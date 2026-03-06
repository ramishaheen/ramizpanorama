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

    const systemPrompt = `You are an economic analyst specializing in conflict economics in the Middle East. Estimate the current economic costs of the Iran-related conflict on Middle East industries.

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "total_daily_cost_billions": number (estimated total daily economic cost in billions USD),
  "sectors": [
    {
      "name": "Oil & Energy",
      "daily_cost_millions": number,
      "description": "brief 10-word max explanation"
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
  "cumulative_estimate_billions": number (estimated total cost since conflict start),
  "timestamp": "ISO timestamp"
}

Be realistic with estimates based on known economic data about Middle East conflicts, oil disruptions, shipping rerouting costs, tourism drops, and defense expenditures.`;

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
          { role: "user", content: "Estimate current war costs on Middle East industries now." },
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
      costs = JSON.parse(jsonMatch[1].trim());
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
