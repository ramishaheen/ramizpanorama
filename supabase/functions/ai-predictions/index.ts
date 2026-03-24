import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const fallbackPredictions = {
  timestamp: new Date().toISOString(),
  overall_market_sentiment: "MIXED",
  predictions: [
    {
      sector: "Energy",
      ticker: "XLE",
      direction: "VOLATILE",
      recommendation: "HOLD",
      confidence: "MEDIUM",
      timeframe: "SHORT",
      rationale: "Regional risk remains elevated; wait for clearer directional confirmation.",
    },
    {
      sector: "Defense",
      ticker: "ITA",
      direction: "UP",
      recommendation: "BUY",
      confidence: "MEDIUM",
      timeframe: "SHORT",
      rationale: "Heightened geopolitical uncertainty continues to support defense demand.",
    },
  ],
  key_insight: "Markets are reacting to headline risk with defensive rotation.",
  risk_level: "HIGH",
  _fallback: true,
};

let cachedPredictionResult: any = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 120_000;

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "moonshotai/kimi-k2-thinking", messages }),
      signal: controller.signal,
    });

    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI_UNAVAILABLE");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_UNAVAILABLE");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [airspaceRes, geoRes, rocketsRes, riskRes, vesselsRes] = await Promise.all([
      supabase.from("airspace_alerts").select("*").eq("active", true).limit(10),
      supabase.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(10),
      supabase.from("rockets").select("*").order("timestamp", { ascending: false }).limit(10),
      supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
      supabase.from("vessels").select("*").limit(10),
    ]);

    const intelSummary = {
      activeAirspaceAlerts: airspaceRes.data?.length || 0,
      activeRockets: rocketsRes.data?.filter(r => r.status === "launched" || r.status === "in_flight").length || 0,
      militaryVessels: vesselsRes.data?.filter(v => v.type === "MILITARY").length || 0,
      riskScore: riskRes.data?.[0] || {},
    };

    const systemPrompt = `You are a senior geopolitical financial analyst. Analyze real-time intelligence data and provide actionable stock/commodity/trade predictions.

Return valid JSON:
{
  "timestamp": "ISO timestamp",
  "overall_market_sentiment": "BEARISH/BULLISH/MIXED",
  "predictions": [
    { "sector": "string", "ticker": "string or null", "direction": "UP/DOWN/VOLATILE", "recommendation": "STRONG BUY/BUY/HOLD/SELL/STRONG SELL", "confidence": "LOW/MEDIUM/HIGH", "timeframe": "SHORT/MEDIUM", "rationale": "brief" }
  ],
  "key_insight": "one-sentence takeaway",
  "risk_level": "LOW/MEDIUM/HIGH/EXTREME"
}`;

    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Intelligence: ${JSON.stringify(intelSummary)}. Generate market predictions now.` },
    ]);

    let predictions;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const objMatch = (jsonMatch[1] || content).trim().match(/\{[\s\S]*\}/);
      predictions = JSON.parse(objMatch ? objMatch[0] : (jsonMatch[1] || content).trim());
    } catch {
      predictions = { predictions: [], key_insight: "Analysis pending", risk_level: "MEDIUM", overall_market_sentiment: "MIXED" };
    }

    cachedPredictionResult = { ...predictions, timestamp: predictions?.timestamp || new Date().toISOString() };
    cacheTimestamp = Date.now();

    return new Response(JSON.stringify(cachedPredictionResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "RATE_LIMIT" || e.message === "PAYMENT_REQUIRED")) {
      const cached = cachedPredictionResult && Date.now() - cacheTimestamp < CACHE_TTL_MS ? cachedPredictionResult : null;
      return new Response(JSON.stringify(cached || fallbackPredictions), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Prediction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
