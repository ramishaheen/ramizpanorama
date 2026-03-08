import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchAdsbFi(lamin: number, lamax: number, lomin: number, lomax: number) {
  const centerLat = (lamin + lamax) / 2;
  const centerLon = (lomin + lomax) / 2;
  const latDiffKm = (lamax - lamin) * 111;
  const lonDiffKm = (lomax - lomin) * 111 * Math.cos(centerLat * Math.PI / 180);
  const radiusKm = Math.sqrt(latDiffKm * latDiffKm + lonDiffKm * lonDiffKm) / 2;
  const radiusNm = Math.min(Math.round(radiusKm / 1.852), 250);

  const url = `https://opendata.adsb.fi/api/v3/lat/${centerLat.toFixed(4)}/lon/${centerLon.toFixed(4)}/dist/${radiusNm}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) throw new Error(`adsb.fi returned ${response.status}`);

  const data = await response.json();
  const acList = data.ac || [];

  return acList.map((ac: any) => ({
    icao24: ac.hex || "",
    callsign: (ac.flight || "").trim(),
    origin_country: ac.r || "",
    registration: ac.r || "",
    type: ac.t || "",
    lat: ac.lat,
    lng: ac.lon,
    altitude: ac.alt_baro !== "ground" ? (ac.alt_baro || ac.alt_geom || 0) : 0,
    on_ground: ac.alt_baro === "ground",
    velocity: ac.gs != null ? ac.gs * 0.514444 : 0,
    heading: ac.track || ac.true_heading || 0,
    vertical_rate: ac.baro_rate != null ? ac.baro_rate * 0.00508 : 0,
    squawk: ac.squawk || "",
    is_military: ac.dbFlags === 1 || isMilitaryCallsign((ac.flight || "").trim()),
  })).filter((a: any) => a.lat != null && a.lng != null && !a.on_ground);
}

async function fetchOpenSky(lamin: number, lamax: number, lomin: number, lomax: number) {
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) throw new Error(`OpenSky returned ${response.status}`);

  const data = await response.json();
  return (data.states || []).map((s: any[]) => ({
    icao24: s[0],
    callsign: (s[1] || "").trim(),
    origin_country: s[2],
    registration: "",
    type: "",
    lat: s[6],
    lng: s[5],
    altitude: s[7] || s[13] || 0,
    on_ground: s[8],
    velocity: s[9] || 0,
    heading: s[10] || 0,
    vertical_rate: s[11] || 0,
    squawk: s[14] || "",
    is_military: isMilitaryCallsign((s[1] || "").trim()),
  })).filter((a: any) => a.lat != null && a.lng != null && !a.on_ground);
}

function isMilitaryCallsign(cs: string): boolean {
  return /^(RCH|DOOM|EVAC|NAVY|USAF|RAF|IAF|RFR|FAF|GAF|CNV|VIPER|HAWK|EAGLE|COBRA|REAPER|FORTE|JAKE|NCHO|PAT|DUKE|KING|REACH|IRON|STEEL)/i.test(cs);
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

    // Try adsb.fi first (best data quality)
    let aircraft: any[] = [];
    let source = "adsb.fi";

    try {
      aircraft = await fetchAdsbFi(lamin, lamax, lomin, lomax);
      source = "adsb.fi";
      console.log(`adsb.fi returned ${aircraft.length} aircraft`);
    } catch (err) {
      console.log("adsb.fi failed:", err instanceof Error ? err.message : "unknown");
    }

    // If adsb.fi returned few/no results, try OpenSky as fallback
    if (aircraft.length < 3) {
      try {
        const openSkyAircraft = await fetchOpenSky(lamin, lamax, lomin, lomax);
        console.log(`OpenSky returned ${openSkyAircraft.length} aircraft`);
        if (openSkyAircraft.length > aircraft.length) {
          // Merge: keep adsb.fi entries (richer data), add OpenSky ones not already present
          const existingIcaos = new Set(aircraft.map(a => a.icao24));
          const merged = [...aircraft];
          for (const ac of openSkyAircraft) {
            if (!existingIcaos.has(ac.icao24)) {
              merged.push(ac);
            }
          }
          aircraft = merged;
          source = aircraft.length > openSkyAircraft.length ? "adsb.fi+opensky" : "opensky";
        }
      } catch (err) {
        console.log("OpenSky fallback failed:", err instanceof Error ? err.message : "unknown");
      }
    }

    return new Response(JSON.stringify({
      aircraft,
      time: Date.now() / 1000,
      total: aircraft.length,
      source,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Live flights error:", e);
    return new Response(JSON.stringify({ aircraft: [], time: Date.now() / 1000, total: 0, source: "error", error: e instanceof Error ? e.message : "Unknown" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
