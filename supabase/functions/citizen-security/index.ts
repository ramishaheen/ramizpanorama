import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [geoRes, rocketsRes, riskRes, airspaceRes] = await Promise.all([
      supabase.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(20),
      supabase.from("rockets").select("*").order("timestamp", { ascending: false }).limit(15),
      supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
      supabase.from("airspace_alerts").select("*").eq("active", true).limit(10),
    ]);

    const rocketSummary = rocketsRes.data?.map(r =>
      `${r.name} [${r.type}] from (${r.origin_lat},${r.origin_lng}) → target (${r.target_lat},${r.target_lng}) status:${r.status} speed:${r.speed}km/h`
    ).join("\n") || "None";

    const alertSummary = geoRes.data?.map(a =>
      `[${a.severity}] ${a.type}: ${a.title} in ${a.region} — ${a.summary}`
    ).join("\n") || "None";

    const airspaceSummary = airspaceRes.data?.map(a =>
      `${a.type} in ${a.region} (${a.severity}) — ${a.description}`
    ).join("\n") || "None";

    const risk = riskRes.data?.[0] || {};

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a citizen safety analyst for the Middle East conflict zone. Based on real-time intelligence data including rocket/missile trajectories, geopolitical alerts, airspace closures, and risk scores, you assess citizen safety levels for specific countries.

IMPORTANT RULES:
- Analyze proximity of rocket targets to each country
- Consider airspace closures near each country
- Factor in diplomatic and military alerts in each country's region
- Rate each country on a scale: SAFE (green), CAUTION (yellow), ELEVATED (orange), DANGER (red), CRITICAL (dark red)
- Provide a safety score 0-100 (100 = safest)
- Give a brief one-line status for each country
- Consider that rockets from Iran primarily threaten countries in their trajectory path

Return ONLY valid JSON with this exact structure:
{
  "countries": [
    {
      "code": "AE",
      "name": "UAE",
      "safety_score": 75,
      "level": "CAUTION",
      "status": "brief one-line description",
      "threats": ["threat1", "threat2"]
    }
  ],
  "overall_assessment": "one paragraph regional assessment",
  "last_analyzed": "ISO timestamp"
}`
          },
          {
            role: "user",
            content: `Analyze citizen safety for these countries: UAE, Jordan, Saudi Arabia (KSA), Bahrain, Oman, Kuwait, Qatar, Yemen, Iraq, Lebanon.

CURRENT INTELLIGENCE:

ROCKETS/MISSILES IN THEATER:
${rocketSummary}

GEOPOLITICAL ALERTS:
${alertSummary}

AIRSPACE STATUS:
${airspaceSummary}

RISK SCORES:
- Overall: ${risk.overall || 'N/A'}/100
- Airspace: ${risk.airspace || 'N/A'}/100
- Maritime: ${risk.maritime || 'N/A'}/100
- Diplomatic: ${risk.diplomatic || 'N/A'}/100
- Sentiment: ${risk.sentiment || 'N/A'}/100
- Trend: ${risk.trend || 'N/A'}

Assess citizen safety now.`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1].trim());
    } catch {
      result = { countries: [], overall_assessment: "Analysis pending", error: "Failed to parse AI response" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Citizen security error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
