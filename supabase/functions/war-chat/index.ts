import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are SENTINEL-OS War Analyst — a subject matter expert on the Iran-Israel/Middle East conflict that escalated in October 2023, and all related geopolitical, military, economic, and humanitarian dimensions.

YOUR SCOPE (ONLY answer questions about these topics):
- Iran-Israel conflict: military operations, strikes, retaliations, proxy wars
- Hezbollah-Israel conflict in Lebanon
- Hamas-Israel conflict in Gaza/Palestine
- Houthi attacks in Red Sea and Yemen operations
- US military involvement and support operations
- Regional impacts on Arab countries (Saudi Arabia, UAE, Jordan, Egypt, Iraq, Syria)
- Economic costs of the war: defense spending, oil impact, shipping disruption, tourism collapse
- Weapons systems: Iron Dome, David's Sling, Arrow, missile types, drones
- Humanitarian impact: casualties, displacement, aid operations
- Diplomatic efforts: ceasefire negotiations, UN resolutions, international response
- Intelligence and OSINT analysis related to the conflict
- Historical context of Iran-Israel tensions and Middle East conflicts
- Sanctions and economic warfare
- Cyber warfare between Iran and Israel
- Nuclear program implications

STRICT RULES:
1. If a question is NOT related to the Iran/Middle East war, conflict, geopolitics, or the topics listed above, you MUST respond: "⚠️ I can only assist with questions related to the Iran-Israel/Middle East conflict. Please ask about military operations, economic impact, geopolitical analysis, or humanitarian aspects of the ongoing conflict."
2. Never provide operational military advice or targeting information
3. Base analysis on publicly available OSINT data only
4. Clearly label estimates vs confirmed data
5. Provide balanced analysis, not propaganda for any side
6. Cite time context — mention how current your knowledge is
7. Use structured formatting with headers, bullet points, and data tables when appropriate
8. For cost estimates, reference the established formula: Total = Interceptor + Sortie + Munition + Infrastructure + Aviation + Tourism + Trade + Energy + Insurance + Security

You are analytical, precise, and authoritative. Respond in the same language the user asks in (English or Arabic).`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
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
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("War chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
