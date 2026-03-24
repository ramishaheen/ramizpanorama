import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

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

// In-memory cache to avoid hammering the AI gateway
let cachedResult: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 86_400_000; // 24 hours

const fallbackCitizenSecurity = {
  countries: [
    { code: "AE", name: "UAE", safety_score: 72, level: "CAUTION", status: "Heightened regional vigilance; daily activity continues.", threats: ["Regional missile risk", "Airspace uncertainty"] },
    { code: "JO", name: "Jordan", safety_score: 64, level: "ELEVATED", status: "Border monitoring increased due to nearby incidents.", threats: ["Border spillover risk"] },
    { code: "SA", name: "Saudi Arabia", safety_score: 68, level: "CAUTION", status: "Critical infrastructure remains protected with elevated readiness.", threats: ["Maritime and missile escalation"] },
    { code: "BH", name: "Bahrain", safety_score: 58, level: "ELEVATED", status: "Security posture is elevated amid regional tensions.", threats: ["Proxy escalation"] },
    { code: "OM", name: "Oman", safety_score: 74, level: "CAUTION", status: "Relatively stable with precautionary monitoring.", threats: ["Regional volatility"] },
    { code: "KW", name: "Kuwait", safety_score: 63, level: "ELEVATED", status: "Security checks increased around strategic sites.", threats: ["Cross-border escalation"] },
    { code: "QA", name: "Qatar", safety_score: 69, level: "CAUTION", status: "Operational continuity with enhanced alertness.", threats: ["Airspace disruption risk"] },
    { code: "YE", name: "Yemen", safety_score: 28, level: "CRITICAL", status: "Severe instability and active conflict conditions.", threats: ["Armed conflict", "Humanitarian crisis"] },
    { code: "IQ", name: "Iraq", safety_score: 35, level: "DANGER", status: "Frequent incidents and elevated militia activity.", threats: ["Rocket attacks", "Civil instability"] },
    { code: "LB", name: "Lebanon", safety_score: 42, level: "DANGER", status: "Border tensions and political fragility persist.", threats: ["Border clashes", "Infrastructure strain"] },
  ],
  overall_assessment: "Regional security is volatile; travelers should monitor official advisories continuously.",
  last_analyzed: new Date().toISOString(),
  _fallback: true,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Return cached result if fresh
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cachedResult.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
      `${r.name} [${r.type}] status:${r.status}`
    ).join("; ") || "None";

    const alertSummary = geoRes.data?.map(a =>
      `[${a.severity}] ${a.type}: ${a.title} in ${a.region}`
    ).join("; ") || "None";

    const airspaceSummary = airspaceRes.data?.map(a =>
      `${a.type} in ${a.region} (${a.severity})`
    ).join("; ") || "None";

    const risk = riskRes.data?.[0] || {};

    const content = await callAI([
      {
        role: "system",
        content: `You are a citizen safety analyst for the Middle East conflict zone. Assess citizen safety levels for specific countries.

Return ONLY valid JSON:
{
  "countries": [
    { "code": "AE", "name": "UAE", "safety_score": 75, "level": "CAUTION", "status": "brief description", "threats": ["threat1"] }
  ],
  "overall_assessment": "one paragraph regional assessment",
  "last_analyzed": "ISO timestamp"
}`
      },
      {
        role: "user",
        content: `Analyze citizen safety for: UAE, Jordan, Saudi Arabia, Bahrain, Oman, Kuwait, Qatar, Yemen, Iraq, Lebanon.

ROCKETS: ${rocketSummary}
GEO ALERTS: ${alertSummary}
AIRSPACE: ${airspaceSummary}
RISK: Overall ${risk.overall || 'N/A'}/100, Trend: ${risk.trend || 'N/A'}`
      }
    ]);

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const objMatch = (jsonMatch[1] || content).trim().match(/\{[\s\S]*\}/);
      result = JSON.parse(objMatch ? objMatch[0] : (jsonMatch[1] || content).trim());
    } catch {
      result = { countries: [], overall_assessment: "Analysis pending", error: "Failed to parse" };
    }

    // Cache the result
    cachedResult = { data: result, timestamp: Date.now() };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "RATE_LIMIT" || e.message === "PAYMENT_REQUIRED")) {
      const cached = cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS ? cachedResult.data : null;
      return new Response(JSON.stringify(cached || fallbackCitizenSecurity), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Error && e.message === "AI_UNAVAILABLE") {
      return new Response(JSON.stringify({
        countries: [], overall_assessment: "AI analysis temporarily unavailable.",
        last_analyzed: new Date().toISOString(), error: "AI temporarily unavailable"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.error("Citizen security error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
