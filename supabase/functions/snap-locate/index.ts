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

    const systemPrompt = `You are an elite GEOINT (Geospatial Intelligence) analyst with 20+ years of experience in GeoGuessr-level photo geolocation. Your task is to determine the EXACT geographic coordinates where this photograph was taken.

MANDATORY ANALYSIS PIPELINE — follow every step:

STEP 1 — TEXT & SCRIPT DETECTION:
- Read ALL visible text: signs, storefronts, license plates, graffiti, billboards, stickers
- Identify the script (Latin, Arabic, Hebrew, Cyrillic, Devanagari, CJK, etc.)
- Identify the language(s) and dialect clues
- License plate format, color, and country codes

STEP 2 — INFRASTRUCTURE FORENSICS:
- Road surface type, lane markings style, curb design
- Traffic light style, pole types, pedestrian crossing patterns
- Power line configuration, utility pole design
- Street furniture: bollards, benches, trash cans, bus stops
- Sidewalk material and pattern

STEP 3 — ARCHITECTURE & URBAN PLANNING:
- Building materials (stone type, brick color, concrete style)
- Roof styles, window designs, balcony patterns
- Urban density and building height regulations
- Construction era estimation

STEP 4 — ENVIRONMENTAL FORENSICS:
- Vegetation species identification (palm types, tree species, ground cover)
- Soil/rock color and type
- Sun angle and shadow direction → estimate latitude and time
- Cloud patterns and atmospheric haze → climate zone
- Terrain: flat, hilly, coastal, mountainous

STEP 5 — CULTURAL & CONTEXTUAL CLUES:
- Vehicle makes and models (market-specific)
- Clothing styles, skin tones of pedestrians
- Shop types, brand presence (local vs international chains)
- Driving side (left/right)
- Religious buildings, cultural symbols

STEP 6 — CROSS-REFERENCE & PINPOINT:
- Cross-reference ALL clues to narrow to a specific city/neighborhood
- Use known landmark databases to match visible structures
- Estimate GPS coordinates to the highest precision possible (6 decimal places)
- If you recognize a specific street or intersection, name it

CONFIDENCE CALIBRATION:
- 0.90+ = You can identify a specific landmark, street name, or unique building
- 0.70-0.89 = You're confident about the city and neighborhood
- 0.50-0.69 = You're confident about the country and region
- 0.30-0.49 = You have a general area based on environmental/cultural clues
- Below 0.30 = Educated guess only

Return ONLY valid JSON:
{
  "locations": [
    {
      "name": "Most specific place name possible (street, landmark, intersection)",
      "city": "City name",
      "country": "Country name",
      "lat": 31.953900,
      "lng": 35.934000,
      "confidence": 0.85,
      "reasoning": "Detailed chain of evidence: what clues you found and how they led to this conclusion"
    }
  ],
  "overall_analysis": "Summary of all visual intelligence extracted from the image"
}

Return up to 5 candidates ranked by confidence. BE PRECISE — use 6 decimal places for coordinates. Never guess randomly; every coordinate must be justified by evidence.`;

    const aiResp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              { type: "image_url", image_url: { url: `data:${mime_type || "image/jpeg"};base64,${image_base64}` } },
            ],
          },
        ],
        max_tokens: 8192,
        temperature: 0.1,
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
