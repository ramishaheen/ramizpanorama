import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate realistic simulated flights when OpenSky is unavailable
function generateFallbackFlights(lamin: number, lamax: number, lomin: number, lomax: number) {
  const militaryCallsigns = ["RCH401", "FORTE12", "REAPER11", "DOOM31", "VIPER22", "REACH445", "NAVY601", "IRON15", "HAWK03", "EAGLE77"];
  const civilCallsigns = ["UAE123", "QTR456", "MEA302", "THY1845", "SAS921", "ETH707", "KAC511", "SVA203", "BAW178", "DLH499", "AFR812", "KLM643", "ELY315", "MSR704", "GFA201", "RJA108", "FDB512", "AIC101", "PIA303", "OMA654"];
  const countries = ["United States", "United Arab Emirates", "Qatar", "Turkey", "Saudi Arabia", "Israel", "Iran", "Jordan", "Lebanon", "Egypt", "Germany", "United Kingdom", "France"];

  const aircraft: any[] = [];
  const latRange = lamax - lamin;
  const lngRange = lomax - lomin;
  const seed = Math.floor(Date.now() / 30000); // changes every 30s for slight movement

  // Generate 8-15 civil + 2-4 military
  const civilCount = 8 + (seed % 8);
  const milCount = 2 + (seed % 3);

  for (let i = 0; i < civilCount; i++) {
    const hash = ((seed * 31 + i * 17) % 10000) / 10000;
    const hash2 = ((seed * 37 + i * 23) % 10000) / 10000;
    // Slight drift each 30s cycle
    const drift = ((Date.now() % 30000) / 30000) * 0.02;
    aircraft.push({
      icao24: `sim_c_${i.toString(16).padStart(4, "0")}`,
      callsign: civilCallsigns[i % civilCallsigns.length],
      origin_country: countries[(i + 3) % countries.length],
      lat: lamin + hash * latRange + drift * (i % 2 === 0 ? 1 : -1),
      lng: lomin + hash2 * lngRange + drift * (i % 2 === 0 ? -1 : 1),
      altitude: 8000 + hash * 4000,
      velocity: 180 + hash2 * 80,
      heading: (hash * 360) | 0,
      vertical_rate: 0,
      is_military: false,
    });
  }

  for (let i = 0; i < milCount; i++) {
    const hash = ((seed * 41 + i * 53) % 10000) / 10000;
    const hash2 = ((seed * 47 + i * 59) % 10000) / 10000;
    const drift = ((Date.now() % 30000) / 30000) * 0.015;
    aircraft.push({
      icao24: `sim_m_${i.toString(16).padStart(4, "0")}`,
      callsign: militaryCallsigns[i % militaryCallsigns.length],
      origin_country: countries[i % 3 === 0 ? 0 : (i % 3 === 1 ? 6 : 5)],
      lat: lamin + hash * latRange + drift,
      lng: lomin + hash2 * lngRange - drift,
      altitude: 10000 + hash * 5000,
      velocity: 200 + hash2 * 120,
      heading: (hash2 * 360) | 0,
      vertical_rate: 0,
      is_military: true,
    });
  }

  return aircraft;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lamin, lamax, lomin, lomax } = await req.json();

    if (!lamin || !lamax || !lomin || !lomax) {
      return new Response(JSON.stringify({ error: "Missing bounding box parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OpenSky Network public API
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.log("OpenSky rate limited, using fallback");
          const aircraft = generateFallbackFlights(lamin, lamax, lomin, lomax);
          return new Response(JSON.stringify({ aircraft, time: Date.now() / 1000, total: aircraft.length, source: "simulated" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`OpenSky API returned ${response.status}`);
      }

      const data = await response.json();
      
      const aircraft = (data.states || []).map((s: any[]) => ({
        icao24: s[0],
        callsign: (s[1] || "").trim(),
        origin_country: s[2],
        lng: s[5],
        lat: s[6],
        altitude: s[7] || s[13] || 0,
        on_ground: s[8],
        velocity: s[9] || 0,
        heading: s[10] || 0,
        vertical_rate: s[11] || 0,
        category: s[17] || 0,
        is_military: /^(RCH|DOOM|EVAC|NAVY|USAF|RAF|IAF|RFR|FAF|GAF|CNV|VIPER|HAWK|EAGLE|COBRA|REAPER|FORTE|JAKE|NCHO|PAT|DUKE|KING|REACH|IRON|STEEL)/i.test((s[1] || "").trim()),
      })).filter((a: any) => a.lat != null && a.lng != null && !a.on_ground);

      if (aircraft.length === 0) {
        // OpenSky returned empty, use fallback
        console.log("OpenSky returned 0 flights, using fallback");
        const fallback = generateFallbackFlights(lamin, lamax, lomin, lomax);
        return new Response(JSON.stringify({ aircraft: fallback, time: Date.now() / 1000, total: fallback.length, source: "simulated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        aircraft,
        time: data.time,
        total: aircraft.length,
        source: "opensky",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.log("OpenSky fetch failed, using fallback:", fetchErr instanceof Error ? fetchErr.message : "unknown");
      const aircraft = generateFallbackFlights(lamin, lamax, lomin, lomax);
      return new Response(JSON.stringify({ aircraft, time: Date.now() / 1000, total: aircraft.length, source: "simulated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("Live flights error:", e);
    return new Response(JSON.stringify({ aircraft: [], time: Date.now() / 1000, error: e instanceof Error ? e.message : "Unknown" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
