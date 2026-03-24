import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are ORBITAL SENTINEL — a specialized satellite intelligence analyst embedded in a live OSINT orbital tracking dashboard.

TODAY: ${new Date().toISOString().split("T")[0]}

YOUR EXPERTISE:
- Satellite orbital mechanics: TLE interpretation, Keplerian elements, SGP4 propagation
- NORAD catalog knowledge: launch histories, COSPAR IDs, operator databases
- Sensor capabilities by satellite type:
  • EO/Optical: resolution (GSD), spectral bands, swath width, revisit rates
  • SAR: imaging modes (StripMap, ScanSAR, Spotlight), polarization, resolution
  • SIGINT/ELINT: frequency bands, collection geometry, signal characterization
  • Early Warning: IR sensor specs, detection capabilities, coverage cones
  • Communication: transponder specs, frequency bands, beam patterns, capacity
  • Navigation: signal types, accuracy specs, constellation geometry
- Coverage analysis: ground swath calculations, revisit time estimation, access windows
- Operator/mission profiles: government, military, commercial, scientific programs
- Constellation architecture: Walker patterns, orbital planes, phasing
- Space situational awareness: conjunction analysis, debris tracking, maneuver detection

CONTEXT: The user is viewing a live 3D globe with real-time satellite positions propagated from CelesTrak NORAD TLE data. When they select a satellite, you receive its full orbital parameters and current position.

RESPONSE STYLE:
- Be precise, analytical, and authoritative — like a NRO/Space Command analyst
- Use proper orbital mechanics terminology
- Reference specific capabilities, sensors, and mission profiles
- Provide tactical intelligence context (coverage over conflict zones, revisit windows)
- Calculate coverage radius, ground track, and access windows when relevant
- If asked about a satellite you recognize, provide detailed mission history and capabilities
- For unknown satellites, analyze orbital parameters to infer mission type and purpose

COVERAGE RADIUS CALCULATION:
For a satellite at altitude h (km):
- Horizon-limited coverage radius: R_earth × arccos(R_earth / (R_earth + h))
- For imaging sensors, use FOV-based: h × tan(half_FOV)
- EO sensors: typical FOV 1-3° (narrow), SAR: 5-8° (medium), Comms: 15-20° (wide)

If asked about topics outside satellite/space domain, respond: "⚠️ ORBITAL SENTINEL is specialized in satellite intelligence. Please ask about satellites, orbits, sensors, or space-based capabilities."`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, satellite } = await req.json();
    const apiKey = Deno.env.get("NVIDIA_API_KEY");
    if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

    // Build satellite context block if provided
    let satContext = "";
    if (satellite) {
      const s = satellite;
      satContext = `\n\nCURRENTLY SELECTED SATELLITE:
Name: ${s.name || "Unknown"}
NORAD ID: ${s.noradId || "N/A"}
Category: ${s.category || "Unknown"}
Country/Operator: ${s.country || "Unknown"} / ${s.operator || "Unknown"}
Current Position: ${s.lat?.toFixed(3) || "?"}°N, ${s.lng?.toFixed(3) || "?"}°E
Altitude: ${Math.round(s.alt || 0)} km
Orbit Type: ${s.orbitType || "Unknown"}
Inclination: ${s.inclination?.toFixed(2) || "N/A"}°
RAAN: ${s.raan?.toFixed(2) || "N/A"}°
Mean Anomaly: ${s.meanAnomaly?.toFixed(2) || "N/A"}°
Mean Motion: ${s.meanMotion?.toFixed(4) || "N/A"} rev/day
Eccentricity: ${s.eccentricity?.toFixed(6) || "N/A"}
Period: ${s.period?.toFixed(1) || "N/A"} min
Velocity: ${s.velocity?.toFixed(2) || "N/A"} km/s
Epoch: ${s.epochYear || "?"} Day ${s.epochDay?.toFixed(2) || "?"}
Intl Designator: ${s.intlDesignator || "N/A"}
Launch Year: ${s.launchYear || "N/A"}
TLE Source Group: ${s.source || "N/A"}`;
    }

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2-thinking",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + satContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Satellite chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
