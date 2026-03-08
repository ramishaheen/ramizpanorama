import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGGREGATOR_SOURCES = ["EarthCam", "SkylineWebcams", "WebCamera24", "OpenWebcamDB", "Insecam", "Opentopia", "GeoCam", "AI Discovery"];

const extractYouTubeId = (url: string) => {
  const embed = url.match(/youtube\.com\/embed\/([^?&/]+)/i);
  if (embed?.[1]) return embed[1];
  const watch = url.match(/[?&]v=([^?&/]+)/i);
  if (watch?.[1]) return watch[1];
  return null;
};

const validateCameraUrl = async (url: string) => {
  const ytId = extractYouTubeId(url);
  try {
    if (ytId) {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`;
      const ytResp = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
      if (ytResp.ok) return { status: "active", error: null };
      return { status: "error", error: `YouTube unavailable (${ytResp.status})` };
    }
    const headResp = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (headResp.ok) return { status: "active", error: null };
    const getResp = await fetch(url, { method: "GET", headers: { Range: "bytes=0-512" }, redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (getResp.ok) return { status: "active", error: null };
    return { status: "error", error: `HTTP ${getResp.status}` };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "Check failed" };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: Record<string, any> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const action = body.action || "list";

    // ── STATS ──
    if (action === "stats") {
      const { data: cameras } = await supabase
        .from("cameras")
        .select("country, status, category, source_name, city")
        .eq("is_active", true);

      const all = cameras || [];
      const online = all.filter(c => c.status === "active").length;
      const offline = all.filter(c => c.status === "error").length;
      const unknown = all.length - online - offline;

      const byCountry: Record<string, { total: number; online: number }> = {};
      const byCategory: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      const byContinent: Record<string, number> = {
        "Middle East": 0, "Europe": 0, "North America": 0,
        "Asia": 0, "Africa": 0, "South America": 0, "Oceania": 0,
      };

      const continentMap: Record<string, string> = {
        "UAE": "Middle East", "Jordan": "Middle East", "Saudi Arabia": "Middle East",
        "Qatar": "Middle East", "Oman": "Middle East", "Bahrain": "Middle East",
        "Kuwait": "Middle East", "Iraq": "Middle East", "Lebanon": "Middle East",
        "Israel": "Middle East", "Iran": "Middle East", "Egypt": "Africa",
        "Turkey": "Europe", "UK": "Europe", "Germany": "Europe", "France": "Europe",
        "Italy": "Europe", "Spain": "Europe", "Netherlands": "Europe", "Ireland": "Europe",
        "Iceland": "Europe", "Ukraine": "Europe",
        "USA": "North America", "Canada": "North America",
        "Japan": "Asia", "South Korea": "Asia", "Singapore": "Asia",
      };

      all.forEach(c => {
        if (!byCountry[c.country]) byCountry[c.country] = { total: 0, online: 0 };
        byCountry[c.country].total++;
        if (c.status === "active") byCountry[c.country].online++;
        byCategory[c.category] = (byCategory[c.category] || 0) + 1;
        if (c.source_name) bySource[c.source_name] = (bySource[c.source_name] || 0) + 1;
        if (c.city) byCity[c.city] = (byCity[c.city] || 0) + 1;
        const continent = continentMap[c.country] || "Other";
        byContinent[continent] = (byContinent[continent] || 0) + 1;
      });

      return new Response(JSON.stringify({
        total: all.length, online, offline, unknown,
        byCountry, byCategory, bySource, byCity, byContinent,
        sources: AGGREGATOR_SOURCES,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST (with bounds + pagination) ──
    if (action === "list") {
      let query = supabase
        .from("cameras")
        .select("*")
        .eq("is_active", true)
        .order("country")
        .order("city");

      if (body.country) query = query.eq("country", body.country);
      if (body.category) query = query.eq("category", body.category);
      if (body.source) query = query.eq("source_name", body.source);
      if (body.status === "online") query = query.eq("status", "active");
      if (body.status === "offline") query = query.neq("status", "active");
      if (body.search) query = query.or(`name.ilike.%${body.search}%,city.ilike.%${body.search}%,country.ilike.%${body.search}%,source_name.ilike.%${body.search}%`);

      // Viewport-based loading
      if (body.bounds) {
        const { north, south, east, west } = body.bounds;
        query = query
          .gte("lat", south).lte("lat", north)
          .gte("lng", west).lte("lng", east);
      }

      const limit = body.limit || 500;
      const offset = body.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ cameras: data || [], count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── COUNTRIES ──
    if (action === "countries") {
      const { data, error } = await supabase.from("cameras").select("country").eq("is_active", true);
      if (error) throw error;
      const countries = [...new Set((data || []).map((d: any) => d.country))].sort();
      return new Response(JSON.stringify({ countries }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DETAIL ──
    if (action === "detail" && body.id) {
      const { data, error } = await supabase.from("cameras").select("*").eq("id", body.id).single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── HEALTH CHECK ──
    if (action === "health_check") {
      const { data: cameras } = await supabase.from("cameras").select("*").eq("is_active", true);
      const results: any[] = [];
      for (const cam of cameras || []) {
        const urlToCheck = cam.embed_url || cam.stream_url || cam.snapshot_url;
        if (!urlToCheck) {
          await supabase.from("cameras").update({ status: "error", error_message: "No URL configured", last_checked_at: new Date().toISOString() }).eq("id", cam.id);
          results.push({ id: cam.id, status: "error" });
          continue;
        }
        const check = await validateCameraUrl(urlToCheck);
        await supabase.from("cameras").update({ status: check.status, error_message: check.error, last_checked_at: new Date().toISOString() }).eq("id", cam.id);
        results.push({ id: cam.id, status: check.status });
      }
      return new Response(JSON.stringify({ checked: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SCRAPE AGGREGATORS ──
    if (action === "scrape_aggregators") {
      const targetCountry = body.country || null;
      const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
      if (!perplexityKey) {
        return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const countryClause = targetCountry ? `in ${targetCountry}` : "worldwide from diverse countries";
      const sourceList = AGGREGATOR_SOURCES.filter(s => s !== "AI Discovery").join(", ");

      const aiResp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${perplexityKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: `You are a webcam aggregator specialist. Find REAL, WORKING public webcam feeds from these sources: ${sourceList}. Only return cameras that are genuinely accessible right now via YouTube Live embeds, direct HLS streams, or snapshot URLs. Prefer YouTube Live embed URLs. Also search for webcams from Windy.com, Weatherbug, DOT traffic cams. NEVER fabricate URLs.` },
            { role: "user", content: `Find up to 15 public live cameras ${countryClause}. Include traffic cams, city cams, port cams, weather cams, and tourism cams. For each camera provide: name, country, city, category (traffic|tourism|ports|weather|public), source_type (embed_page|snapshot|hls), source_name, embed_url (or stream_url or snapshot_url), lat, lng.` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "camera_list",
              schema: {
                type: "object",
                properties: {
                  cameras: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" }, country: { type: "string" }, city: { type: "string" },
                        category: { type: "string" }, source_type: { type: "string" }, source_name: { type: "string" },
                        embed_url: { type: "string" }, stream_url: { type: "string" }, snapshot_url: { type: "string" },
                        lat: { type: "number" }, lng: { type: "number" },
                      },
                      required: ["name", "country", "city", "category", "embed_url", "lat", "lng"],
                    },
                  },
                },
                required: ["cameras"],
              },
            },
          },
        }),
      });

      const aiData = await aiResp.json();
      if (!aiResp.ok) throw new Error(`AI scrape failed [${aiResp.status}]`);

      const parsed = JSON.parse(aiData?.choices?.[0]?.message?.content || '{"cameras":[]}');
      const candidates: any[] = (parsed?.cameras || []).slice(0, 15);

      const { data: existing } = await supabase.from("cameras").select("embed_url, stream_url, snapshot_url");
      const existingUrls = new Set((existing || []).flatMap((row: any) => [row.embed_url, row.stream_url, row.snapshot_url].filter(Boolean)));

      const inserted: any[] = [];
      for (const cam of candidates) {
        const primaryUrl = cam.embed_url || cam.stream_url || cam.snapshot_url;
        if (!primaryUrl || existingUrls.has(primaryUrl)) continue;
        const check = await validateCameraUrl(primaryUrl);
        if (check.status !== "active") continue;

        const validCats = ["traffic", "tourism", "ports", "weather", "public"];
        const validTypes = ["embed_page", "snapshot", "hls"];
        const payload = {
          name: cam.name, country: cam.country, city: cam.city,
          category: validCats.includes(cam.category) ? cam.category : "public",
          source_type: validTypes.includes(cam.source_type) ? cam.source_type : "embed_page",
          source_name: cam.source_name || "Aggregator",
          embed_url: cam.embed_url || null, stream_url: cam.stream_url || null, snapshot_url: cam.snapshot_url || null,
          lat: Number(cam.lat) || 0, lng: Number(cam.lng) || 0,
          is_active: true, status: "active", last_checked_at: new Date().toISOString(),
        };
        const { data: created } = await supabase.from("cameras").insert(payload).select().single();
        if (created) { inserted.push(created); existingUrls.add(primaryUrl); }
      }

      return new Response(JSON.stringify({ found: candidates.length, inserted: inserted.length, cameras: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISCOVER ──
    if (action === "discover") {
      const targetCountry = body.country || "Middle East";
      const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
      if (!perplexityKey) {
        return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY missing" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${perplexityKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: "Return only real, public webcam links accessible right now. Prefer YouTube live embed links and official city cams. No fabricated URLs." },
            { role: "user", content: `Find up to 8 public live cameras for ${targetCountry}. Return JSON with: name, country, city, category (traffic|tourism|ports|weather|public), source_type (embed_page), embed_url, lat, lng.` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "camera_list",
              schema: {
                type: "object",
                properties: {
                  cameras: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, city: { type: "string" }, category: { type: "string" }, source_type: { type: "string" }, embed_url: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } }, required: ["name", "country", "city", "category", "source_type", "embed_url", "lat", "lng"] } },
                },
                required: ["cameras"],
              },
            },
          },
        }),
      });

      const aiData = await aiResp.json();
      if (!aiResp.ok) throw new Error(`AI discovery failed [${aiResp.status}]`);

      const parsed = JSON.parse(aiData?.choices?.[0]?.message?.content || '{"cameras":[]}');
      const candidates = (parsed?.cameras || []).slice(0, 8);
      const { data: existing } = await supabase.from("cameras").select("embed_url");
      const existingUrls = new Set((existing || []).map((r: any) => r.embed_url).filter(Boolean));
      const inserted: any[] = [];

      for (const cam of candidates) {
        if (!cam?.embed_url || existingUrls.has(cam.embed_url)) continue;
        const check = await validateCameraUrl(cam.embed_url);
        if (check.status !== "active") continue;
        const payload = {
          name: cam.name, country: cam.country, city: cam.city,
          category: ["traffic", "tourism", "ports", "weather", "public"].includes(cam.category) ? cam.category : "public",
          source_type: "embed_page", source_name: "AI Discovery",
          embed_url: cam.embed_url, lat: Number(cam.lat) || 0, lng: Number(cam.lng) || 0,
          is_active: true, status: "active", last_checked_at: new Date().toISOString(),
        };
        const { data: created } = await supabase.from("cameras").insert(payload).select().single();
        if (created) { inserted.push(created); existingUrls.add(cam.embed_url); }
      }

      return new Response(JSON.stringify({ discovered: candidates.length, inserted: inserted.length, cameras: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CRUD ──
    if (action === "create") {
      const { data, error } = await supabase.from("cameras").insert(body.camera).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "update") {
      const { data, error } = await supabase.from("cameras").update({ ...body.camera, updated_at: new Date().toISOString() }).eq("id", body.id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "delete") {
      const { error } = await supabase.from("cameras").delete().eq("id", body.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Cameras error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
