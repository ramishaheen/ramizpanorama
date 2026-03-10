const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { image_base64, mime_type } = await req.json();
    if (!image_base64) throw new Error("image_base64 is required");

    const systemPrompt = `You are a world-class geolocation analyst. Given a photograph, analyze every visual cue to determine the most likely geographic location(s) where this photo was taken.

Analyze:
- Landmarks and monuments (specific buildings, bridges, towers)
- Architecture style (Ottoman, Roman, modern, brutalist, etc.)
- Language on signs, license plates, storefronts
- Vegetation and terrain (desert, tropical, Mediterranean, alpine)
- Road markings, traffic signs, driving side
- Sky conditions, sun position, shadows
- Cultural indicators (clothing, vehicles, shop types)
- Terrain elevation and geological features

Return ONLY valid JSON with this exact structure:
{
  "locations": [
    {
      "name": "Specific place name",
      "city": "City name",
      "country": "Country name",
      "lat": 31.9539,
      "lng": 35.9340,
      "confidence": 0.85,
      "reasoning": "Detailed explanation of why this location matches"
    }
  ],
  "overall_analysis": "Brief overall description of the image and key geolocation clues found"
}

Return up to 5 candidate locations, ranked by confidence (highest first). Be as specific as possible with coordinates.`;

    const aiResp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              { type: "image_url", image_url: { url: `data:${mime_type || "image/jpeg"};base64,${image_base64}` } },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted, please add funds" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI Gateway error:", aiResp.status, errText);
      throw new Error(`AI Gateway failed: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const rawText = aiData.choices?.[0]?.message?.content || "";

    // Strip think blocks
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    let result;
    try {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      result = null;
    }

    if (!result) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: cleaned.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("snap-locate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
