import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedEscalationResult: any = null;
let escalationCacheTs = 0;
const ESCALATION_CACHE_TTL_MS = 86_400_000; // 24 hours

const fallbackEscalation = {
  timestamp: new Date().toISOString(),
  current_escalation_level: { kahn_rung: 16, label: "Limited Theater Escalation", description: "Sustained regional tensions with intermittent flare-ups." },
  overall_escalation_probability: 62,
  trend: "STABLE",
  trend_velocity: "MODERATE",
  scenarios: [],
  escalation_indicators: [],
  conflict_phases: [],
  key_assessment: "Escalation risk remains elevated but without confirmed immediate breakout.",
  next_24h_outlook: "Expect headline-driven volatility and localized incidents.",
  recommended_posture: "ELEVATED",
  _fallback: true,
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gemini-2.5-flash", messages }),
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

    const [airspaceRes, geoRes, rocketsRes, riskRes, vesselsRes, timelineRes] = await Promise.all([
      supabase.from("airspace_alerts").select("*").eq("active", true).limit(20),
      supabase.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(20),
      supabase.from("rockets").select("*").order("timestamp", { ascending: false }).limit(30),
      supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
      supabase.from("vessels").select("*").limit(20),
      supabase.from("timeline_events").select("*").order("timestamp", { ascending: false }).limit(20),
    ]);

    const rocketsByStatus = {
      launched: rocketsRes.data?.filter(r => r.status === "launched").length || 0,
      in_flight: rocketsRes.data?.filter(r => r.status === "in_flight").length || 0,
      intercepted: rocketsRes.data?.filter(r => r.status === "intercepted").length || 0,
      impact: rocketsRes.data?.filter(r => r.status === "impact").length || 0,
    };

    const rocketTypes: Record<string, number> = {};
    rocketsRes.data?.forEach(r => { rocketTypes[r.type] = (rocketTypes[r.type] || 0) + 1; });

    const militaryVessels = vesselsRes.data?.filter(v => v.type === "MILITARY") || [];
    const geoByType: Record<string, number> = {};
    geoRes.data?.forEach(a => { geoByType[a.type] = (geoByType[a.type] || 0) + 1; });
    const risk = riskRes.data?.[0];

    const intelContext = `CURRENT INTELLIGENCE SNAPSHOT:
MISSILE ACTIVITY: Total: ${rocketsRes.data?.length || 0}, Active: ${rocketsByStatus.launched + rocketsByStatus.in_flight}, Intercepted: ${rocketsByStatus.intercepted}, Impacts: ${rocketsByStatus.impact}
AIRSPACE: ${airspaceRes.data?.length || 0} active alerts
GEO ALERTS: ${geoRes.data?.length || 0} total
MARITIME: ${militaryVessels.length} military vessels
RISK: Overall ${risk?.overall || 'N/A'}/100, Trend: ${risk?.trend || 'N/A'}`;

    const systemPrompt = `You are a senior military intelligence analyst and conflict escalation specialist. Analyze the intelligence data and produce a WAR ESCALATION ASSESSMENT.

Return valid JSON with this structure:
{
  "timestamp": "ISO timestamp",
  "current_escalation_level": { "kahn_rung": 1-44, "label": "string", "description": "brief" },
  "overall_escalation_probability": 0-100,
  "trend": "ESCALATING" | "STABLE" | "DE-ESCALATING",
  "trend_velocity": "RAPID" | "MODERATE" | "SLOW",
  "scenarios": [{ "name": "string", "probability": 0-100, "timeline": "string", "description": "string", "triggers": ["string"], "severity": "LOW|MEDIUM|HIGH|CRITICAL|CATASTROPHIC" }],
  "escalation_indicators": [{ "indicator": "string", "significance": "HIGH|MEDIUM|LOW", "direction": "ESCALATORY|DE-ESCALATORY|AMBIGUOUS", "detail": "string" }],
  "conflict_phases": [{ "phase": "string", "status": "ACTIVE|EMERGING|POTENTIAL|PASSED", "probability": 0-100, "timeline": "string" }],
  "historical_analogy": { "conflict": "string", "similarity_score": 0-100, "current_parallel": "string", "lesson": "string" },
  "key_assessment": "2-3 sentence assessment",
  "next_24h_outlook": "brief outlook",
  "recommended_posture": "NORMAL|ELEVATED|HIGH|MAXIMUM"
}`;

    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this intelligence data:\n\n${intelContext}` },
    ]);

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const objMatch = (jsonMatch[1] || content).trim().match(/\{[\s\S]*\}/);
      result = JSON.parse(objMatch ? objMatch[0] : (jsonMatch[1] || content).trim());
    } catch {
      result = {
        overall_escalation_probability: 50, trend: "STABLE",
        key_assessment: content.slice(0, 300), scenarios: [], escalation_indicators: [], conflict_phases: [],
      };
    }

    cachedEscalationResult = { ...result, timestamp: result?.timestamp || new Date().toISOString() };
    escalationCacheTs = Date.now();

    return new Response(JSON.stringify(cachedEscalationResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "RATE_LIMIT" || e.message === "PAYMENT_REQUIRED")) {
      const cached = cachedEscalationResult && Date.now() - escalationCacheTs < ESCALATION_CACHE_TTL_MS ? cachedEscalationResult : null;
      return new Response(JSON.stringify(cached || fallbackEscalation), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Escalation prediction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
