import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const fallbackWarCosts = {
  total_daily_cost_billions: 0.42,
  cost_per_second_usd: 4861,
  sectors: [
    { name: "Oil & Energy", daily_cost_millions: 86, cost_per_second: 995, description: "Price volatility and export risk", live_modifier: "elevated" },
    { name: "Aviation & Airspace", daily_cost_millions: 54, cost_per_second: 625, description: "Rerouting and insurance costs", live_modifier: "elevated" },
    { name: "Tourism & Hospitality", daily_cost_millions: 41, cost_per_second: 474, description: "Demand weakness from travel alerts", live_modifier: "elevated" },
    { name: "Shipping & Trade", daily_cost_millions: 79, cost_per_second: 914, description: "Freight disruptions in choke points", live_modifier: "critical" },
    { name: "Real Estate & Construction", daily_cost_millions: 38, cost_per_second: 440, description: "Project delays and risk premiums", live_modifier: "normal" },
    { name: "Defense Spending", daily_cost_millions: 122, cost_per_second: 1412, description: "Higher operational and procurement outlays", live_modifier: "critical" }
  ],
  country_costs: [],
  cumulative_estimate_billions: 213.4,
  cumulative_unit: "B",
  daily_unit: "B",
  conflict_day: Math.floor((Date.now() - new Date("2023-10-07").getTime()) / 86400000),
  scenarios: { conservative_billions: 185.2, base_billions: 213.4, severe_billions: 256.8 },
  active_events_affecting_costs: ["Airspace disruptions", "Maritime chokepoint risk"],
  methodology: "Fallback estimate from historical trend weighting and current risk state.",
  timestamp: new Date().toISOString(),
  _fallback: true,
};

// 24-hour in-memory cache
let cachedWarCosts: { data: unknown; timestamp: number } | null = null;
const WAR_COSTS_CACHE_TTL = 86_400_000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Return cached if fresh
  if (cachedWarCosts && Date.now() - cachedWarCosts.timestamp < WAR_COSTS_CACHE_TTL) {
    return new Response(JSON.stringify(cachedWarCosts.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = Deno.env.get("NVIDIA_API_KEY");
    if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

    const today = new Date().toISOString().split("T")[0];
    const daysSinceOct2023 = Math.floor((Date.now() - new Date("2023-10-07").getTime()) / 86400000);

    const systemPrompt = `You are a senior economic analyst and war-cost calculation engine focused on the Iran-Israel/Middle East conflict that escalated October 7, 2023.

TODAY IS: ${today} (Day ${daysSinceOct2023} of the conflict)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "total_daily_cost_billions": number,
  "cost_per_second_usd": number,
  "sectors": [
    { "name": "Oil & Energy", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Aviation & Airspace", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Tourism & Hospitality", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Shipping & Trade", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Real Estate & Construction", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Defense Spending", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" }
  ],
  "country_costs": [
    { "country": "Israel", "code": "IL", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "high|medium|low", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Palestine/Gaza", "code": "PS", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "rising", "breakdown": "..." },
    { "country": "Lebanon", "code": "LB", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "stable", "breakdown": "..." },
    { "country": "Iran", "code": "IR", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "rising", "breakdown": "..." },
    { "country": "Yemen/Houthis", "code": "YE", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "stable", "breakdown": "..." },
    { "country": "USA", "code": "US", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "high", "trend": "rising", "breakdown": "..." },
    { "country": "Saudi Arabia", "code": "SA", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "stable", "breakdown": "..." },
    { "country": "UAE", "code": "AE", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "stable", "breakdown": "..." },
    { "country": "Jordan", "code": "JO", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "stable", "breakdown": "..." },
    { "country": "Egypt", "code": "EG", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "high", "trend": "stable", "breakdown": "..." },
    { "country": "Iraq", "code": "IQ", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "stable", "breakdown": "..." },
    { "country": "Syria", "code": "SY", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "stable", "breakdown": "..." }
  ],
  "cumulative_estimate_billions": number,
  "cumulative_unit": "B",
  "daily_unit": "B",
  "conflict_day": ${daysSinceOct2023},
  "scenarios": { "conservative_billions": number, "base_billions": number, "severe_billions": number },
  "active_events_affecting_costs": ["list current events modifying rates"],
  "methodology": "One sentence on calculation approach",
  "timestamp": "${new Date().toISOString()}"
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "moonshotai/kimi-k2-thinking",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Today is ${today}, day ${daysSinceOct2023} of the conflict. Provide precise per-second war costs for all Middle East countries affected.` },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        return new Response(JSON.stringify({ ...fallbackWarCosts, timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let costs;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
      const sanitized = (jsonMatch[1] || rawContent).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
      const objMatch = sanitized.match(/\{[\s\S]*\}/);
      try {
        costs = JSON.parse(objMatch ? objMatch[0] : sanitized);
      } catch {
        const fixed = (objMatch ? objMatch[0] : sanitized).replace(/,\s*([\]}])/g, '$1');
        costs = JSON.parse(fixed);
      }
    } catch {
      costs = { error: "Failed to parse AI response" };
    }

    // Cache successful result
    cachedWarCosts = { data: costs, timestamp: Date.now() };

    return new Response(JSON.stringify(costs), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("War costs error:", e);
    return new Response(
      JSON.stringify({ ...fallbackWarCosts, timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
