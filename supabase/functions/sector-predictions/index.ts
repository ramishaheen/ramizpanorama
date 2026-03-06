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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior geopolitical business intelligence analyst covering the Middle East and Gulf region during the Iran conflict. Analyze the current situation and provide sector-by-sector business predictions for each country.

Return your response as valid JSON with this exact structure:
{
  "last_analyzed": "ISO timestamp",
  "countries": [
    {
      "code": "AE",
      "name": "UAE",
      "overall_outlook": "POSITIVE/CAUTIOUS/NEGATIVE/CRITICAL",
      "sectors": [
        {
          "name": "string",
          "impact": "POSITIVE/NEUTRAL/NEGATIVE/SEVERE",
          "trend": "UP/DOWN/STABLE/VOLATILE",
          "confidence": "LOW/MEDIUM/HIGH",
          "prediction": "brief 1-2 sentence prediction",
          "opportunities": ["opportunity 1"],
          "risks": ["risk 1"]
        }
      ]
    }
  ],
  "regional_summary": "One paragraph overall assessment"
}

RULES:
- Cover these countries: UAE (AE), Saudi Arabia (SA), Jordan (JO), Bahrain (BH), Oman (OM), Kuwait (KW), Qatar (QA), Iraq (IQ)
- For each country, cover 4-6 key sectors from: Oil & Gas, Real Estate, Tourism, Finance & Banking, Defense & Security, Technology, Logistics & Shipping, Aviation, Construction, Retail, Healthcare, Agriculture
- Choose the most relevant sectors per country based on their economy
- Be realistic and specific to each country's economic profile
- Consider supply chain disruptions, tourism impacts, energy price effects, defense spending, and investor sentiment
- Include specific opportunities and risks per sector`;

    const userPrompt = `The Iran conflict is ongoing in the Middle East. Regional tensions are elevated with active military operations, airspace restrictions, maritime security concerns, and diplomatic activity. Provide country-by-country sector predictions for the Gulf and Levant region. Generate predictions now.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Sector predictions gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let predictions;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      predictions = JSON.parse(jsonMatch[1].trim());
    } catch {
      predictions = { error: "Failed to parse AI response", raw: content };
    }

    return new Response(JSON.stringify(predictions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sector prediction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
