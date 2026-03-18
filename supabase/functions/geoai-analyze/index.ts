import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lat, lng, zoom = 16, analysisType = "full" } = await req.json();
    if (!lat || !lng) throw new Error("lat and lng are required");

    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get satellite image from Google Maps Static API
    let imageUrl = "";
    if (GOOGLE_MAPS_API_KEY) {
      imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;
    }

    const analysisPrompts: Record<string, string> = {
      full: `You are a GeoAI geospatial intelligence analyst. Analyze the satellite imagery at coordinates (${lat}, ${lng}) at zoom level ${zoom}.

Provide a comprehensive geospatial analysis in the following JSON format:
{
  "land_use": {
    "primary": "string (e.g., urban, agricultural, industrial, forest, water, desert, mixed)",
    "breakdown": [{"type": "string", "percentage": number, "description": "string"}],
    "urbanization_level": "high|medium|low"
  },
  "infrastructure": {
    "roads": {"density": "high|medium|low|none", "types": ["highway", "secondary", "unpaved"]},
    "buildings": {"density": "high|medium|low|none", "types": ["residential", "commercial", "industrial", "military"]},
    "critical": [{"type": "string", "description": "string", "confidence": number}]
  },
  "terrain": {
    "type": "flat|hilly|mountainous|coastal|river_valley|desert",
    "elevation_estimate": "string",
    "vegetation": "dense|moderate|sparse|none",
    "water_features": [{"type": "river|lake|reservoir|canal|coast", "description": "string"}]
  },
  "objects_detected": [
    {"label": "string", "category": "vehicle|structure|vessel|aircraft|equipment|natural", "confidence": number, "description": "string", "threat_level": "none|low|medium|high"}
  ],
  "change_indicators": [
    {"type": "construction|demolition|movement|vegetation_change|water_level", "description": "string", "confidence": number}
  ],
  "military_assessment": {
    "installations_detected": boolean,
    "fortifications": boolean,
    "staging_areas": boolean,
    "supply_routes": boolean,
    "notes": "string"
  },
  "risk_factors": [
    {"factor": "string", "severity": "low|medium|high|critical", "description": "string"}
  ],
  "summary": "string (2-3 sentence executive summary)",
  "strategic_value": "none|low|moderate|high|critical",
  "recommended_actions": ["string"]
}

Analyze based on the geographic location context. For coordinates in the Middle East, consider conflict zones, military infrastructure, and strategic chokepoints. Be specific and actionable.`,

      objects: `You are a GeoAI object detection specialist. For the area at (${lat}, ${lng}), identify all visible objects, vehicles, structures, and features. Return JSON:
{
  "objects_detected": [{"label": "string", "category": "vehicle|structure|vessel|aircraft|equipment|natural", "confidence": number, "description": "string", "estimated_count": number, "threat_level": "none|low|medium|high"}],
  "summary": "string"
}`,

      terrain: `You are a GeoAI terrain analyst. Analyze terrain at (${lat}, ${lng}). Return JSON:
{
  "terrain": {"type": "string", "elevation_estimate": "string", "slope": "string", "vegetation": "string", "soil_type": "string", "trafficability": "good|moderate|poor|impassable"},
  "water_features": [{"type": "string", "description": "string"}],
  "weather_impact": "string",
  "military_terrain_assessment": "string",
  "summary": "string"
}`,

      change: `You are a GeoAI change detection analyst. For (${lat}, ${lng}), assess likely recent changes and indicators. Return JSON:
{
  "change_indicators": [{"type": "string", "description": "string", "confidence": number, "timeframe": "string"}],
  "baseline_assessment": "string",
  "anomalies": [{"description": "string", "severity": "low|medium|high"}],
  "summary": "string"
}`,
    };

    const prompt = analysisPrompts[analysisType] || analysisPrompts.full;

    const messages: any[] = [
      { role: "system", content: "You are GeoAI, an advanced geospatial artificial intelligence system inspired by opengeos/geoai. You perform satellite imagery analysis, object detection, land use classification, terrain analysis, and change detection. Always respond with valid JSON only, no markdown." },
    ];

    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          { type: "text", text: prompt },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: prompt + "\n\nNote: No satellite image available. Provide analysis based on geographic knowledge of these coordinates.",
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";

    // Clean and parse JSON
    let analysis: any;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      // Try to repair
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
        else analysis = { summary: rawContent, error: "Could not parse structured response" };
      } catch {
        analysis = { summary: rawContent, error: "Could not parse structured response" };
      }
    }

    return new Response(JSON.stringify({
      lat, lng, zoom, analysisType,
      analysis,
      has_imagery: !!GOOGLE_MAPS_API_KEY,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("GeoAI error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
