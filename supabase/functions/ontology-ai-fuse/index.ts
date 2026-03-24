import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    if (!NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY not configured");

    // Query 6 tables in parallel
    const [entitiesRes, eventsRes, alertsRes, targetsRes, unitsRes, actionsRes] = await Promise.all([
      sb.from("ontology_entities").select("*").order("ingestion_time", { ascending: false }).limit(50),
      sb.from("intel_events").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(50),
      sb.from("target_tracks").select("*").order("detected_at", { ascending: false }).limit(50),
      sb.from("force_units").select("*").order("last_updated", { ascending: false }).limit(50),
      sb.from("action_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const entities = entitiesRes.data || [];
    const events = eventsRes.data || [];
    const alerts = alertsRes.data || [];
    const targets = targetsRes.data || [];
    const units = unitsRes.data || [];
    const actions = actionsRes.data || [];

    const sourceCounts = {
      ontology_entities: entities.length,
      intel_events: events.length,
      geo_alerts: alerts.length,
      target_tracks: targets.length,
      force_units: units.length,
      action_logs: actions.length,
    };

    const totalItems = Object.values(sourceCounts).reduce((a, b) => a + b, 0);
    if (totalItems === 0) {
      return new Response(JSON.stringify({ message: "No data to fuse", sourceCounts, discovered_entities: 0, discovered_relations: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build intelligence snapshot
    const lines: string[] = [];
    lines.push("=== ONTOLOGY ENTITIES ===");
    entities.forEach((e: any) => lines.push(`[ENT:${e.id}] ${e.name} (${e.entity_type}, ${e.affiliation}) @ ${e.lat.toFixed(3)},${e.lng.toFixed(3)} conf=${e.confidence} status=${e.status}`));

    lines.push("\n=== INTEL EVENTS ===");
    events.forEach((e: any) => lines.push(`[EVT:${e.id}] "${e.title}" type=${e.event_type} severity=${e.severity} @ ${e.lat.toFixed(3)},${e.lng.toFixed(3)} ${e.summary?.slice(0, 80) || ""}`));

    lines.push("\n=== GEO ALERTS ===");
    alerts.forEach((a: any) => lines.push(`[ALR:${a.id}] "${a.title}" type=${a.type} severity=${a.severity} @ ${a.lat.toFixed(3)},${a.lng.toFixed(3)} region=${a.region}`));

    lines.push("\n=== TARGET TRACKS ===");
    targets.forEach((t: any) => lines.push(`[TGT:${t.id}] track=${t.track_id} class=${t.classification} priority=${t.priority} @ ${t.lat.toFixed(3)},${t.lng.toFixed(3)} conf=${t.confidence} status=${t.status}`));

    lines.push("\n=== FORCE UNITS ===");
    units.forEach((u: any) => lines.push(`[UNIT:${u.id}] ${u.name} type=${u.unit_type} affil=${u.affiliation} @ ${u.lat.toFixed(3)},${u.lng.toFixed(3)} status=${u.status}`));

    lines.push("\n=== ACTION LOGS (BDA) ===");
    actions.forEach((a: any) => lines.push(`[BDA:${a.id}] effect=${a.effect} @ ${a.lat.toFixed(3)},${a.lng.toFixed(3)} target=${a.target_track_id || "N/A"} decision_time=${a.decision_time_sec}s`));

    const snapshot = lines.join("\n");

    const aiResp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2-thinking",
        messages: [
          {
            role: "system",
            content: `You are a military intelligence fusion engine. Analyze a multi-source intelligence snapshot and discover:
1. NEW ENTITIES implied by events/alerts/BDA that don't exist in the ontology yet (e.g., a strike event implies a weapon system; a geo alert implies a threat).
2. CROSS-LAYER RELATIONSHIPS between existing entities, events, targets, units, and BDA logs.

Relationship types available: occupies, commands, observes, targets, transports, supplies, defends, attacks, impacts, caused_by, assessed_by, observed_at, threatens, defends_against.

For relationships, use the IDs from the snapshot. source_id and target_id can be entity IDs (ENT:), event IDs (EVT:), alert IDs (ALR:), target IDs (TGT:), unit IDs (UNIT:), or BDA IDs (BDA:).
Strip the prefix — return only the UUID.

Focus on proximity (entities/events within ~50km), semantic connections, and causal chains.`
          },
          { role: "user", content: `Analyze this intelligence snapshot and discover entities and relationships:\n\n${snapshot}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_fusion",
            description: "Report discovered entities and cross-layer relationships",
            parameters: {
              type: "object",
              properties: {
                discovered_entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      entity_type: { type: "string", enum: ["equipment", "facility", "unit", "person", "vehicle", "infrastructure", "weapon_system"] },
                      affiliation: { type: "string", enum: ["blue", "red", "neutral", "unknown"] },
                      lat: { type: "number" },
                      lng: { type: "number" },
                      description: { type: "string" },
                      confidence: { type: "number" },
                      implied_by: { type: "string", description: "ID of the event/alert/BDA that implies this entity" },
                    },
                    required: ["name", "entity_type", "affiliation", "lat", "lng", "description", "confidence"],
                  },
                },
                discovered_relations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source_entity_id: { type: "string", description: "UUID of source entity (must be an ontology_entities ID)" },
                      target_entity_id: { type: "string", description: "UUID of target entity (must be an ontology_entities ID)" },
                      relationship_type: { type: "string", enum: ["occupies", "commands", "observes", "targets", "transports", "supplies", "defends", "attacks", "impacts", "caused_by", "assessed_by", "observed_at", "threatens", "defends_against"] },
                      confidence: { type: "number" },
                      reason: { type: "string" },
                    },
                    required: ["source_entity_id", "target_entity_id", "relationship_type", "confidence", "reason"],
                  },
                },
                analysis_summary: { type: "string", description: "Brief intelligence assessment of the cross-layer picture" },
              },
              required: ["discovered_entities", "discovered_relations", "analysis_summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_fusion" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResp.json();
    let fusion = { discovered_entities: [] as any[], discovered_relations: [] as any[], analysis_summary: "" };
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) fusion = JSON.parse(toolCall.function.arguments);
    } catch { /* parse error */ }

    // Insert discovered entities
    let newEntCount = 0;
    const newEntityIdMap: Record<string, string> = {};
    for (const ent of fusion.discovered_entities) {
      const { data: inserted, error } = await sb.from("ontology_entities").insert({
        name: ent.name,
        entity_type: ent.entity_type,
        affiliation: ent.affiliation,
        lat: ent.lat,
        lng: ent.lng,
        description: ent.description || "",
        confidence: ent.confidence || 0.6,
        status: "active",
        attributes: { ai_discovered: true, implied_by: ent.implied_by || "fusion" },
        event_time: new Date().toISOString(),
        ingestion_time: new Date().toISOString(),
      }).select().single();
      if (!error && inserted) {
        newEntCount++;
        newEntityIdMap[ent.name] = inserted.id;
      }
    }

    // Insert discovered relationships (only between valid ontology entity IDs)
    const entityIds = new Set(entities.map((e: any) => e.id));
    // Also add newly created entity IDs
    Object.values(newEntityIdMap).forEach(id => entityIds.add(id));

    let newRelCount = 0;
    for (const rel of fusion.discovered_relations) {
      const srcId = rel.source_entity_id;
      const tgtId = rel.target_entity_id;
      if (!entityIds.has(srcId) || !entityIds.has(tgtId)) continue;
      if (srcId === tgtId) continue;

      const { error } = await sb.from("ontology_relationships").insert({
        source_entity_id: srcId,
        target_entity_id: tgtId,
        relationship_type: rel.relationship_type,
        confidence: rel.confidence || 0.5,
        metadata: { ai_reason: rel.reason, source: "ai_fusion" },
      });
      if (!error) newRelCount++;
    }

    return new Response(JSON.stringify({
      discovered_entities: newEntCount,
      discovered_relations: newRelCount,
      analysis_summary: fusion.analysis_summary,
      sourceCounts,
      ai_relations: fusion.discovered_relations,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Ontology AI Fuse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
