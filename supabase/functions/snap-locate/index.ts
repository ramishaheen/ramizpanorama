const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const AI_GATEWAY_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// ── Pass 1 Prompt: Evidence Extraction ──
const pass1Prompt = `You are an elite GEOINT forensic analyst. Your ONLY task is to extract every possible visual clue from this photograph. Do NOT guess coordinates yet.

EXTRACT ALL OF THE FOLLOWING:

1. TEXT & SIGNAGE:
   - Every visible word, letter, number (signs, storefronts, license plates, graffiti, stickers, billboards)
   - Script type (Latin, Arabic, Hebrew, Cyrillic, Devanagari, CJK, Thai, etc.)
   - Language(s) detected and dialect indicators
   - License plate format, color scheme, country codes
   - Brand names (local and international chains)

2. INFRASTRUCTURE:
   - Road surface type, lane marking style (white/yellow, dashed/solid), curb design
   - Traffic light style, signal pole type, pedestrian crossing patterns
   - Power line configuration, utility pole material and design
   - Street furniture: bollard style, bench design, trash can type, bus stop shelter design
   - Sidewalk material and laying pattern
   - Guard rail style, road barrier type

3. ARCHITECTURE:
   - Building materials (limestone, sandstone, red brick, concrete, stucco, wood)
   - Roof style (flat, pitched, tile color, material)
   - Window design (shutters, balconies, AC unit placement patterns)
   - Construction era estimation
   - Building height and density
   - Distinctive architectural features (arches, columns, ornamental details)

4. ENVIRONMENT:
   - Tree species (palm type, pine, eucalyptus, deciduous, olive, etc.)
   - Ground cover, grass type, garden plants
   - Soil/rock color and geological type
   - Sun angle and shadow direction (estimate cardinal direction and time of day)
   - Sky conditions, atmospheric haze, pollution level
   - Terrain: flat, hilly, coastal, mountainous, desert, urban canyon

5. CULTURAL & CONTEXTUAL:
   - Vehicle makes, models, and market specificity (right-hand or left-hand drive)
   - Driving side (left or right)
   - Pedestrian clothing styles, cultural markers
   - Religious buildings or symbols visible
   - Shop types and commercial patterns
   - Currency symbols, phone number formats visible
   - Any flags, emblems, or national symbols

6. REGION-SPECIFIC FORENSICS:
   - Middle East: Jerusalem stone color, settlement patterns, Hebrew/Arabic bilingual signs, Israeli/Palestinian road markings
   - Europe: cobblestone patterns, window shutter styles, pharmacy cross signs, EU license plates
   - East Asia: character styles (Simplified/Traditional Chinese, Japanese kanji+kana, Korean hangul), vending machine types
   - Americas: street grid patterns, fire hydrant styles, mailbox types
   - Africa: laterite soil color, vegetation zones, colonial architecture remnants
   - South Asia: auto-rickshaw types, Hindi/regional script signs, temple architecture

Return ONLY valid JSON:
{
  "evidence": {
    "text_and_signs": ["list every piece of text found"],
    "scripts_languages": ["scripts and languages identified"],
    "license_plates": ["format and details"],
    "infrastructure": ["all infrastructure observations"],
    "architecture": ["all building observations"],
    "environment": ["all environmental observations"],
    "cultural": ["all cultural and contextual clues"],
    "vehicles": ["vehicle types and market specifics"],
    "region_indicators": ["specific regional forensic matches"]
  },
  "preliminary_region": "Your best guess of the broad region/country based on evidence",
  "driving_side": "left or right",
  "estimated_sun_direction": "cardinal direction the sun appears to be"
}`;

// ── Pass 2 Prompt: Coordinate Pinpointing ──
const pass2Prompt = `You are an elite GEOINT analyst with 20+ years of experience. You have already extracted visual evidence from this photograph (provided below). Now use that evidence AND the original image to determine the EXACT coordinates.

EXTRACTED EVIDENCE FROM PASS 1:
{EVIDENCE}

CRITICAL INSTRUCTIONS:

1. CROSS-REFERENCE each piece of evidence against known geographic databases:
   - Match text/signs to specific businesses, streets, or landmarks on Google Maps
   - Match architecture style to specific neighborhoods
   - Match vegetation to climate zones and narrow the latitude band
   - Match infrastructure standards to specific countries/regions

2. CAMERA POSITION ESTIMATION:
   - Consider the camera angle (elevated, street-level, looking up/down)
   - Estimate distance to visible landmarks based on perspective and apparent size
   - The coordinates should represent WHERE THE CAMERA IS, not where the landmark is
   - If a landmark is 200m away, adjust coordinates accordingly based on viewing angle

3. PRECISION REQUIREMENTS:
   - If you identify a specific street or intersection: provide coordinates to 6 decimal places (±1m)
   - If you identify a neighborhood: provide the most likely street within it
   - NEVER place coordinates at the geographic center of a city
   - NEVER guess a famous landmark unless you have direct visual evidence

4. NEGATIVE CONSTRAINTS:
   - Do NOT default to capital cities or major landmarks without evidence
   - Do NOT guess coordinates in the center of a city if you cannot identify the exact neighborhood
   - Do NOT provide coordinates for a country's most famous location unless you see it
   - If evidence is weak, say so with low confidence rather than guessing a popular location

5. CONFIDENCE CALIBRATION:
   - 0.90+ = Specific landmark, street name, or unique building positively identified
   - 0.70-0.89 = Confident about city and neighborhood, strong corroborating evidence
   - 0.50-0.69 = Confident about country and region, multiple consistent clues
   - 0.30-0.49 = General area based on environmental/cultural clues, limited specifics
   - Below 0.30 = Educated guess only, state clearly what's uncertain

Return ONLY valid JSON:
{
  "locations": [
    {
      "name": "Most specific place name (street, landmark, intersection, building name)",
      "city": "City name",
      "country": "Country name",
      "lat": 31.953900,
      "lng": 35.934000,
      "confidence": 0.85,
      "reasoning": "Detailed chain of evidence: [clue] → [inference] → [location]. Explain camera position relative to identified landmarks."
    }
  ],
  "overall_analysis": "Comprehensive summary of all visual intelligence. Explain how Pass 1 evidence was cross-referenced to reach these conclusions. Mention any conflicting clues and how they were resolved."
}

Return up to 5 candidates ranked by confidence. Use 6 decimal places. Every coordinate must be justified.`;

function buildPass1Body(image_base64: string, mime_type: string, model: string) {
  return JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: pass1Prompt },
          { type: "image_url", image_url: { url: `data:${mime_type || "image/jpeg"};base64,${image_base64}` } },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });
}

function buildPass2Body(image_base64: string, mime_type: string, evidence: string, model: string) {
  const prompt = pass2Prompt.replace("{EVIDENCE}", evidence);
  return JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime_type || "image/jpeg"};base64,${image_base64}` } },
        ],
      },
    ],
    max_tokens: 8192,
    temperature: 0.1,
  });
}

async function callAI(
  body: string,
  geminiKey: string | undefined,
  lovableKey: string | undefined,
  directModel: string,
): Promise<Response> {
  let resp: Response | null = null;

  // Primary: direct Gemini
  if (geminiKey) {
    try {
      resp = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${geminiKey}`, "Content-Type": "application/json" },
        body,
      });
      if (!resp.ok) {
        console.error(`Direct Gemini ${directModel} failed:`, resp.status);
        resp = null;
      }
    } catch (e) {
      console.error(`Direct Gemini error:`, e);
      resp = null;
    }
  }

  // Fallback: Lovable AI Gateway
  if (!resp) {
    if (!lovableKey) throw new Error("No AI keys configured");
    console.log("Falling back to Lovable AI Gateway");
    resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body,
    });
  }

  return resp!;
}

function parseJSON(raw: string) {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, mime_type } = await req.json();
    if (!image_base64) throw new Error("image_base64 is required");

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_2");
    const LOVABLE_KEY = Deno.env.get("NVIDIA_API_KEY");

    // ═══ PASS 1: Evidence Extraction (Flash) ═══
    console.log("Pass 1: Extracting visual evidence...");
    const pass1Body = buildPass1Body(image_base64, mime_type, "gemini-2.5-flash");
    const pass1GatewayBody = buildPass1Body(image_base64, mime_type, "moonshotai/kimi-k2-thinking");

    let pass1Resp = await callAI(
      GEMINI_KEY ? pass1Body : pass1GatewayBody,
      GEMINI_KEY,
      LOVABLE_KEY,
      "gemini-2.5-flash",
    );

    if (!pass1Resp.ok) {
      if (pass1Resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (pass1Resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Pass 1 AI failed: ${pass1Resp.status}`);
    }

    const pass1Data = await pass1Resp.json();
    const pass1Raw = pass1Data.choices?.[0]?.message?.content || "";
    const evidence = parseJSON(pass1Raw);

    if (!evidence) {
      console.error("Pass 1 parse failed, raw:", pass1Raw.slice(0, 500));
      throw new Error("Failed to extract visual evidence");
    }

    const evidenceStr = JSON.stringify(evidence, null, 2);
    console.log("Pass 1 complete. Evidence extracted:", evidenceStr.slice(0, 300));

    // ═══ PASS 2: Coordinate Pinpointing (Pro) ═══
    console.log("Pass 2: Pinpointing coordinates...");
    const pass2Body = buildPass2Body(image_base64, mime_type, evidenceStr, "gemini-2.5-pro");
    const pass2GatewayBody = buildPass2Body(image_base64, mime_type, evidenceStr, "moonshotai/kimi-k2-thinking");

    let pass2Resp = await callAI(
      GEMINI_KEY ? pass2Body : pass2GatewayBody,
      GEMINI_KEY,
      LOVABLE_KEY,
      "gemini-2.5-pro",
    );

    if (!pass2Resp.ok) {
      if (pass2Resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (pass2Resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Pass 2 AI failed: ${pass2Resp.status}`);
    }

    const pass2Data = await pass2Resp.json();
    const pass2Raw = pass2Data.choices?.[0]?.message?.content || "";
    const result = parseJSON(pass2Raw);

    if (!result) {
      return new Response(JSON.stringify({ error: "Failed to parse coordinates", raw: pass2Raw.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Attach the extracted evidence for transparency
    result.extracted_evidence = evidence;

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
