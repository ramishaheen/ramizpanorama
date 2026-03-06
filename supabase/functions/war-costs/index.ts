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

    const systemPrompt = `You are a senior economic analyst specializing in conflict economics and the Middle East region. Provide realistic, well-researched estimates of the economic costs of the ongoing Iran-Israel/Middle East conflict that escalated in October 2023.

GUIDELINES:
- Use real-world data: oil spikes, Red Sea/Suez disruption, tourism drops, defense spending, GDP impact from IMF/World Bank.
- Cumulative cost = TOTAL since Oct 2023 to ${today} across the ENTIRE region.
- Reference points: Israel war costs ~$250M+/day, Red Sea rerouting $50-80B+, Gaza infrastructure $30-50B+, regional tourism -30-60%, Lebanon damage, Iran sanctions.
- Include per-country breakdown for ALL major affected Middle East countries.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "total_daily_cost_billions": number,
  "sectors": [
    { "name": "Oil & Energy", "daily_cost_millions": number, "description": "brief with $ amounts" },
    { "name": "Aviation & Airspace", "daily_cost_millions": number, "description": "brief" },
    { "name": "Tourism & Hospitality", "daily_cost_millions": number, "description": "brief" },
    { "name": "Shipping & Trade", "daily_cost_millions": number, "description": "brief" },
    { "name": "Real Estate & Construction", "daily_cost_millions": number, "description": "brief" },
    { "name": "Defense Spending", "daily_cost_millions": number, "description": "brief" }
  ],
  "country_costs": [
    {
      "country": "Israel",
      "code": "IL",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "2-3 sentence explanation: military ops, Iron Dome, GDP loss, reconstruction"
    },
    {
      "country": "Palestine/Gaza",
      "code": "PS",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "infrastructure destruction, humanitarian crisis, GDP collapse"
    },
    {
      "country": "Lebanon",
      "code": "LB",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "Hezbollah conflict damage, displacement, economic disruption"
    },
    {
      "country": "Iran",
      "code": "IR",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "sanctions, proxy funding, direct strike costs, oil revenue impact"
    },
    {
      "country": "Yemen/Houthis",
      "code": "YE",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "Red Sea blockade costs, US/UK strikes, humanitarian impact"
    },
    {
      "country": "Saudi Arabia",
      "code": "SA",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "defense spending, oil market volatility, tourism & NEOM delays"
    },
    {
      "country": "UAE",
      "code": "AE",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "shipping rerouting, insurance premiums, investment slowdown"
    },
    {
      "country": "Jordan",
      "code": "JO",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "tourism collapse, refugee costs, trade disruption"
    },
    {
      "country": "Egypt",
      "code": "EG",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "Suez Canal revenue loss, tourism drop, security spending"
    },
    {
      "country": "Iraq",
      "code": "IQ",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "militia activity, oil infrastructure risk, US base attacks"
    },
    {
      "country": "Syria",
      "code": "SY",
      "total_cost_billions": number,
      "daily_cost_millions": number,
      "breakdown": "Israeli strikes, Iranian presence costs, displacement"
    }
  ],
  "cumulative_estimate_billions": number,
  "cumulative_unit": "B",
  "daily_unit": "B",
  "methodology": "One sentence on calculation approach",
  "timestamp": "${new Date().toISOString()}"
}

Be realistic and thorough. The country_costs totals should roughly sum to cumulative_estimate_billions.`;

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
          { role: "user", content: `Today is ${today}. Estimate current war costs across the Middle East with detailed per-country breakdown.` },
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
