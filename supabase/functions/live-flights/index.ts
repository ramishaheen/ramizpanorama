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

    if (lamin == null || lamax == null || lomin == null || lomax == null) {
      return new Response(JSON.stringify({ error: "Missing bounding box parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate center and radius from bounding box
    const centerLat = (lamin + lamax) / 2;
    const centerLon = (lomin + lomax) / 2;
    const latDiffKm = (lamax - lamin) * 111;
    const lonDiffKm = (lomax - lomin) * 111 * Math.cos(centerLat * Math.PI / 180);
    const radiusKm = Math.sqrt(latDiffKm * latDiffKm + lonDiffKm * lonDiffKm) / 2;
    const radiusNm = Math.min(Math.round(radiusKm / 1.852), 250);

    // adsb.fi free open API (ADS-B Exchange v2 compatible)
    const url = `https://opendata.adsb.fi/api/v3/lat/${centerLat.toFixed(4)}/lon/${centerLon.toFixed(4)}/dist/${radiusNm}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      console.error(`adsb.fi returned ${response.status}: ${body}`);
      return new Response(JSON.stringify({ aircraft: [], time: Date.now() / 1000, total: 0, source: "adsb.fi", error: `API returned ${response.status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const acList = data.ac || [];

    const aircraft = acList.map((ac: any) => ({
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
      is_military: ac.dbFlags === 1 || /^(RCH|DOOM|EVAC|NAVY|USAF|RAF|IAF|RFR|FAF|GAF|CNV|VIPER|HAWK|EAGLE|COBRA|REAPER|FORTE|JAKE|NCHO|PAT|DUKE|KING|REACH|IRON|STEEL)/i.test((ac.flight || "").trim()),
    })).filter((a: any) => a.lat != null && a.lng != null && !a.on_ground);

    return new Response(JSON.stringify({
      aircraft,
      time: data.ctime || Date.now() / 1000,
      total: aircraft.length,
      source: "adsb.fi",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Live flights error:", e);
    return new Response(JSON.stringify({ aircraft: [], time: Date.now() / 1000, total: 0, source: "adsb.fi", error: e instanceof Error ? e.message : "Unknown" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
