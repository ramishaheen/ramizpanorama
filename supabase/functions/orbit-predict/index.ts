import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SGP4-lite propagator for future positions
function propagatePosition(
  inclination: number, raan: number, meanAnomaly: number,
  meanMotion: number, eccentricity: number,
  epochYear: number, epochDay: number, alt: number,
  targetDate: Date
): { lat: number; lng: number; alt: number } {
  const startOfYear = new Date(epochYear, 0, 1);
  const targetDayOfYear = (targetDate.getTime() - startOfYear.getTime()) / 86400000;
  const elapsedDays = targetDayOfYear - epochDay;
  const totalRevs = elapsedDays * meanMotion;
  const currentMA = (((meanAnomaly + totalRevs * 360) % 360) + 360) % 360;

  const E = currentMA + (eccentricity * 180 / Math.PI) * Math.sin(currentMA * Math.PI / 180);
  const nu = E;
  const argLat = nu * Math.PI / 180;
  const incRad = inclination * Math.PI / 180;

  const lat = Math.asin(Math.sin(incRad) * Math.sin(argLat)) * (180 / Math.PI);
  const greenwichOffset = targetDate.getUTCHours() * 15 + targetDate.getUTCMinutes() * 0.25 + targetDate.getUTCSeconds() * (0.25 / 60);
  const ascNode = raan - greenwichOffset;
  const lng = (((ascNode + Math.atan2(Math.cos(incRad) * Math.sin(argLat), Math.cos(argLat)) * (180 / Math.PI)) % 360) + 540) % 360 - 180;

  return { lat: Math.max(-85, Math.min(85, lat)), lng, alt };
}

// Generate future positions at intervals
function predictFuturePositions(
  params: { inclination: number; raan: number; meanAnomaly: number; meanMotion: number; eccentricity: number; epochYear: number; epochDay: number; alt: number },
  hoursAhead: number = 24,
  intervalMinutes: number = 10
): { time: string; lat: number; lng: number; alt: number }[] {
  const positions: { time: string; lat: number; lng: number; alt: number }[] = [];
  const now = Date.now();
  const totalSteps = Math.floor((hoursAhead * 60) / intervalMinutes);

  for (let i = 0; i <= totalSteps; i++) {
    const t = new Date(now + i * intervalMinutes * 60000);
    const pos = propagatePosition(
      params.inclination, params.raan, params.meanAnomaly,
      params.meanMotion, params.eccentricity,
      params.epochYear, params.epochDay, params.alt, t
    );
    positions.push({ time: t.toISOString(), ...pos });
  }
  return positions;
}

// Find passes over a target location
function findPasses(
  params: { inclination: number; raan: number; meanAnomaly: number; meanMotion: number; eccentricity: number; epochYear: number; epochDay: number; alt: number },
  targetLat: number, targetLng: number,
  radiusKm: number = 1500,
  hoursAhead: number = 48
): { startTime: string; closestTime: string; endTime: string; minDistKm: number; maxElevation: number }[] {
  const passes: any[] = [];
  const now = Date.now();
  let inPass = false;
  let currentPass: any = {};
  let minDist = Infinity;

  for (let min = 0; min <= hoursAhead * 60; min += 1) {
    const t = new Date(now + min * 60000);
    const pos = propagatePosition(
      params.inclination, params.raan, params.meanAnomaly,
      params.meanMotion, params.eccentricity,
      params.epochYear, params.epochDay, params.alt, t
    );

    // Haversine distance
    const R = 6371;
    const dLat = (pos.lat - targetLat) * Math.PI / 180;
    const dLng = (pos.lng - targetLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(targetLat * Math.PI / 180) * Math.cos(pos.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (dist <= radiusKm) {
      if (!inPass) {
        inPass = true;
        currentPass = { startTime: t.toISOString(), minDistKm: dist, closestTime: t.toISOString() };
        minDist = dist;
      }
      if (dist < minDist) {
        minDist = dist;
        currentPass.minDistKm = dist;
        currentPass.closestTime = t.toISOString();
      }
    } else if (inPass) {
      inPass = false;
      currentPass.endTime = t.toISOString();
      currentPass.maxElevation = Math.atan2(params.alt, minDist) * 180 / Math.PI;
      passes.push(currentPass);
      minDist = Infinity;
      if (passes.length >= 10) break;
    }
  }
  return passes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, satellite, hoursAhead, targetLat, targetLng, radiusKm, intervalMinutes } = body;

    if (!satellite) throw new Error("Missing satellite orbital parameters");

    const params = {
      inclination: satellite.inclination,
      raan: satellite.raan,
      meanAnomaly: satellite.meanAnomaly,
      meanMotion: satellite.meanMotion,
      eccentricity: satellite.eccentricity,
      epochYear: satellite.epochYear,
      epochDay: satellite.epochDay,
      alt: satellite.alt,
    };

    let result: any = {};

    if (action === "predict_track") {
      // Predict future ground track
      const positions = predictFuturePositions(params, hoursAhead || 24, intervalMinutes || 10);
      result = { positions, satellite_name: satellite.name, generated_at: new Date().toISOString() };
    } else if (action === "find_passes") {
      // Find passes over a target
      const passes = findPasses(params, targetLat || 31.5, targetLng || 34.8, radiusKm || 1500, hoursAhead || 48);
      result = { passes, target: { lat: targetLat || 31.5, lng: targetLng || 34.8 }, satellite_name: satellite.name, generated_at: new Date().toISOString() };
    } else if (action === "full_analysis") {
      // Compute predictions + AI analysis
      const positions = predictFuturePositions(params, hoursAhead || 12, 5);
      const passes = findPasses(params, targetLat || 31.5, targetLng || 34.8, radiusKm || 1500, hoursAhead || 48);

      // Call AI for deep analysis
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

      const aiPrompt = `You are an expert orbital mechanics and satellite intelligence analyst. Analyze this satellite and its predicted orbital data.

SATELLITE: ${satellite.name}
NORAD ID: ${satellite.noradId || "N/A"}
Category: ${satellite.category || "Unknown"}
Country: ${satellite.country || "Unknown"}
Operator: ${satellite.operator || "Unknown"}
Current Position: ${satellite.lat?.toFixed(3)}°N, ${satellite.lng?.toFixed(3)}°E
Altitude: ${Math.round(satellite.alt)} km
Inclination: ${satellite.inclination?.toFixed(2)}°
Eccentricity: ${satellite.eccentricity?.toFixed(5)}
Mean Motion: ${satellite.meanMotion?.toFixed(4)} rev/day
Period: ${(1440 / satellite.meanMotion)?.toFixed(1)} minutes
RAAN: ${satellite.raan?.toFixed(2)}°

PREDICTED PASSES OVER MIDDLE EAST (next 48h): ${JSON.stringify(passes.slice(0, 5))}
NEXT POSITIONS (sample): ${JSON.stringify(positions.filter((_, i) => i % 12 === 0).slice(0, 8))}

Provide a structured analysis:
1. **Orbit Classification**: Precise orbit type, regime, and characteristics
2. **Coverage Analysis**: What regions does this orbit cover, with emphasis on Middle East coverage windows
3. **Next Passes**: When will it pass over key Middle East locations (Israel, Iran, Saudi Arabia, UAE) 
4. **Mission Assessment**: Based on orbital parameters and satellite identity, what is the likely mission
5. **Strategic Significance**: Intelligence value and strategic importance
6. **Orbital Decay/Maneuver Indicators**: Any signs of orbital adjustments based on eccentricity and epoch
7. **Prediction Confidence**: How accurate are these predictions based on TLE age and orbital stability

Be precise with times and positions. Use UTC.`;

      const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a satellite orbital mechanics and OSINT intelligence expert. Provide precise, technical analysis." },
            { role: "user", content: aiPrompt },
          ],
        }),
      });

      let aiAnalysis = "";
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        aiAnalysis = aiData.choices?.[0]?.message?.content || "";
      }

      result = {
        positions,
        passes,
        ai_analysis: aiAnalysis,
        satellite_name: satellite.name,
        target: { lat: targetLat || 31.5, lng: targetLng || 34.8, name: "Middle East" },
        generated_at: new Date().toISOString(),
      };
    } else {
      throw new Error("Unknown action. Use: predict_track, find_passes, or full_analysis");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Orbit predict error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
