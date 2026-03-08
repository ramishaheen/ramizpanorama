import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Deterministic pseudo-random from seed
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

// Generate realistic simulated flights with smooth movement
function generateFallbackFlights(lamin: number, lamax: number, lomin: number, lomax: number) {
  const militaryCallsigns = ["RCH401","FORTE12","REAPER11","DOOM31","VIPER22","REACH445","NAVY601","IRON15","HAWK03","EAGLE77"];
  const civilCallsigns = ["UAE231","QTR456","MEA302","THY1845","SAS921","ETH707","KAC511","SVA203","BAW178","DLH499","AFR812","KLM643","ELY315","MSR704","GFA201","RJA108","FDB512","AIC101","PIA303","OMA654","FLY321","ABY100","NIA408","JZR102","KQA207"];
  const countries = ["United States","United Arab Emirates","Qatar","Turkey","Saudi Arabia","Israel","Iran","Jordan","Lebanon","Egypt","Germany","United Kingdom","France","India","Pakistan","Kuwait","Bahrain","Oman"];
  const aircraft: any[] = [];
  const latRange = lamax - lamin;
  const lngRange = lomax - lomin;
  const now = Date.now();
  const baseSeed = Math.floor(now / 15000); // changes every 15s

  // Scale count by viewport area
  const area = latRange * lngRange;
  const civilCount = Math.min(Math.max(Math.floor(area / 40), 8), 30);
  const milCount = Math.min(Math.max(Math.floor(area / 200), 2), 6);

  for (let i = 0; i < civilCount; i++) {
    const s1 = seededRandom(baseSeed + i * 7);
    const s2 = seededRandom(baseSeed + i * 13 + 1);
    const headingSeed = seededRandom(i * 31 + 5);
    const heading = headingSeed * 360;
    // Smooth drift based on heading
    const elapsed = (now % 15000) / 15000;
    const speed = 180 + s2 * 100; // km/h
    const driftDeg = (speed / 111000) * 15 * elapsed; // approx degrees moved in 15s
    const driftLat = Math.cos(heading * Math.PI / 180) * driftDeg;
    const driftLng = Math.sin(heading * Math.PI / 180) * driftDeg;

    aircraft.push({
      icao24: `sim_c_${i.toString(16).padStart(4,"0")}`,
      callsign: civilCallsigns[i % civilCallsigns.length],
      origin_country: countries[(i + 3) % countries.length],
      lat: lamin + s1 * latRange + driftLat,
      lng: lomin + s2 * lngRange + driftLng,
      altitude: 8500 + s1 * 4000,
      velocity: speed / 3.6, // m/s
      heading: Math.round(heading),
      vertical_rate: (seededRandom(baseSeed + i * 19) - 0.5) * 2,
      is_military: false,
    });
  }

  for (let i = 0; i < milCount; i++) {
    const s1 = seededRandom(baseSeed + i * 41 + 100);
    const s2 = seededRandom(baseSeed + i * 47 + 101);
    const heading = seededRandom(i * 53 + 200) * 360;
    const elapsed = (now % 15000) / 15000;
    const speed = 250 + s2 * 150;
    const driftDeg = (speed / 111000) * 15 * elapsed;

    aircraft.push({
      icao24: `sim_m_${i.toString(16).padStart(4,"0")}`,
      callsign: militaryCallsigns[i % militaryCallsigns.length],
      origin_country: countries[i % 3 === 0 ? 0 : (i % 3 === 1 ? 5 : 4)],
      lat: lamin + s1 * latRange + Math.cos(heading * Math.PI / 180) * driftDeg,
      lng: lomin + s2 * lngRange + Math.sin(heading * Math.PI / 180) * driftDeg,
      altitude: 10000 + s1 * 6000,
      velocity: speed / 3.6,
      heading: Math.round(heading),
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

    if (lamin == null || lamax == null || lomin == null || lomax == null) {
      return new Response(JSON.stringify({ error: "Missing bounding box parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OpenSky Network public API
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

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
