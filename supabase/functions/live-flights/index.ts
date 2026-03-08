import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // OpenSky Network public API — no auth needed for anonymous access
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        // OpenSky may rate-limit anonymous users
        if (response.status === 429) {
          return new Response(JSON.stringify({ states: [], time: Date.now() / 1000, _note: "rate_limited" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`OpenSky API returned ${response.status}`);
      }

      const data = await response.json();
      
      // Transform raw states into clean aircraft objects
      const aircraft = (data.states || []).map((s: any[]) => ({
        icao24: s[0],
        callsign: (s[1] || "").trim(),
        origin_country: s[2],
        lng: s[5],
        lat: s[6],
        altitude: s[7] || s[13] || 0, // baro_altitude or geo_altitude
        on_ground: s[8],
        velocity: s[9] || 0,
        heading: s[10] || 0,
        vertical_rate: s[11] || 0,
        category: s[17] || 0, // 0=unknown, 1-4=light to heavy, etc
        // Classify as military based on callsign patterns
        is_military: /^(RCH|DOOM|EVAC|NAVY|USAF|RAF|IAF|RFR|FAF|GAF|CNV|VIPER|HAWK|EAGLE|COBRA|REAPER|FORTE|JAKE|NCHO|PAT|DUKE|KING|REACH|IRON|STEEL)/i.test((s[1] || "").trim()),
      })).filter((a: any) => a.lat != null && a.lng != null && !a.on_ground);

      return new Response(JSON.stringify({
        aircraft,
        time: data.time,
        total: aircraft.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.error("Live flights error:", e);
    return new Response(JSON.stringify({ aircraft: [], time: Date.now() / 1000, error: e instanceof Error ? e.message : "Unknown" }), {
      status: 200, // Return empty array, not error status
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
