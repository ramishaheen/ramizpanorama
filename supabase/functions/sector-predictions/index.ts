import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
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
    const systemPrompt = `You are a senior geopolitical business intelligence analyst covering the Middle East during the Iran conflict. 

Return valid JSON:
{
  "last_analyzed": "ISO timestamp",
  "countries": [
    {
      "code": "AE", "name": "UAE", "overall_outlook": "POSITIVE/CAUTIOUS/NEGATIVE/CRITICAL",
      "sectors": [
        { "name": "string", "impact": "POSITIVE/NEUTRAL/NEGATIVE/SEVERE", "trend": "UP/DOWN/STABLE/VOLATILE", "confidence": "LOW/MEDIUM/HIGH", "prediction": "1-2 sentences", "opportunities": ["opp1"], "risks": ["risk1"] }
      ]
    }
  ],
  "regional_summary": "One paragraph assessment"
}

Cover countries: UAE (AE), Saudi Arabia (SA), Jordan (JO), Bahrain (BH), Oman (OM), Kuwait (KW), Qatar (QA), Iraq (IQ). 4-6 sectors each.`;

    const content = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Provide country-by-country sector predictions for the Gulf and Levant region now." },
    ]);

    let predictions;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const objMatch = (jsonMatch[1] || content).trim().match(/\{[\s\S]*\}/);
      predictions = JSON.parse(objMatch ? objMatch[0] : (jsonMatch[1] || content).trim());
    } catch {
      predictions = { error: "Failed to parse AI response" };
    }

    return new Response(JSON.stringify(predictions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Error && e.message === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Sector prediction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
