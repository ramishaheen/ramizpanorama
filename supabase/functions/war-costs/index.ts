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

    const systemPrompt = `You are a senior economic analyst specializing in conflict economics and the Middle East region. Your task is to provide realistic, well-researched estimates of the economic costs of the ongoing Iran-Israel/Middle East conflict that escalated in October 2023.

IMPORTANT GUIDELINES FOR ACCURACY:
- Use real-world data points: oil price spikes, Suez/Red Sea shipping disruption costs, tourism revenue drops, defense spending increases, GDP impact estimates from IMF/World Bank reports.
- The cumulative cost should reflect TOTAL economic damage since October 2023 to today (${today}), across the ENTIRE Middle East region — not just direct military spending.
- Consider: Houthi Red Sea attacks cost global trade ~$50-80B+ in rerouting; Israel's war costs alone are ~$250M+/day; regional tourism dropped 30-60%; oil volatility premium adds billions; infrastructure destruction in Gaza estimated at $30-50B+; Lebanon conflict damage; Iran sanctions tightening.
- The cumulative number should realistically be in the hundreds of billions USD range.
- Daily costs should be realistic — think about ALL sectors combined across the whole region.
- Always include the UNIT clearly: use "M" for millions, "B" for billions in descriptions.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "total_daily_cost_billions": number (total daily economic cost in billions USD, e.g. 1.5 means $1.5B/day),
  "sectors": [
    {
      "name": "Oil & Energy",
      "daily_cost_millions": number,
      "description": "brief explanation with $ amounts"
    },
    {
      "name": "Aviation & Airspace",
      "daily_cost_millions": number,
      "description": "brief explanation"
    },
    {
      "name": "Tourism & Hospitality",
      "daily_cost_millions": number,
      "description": "brief explanation"
    },
    {
      "name": "Shipping & Trade",
      "daily_cost_millions": number,
      "description": "brief explanation"
    },
    {
      "name": "Real Estate & Construction",
      "daily_cost_millions": number,
      "description": "brief explanation"
    },
    {
      "name": "Defense Spending",
      "daily_cost_millions": number,
      "description": "brief explanation"
    }
  ],
  "cumulative_estimate_billions": number (total since Oct 2023 to ${today}, realistically hundreds of billions),
  "cumulative_unit": "B" or "T" (use "B" for billions, "T" if it exceeds 1 trillion),
  "daily_unit": "B",
  "methodology": "One sentence on how you calculated this",
  "timestamp": "${new Date().toISOString()}"
}

Be realistic. Cross-reference known figures: Israel alone has spent $100B+, Red Sea disruption $50B+, regional GDP losses, infrastructure destruction, refugee costs, etc.`;

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
          { role: "user", content: `Today is ${today}. Provide your best estimate of the current economic costs of the Middle East conflict across all sectors and countries in the region. Be thorough and realistic.` },
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
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      // Sanitize hidden control characters
      const sanitized = jsonMatch[1].trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
      try {
        costs = JSON.parse(sanitized);
      } catch {
        // Fix trailing commas
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
