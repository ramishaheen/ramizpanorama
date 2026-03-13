import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action } = body;

    // ── HEALTH: Return all sensor feed statuses ──
    if (action === "health") {
      const { data, error } = await sb.from("sensor_feeds").select("*").order("feed_type");
      if (error) throw error;

      const byType: Record<string, { total: number; active: number; degraded: number; offline: number }> = {};
      (data || []).forEach((f: any) => {
        const cat = f.feed_type.split("_")[0];
        if (!byType[cat]) byType[cat] = { total: 0, active: 0, degraded: 0, offline: 0 };
        byType[cat].total++;
        if (f.status === "active") byType[cat].active++;
        else if (f.status === "degraded") byType[cat].degraded++;
        else byType[cat].offline++;
      });

      return new Response(JSON.stringify({ feeds: data, summary: byType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PULSE: Refresh sensor feed timestamps to simulate live data ──
    if (action === "pulse") {
      const { data: activeFeeds, error: pErr } = await sb.from("sensor_feeds")
        .select("id, health_score, status")
        .in("status", ["active", "degraded"]);
      if (pErr) throw pErr;

      let updated = 0;
      for (const feed of (activeFeeds || [])) {
        const jitter = (Math.random() - 0.5) * 6; // ±3%
        const newHealth = Math.max(50, Math.min(100, feed.health_score + jitter));
        await sb.from("sensor_feeds").update({
          last_data_at: new Date().toISOString(),
          health_score: Math.round(newHealth),
        }).eq("id", feed.id);
        updated++;
      }

      return new Response(JSON.stringify({ pulsed: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── INGEST: Accept sensor data, normalize, create/update ontology entities ──
    if (action === "ingest") {
      const { feed_id, detections } = body;
      if (!detections?.length) throw new Error("detections[] required");

      let feed: any = null;
      if (feed_id) {
        const { data: f, error: feedErr } = await sb.from("sensor_feeds").select("*").eq("id", feed_id).single();
        if (feedErr || !f) throw new Error("Sensor feed not found");
        feed = f;
      }

      const results: any[] = [];

      for (const det of detections) {
        // Check proximity to existing entities (haversine < 500m)
        const { data: nearby } = await sb.from("ontology_entities")
          .select("*")
          .gte("lat", det.lat - 0.005)
          .lte("lat", det.lat + 0.005)
          .gte("lng", det.lng - 0.005)
          .lte("lng", det.lng + 0.005)
          .limit(5);

        const match = (nearby || []).find((e: any) =>
          e.name === det.name || (e.entity_type === det.entity_type && haversine(e.lat, e.lng, det.lat, det.lng) < 500)
        );

        if (match) {
          // Merge: update confidence and last_known_at
          const newConf = Math.min(1, (match.confidence + (det.confidence || 0.5)) / 2 + 0.1);
          await sb.from("ontology_entities").update({
            confidence: newConf,
            last_known_at: new Date().toISOString(),
            ingestion_time: new Date().toISOString(),
            source_sensor_id: feed_id,
            attributes: { ...match.attributes, ...(det.attributes || {}) },
          }).eq("id", match.id);
          results.push({ action: "merged", entity_id: match.id, confidence: newConf });
        } else {
          // Create new entity
          const { data: newEnt, error: entErr } = await sb.from("ontology_entities").insert({
            entity_type: det.entity_type || "equipment",
            name: det.name || `Detection ${Date.now()}`,
            designation: det.designation || "",
            description: det.description || "",
            lat: det.lat,
            lng: det.lng,
            affiliation: det.affiliation || "unknown",
            attributes: det.attributes || {},
            source_sensor_id: feed_id,
            confidence: det.confidence || 0.5,
            status: "active",
            event_time: det.event_time || new Date().toISOString(),
            ingestion_time: new Date().toISOString(),
          }).select().single();
          if (entErr) throw entErr;
          results.push({ action: "created", entity_id: newEnt?.id });
        }
      }

      // Update feed last_data_at if feed_id provided
      if (feed_id) {
        await sb.from("sensor_feeds").update({ last_data_at: new Date().toISOString() }).eq("id", feed_id);
      }

      return new Response(JSON.stringify({ results, count: results.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTO_CORRELATE: AI-driven multi-INT correlation ──
    if (action === "auto_correlate") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Get recent entities without high confidence
      const { data: entities } = await sb.from("ontology_entities")
        .select("*")
        .lt("confidence", 0.8)
        .order("ingestion_time", { ascending: false })
        .limit(20);

      if (!entities?.length) {
        return new Response(JSON.stringify({ message: "No entities need correlation", correlations: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const entSummary = entities.map((e: any) => `${e.name} (${e.entity_type}, ${e.affiliation}) at ${e.lat.toFixed(3)},${e.lng.toFixed(3)} conf=${e.confidence}`).join("\n");

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a multi-INT correlation engine. Given a list of detected entities, identify which ones likely refer to the same real-world object based on proximity, type, and context. Return JSON array of correlations: [{entity_ids: [id1, id2], reason: string, merged_confidence: number}]" },
            { role: "user", content: `Correlate these entities:\n${entSummary}\n\nEntity IDs: ${entities.map((e: any) => e.id).join(", ")}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_correlations",
              description: "Report multi-INT correlations between entities",
              parameters: {
                type: "object",
                properties: {
                  correlations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        entity_ids: { type: "array", items: { type: "string" } },
                        reason: { type: "string" },
                        merged_confidence: { type: "number" },
                      },
                      required: ["entity_ids", "reason", "merged_confidence"],
                    },
                  },
                },
                required: ["correlations"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_correlations" } },
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResp.json();
      let correlations: any[] = [];
      try {
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) correlations = JSON.parse(toolCall.function.arguments).correlations || [];
      } catch { /* parse error */ }

      return new Response(JSON.stringify({ correlations, entity_count: entities.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ENTITIES: Get ontology entities ──
    if (action === "entities") {
      const { entity_type, limit = 100 } = body;
      let query = sb.from("ontology_entities").select("*").order("ingestion_time", { ascending: false }).limit(limit);
      if (entity_type) query = query.eq("entity_type", entity_type);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ entities: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RELATIONSHIPS: Get ontology relationships ──
    if (action === "relationships") {
      const { entity_id, limit = 50 } = body;
      let query = sb.from("ontology_relationships").select("*").order("created_at", { ascending: false }).limit(limit);
      if (entity_id) query = query.or(`source_entity_id.eq.${entity_id},target_entity_id.eq.${entity_id}`);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ relationships: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sensor ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
