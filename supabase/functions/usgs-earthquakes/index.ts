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
    // Fetch all earthquakes from the last 24 hours from USGS
    const response = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const geojson = await response.json();

    const earthquakes = (geojson.features || []).map((f: any) => ({
      id: f.id,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      type: f.properties.type,
      tsunami: f.properties.tsunami === 1,
      alert: f.properties.alert, // green, yellow, orange, red
      felt: f.properties.felt,
      significance: f.properties.sig,
      url: f.properties.url,
    }));

    return new Response(
      JSON.stringify({
        earthquakes,
        count: earthquakes.length,
        generated: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("USGS earthquake error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", earthquakes: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
