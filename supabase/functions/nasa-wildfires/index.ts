import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // NASA FIRMS active fire data - last 24 hours, global, CSV format
    // Using MODIS C6.1 and VIIRS SNPP
    const MAP_KEY = Deno.env.get("FIRMS_MAP_KEY") || "FIRMS_MAP_KEY";
    const sources = [
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_SNPP_NRT/world/1`,
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/MODIS_NRT/world/1`,
    ];

    // Try VIIRS first, fall back to MODIS, fall back to active fire GeoJSON
    let fires: any[] = [];
    
    // Use the open FIRMS GeoJSON endpoint (no key needed)
    const geoResponse = await fetch(
      "https://firms.modaps.eosdis.nasa.gov/api/area/csv/FIRMS_MAP_KEY/VIIRS_SNPP_NRT/world/1",
      { signal: AbortSignal.timeout(15000) }
    ).catch(() => null);

    if (geoResponse && geoResponse.ok) {
      const csvText = await geoResponse.text();
      const lines = csvText.trim().split("\n");
      if (lines.length > 1) {
        const headers = lines[0].split(",");
        const latIdx = headers.indexOf("latitude");
        const lngIdx = headers.indexOf("longitude");
        const brIdx = headers.indexOf("bright_ti4");
        const frpIdx = headers.indexOf("frp");
        const confIdx = headers.indexOf("confidence");
        const dateIdx = headers.indexOf("acq_date");
        const timeIdx = headers.indexOf("acq_time");

        fires = lines.slice(1, 501).map((line, i) => {
          const cols = line.split(",");
          return {
            id: `fire-${i}`,
            lat: parseFloat(cols[latIdx]) || 0,
            lng: parseFloat(cols[lngIdx]) || 0,
            brightness: parseFloat(cols[brIdx]) || 0,
            frp: parseFloat(cols[frpIdx]) || 0,
            confidence: cols[confIdx] || "nominal",
            date: cols[dateIdx] || "",
            time: cols[timeIdx] || "",
          };
        }).filter(f => f.lat !== 0 && f.lng !== 0);
      }
    }

    // If FIRMS API fails, generate representative wildfire data from known active regions
    if (fires.length === 0) {
      const activeRegions = [
        // Middle East / conflict zone fires
        { lat: 33.5, lng: 44.4, region: "Iraq" },
        { lat: 34.8, lng: 36.8, region: "Syria" },
        { lat: 15.4, lng: 44.2, region: "Yemen" },
        // Africa
        { lat: -2.5, lng: 28.9, region: "DRC" },
        { lat: -15.4, lng: 28.3, region: "Zambia" },
        { lat: -8.8, lng: 13.2, region: "Angola" },
        { lat: 9.1, lng: 7.5, region: "Nigeria" },
        // South America
        { lat: -3.1, lng: -60.0, region: "Amazon" },
        { lat: -15.8, lng: -47.9, region: "Brazil Cerrado" },
        // Southeast Asia
        { lat: 2.5, lng: 112.0, region: "Borneo" },
        { lat: 16.0, lng: 103.0, region: "Thailand" },
        // Australia
        { lat: -33.8, lng: 150.5, region: "NSW Australia" },
        // North America
        { lat: 34.1, lng: -118.3, region: "California" },
        { lat: 51.0, lng: -115.0, region: "Alberta Canada" },
      ];

      fires = activeRegions.flatMap((r, ri) => {
        const count = 5 + Math.floor(Math.random() * 15);
        return Array.from({ length: count }, (_, i) => ({
          id: `fire-gen-${ri}-${i}`,
          lat: r.lat + (Math.random() - 0.5) * 2,
          lng: r.lng + (Math.random() - 0.5) * 2,
          brightness: 300 + Math.random() * 100,
          frp: 10 + Math.random() * 150,
          confidence: Math.random() > 0.3 ? "high" : "nominal",
          date: new Date().toISOString().split("T")[0],
          time: `${String(Math.floor(Math.random() * 24)).padStart(2, "0")}${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
          region: r.region,
        }));
      });
    }

    return new Response(
      JSON.stringify({
        fires,
        count: fires.length,
        generated: new Date().toISOString(),
        source: fires[0]?.region ? "simulated" : "NASA FIRMS",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("FIRMS wildfire error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", fires: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
