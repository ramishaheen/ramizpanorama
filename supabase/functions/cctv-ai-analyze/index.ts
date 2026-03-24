import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");
  if (!NVIDIA_API_KEY) {
    return new Response(JSON.stringify({ error: "NVIDIA_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action } = body;

    // ── ANALYZE: AI analysis of a camera thumbnail ──
    if (action === "analyze") {
      const { camera_id } = body;
      if (!camera_id) throw new Error("camera_id required");

      const { data: cam, error: camErr } = await sb.from("cameras").select("*").eq("id", camera_id).single();
      if (camErr || !cam) throw new Error("Camera not found");

      const ytId = cam.youtube_video_id;
      const thumbnailUrl = ytId
        ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`
        : cam.thumbnail_url || cam.snapshot_url;

      if (!thumbnailUrl) throw new Error("No thumbnail available for analysis");

      const systemPrompt = `You are a CCTV surveillance AI analyst. Analyze camera images and detect:
- People (count and positions)
- Vehicles (cars, trucks, motorcycles, buses)
- Smoke or fire
- Crowd density (low/medium/high/critical)
- Traffic congestion level
- Any abnormal activity or security concerns
- Weather/visibility conditions

Return ONLY valid JSON with this exact structure:
{
  "detections": [
    {"type": "person|vehicle|truck|motorcycle|smoke|fire|crowd", "count": number, "confidence": 0.0-1.0, "description": "brief description"}
  ],
  "crowd_density": "none|low|medium|high|critical",
  "traffic_level": "none|light|moderate|heavy|gridlock",
  "visibility": "clear|hazy|foggy|dark|rain",
  "abnormal_activity": false,
  "abnormal_description": "",
  "overall_severity": "low|medium|high|critical",
  "summary": "One-line summary of scene",
  "event_type": "normal|person_detected|vehicle_detected|crowd_detected|fire_detected|smoke_detected|abnormal_activity|traffic_congestion"
}`;

      const userText = `Analyze this CCTV camera feed from ${cam.name} in ${cam.city}, ${cam.country}. The camera thumbnail URL is: ${thumbnailUrl}. Detect all objects, people, vehicles, and any security concerns.`;

      const aiResponse = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "moonshotai/kimi-k2-thinking",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText },
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiResponse.text();
        console.error("NVIDIA API error:", aiResponse.status, errText);
        throw new Error(`AI analysis failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const rawContent = aiData.choices?.[0]?.message?.content || "";

      // Parse JSON from response (strip thinking tags if present)
      let analysis;
      try {
        const cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        analysis = null;
      }

      if (!analysis) {
        return new Response(JSON.stringify({ error: "Failed to parse AI analysis", raw: rawContent }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store event if noteworthy
      const isNoteworthy = analysis.event_type !== "normal" || analysis.overall_severity !== "low";
      if (isNoteworthy) {
        await sb.from("camera_events").insert({
          camera_id: cam.id,
          event_type: analysis.event_type || "unknown",
          confidence: analysis.detections?.[0]?.confidence || 0.5,
          detections: analysis.detections || [],
          summary: analysis.summary || "",
          severity: analysis.overall_severity || "low",
          thumbnail_url: thumbnailUrl,
          lat: cam.lat || 0,
          lng: cam.lng || 0,
        });
      }

      await sb.from("cameras").update({
        last_ai_analysis_at: new Date().toISOString(),
        ai_event_count: (cam.ai_event_count || 0) + (isNoteworthy ? 1 : 0),
        ai_detection_enabled: true,
      }).eq("id", cam.id);

      return new Response(JSON.stringify({
        analysis,
        camera: { id: cam.id, name: cam.name, city: cam.city, country: cam.country },
        thumbnail_url: thumbnailUrl,
        stored_event: isNoteworthy,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EVENTS: Get recent events ──
    if (action === "events") {
      const { camera_id, limit = 50 } = body;
      let query = sb.from("camera_events").select("*").order("created_at", { ascending: false }).limit(limit);
      if (camera_id) query = query.eq("camera_id", camera_id);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ events: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATS: Get event statistics ──
    if (action === "stats") {
      const { data: events } = await sb.from("camera_events").select("event_type, severity, created_at").order("created_at", { ascending: false }).limit(500);
      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      (events || []).forEach(e => {
        byType[e.event_type] = (byType[e.event_type] || 0) + 1;
        bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
      });
      return new Response(JSON.stringify({
        total_events: events?.length || 0,
        by_type: byType,
        by_severity: bySeverity,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("CCTV AI error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
