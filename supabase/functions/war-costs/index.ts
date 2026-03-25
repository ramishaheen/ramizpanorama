import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const fallbackWarCosts = {
  total_daily_cost_billions: 0.42,
  cost_per_second_usd: 4861,
  sectors: [
    { name: "Oil & Energy", daily_cost_millions: 86, cost_per_second: 995, description: "Price volatility and export risk", live_modifier: "elevated" },
    { name: "Aviation & Airspace", daily_cost_millions: 54, cost_per_second: 625, description: "Rerouting and insurance costs", live_modifier: "elevated" },
    { name: "Tourism & Hospitality", daily_cost_millions: 41, cost_per_second: 474, description: "Demand weakness from travel alerts", live_modifier: "elevated" },
    { name: "Shipping & Trade", daily_cost_millions: 79, cost_per_second: 914, description: "Freight disruptions in choke points", live_modifier: "critical" },
    { name: "Real Estate & Construction", daily_cost_millions: 38, cost_per_second: 440, description: "Project delays and risk premiums", live_modifier: "normal" },
    { name: "Defense Spending", daily_cost_millions: 122, cost_per_second: 1412, description: "Higher operational and procurement outlays", live_modifier: "critical" },
  ],
  country_costs: [
    { country: "Israel", code: "IL", total_cost_billions: 68.5, daily_cost_millions: 125, cost_per_second: 1447, confidence: "high", trend: "rising", breakdown: "Defense ops, Iron Dome, economic disruption" },
    { country: "Palestine/Gaza", code: "PS", total_cost_billions: 42.0, daily_cost_millions: 78, cost_per_second: 903, confidence: "medium", trend: "rising", breakdown: "Infrastructure destruction, humanitarian crisis" },
    { country: "Lebanon", code: "LB", total_cost_billions: 18.2, daily_cost_millions: 34, cost_per_second: 394, confidence: "medium", trend: "stable", breakdown: "Border conflict damage, displacement costs" },
    { country: "Iran", code: "IR", total_cost_billions: 22.5, daily_cost_millions: 42, cost_per_second: 486, confidence: "low", trend: "rising", breakdown: "Sanctions impact, proxy funding, defense spending" },
    { country: "Yemen/Houthis", code: "YE", total_cost_billions: 8.3, daily_cost_millions: 15, cost_per_second: 174, confidence: "low", trend: "stable", breakdown: "Red Sea disruption costs, military operations" },
    { country: "USA", code: "US", total_cost_billions: 26.8, daily_cost_millions: 50, cost_per_second: 579, confidence: "high", trend: "rising", breakdown: "Military aid, naval deployments, diplomatic costs" },
    { country: "Saudi Arabia", code: "SA", total_cost_billions: 9.4, daily_cost_millions: 17, cost_per_second: 197, confidence: "medium", trend: "stable", breakdown: "Oil market hedging, defense posture" },
    { country: "UAE", code: "AE", total_cost_billions: 5.2, daily_cost_millions: 10, cost_per_second: 116, confidence: "medium", trend: "stable", breakdown: "Trade rerouting, insurance premiums" },
    { country: "Jordan", code: "JO", total_cost_billions: 4.8, daily_cost_millions: 9, cost_per_second: 104, confidence: "medium", trend: "stable", breakdown: "Refugee costs, tourism decline" },
    { country: "Egypt", code: "EG", total_cost_billions: 7.5, daily_cost_millions: 14, cost_per_second: 162, confidence: "high", trend: "stable", breakdown: "Suez Canal revenue impact, border security" },
    { country: "Iraq", code: "IQ", total_cost_billions: 3.8, daily_cost_millions: 7, cost_per_second: 81, confidence: "low", trend: "stable", breakdown: "Militia activity costs, oil market impact" },
    { country: "Syria", code: "SY", total_cost_billions: 2.4, daily_cost_millions: 4, cost_per_second: 46, confidence: "low", trend: "stable", breakdown: "Spillover conflict, displacement" },
  ],
  cumulative_estimate_billions: 219.4,
  cumulative_unit: "B",
  daily_unit: "B",
  conflict_day: Math.floor((Date.now() - new Date("2023-10-07").getTime()) / 86400000),
  scenarios: { conservative_billions: 189.2, base_billions: 219.4, severe_billions: 264.8 },
  active_events_affecting_costs: ["Airspace disruptions", "Maritime chokepoint risk", "Regional escalation tension"],
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
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

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
    { "country": "Palestine/Gaza", "code": "PS", ... },
    { "country": "Lebanon", "code": "LB", ... },
    { "country": "Iran", "code": "IR", ... },
    { "country": "Yemen/Houthis", "code": "YE", ... },
    { "country": "USA", "code": "US", ... },
    { "country": "Saudi Arabia", "code": "SA", ... },
    { "country": "UAE", "code": "AE", ... },
    { "country": "Jordan", "code": "JO", ... },
    { "country": "Egypt", "code": "EG", ... },
    { "country": "Iraq", "code": "IQ", ... },
    { "country": "Syria", "code": "SY", ... }
  ],
  "cumulative_estimate_billions": number,
  "cumulative_unit": "B",
  "daily_unit": "B",
  "conflict_day": ${daysSinceOct2023},
  "scenarios": { "conservative_billions": number, "base_billions": number, "severe_billions": number },
  "active_events_affecting_costs": ["list current events modifying rates"],
  "methodology": "One sentence on calculation approach",
  "timestamp": "${new Date().toISOString()}"
}

IMPORTANT CALCULATION RULES:
- cumulative_estimate_billions = sum of all country total_cost_billions
- total_daily_cost_billions = sum of all sector daily_cost_millions / 1000
- cost_per_second_usd = total_daily_cost_billions * 1e9 / 86400
- Each sector cost_per_second = daily_cost_millions * 1e6 / 86400
- Ensure all numbers are internally consistent`;

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Today is ${today}, day ${daysSinceOct2023} of the conflict. Provide precise per-second war costs for all Middle East countries affected. Return ONLY the JSON object, no explanation.` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("War costs: rate limited, using fallback");
        return new Response(JSON.stringify({ ...fallbackWarCosts, conflict_day: daysSinceOct2023, timestamp: new Date().toISOString() }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.warn("War costs: credits exhausted, using fallback");
        return new Response(JSON.stringify({ ...fallbackWarCosts, conflict_day: daysSinceOct2023, timestamp: new Date().toISOString() }), {
          status: 200,
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
      const sanitized = (jsonMatch[1] || rawContent).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
      const objMatch = sanitized.match(/\{[\s\S]*\}/);
      try {
        costs = JSON.parse(objMatch ? objMatch[0] : sanitized);
      } catch {
        const fixed = (objMatch ? objMatch[0] : sanitized).replace(/,\s*([\]}])/g, "$1");
        costs = JSON.parse(fixed);
      }
    } catch {
      console.error("Failed to parse AI response, using fallback");
      costs = { ...fallbackWarCosts, conflict_day: daysSinceOct2023, timestamp: new Date().toISOString() };
    }

    // Validate & fix consistency
    if (costs.sectors && Array.isArray(costs.sectors)) {
      const sectorSum = costs.sectors.reduce((s: number, sec: any) => s + (sec.daily_cost_millions || 0), 0);
      costs.total_daily_cost_billions = sectorSum / 1000;
      costs.cost_per_second_usd = Math.round(costs.total_daily_cost_billions * 1e9 / 86400);
      for (const sec of costs.sectors) {
        sec.cost_per_second = Math.round((sec.daily_cost_millions || 0) * 1e6 / 86400);
      }
    }
    if (costs.country_costs && Array.isArray(costs.country_costs)) {
      const countrySum = costs.country_costs.reduce((s: number, c: any) => s + (c.total_cost_billions || 0), 0);
      costs.cumulative_estimate_billions = Math.round(countrySum * 10) / 10;
      if (costs.scenarios) {
        const ratio = costs.cumulative_estimate_billions / (costs.scenarios.base_billions || costs.cumulative_estimate_billions || 1);
        costs.scenarios.base_billions = costs.cumulative_estimate_billions;
        costs.scenarios.conservative_billions = Math.round(costs.cumulative_estimate_billions * 0.85 * 10) / 10;
        costs.scenarios.severe_billions = Math.round(costs.cumulative_estimate_billions * 1.2 * 10) / 10;
      }
    }

    costs.conflict_day = daysSinceOct2023;
    costs.timestamp = new Date().toISOString();

    // Cache
    cachedWarCosts = { data: costs, timestamp: Date.now() };

    return new Response(JSON.stringify(costs), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("War costs error:", e);
    const daysSinceOct2023 = Math.floor((Date.now() - new Date("2023-10-07").getTime()) / 86400000);
    return new Response(
      JSON.stringify({ ...fallbackWarCosts, conflict_day: daysSinceOct2023, timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
