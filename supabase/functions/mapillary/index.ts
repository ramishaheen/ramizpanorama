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
    const token = Deno.env.get("MAPILLARY_ACCESS_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "MAPILLARY_ACCESS_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lat, lng, radius = 500, limit = 1 } = await req.json();

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "lat and lng are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search for nearby Mapillary images
    const bbox = getBbox(lat, lng, radius);
    const url = `https://graph.mapillary.com/images?access_token=${token}&fields=id,captured_at,compass_angle,geometry,is_pano,thumb_1024_url,thumb_2048_url&bbox=${bbox}&limit=${limit}&is_pano=true`;

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Mapillary API error [${res.status}]: ${errText}` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();

    // If no panoramas found, try non-pano images
    if (!data.data || data.data.length === 0) {
      const fallbackUrl = `https://graph.mapillary.com/images?access_token=${token}&fields=id,captured_at,compass_angle,geometry,is_pano,thumb_1024_url,thumb_2048_url&bbox=${bbox}&limit=${limit}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return new Response(JSON.stringify({ images: fallbackData.data || [], token }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ images: data.data || [], token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getBbox(lat: number, lng: number, radiusMeters: number): string {
  const latOffset = radiusMeters / 111320;
  const lngOffset = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
  return `${lng - lngOffset},${lat - latOffset},${lng + lngOffset},${lat + latOffset}`;
}
