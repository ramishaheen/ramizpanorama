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

    // Fetch latest intel data for context
    const [airspaceRes, geoRes, rocketsRes, riskRes, vesselsRes] = await Promise.all([
      supabase.from("airspace_alerts").select("*").eq("active", true).limit(10),
      supabase.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(10),
      supabase.from("rockets").select("*").order("timestamp", { ascending: false }).limit(10),
      supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
      supabase.from("vessels").select("*").limit(10),
    ]);

    const intelSummary = {
      activeAirspaceAlerts: airspaceRes.data?.length || 0,
      airspaceDetails: airspaceRes.data?.map(a => `${a.type} in ${a.region} (${a.severity})`).join("; "),
      recentGeoAlerts: geoRes.data?.map(a => `${a.type}: ${a.title} (${a.severity})`).join("; "),
      activeRockets: rocketsRes.data?.filter(r => r.status === "launched" || r.status === "in_flight").length || 0,
      rocketDetails: rocketsRes.data?.map(r => `${r.name} [${r.type}] - ${r.status}`).join("; "),
      riskScore: riskRes.data?.[0] || {},
      militaryVessels: vesselsRes.data?.filter(v => v.type === "MILITARY").length || 0,
      totalVessels: vesselsRes.data?.length || 0,
    };

    const systemPrompt = `You are a senior geopolitical financial analyst specializing in conflict-driven market impacts. You analyze real-time intelligence data from the Iran war theater and provide actionable stock/commodity/trade predictions.

IMPORTANT RULES:
- Base predictions ONLY on the intelligence data provided
- Include specific ticker symbols when possible
- Rate confidence as LOW/MEDIUM/HIGH
- Include both SHORT-TERM (24-48h) and MEDIUM-TERM (1-2 weeks) predictions
- Cover: Oil & Energy, Defense/Aerospace, Currencies, Gold/Commodities, Shipping/Logistics, Regional Markets, Cryptocurrency (BTC, ETH, and other relevant crypto assets)
- Be concise, use bullet points
- Add a risk disclaimer at the end
- Return your response as valid JSON with this structure:
{
  "timestamp": "ISO timestamp",
  "overall_market_sentiment": "BEARISH/BULLISH/MIXED",
  "predictions": [
    {
      "sector": "string",
      "ticker": "string or null",
      "direction": "UP/DOWN/VOLATILE",
      "confidence": "LOW/MEDIUM/HIGH",
      "timeframe": "SHORT/MEDIUM",
      "rationale": "brief explanation"
    }
  ],
  "key_insight": "one-sentence top takeaway",
  "risk_level": "LOW/MEDIUM/HIGH/EXTREME"
}`;

    const userPrompt = `Here is the current real-time intelligence from the Iran conflict theater. Generate market/stock/trade predictions based on this data:

SITUATION OVERVIEW:
- Active Airspace Closures/Alerts: ${intelSummary.activeAirspaceAlerts}
- Details: ${intelSummary.airspaceDetails || "None"}
- Recent Geo Alerts: ${intelSummary.recentGeoAlerts || "None"}  
- Active Rockets/Missiles: ${intelSummary.activeRockets}
- Rocket Details: ${intelSummary.rocketDetails || "None"}
- Military Vessels in Theater: ${intelSummary.militaryVessels} of ${intelSummary.totalVessels} total
- Overall Risk Score: ${intelSummary.riskScore?.overall || "N/A"}/100
- Risk Trend: ${intelSummary.riskScore?.trend || "N/A"}
- Airspace Risk: ${intelSummary.riskScore?.airspace || "N/A"}
- Maritime Risk: ${intelSummary.riskScore?.maritime || "N/A"}
- Diplomatic Risk: ${intelSummary.riskScore?.diplomatic || "N/A"}
- Sentiment Score: ${intelSummary.riskScore?.sentiment || "N/A"}

Generate predictions now.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let predictions;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      predictions = JSON.parse(jsonMatch[1].trim());
    } catch {
      predictions = { raw: content, predictions: [], key_insight: "Analysis pending", risk_level: "MEDIUM", overall_market_sentiment: "MIXED" };
    }

    return new Response(JSON.stringify(predictions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Prediction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
