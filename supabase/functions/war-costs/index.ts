import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("MINIMAX_API_KEY");
    if (!apiKey) throw new Error("MINIMAX_API_KEY not configured");

    const today = new Date().toISOString().split("T")[0];
    const daysSinceOct2023 = Math.floor((Date.now() - new Date("2023-10-07").getTime()) / 86400000);

    const systemPrompt = `You are a senior economic analyst and war-cost calculation engine focused on the Iran-Israel/Middle East conflict that escalated October 7, 2023.

TODAY IS: ${today} (Day ${daysSinceOct2023} of the conflict)

YOUR MISSION: Compute the PRECISE cost impact on:
1. Israel  2. USA  3. Each Arab country separately  4. All Arab countries combined  5. Total Middle East

MANDATORY COST FORMULA — Apply for EVERY country:
Total_Event_Cost =
  Interceptor_Cost
+ Air_Sortie_Cost
+ Strike_Munition_Cost
+ Infrastructure_Damage
+ Aviation_Loss
+ Tourism_Loss
+ Trade_Shipping_Loss
+ Energy_Shock
+ Insurance_Risk_Premium
+ Security_Readiness_Cost

PRECISION RULES:
- Calculate costs DOWN TO THE DOLLAR PER SECOND for each sector
- Daily cost = 24h accumulation. Show exact daily_cost_millions with 2 decimal places
- Cumulative = total since Oct 7 2023. Must reflect ${daysSinceOct2023} days of conflict
- Derive min/base/max scenarios. Use BASE for the main numbers
- Attach confidence score to each country estimate
- Aggregate by country, sector, and region
- Output in USD million / USD billion as appropriate
- When data is missing: clearly label as "estimated" and show conservative/base/severe
- When sources disagree: calculate min/base/max, mark base as reconciled estimate

BENCHMARK DATA:
- Iron Dome interception: ~$50K-100K per missile
- David's Sling: ~$1M per interception
- Arrow-3: ~$2-3M per interception
- Tomahawk cruise missile: ~$2M each
- F-35 sortie cost: ~$40K-60K/hour
- Oil baseline: $85/bbl pre-conflict
- Suez/Red Sea rerouting: $1M+ per large vessel per trip, +7-14 days transit
- Tourism collapse: Israel -70%, Lebanon -80%, Jordan -40%, Egypt -25%
- Defense spending surge: Israel $250-300M/day ops, US $50M+/day support, Iran proxy funding $20-50M/day, Gulf states arms buildup $100M+/day. Total ME defense surge $500-800M+/day MINIMUM

LIVE EVENT MODIFIERS:
- Active military operations: 1.5x base rate for affected sectors
- Ceasefire periods: 0.6x base rate
- New sanctions: +15% to affected country costs
- Shipping attacks: +$2-5M/day to Shipping & Trade
- Oil price spikes: proportional increase to Oil & Energy
- Infrastructure strikes: +$10-50M one-time to Real Estate & Construction

Return ONLY valid JSON (no markdown, no code blocks):
{
  "total_daily_cost_billions": number (2 decimal places),
  "cost_per_second_usd": number,
  "sectors": [
    { "name": "Oil & Energy", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with current oil price impact", "live_modifier": "normal|elevated|critical" },
    { "name": "Aviation & Airspace", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Tourism & Hospitality", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Shipping & Trade", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Real Estate & Construction", "daily_cost_millions": number, "cost_per_second": number, "description": "brief", "live_modifier": "normal|elevated|critical" },
    { "name": "Defense Spending", "daily_cost_millions": number, "cost_per_second": number, "description": "brief with formula breakdown: interceptor + sortie + munition + readiness", "live_modifier": "normal|elevated|critical" }
  ],
  "country_costs": [
    {
      "country": "Israel", "code": "IL",
      "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number,
      "confidence": "high|medium|low",
      "trend": "rising|falling|stable",
      "breakdown": "Interceptor_Cost: $X, Air_Sortie_Cost: $X, Munition: $X, Infrastructure: $X, Aviation_Loss: $X, Tourism_Loss: $X, Trade: $X, Energy: $X, Insurance: $X, Security: $X"
    },
    { "country": "Palestine/Gaza", "code": "PS", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Lebanon", "code": "LB", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Iran", "code": "IR", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Yemen/Houthis", "code": "YE", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "USA", "code": "US", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "high", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Saudi Arabia", "code": "SA", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "UAE", "code": "AE", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Jordan", "code": "JO", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "medium", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Egypt", "code": "EG", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "high", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Iraq", "code": "IQ", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "rising|falling|stable", "breakdown": "..." },
    { "country": "Syria", "code": "SY", "total_cost_billions": number, "daily_cost_millions": number, "cost_per_second": number, "confidence": "low", "trend": "rising|falling|stable", "breakdown": "..." }
  ],
  "cumulative_estimate_billions": number (precise to 2 decimals — MUST equal sum of all country total_cost_billions),
  "cumulative_unit": "B",
  "daily_unit": "B",
  "conflict_day": ${daysSinceOct2023},
  "scenarios": { "conservative_billions": number, "base_billions": number, "severe_billions": number },
  "active_events_affecting_costs": ["list current events modifying rates"],
  "methodology": "One sentence on calculation approach with per-second precision and formula reference",
  "timestamp": "${new Date().toISOString()}"
}

CRITICAL: country_costs totals MUST sum to cumulative_estimate_billions. Each cost_per_second = daily_cost_millions * 1000000 / 86400. Use the FULL cost formula for each country breakdown.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch("https://api.minimax.chat/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "MiniMax-M2",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Today is ${today}, day ${daysSinceOct2023} of the conflict. Provide precise per-second war costs with current event modifiers for all Middle East countries affected.` },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

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
      console.error("MiniMax error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const rawText = await response.text();
    if (!rawText) throw new Error("AI returned empty response");
    const data = JSON.parse(rawText);
    const rawContent = data.choices?.[0]?.message?.content || "";
    const content = stripThinkTags(rawContent);

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
