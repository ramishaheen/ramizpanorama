import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("No AI provider available");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });

  if (response.status === 429) throw new Error("RATE_LIMIT");
  if (response.status === 402) throw new Error("PAYMENT_REQUIRED");

  const text = await response.text();
  if (!response.ok || !text) {
    console.error("AI failed:", response.status, text?.slice(0, 200));
    throw new Error("AI_UNAVAILABLE");
  }

  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI_UNAVAILABLE");
  return content;
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

    const intelContext = `
CURRENT INTELLIGENCE SNAPSHOT:
═══════════════════════════════

MISSILE ACTIVITY:
- Total rockets tracked: ${rocketsRes.data?.length || 0}
- Active (launched/in-flight): ${rocketsByStatus.launched + rocketsByStatus.in_flight}
- Intercepted: ${rocketsByStatus.intercepted}
- Impacts confirmed: ${rocketsByStatus.impact}
- Types deployed: ${Object.entries(rocketTypes).map(([t, c]) => `${t}: ${c}`).join(", ") || "None"}
- Recent launches: ${rocketsRes.data?.slice(0, 5).map(r => `${r.name} [${r.type}] ${r.status} at ${r.timestamp}`).join("; ") || "None"}

AIRSPACE STATUS:
- Active airspace alerts: ${airspaceRes.data?.length || 0}
- Closures/Restrictions: ${airspaceRes.data?.map(a => `${a.type} over ${a.region} (${a.severity})`).join("; ") || "None"}

GEOPOLITICAL ALERTS:
- Total alerts: ${geoRes.data?.length || 0}
- By type: ${Object.entries(geoByType).map(([t, c]) => `${t}: ${c}`).join(", ") || "None"}
- Recent: ${geoRes.data?.slice(0, 5).map(a => `[${a.type}/${a.severity}] ${a.title}`).join("; ") || "None"}

MILITARY MARITIME:
- Military vessels in theater: ${militaryVessels.length}
- Details: ${militaryVessels.slice(0, 5).map(v => `${v.name} (${v.flag}) heading ${v.heading}° at ${v.speed}kts`).join("; ") || "None"}
- Total vessels tracked: ${vesselsRes.data?.length || 0}

RISK SCORES:
- Overall: ${risk?.overall || "N/A"}/100
- Airspace Risk: ${risk?.airspace || "N/A"}/100
- Maritime Risk: ${risk?.maritime || "N/A"}/100
- Diplomatic Risk: ${risk?.diplomatic || "N/A"}/100
- Sentiment: ${risk?.sentiment || "N/A"}/100
- Trend: ${risk?.trend || "N/A"}

RECENT TIMELINE EVENTS:
${timelineRes.data?.slice(0, 10).map(e => `- [${e.type}/${e.severity}] ${e.title} (${e.timestamp})`).join("\n") || "None"}
`;

    const systemPrompt = `You are a senior military intelligence analyst and conflict escalation specialist. Your expertise covers:
- Military force disposition and movement analysis
- Escalation ladder theory (Herman Kahn framework)
- Pattern recognition in conflict dynamics
- Nuclear/WMD escalation indicators
- Historical conflict analogy mapping

Analyze the provided real-time intelligence data and produce a comprehensive WAR ESCALATION ASSESSMENT.

CRITICAL RULES:
1. Base ALL analysis strictly on the intelligence data provided
2. Use the Kahn escalation ladder (1-44 rungs) as reference framework
3. Provide specific percentage probabilities for each escalation scenario
4. Include both escalation AND de-escalation indicators
5. Map current situation to historical conflict analogies
6. Identify specific trigger points that could cause rapid escalation
7. Provide timeline estimates for each scenario

Return your response as valid JSON with this EXACT structure:
{
  "timestamp": "ISO timestamp",
  "current_escalation_level": {
    "kahn_rung": 1-44,
    "label": "string describing current rung",
    "description": "brief situation assessment"
  },
  "overall_escalation_probability": 0-100,
  "trend": "ESCALATING" | "STABLE" | "DE-ESCALATING",
  "trend_velocity": "RAPID" | "MODERATE" | "SLOW",
  "scenarios": [
    {
      "name": "scenario name",
      "probability": 0-100,
      "timeline": "e.g. 24-48 hours",
      "description": "what happens in this scenario",
      "triggers": ["specific trigger 1", "trigger 2"],
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "CATASTROPHIC"
    }
  ],
  "escalation_indicators": [
    {
      "indicator": "what was observed",
      "significance": "HIGH" | "MEDIUM" | "LOW",
      "direction": "ESCALATORY" | "DE-ESCALATORY" | "AMBIGUOUS",
      "detail": "brief explanation"
    }
  ],
  "conflict_phases": [
    {
      "phase": "phase name",
      "status": "ACTIVE" | "EMERGING" | "POTENTIAL" | "PASSED",
      "probability": 0-100,
      "timeline": "estimated timeline"
    }
  ],
  "historical_analogy": {
    "conflict": "historical conflict name",
    "similarity_score": 0-100,
    "current_parallel": "what stage of that conflict we're at",
    "lesson": "key lesson from history"
  },
  "key_assessment": "2-3 sentence top-level assessment",
  "next_24h_outlook": "brief outlook for next 24 hours",
  "recommended_posture": "NORMAL" | "ELEVATED" | "HIGH" | "MAXIMUM"
}`;

    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze the following intelligence data and provide your war escalation assessment:\n\n${intelContext}` },
    ]);

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1].trim());
    } catch {
      result = {
        overall_escalation_probability: 50,
        trend: "STABLE",
        key_assessment: content.slice(0, 300),
        scenarios: [],
        escalation_indicators: [],
        conflict_phases: [],
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Error && e.message === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Escalation prediction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
