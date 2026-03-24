import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, lat, lng, source_sensor } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a military intelligence image analyst (IMINT specialist). Analyze the provided imagery and identify military assets.

For each detected object, provide:
- classification: one of tank, truck, missile_launcher, apc, radar, sam_site, artillery, command_post, supply_depot
- confidence: 0.0-1.0
- priority: critical, high, medium, or low
- assessment: brief tactical assessment

Return a JSON array of detections. If no military objects found, return empty array.
Example: [{"classification":"tank","confidence":0.85,"priority":"high","assessment":"T-72 variant in defilade position"}]`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (image_base64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Analyze this satellite/drone imagery at coordinates ${lat?.toFixed(4)}°N, ${lng?.toFixed(4)}°E. Identify all military vehicles, equipment, and installations.` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Simulate automatic target recognition for coordinates ${lat?.toFixed(4)}°N, ${lng?.toFixed(4)}°E. Generate 2-4 realistic military target detections based on the Middle East theater context.`,
      });
    }

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2-thinking",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "report_detections",
            description: "Report detected military targets from imagery analysis",
            parameters: {
              type: "object",
              properties: {
                detections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      classification: { type: "string", enum: ["tank", "truck", "missile_launcher", "apc", "radar", "sam_site", "artillery", "command_post", "supply_depot"] },
                      confidence: { type: "number" },
                      priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      assessment: { type: "string" },
                    },
                    required: ["classification", "confidence", "priority", "assessment"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["detections"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_detections" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let detections: any[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      detections = parsed.detections || [];
    }

    // Store detections in target_tracks
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tracks = detections.map((d: any, i: number) => ({
      track_id: `ATR-${Date.now()}-${i}`,
      classification: d.classification,
      confidence: d.confidence,
      lat: lat + (Math.random() - 0.5) * 0.02,
      lng: lng + (Math.random() - 0.5) * 0.02,
      source_sensor: source_sensor || "satellite",
      status: "detected",
      priority: d.priority,
      ai_assessment: d.assessment,
    }));

    if (tracks.length > 0) {
      await supabase.from("target_tracks").insert(tracks);
    }

    return new Response(JSON.stringify({ detections: tracks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("c2-targeting error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
