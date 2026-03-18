const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const DETECTION_PROMPT = `You are a computer vision AI analyzing a street-level photograph. Detect ALL visible objects and provide bounding box coordinates as percentages of the image dimensions.

DETECT these object categories:
- Person/Pedestrian
- Car/Vehicle
- Truck
- Bus
- Motorcycle/Bicycle
- Traffic Light
- Stop Sign/Sign
- Dog/Animal
- Military Vehicle (if any)

For EACH detected object, provide:
- label: object type
- confidence: 0.0-1.0 (how certain you are)
- x: left edge as percentage of image width (0-100)
- y: top edge as percentage of image height (0-100)  
- w: width as percentage of image width
- h: height as percentage of image height

IMPORTANT RULES:
- Be precise with bounding boxes - they should tightly fit the detected object
- Only detect objects you can actually see - do NOT hallucinate objects
- Confidence should reflect actual certainty
- x,y is the TOP-LEFT corner of the bounding box
- Objects far away should have smaller bounding boxes
- Objects in foreground should have larger bounding boxes
- Typical person: w=3-8%, h=10-25% depending on distance
- Typical car: w=8-20%, h=5-15% depending on angle/distance
- Do NOT detect buildings, sky, road surface - only discrete objects

Return ONLY valid JSON:
{
  "detections": [
    {"label": "Person", "confidence": 0.92, "x": 45.2, "y": 38.5, "w": 4.1, "h": 18.3},
    {"label": "Car", "confidence": 0.88, "x": 12.0, "y": 55.0, "w": 15.5, "h": 10.2}
  ],
  "scene_summary": "Brief one-line description of the scene",
  "object_count": 5
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lat, lng, heading, pitch, fov, image_base64, mime_type } = await req.json();

    const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageData: string;
    let imageMime: string;

    if (image_base64) {
      // Client sent an image directly (e.g. from canvas capture)
      imageData = image_base64;
      imageMime = mime_type || "image/jpeg";
    } else if (GOOGLE_MAPS_KEY && lat && lng) {
      // Fetch from Google Street View Static API
      const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&heading=${heading || 0}&pitch=${pitch || 0}&fov=${fov || 90}&key=${GOOGLE_MAPS_KEY}`;
      const imgResp = await fetch(svUrl);
      if (!imgResp.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch street view image", status: imgResp.status }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const imgBuffer = await imgResp.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      imageMime = imgResp.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    } else {
      return new Response(JSON.stringify({ error: "Provide image_base64 or lat/lng with Google Maps key" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Gemini via Lovable AI Gateway, fallback to direct Gemini API
    let aiResp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: DETECTION_PROMPT },
              { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageData}` } },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    // Fallback to direct Gemini API if gateway credits exhausted
    if (aiResp.status === 402 || aiResp.status === 429) {
      const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_2") || Deno.env.get("GEMINI_API_KEY");
      if (GEMINI_KEY) {
        console.log("Gateway returned " + aiResp.status + ", falling back to direct Gemini API");
        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: DETECTION_PROMPT },
                  { inline_data: { mime_type: imageMime, data: imageData } },
                ],
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
            }),
          }
        );
        if (geminiResp.ok) {
          const gData = await geminiResp.json();
          const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          // Repackage into OpenAI-compatible format for downstream parsing
          aiResp = new Response(JSON.stringify({ choices: [{ message: { content: rawText } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          console.error("Gemini fallback also failed:", geminiResp.status);
        }
      }
    }

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Clean thinking blocks and parse JSON
    const cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse AI response:", cleaned.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse detections", detections: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      // Try to salvage by fixing common JSON issues: trailing commas, truncation
      let fixedJson = jsonMatch[0]
        .replace(/,\s*]/g, "]")   // trailing comma in arrays
        .replace(/,\s*}/g, "}")   // trailing comma in objects
        .replace(/[\x00-\x1F\x7F]/g, " "); // control chars
      
      // If JSON is truncated mid-array, try to close it
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      
      // Truncate to last complete object in the detections array
      const lastCompleteObj = fixedJson.lastIndexOf("}");
      if (lastCompleteObj > 0 && openBrackets > closeBrackets) {
        fixedJson = fixedJson.slice(0, lastCompleteObj + 1);
        for (let i = 0; i < openBrackets - closeBrackets; i++) fixedJson += "]";
        for (let i = 0; i < openBraces - closeBraces - 0; i++) fixedJson += "}";
      }

      try {
        result = JSON.parse(fixedJson);
      } catch {
        console.error("JSON repair failed:", (parseErr as Error).message, cleaned.slice(0, 500));
        return new Response(JSON.stringify({ detections: [], scene_summary: "Detection parse error", object_count: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Assign colors based on label
    const colorMap: Record<string, string> = {
      "Person": "#3b82f6", "Pedestrian": "#3b82f6",
      "Car": "#22c55e", "Vehicle": "#22c55e",
      "Truck": "#f59e0b",
      "Bus": "#8b5cf6",
      "Motorcycle": "#06b6d4", "Bicycle": "#06b6d4",
      "Traffic Light": "#ec4899",
      "Sign": "#a855f7", "Stop Sign": "#a855f7",
      "Dog": "#f97316", "Animal": "#f97316",
      "Military Vehicle": "#ef4444",
    };

    const detections = (result.detections || []).map((d: any, i: number) => ({
      id: `ai-${Date.now()}-${i}`,
      label: d.label,
      confidence: Math.min(1, Math.max(0, d.confidence || 0.5)),
      x: Math.max(0, Math.min(95, d.x || 0)),
      y: Math.max(0, Math.min(95, d.y || 0)),
      w: Math.max(1, Math.min(40, d.w || 5)),
      h: Math.max(1, Math.min(40, d.h || 5)),
      color: colorMap[d.label] || "#94a3b8",
    }));

    return new Response(JSON.stringify({
      detections,
      scene_summary: result.scene_summary || "",
      object_count: detections.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("streetview-detect error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
