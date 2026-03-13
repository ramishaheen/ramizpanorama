import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_STAC_API = "https://earth-search.aws.element84.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action } = body;
    const stacBase = body.stac_endpoint || DEFAULT_STAC_API;

    // ── SEARCH: Query STAC catalog ──
    if (action === "search") {
      const { bbox, datetime, collections, limit = 10, query: stacQuery } = body;

      const searchBody: any = { limit };
      if (bbox) searchBody.bbox = bbox;
      if (datetime) searchBody.datetime = datetime;
      if (collections) searchBody.collections = collections;
      if (stacQuery) searchBody.query = stacQuery;

      const resp = await fetch(`${stacBase}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchBody),
      });

      if (!resp.ok) throw new Error(`STAC search failed: ${resp.status} ${await resp.text()}`);
      const data = await resp.json();

      const features = (data.features || []).map((f: any) => ({
        id: f.id,
        collection: f.collection,
        datetime: f.properties?.datetime,
        bbox: f.bbox,
        geometry: f.geometry,
        cloud_cover: f.properties?.["eo:cloud_cover"],
        gsd: f.properties?.gsd,
        platform: f.properties?.platform,
        constellation: f.properties?.constellation,
        thumbnail: f.assets?.thumbnail?.href || f.assets?.overview?.href || null,
        visual_href: f.assets?.visual?.href || f.assets?.["true-color"]?.href || null,
        asset_keys: Object.keys(f.assets || {}),
      }));

      return new Response(JSON.stringify({
        type: "FeatureCollection",
        numberMatched: data.numberMatched || features.length,
        numberReturned: features.length,
        features,
        stac_endpoint: stacBase,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ITEM: Fetch single STAC item ──
    if (action === "item") {
      const { collection, item_id } = body;
      if (!collection || !item_id) throw new Error("collection and item_id required");

      const resp = await fetch(`${stacBase}/collections/${collection}/items/${item_id}`);
      if (!resp.ok) throw new Error(`STAC item fetch failed: ${resp.status}`);
      const item = await resp.json();

      return new Response(JSON.stringify({
        id: item.id,
        collection: item.collection,
        properties: item.properties,
        geometry: item.geometry,
        bbox: item.bbox,
        assets: Object.fromEntries(
          Object.entries(item.assets || {}).map(([k, v]: [string, any]) => [k, {
            href: v.href,
            type: v.type,
            title: v.title,
            roles: v.roles,
          }])
        ),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── INGEST_DETECTIONS: AI analysis of satellite imagery ──
    if (action === "ingest_detections") {
      const { collection, item_id, feed_id } = body;
      if (!collection || !item_id) throw new Error("collection and item_id required");

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Fetch thumbnail
      const itemResp = await fetch(`${stacBase}/collections/${collection}/items/${item_id}`);
      if (!itemResp.ok) throw new Error(`STAC item fetch failed: ${itemResp.status}`);
      const item = await itemResp.json();

      const thumbUrl = item.assets?.thumbnail?.href || item.assets?.overview?.href;
      if (!thumbUrl) throw new Error("No thumbnail available for this item");

      const center = item.bbox
        ? [(item.bbox[1] + item.bbox[3]) / 2, (item.bbox[0] + item.bbox[2]) / 2]
        : [0, 0];

      // AI analysis
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a military satellite imagery analyst. Analyze the satellite image and detect military objects (vehicles, installations, aircraft, ships, camps). Return structured detections.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Analyze this satellite image from ${item.properties?.platform || "unknown"} captured at ${item.properties?.datetime || "unknown"}. Center coordinates: ${center[0].toFixed(4)}, ${center[1].toFixed(4)}. Detect any military-relevant objects.` },
                { type: "image_url", image_url: { url: thumbUrl } },
              ],
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_detections",
              description: "Report detected military objects in satellite imagery",
              parameters: {
                type: "object",
                properties: {
                  detections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        entity_type: { type: "string", enum: ["vehicle", "aircraft", "ship", "installation", "equipment", "personnel_group", "camp"] },
                        name: { type: "string" },
                        confidence: { type: "number" },
                        description: { type: "string" },
                        offset_lat: { type: "number", description: "Offset from center in degrees" },
                        offset_lng: { type: "number", description: "Offset from center in degrees" },
                      },
                      required: ["entity_type", "name", "confidence", "description"],
                    },
                  },
                  scene_summary: { type: "string" },
                },
                required: ["detections", "scene_summary"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_detections" } },
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const aiData = await aiResp.json();
      let detections: any[] = [];
      let sceneSummary = "";
      try {
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          detections = parsed.detections || [];
          sceneSummary = parsed.scene_summary || "";
        }
      } catch { /* parse error */ }

      // Ingest high-confidence detections into ontology
      const ingested: any[] = [];
      for (const det of detections) {
        if (det.confidence >= 0.6) {
          const entLat = center[0] + (det.offset_lat || 0);
          const entLng = center[1] + (det.offset_lng || 0);

          const { data: ent } = await sb.from("ontology_entities").insert({
            entity_type: det.entity_type || "equipment",
            name: det.name,
            description: det.description,
            lat: entLat,
            lng: entLng,
            confidence: det.confidence,
            affiliation: "unknown",
            source_sensor_id: feed_id || null,
            attributes: {
              source: "stac_satellite",
              stac_item_id: item_id,
              stac_collection: collection,
              platform: item.properties?.platform,
              capture_datetime: item.properties?.datetime,
            },
          }).select().single();

          if (ent) ingested.push(ent);

          // Create target track for high-confidence military detections
          if (det.confidence >= 0.75) {
            await sb.from("target_tracks").insert({
              track_id: `SAT-${item_id.slice(0, 8)}-${Date.now()}`,
              classification: det.entity_type === "vehicle" ? "truck" : det.entity_type === "aircraft" ? "aircraft" : "structure",
              lat: entLat,
              lng: entLng,
              confidence: det.confidence,
              source_sensor: "satellite",
              source_sensor_id: feed_id || null,
              ai_assessment: det.description,
              priority: det.confidence >= 0.9 ? "critical" : "high",
            });
          }
        }
      }

      return new Response(JSON.stringify({
        scene_summary: sceneSummary,
        detections_total: detections.length,
        ingested_count: ingested.length,
        detections,
        stac_item: { id: item_id, collection, platform: item.properties?.platform },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: search, item, ingest_detections" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stac-connector error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
