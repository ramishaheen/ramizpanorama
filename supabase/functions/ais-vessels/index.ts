import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { lamin = 20, lamax = 40, lomin = 30, lomax = 60 } = body;

    // Use AISHub or fallback to barentswatch / public AIS APIs
    // Primary: Use the free AIS data from the Finnish Transport Agency (Digitraffic)
    const vessels: any[] = [];

    // Try Digitraffic AIS (Finland, free, no key needed)
    try {
      const url = `https://meri.digitraffic.fi/api/ais/v1/locations?from=${Math.floor(Date.now() / 1000) - 300}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const features = data?.features || [];
        features.forEach((f: any) => {
          const coords = f.geometry?.coordinates;
          const props = f.properties || {};
          if (!coords || coords.length < 2) return;
          const lon = coords[0];
          const lat = coords[1];
          // Filter to bounding box
          if (lat >= lamin && lat <= lamax && lon >= lomin && lon <= lomax) {
            vessels.push({
              mmsi: props.mmsi?.toString() || `ais-${Math.random().toString(36).slice(2,8)}`,
              name: `MMSI-${props.mmsi || "Unknown"}`,
              lat,
              lng: lon,
              heading: props.heading ?? props.cog ?? 0,
              speed: props.sog ?? 0,
              type: classifyVesselType(props.navStat),
              flag: "FI",
              destination: null,
              source: "digitraffic",
            });
          }
        });
      }
    } catch (e) {
      console.log("Digitraffic AIS error:", e);
    }

    // Secondary: Try the free AIS stream from AISHUB public API (if API key available)
    const aisHubKey = Deno.env.get("AISHUB_API_KEY");
    if (aisHubKey && vessels.length < 10) {
      try {
        const url = `https://data.aishub.net/ws.php?username=${aisHubKey}&format=1&output=json&latmin=${lamin}&latmax=${lamax}&lonmin=${lomin}&lonmax=${lomax}&compress=0`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = await res.json();
          const records = Array.isArray(data) && data.length > 1 ? data[1] : [];
          records.forEach((r: any) => {
            vessels.push({
              mmsi: r.MMSI?.toString() || `ais-${Math.random().toString(36).slice(2,8)}`,
              name: r.NAME?.trim() || `MMSI-${r.MMSI}`,
              lat: r.LATITUDE,
              lng: r.LONGITUDE,
              heading: r.HEADING ?? r.COG ?? 0,
              speed: r.SOG ?? 0,
              type: classifyByShipType(r.TYPE),
              flag: r.FLAG || "",
              destination: r.DEST?.trim() || null,
              source: "aishub",
            });
          });
        }
      } catch (e) {
        console.log("AISHub error:", e);
      }
    }

    // Tertiary: If no live API returned data, pull from Supabase DB
    if (vessels.length === 0) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: dbVessels } = await supabase
          .from("vessels")
          .select("*")
          .gte("lat", lamin)
          .lte("lat", lamax)
          .gte("lng", lomin)
          .lte("lng", lomax);
        if (dbVessels && dbVessels.length > 0) {
          dbVessels.forEach((v: any) => {
            vessels.push({
              mmsi: v.id,
              name: v.name,
              lat: v.lat,
              lng: v.lng,
              heading: v.heading,
              speed: v.speed,
              type: v.type,
              flag: v.flag,
              destination: v.destination,
              source: "database",
            });
          });
          console.log(`DB fallback: ${vessels.length} vessels in bbox`);
        } else {
          console.log("No vessels found in DB for this bbox either");
        }
      } catch (dbErr) {
        console.error("DB fallback error:", dbErr);
      }
    }

    return new Response(JSON.stringify({ 
      vessels: vessels.slice(0, 500),
      count: vessels.length,
      source: vessels.length > 0 ? vessels[0].source : "none",
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AIS vessels error:", e);
    return new Response(JSON.stringify({ vessels: [], error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function classifyVesselType(navStat: number | undefined): string {
  if (navStat === undefined) return "UNKNOWN";
  // AIS nav status: 0=underway engine, 1=at anchor, 5=moored, 7=fishing, etc.
  if (navStat === 7) return "FISHING";
  return "CARGO"; // Default to cargo for AIS
}

function classifyByShipType(type: number | undefined): string {
  if (!type) return "UNKNOWN";
  if (type >= 60 && type <= 69) return "CARGO";
  if (type >= 70 && type <= 79) return "CARGO";
  if (type >= 80 && type <= 89) return "TANKER";
  if (type === 30) return "FISHING";
  if (type >= 35 && type <= 39) return "MILITARY";
  return "UNKNOWN";
}
