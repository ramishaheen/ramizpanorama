import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const today = new Date().toISOString().split("T")[0];
    const daysSinceOct2023 = Math.floor((Date.now() - new Date("2023-10-07").getTime()) / 86400000);

    const systemPrompt = `You are a senior economic analyst specializing in conflict economics and the Middle East region. Provide PRECISE, well-researched estimates of the economic costs of the ongoing Iran-Israel/Middle East conflict that escalated in October 2023.

TODAY IS: ${today} (Day ${daysSinceOct2023} of the conflict)

CRITICAL PRECISION REQUIREMENTS:
- Calculate costs DOWN TO THE DOLLAR PER SECOND for each sector
- Daily cost = 24h accumulation. Show exact daily_cost_millions with 2 decimal places
- Cumulative = total since Oct 7 2023. Must reflect ${daysSinceOct2023} days of conflict
- Factor in RECENT EVENTS: any escalations, ceasefires, new fronts, sanctions changes
- Oil price impact: current crude prices vs pre-conflict baseline ($85/bbl)
- Suez/Red Sea: shipping rerouting adds $1M+ per large vessel per trip
- Tourism: Israel -70%, Lebanon -80%, Jordan -40%, Egypt -25% vs pre-conflict
- Defense: Israel $250-300M/day military ops, US $50M+/day support operations

LIVE EVENT MODIFIERS - Apply these multipliers based on current situation:
- Active military operations: 1.5x base rate for affected sectors
- Ceasefire periods: 0.6x base rate
- New sanctions: +15% to affected country costs
- Shipping attacks: +$2-5M/day to Shipping & Trade
- Oil price spikes: proportional increase to Oil & Energy sector
- Infrastructure strikes: +$10-50M one-time to Real Estate & Construction

Return ONLY valid JSON (no markdown, no code blocks):
{
  "total_daily_cost_billions": number (2 decimal places),
  "cost_per_second_usd": number (exact USD per second across all sectors),
  "sectors": [
    { "name": "Oil & Energy", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with current oil price impact, $ amounts", "live_modifier": "normal|elevated|critical" },
    { "name": "Aviation & Airspace", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with route diversions", "live_modifier": "normal|elevated|critical" },
    { "name": "Tourism & Hospitality", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with occupancy rates", "live_modifier": "normal|elevated|critical" },
    { "name": "Shipping & Trade", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with Red Sea/Suez impact", "live_modifier": "normal|elevated|critical" },
    { "name": "Real Estate & Construction", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with reconstruction needs", "live_modifier": "normal|elevated|critical" },
    { "name": "Defense Spending", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with military ops tempo", "live_modifier": "normal|elevated|critical" }
  ],
  "country_costs": [
    {
      "country": "Israel", "code": "IL",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "2-3 sentences: military ops cost, Iron Dome expenditure per interception, GDP loss percentage, reconstruction estimates"
    },
    {
      "country": "Palestine/Gaza", "code": "PS",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "infrastructure destruction totals, humanitarian crisis cost, GDP collapse percentage, reconstruction estimate"
    },
    {
      "country": "Lebanon", "code": "LB",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "Hezbollah conflict damage, displacement costs, economic disruption, infrastructure"
    },
    {
      "country": "Iran", "code": "IR",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "sanctions impact, proxy funding, direct strike costs, oil revenue changes"
    },
    {
      "country": "Yemen/Houthis", "code": "YE",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "Red Sea blockade costs, US/UK strikes damage, humanitarian impact"
    },
    {
      "country": "Saudi Arabia", "code": "SA",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "defense spending increase, oil market volatility impact, tourism & NEOM delays"
    },
    {
      "country": "UAE", "code": "AE",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "shipping rerouting costs, insurance premium increases, investment slowdown"
    },
    {
      "country": "Jordan", "code": "JO",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "tourism collapse percentage, refugee costs, trade disruption"
    },
    {
      "country": "Egypt", "code": "EG",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "Suez Canal revenue loss exact figures, tourism drop, security spending"
    },
    {
      "country": "Iraq", "code": "IQ",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "militia activity costs, oil infrastructure risk premium, US base attacks"
    },
    {
      "country": "Syria", "code": "SY",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "breakdown": "Israeli strikes damage, Iranian presence costs, displacement costs"
    }
  ],
  "cumulative_estimate_billions": number (precise to 2 decimals),
  "cumulative_unit": "B",
  "daily_unit": "B",
  "conflict_day": ${daysSinceOct2023},
  "active_events_affecting_costs": ["list of current events modifying cost rates"],
  "methodology": "One sentence on calculation approach including per-second precision",
  "timestamp": "${new Date().toISOString()}"
}

Be PRECISE. The country_costs totals should sum to cumulative_estimate_billions. Each sector cost_per_second = daily_cost_millions * 1000000 / 86400.`;

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
          { role: "user", content: `Today is ${today}, day ${daysSinceOct2023} of the conflict. Provide precise per-second war costs with current event modifiers for all Middle East countries affected.` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let costs;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const sanitized = jsonMatch[1].trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
      try {
        costs = JSON.parse(sanitized);
      } catch {
        const fixed = sanitized.replace(/,\s*([\]}])/g, '$1');
        costs = JSON.parse(fixed);
      }
    } catch {
      costs = { error: "Failed to parse AI response", raw: content };
    }

    return new Response(JSON.stringify(costs), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("War costs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
