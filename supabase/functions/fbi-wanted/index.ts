import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const page = url.searchParams.get("page") || "1";
    const pageSize = url.searchParams.get("pageSize") || "20";
    const title = url.searchParams.get("title") || "";
    const field_offices = url.searchParams.get("field_offices") || "";
    const poster_classification = url.searchParams.get("poster_classification") || "";

    let apiUrl = `https://api.fbi.gov/wanted/v1/list?page=${page}&pageSize=${pageSize}`;
    if (title) apiUrl += `&title=${encodeURIComponent(title)}`;
    if (field_offices) apiUrl += `&field_offices=${encodeURIComponent(field_offices)}`;
    if (poster_classification) apiUrl += `&poster_classification=${encodeURIComponent(poster_classification)}`;

    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json", "User-Agent": "WAROS-Intel/1.0" },
    });

    if (!res.ok) throw new Error(`FBI API returned ${res.status}`);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
