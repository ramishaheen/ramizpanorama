import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Decode Google's encoded polyline format
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { origin, destination, mode = "driving", waypoints } = await req.json();

    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: "origin and destination required (lat,lng format)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      origin: typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`,
      destination: typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`,
      mode,
      key: apiKey,
    });

    if (waypoints && waypoints.length > 0) {
      const wp = waypoints.map((w: any) => typeof w === "string" ? w : `${w.lat},${w.lng}`).join("|");
      params.set("waypoints", wp);
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      return new Response(JSON.stringify({ error: data.status, error_message: data.error_message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const route = data.routes?.[0];
    const leg = route?.legs?.[0];

    const result = {
      distance: leg?.distance,
      duration: leg?.duration,
      start_address: leg?.start_address,
      end_address: leg?.end_address,
      polyline: route?.overview_polyline?.points
        ? decodePolyline(route.overview_polyline.points)
        : [],
      steps: leg?.steps?.map((s: any) => ({
        instruction: s.html_instructions?.replace(/<[^>]*>/g, ""),
        distance: s.distance,
        duration: s.duration,
        start: s.start_location,
        end: s.end_location,
      })) || [],
      bounds: route?.bounds,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-directions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
