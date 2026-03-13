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
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lat, lng, radius = 50000, type, keyword, categories } = await req.json();

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "lat and lng required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If categories provided, fetch multiple types
    const typeList = categories || (type ? [type] : ["airport", "embassy", "hospital", "military", "government"]);
    
    const allResults: any[] = [];
    
    for (const t of typeList.slice(0, 5)) {
      const params = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(Math.min(radius, 50000)),
        key: apiKey,
      });
      
      // Some types need keyword instead of type
      const keywordTypes = ["military", "military_base", "embassy", "government"];
      if (keywordTypes.includes(t)) {
        params.set("keyword", t.replace("_", " "));
      } else {
        params.set("type", t);
      }
      
      if (keyword) {
        params.set("keyword", keyword);
      }

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        data.results.forEach((place: any) => {
          allResults.push({
            place_id: place.place_id,
            name: place.name,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            address: place.vicinity,
            types: place.types || [],
            category: t,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            open_now: place.opening_hours?.open_now,
            icon: place.icon,
            business_status: place.business_status,
          });
        });
      }
    }

    // Deduplicate by place_id
    const unique = Array.from(new Map(allResults.map(r => [r.place_id, r])).values());

    return new Response(JSON.stringify({ results: unique, count: unique.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-places error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
