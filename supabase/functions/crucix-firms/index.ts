import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOTSPOTS = [
  { name: "Middle East", lamin: 12, lamax: 42, lomin: 25, lomax: 65 },
  { name: "Ukraine", lamin: 44, lamax: 53, lomin: 22, lomax: 40 },
  { name: "Sahel", lamin: 5, lamax: 20, lomin: -15, lomax: 25 },
  { name: "Horn of Africa", lamin: -2, lamax: 18, lomin: 30, lomax: 52 },
  { name: "SE Asia", lamin: -10, lamax: 20, lomin: 95, lomax: 130 },
  { name: "S. America", lamin: -20, lamax: 5, lomin: -75, lomax: -35 },
];

let cache: { data: any; ts: number } | null = null;
const TTL = 15 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (cache && Date.now() - cache.ts < TTL) {
    return new Response(JSON.stringify({ ...cache.data, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mapKey = Deno.env.get("FIRMS_MAP_KEY");
  if (!mapKey) {
    return new Response(JSON.stringify({ error: "FIRMS_MAP_KEY not configured", fires: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_SNPP_NRT/world/1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);

    const csv = await res.text();
    const lines = csv.trim().split("\n");
    if (lines.length < 2) throw new Error("No FIRMS data");

    const headers = lines[0].split(",");
    const idx = (n: string) => headers.indexOf(n);
    const latI = idx("latitude"), lngI = idx("longitude"), brI = idx("bright_ti4"),
      frpI = idx("frp"), confI = idx("confidence"), dateI = idx("acq_date"), timeI = idx("acq_time");

    const allFires = lines.slice(1).map((line, i) => {
      const c = line.split(",");
      return {
        id: `f-${i}`,
        lat: parseFloat(c[latI]) || 0,
        lng: parseFloat(c[lngI]) || 0,
        brightness: parseFloat(c[brI]) || 0,
        frp: parseFloat(c[frpI]) || 0,
        confidence: c[confI] || "nominal",
        date: c[dateI] || "",
        time: c[timeI] || "",
      };
    }).filter(f => f.lat !== 0 && f.lng !== 0);

    // Bin fires into hotspots
    const hotspotFires = HOTSPOTS.map(h => ({
      region: h.name,
      fires: allFires.filter(f =>
        f.lat >= h.lamin && f.lat <= h.lamax && f.lng >= h.lomin && f.lng <= h.lomax
      ).slice(0, 100),
    }));

    const data = {
      hotspots: hotspotFires,
      totalGlobal: allFires.length,
      timestamp: new Date().toISOString(),
      source: "NASA FIRMS VIIRS",
    };
    cache = { data, ts: Date.now() };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("FIRMS error:", e);
    if (cache) {
      return new Response(JSON.stringify({ ...cache.data, cached: true, stale: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown", hotspots: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
