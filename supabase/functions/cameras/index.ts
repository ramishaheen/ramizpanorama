import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGGREGATOR_SOURCES = ["EarthCam", "SkylineWebcams", "WebCamera24", "OpenWebcamDB", "Insecam", "Opentopia", "GeoCam", "AI Discovery"];
const MAX_FAILURES = 5;

// ── YouTube Helpers ──
const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/i,
    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
};

const isValidYouTubeId = (id: string): boolean => /^[A-Za-z0-9_-]{11}$/.test(id);

// ── Source Type Detection ──
const detectSourceType = async (url: string): Promise<{
  source_type: string;
  youtube_video_id: string | null;
  playable_url: string | null;
  verification_status: string;
  stream_type_detected: string;
}> => {
  if (!url) return { source_type: "unknown", youtube_video_id: null, playable_url: null, verification_status: "unsupported", stream_type_detected: "unknown" };

  // YouTube detection
  const ytId = extractYouTubeId(url);
  if (ytId && isValidYouTubeId(ytId)) {
    return {
      source_type: "youtube",
      youtube_video_id: ytId,
      playable_url: `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0`,
      verification_status: "verified_youtube",
      stream_type_detected: "embed",
    };
  }

  // Direct HLS
  if (/\.m3u8(\?|$)/i.test(url)) {
    return { source_type: "hls", youtube_video_id: null, playable_url: url, verification_status: "verified_hls", stream_type_detected: "hls" };
  }

  // RTSP
  if (/^rtsp:\/\//i.test(url)) {
    return { source_type: "rtsp", youtube_video_id: null, playable_url: null, verification_status: "proxy_required", stream_type_detected: "rtsp" };
  }

  // Probe via HEAD
  try {
    const resp = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    const ct = (resp.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("mpegurl") || ct.includes("x-mpegurl")) {
      return { source_type: "hls", youtube_video_id: null, playable_url: url, verification_status: "verified_hls", stream_type_detected: "hls" };
    }
    if (ct.includes("multipart/x-mixed-replace") || ct.includes("mjpeg")) {
      return { source_type: "mjpeg", youtube_video_id: null, playable_url: url, verification_status: "verified_mjpeg", stream_type_detected: "mjpeg" };
    }
    if (ct.includes("image/jpeg") || ct.includes("image/png") || ct.includes("image/gif")) {
      return { source_type: "snapshot", youtube_video_id: null, playable_url: url, verification_status: "verified_snapshot", stream_type_detected: "snapshot" };
    }
    if (ct.includes("text/html")) {
      // Check if it's an embeddable page (Windy, SkylineWebcams, etc.)
      const embeddable = /windy\.com|skylinewebcams\.com|earthcam\.com|webcamtaxi\.com|insecam\.org/i.test(url);
      return {
        source_type: embeddable ? "embed_page" : "webpage",
        youtube_video_id: null,
        playable_url: embeddable ? url : null,
        verification_status: embeddable ? "page_only" : "unsupported",
        stream_type_detected: "embed",
      };
    }

    return { source_type: "unknown", youtube_video_id: null, playable_url: url, verification_status: "pending", stream_type_detected: "unknown" };
  } catch {
    return { source_type: "unknown", youtube_video_id: null, playable_url: null, verification_status: "inactive", stream_type_detected: "unknown" };
  }
};

// ── URL Validation ──
const validateCameraUrl = async (url: string) => {
  const ytId = extractYouTubeId(url);
  if (ytId && isValidYouTubeId(ytId)) {
    // YouTube IDs with valid format are assumed active (oembed is unreliable for live streams)
    return { status: "active", error: null, contentType: "embed" };
  }

  try {
    const headResp = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (headResp.ok) return { status: "active", error: null, contentType: (headResp.headers.get("content-type") || "").toLowerCase() };

    const getResp = await fetch(url, { method: "GET", headers: { Range: "bytes=0-512" }, redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (getResp.ok) return { status: "active", error: null, contentType: (getResp.headers.get("content-type") || "").toLowerCase() };

    return { status: "error", error: `HTTP ${getResp.status}`, contentType: null };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "Check failed", contentType: null };
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
        .select("country, status, category, source_name, city, youtube_video_id, verification_status")
        .eq("is_active", true);

      const all = cameras || [];
      const online = all.filter(c => c.status === "active").length;
      const offline = all.filter(c => c.status === "error").length;
      const unknown = all.length - online - offline;
      const youtubeCount = all.filter(c => c.youtube_video_id).length;

      const byCountry: Record<string, { total: number; online: number }> = {};
      const byCategory: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      const byVerification: Record<string, number> = {};
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
        const vs = c.verification_status || "pending";
        byVerification[vs] = (byVerification[vs] || 0) + 1;
        const continent = continentMap[c.country] || "Other";
        byContinent[continent] = (byContinent[continent] || 0) + 1;
      });

      return new Response(JSON.stringify({
        total: all.length, online, offline, unknown, youtubeCount,
        byCountry, byCategory, bySource, byCity, byContinent, byVerification,
        sources: AGGREGATOR_SOURCES,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST ──
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

      if (body.bounds) {
        const { north, south, east, west } = body.bounds;
        query = query.gte("lat", south).lte("lat", north).gte("lng", west).lte("lng", east);
      }

      const limit = body.limit || 500;
      const offset = body.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;
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

    // ── VERIFY: detect source type and update camera ──
    if (action === "verify") {
      const targetId = body.id;
      if (!targetId) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: cam } = await supabase.from("cameras").select("*").eq("id", targetId).single();
      if (!cam) return new Response(JSON.stringify({ error: "Camera not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const url = cam.original_url || cam.embed_url || cam.stream_url || cam.snapshot_url;
      if (!url) return new Response(JSON.stringify({ error: "No URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const detection = await detectSourceType(url);
      const updateData: any = {
        youtube_video_id: detection.youtube_video_id,
        playable_url: detection.playable_url,
        verification_status: detection.verification_status,
        stream_type_detected: detection.stream_type_detected,
        is_verified: ["verified_youtube", "verified_hls", "verified_snapshot", "verified_mjpeg"].includes(detection.verification_status),
        updated_at: new Date().toISOString(),
      };

      // For YouTube, set the embed_url properly
      if (detection.source_type === "youtube" && detection.youtube_video_id) {
        updateData.embed_url = `https://www.youtube.com/embed/${detection.youtube_video_id}`;
        updateData.status = "active";
      }

      await supabase.from("cameras").update(updateData).eq("id", targetId);
      return new Response(JSON.stringify({ id: targetId, ...detection }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── VERIFY_ALL: batch verify all cameras ──
    if (action === "verify_all") {
      const { data: cameras } = await supabase.from("cameras").select("id, embed_url, stream_url, snapshot_url, original_url").eq("is_active", true).limit(100);
      const results: any[] = [];

      for (const cam of cameras || []) {
        const url = cam.original_url || cam.embed_url || cam.stream_url || cam.snapshot_url;
        if (!url) continue;

        const detection = await detectSourceType(url);
        const updateData: any = {
          youtube_video_id: detection.youtube_video_id,
          playable_url: detection.playable_url,
          verification_status: detection.verification_status,
          stream_type_detected: detection.stream_type_detected,
          is_verified: ["verified_youtube", "verified_hls", "verified_snapshot", "verified_mjpeg"].includes(detection.verification_status),
          original_url: url,
          updated_at: new Date().toISOString(),
        };
        if (detection.source_type === "youtube" && detection.youtube_video_id) {
          updateData.embed_url = `https://www.youtube.com/embed/${detection.youtube_video_id}`;
          updateData.status = "active";
        }

        await supabase.from("cameras").update(updateData).eq("id", cam.id);
        results.push({ id: cam.id, ...detection });
      }

      return new Response(JSON.stringify({ verified: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DEDUPLICATE ──
    if (action === "deduplicate") {
      const { data: allCams } = await supabase.from("cameras").select("id, embed_url, stream_url, snapshot_url, created_at").order("created_at", { ascending: true });
      const seen = new Set<string>();
      const dupes: string[] = [];

      for (const cam of allCams || []) {
        const key = cam.embed_url || cam.stream_url || cam.snapshot_url;
        if (!key) continue;
        if (seen.has(key)) { dupes.push(cam.id); } else { seen.add(key); }
      }

      if (dupes.length > 0) {
        for (let i = 0; i < dupes.length; i += 50) {
          const batch = dupes.slice(i, i + 50);
          await supabase.from("cameras").delete().in("id", batch);
        }
      }

      return new Response(JSON.stringify({ removed: dupes.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── HEALTH CHECK ──
    if (action === "health_check") {
      const { data: cameras } = await supabase.from("cameras").select("*").eq("is_active", true).limit(200);
      const results: any[] = [];
      let disabled = 0;

      for (const cam of cameras || []) {
        // YouTube cameras: just validate the ID format
        if (cam.youtube_video_id && isValidYouTubeId(cam.youtube_video_id)) {
          await supabase.from("cameras").update({
            status: "active", error_message: null, failure_count: 0,
            verification_status: "verified_youtube", is_verified: true,
            last_checked_at: new Date().toISOString(),
          }).eq("id", cam.id);
          results.push({ id: cam.id, status: "active", type: "youtube" });
          continue;
        }

        const urlToCheck = cam.playable_url || cam.embed_url || cam.stream_url || cam.snapshot_url;
        if (!urlToCheck) {
          const newFail = (cam.failure_count || 0) + 1;
          const shouldDisable = newFail >= MAX_FAILURES;
          await supabase.from("cameras").update({
            status: "error", error_message: "No URL configured",
            failure_count: newFail, is_active: !shouldDisable,
            last_checked_at: new Date().toISOString(),
          }).eq("id", cam.id);
          if (shouldDisable) disabled++;
          results.push({ id: cam.id, status: "error", disabled: shouldDisable });
          continue;
        }

        const check = await validateCameraUrl(urlToCheck);
        if (check.status === "active") {
          await supabase.from("cameras").update({
            status: "active", error_message: null, failure_count: 0,
            last_checked_at: new Date().toISOString(),
          }).eq("id", cam.id);
          results.push({ id: cam.id, status: "active" });
        } else {
          const newFail = (cam.failure_count || 0) + 1;
          const shouldDisable = newFail >= MAX_FAILURES;
          await supabase.from("cameras").update({
            status: "error", error_message: check.error,
            failure_count: newFail, is_active: !shouldDisable,
            last_checked_at: new Date().toISOString(),
          }).eq("id", cam.id);
          if (shouldDisable) disabled++;
          results.push({ id: cam.id, status: "error", failCount: newFail, disabled: shouldDisable });
        }
      }

      return new Response(JSON.stringify({ checked: results.length, disabled, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PROXY_SNAPSHOT ──
    if (action === "proxy_snapshot") {
      const url = body.url;
      if (!url) return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      try {
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CameraProxy/1.0)" },
          redirect: "follow", signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        const ct = resp.headers.get("content-type") || "image/jpeg";
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        return new Response(JSON.stringify({ data: `data:${ct};base64,${b64}`, contentType: ct }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Fetch failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

        // Detect source type before insertion
        const detection = await detectSourceType(primaryUrl);
        const validCats = ["traffic", "tourism", "ports", "weather", "public"];

        const payload: any = {
          name: cam.name, country: cam.country, city: cam.city,
          category: validCats.includes(cam.category) ? cam.category : "public",
          source_type: detection.source_type === "youtube" ? "embed_page" : (cam.source_type || "embed_page"),
          source_name: cam.source_name || "Aggregator",
          embed_url: cam.embed_url || null, stream_url: cam.stream_url || null, snapshot_url: cam.snapshot_url || null,
          lat: Number(cam.lat) || 0, lng: Number(cam.lng) || 0,
          is_active: true, status: "active",
          original_url: primaryUrl,
          youtube_video_id: detection.youtube_video_id,
          playable_url: detection.playable_url,
          verification_status: detection.verification_status,
          stream_type_detected: detection.stream_type_detected,
          is_verified: ["verified_youtube", "verified_hls", "verified_snapshot", "verified_mjpeg"].includes(detection.verification_status),
          failure_count: 0, last_checked_at: new Date().toISOString(),
        };

        if (detection.source_type === "youtube" && detection.youtube_video_id) {
          payload.embed_url = `https://www.youtube.com/embed/${detection.youtube_video_id}`;
        }

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

        const detection = await detectSourceType(cam.embed_url);
        const payload: any = {
          name: cam.name, country: cam.country, city: cam.city,
          category: ["traffic", "tourism", "ports", "weather", "public"].includes(cam.category) ? cam.category : "public",
          source_type: "embed_page", source_name: "AI Discovery",
          embed_url: cam.embed_url, lat: Number(cam.lat) || 0, lng: Number(cam.lng) || 0,
          is_active: true, status: "active",
          original_url: cam.embed_url,
          youtube_video_id: detection.youtube_video_id,
          playable_url: detection.playable_url,
          verification_status: detection.verification_status,
          stream_type_detected: detection.stream_type_detected,
          is_verified: ["verified_youtube", "verified_hls", "verified_snapshot", "verified_mjpeg"].includes(detection.verification_status),
          failure_count: 0, last_checked_at: new Date().toISOString(),
        };

        if (detection.source_type === "youtube" && detection.youtube_video_id) {
          payload.embed_url = `https://www.youtube.com/embed/${detection.youtube_video_id}`;
        }

        const { data: created } = await supabase.from("cameras").insert(payload).select().single();
        if (created) { inserted.push(created); existingUrls.add(cam.embed_url); }
      }

      return new Response(JSON.stringify({ discovered: candidates.length, inserted: inserted.length, cameras: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── IMPORT FROM OPENWEBCAMDB ──
    if (action === "import_openwebcamdb") {
      const OWDB_KEY = Deno.env.get("OPENWEBCAMDB_API_KEY");
      if (!OWDB_KEY) {
        return new Response(JSON.stringify({ error: "OPENWEBCAMDB_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetCountry = body.country || null; // e.g. "united-states", "germany"
      const perPage = Math.min(body.per_page || 50, 100);
      const page = body.page || 1;

      // Build query params
      const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
      if (targetCountry) params.set("country", targetCountry);

      const apiResp = await fetch(`https://openwebcamdb.com/api/v1/webcams?${params}`, {
        headers: { Authorization: `Bearer ${OWDB_KEY}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (!apiResp.ok) {
        const errText = await apiResp.text();
        console.error("OpenWebcamDB error:", apiResp.status, errText);
        return new Response(JSON.stringify({ error: `OpenWebcamDB API error: ${apiResp.status}` }), {
          status: apiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiData = await apiResp.json();
      const webcams = apiData?.data || apiData?.webcams || apiData || [];
      const webcamList = Array.isArray(webcams) ? webcams : [];

      // Get existing cameras to avoid duplicates
      const { data: existing } = await supabase.from("cameras").select("name, embed_url, stream_url, original_url");
      const existingUrls = new Set(
        (existing || []).flatMap((r: any) => [r.embed_url, r.stream_url, r.original_url].filter(Boolean))
      );
      const existingNames = new Set((existing || []).map((r: any) => r.name?.toLowerCase()).filter(Boolean));

      const inserted: any[] = [];
      const skipped: string[] = [];

      for (const wc of webcamList) {
        const slug = wc.slug || wc.id;
        const wcName = wc.title || wc.name || slug || "Unknown Webcam";

        // Skip if name already exists
        if (existingNames.has(wcName.toLowerCase())) {
          skipped.push(wcName);
          continue;
        }

        // Fetch individual webcam details for stream_url
        let streamUrl: string | null = null;
        let thumbnailUrl = wc.thumbnail_url || wc.image_url || wc.preview_url || null;

        if (slug) {
          try {
            const detailResp = await fetch(`https://openwebcamdb.com/api/v1/webcams/${slug}`, {
              headers: { Authorization: `Bearer ${OWDB_KEY}`, Accept: "application/json" },
              signal: AbortSignal.timeout(8000),
            });
            if (detailResp.ok) {
              const detail = await detailResp.json();
              const wcDetail = detail?.data || detail;
              streamUrl = wcDetail?.stream_url || wcDetail?.url || null;
              if (!thumbnailUrl) thumbnailUrl = wcDetail?.thumbnail_url || wcDetail?.image_url || null;
            }
          } catch (e) {
            console.error(`Failed to fetch detail for ${slug}:`, e);
          }
        }

        const primaryUrl = streamUrl || wc.url || wc.stream_url || null;
        if (!primaryUrl || existingUrls.has(primaryUrl)) {
          skipped.push(wcName);
          continue;
        }

        // Detect source type
        const detection = await detectSourceType(primaryUrl);

        const lat = Number(wc.latitude || wc.lat) || 0;
        const lng = Number(wc.longitude || wc.lng || wc.lon) || 0;
        // Handle country as object {name, iso_code} or string
        const rawCountry = wc.country;
        const country = typeof rawCountry === "object" && rawCountry?.name ? rawCountry.name : (wc.country_name || rawCountry || "");
        // Handle city as object or string
        const rawCity = wc.city;
        const city = typeof rawCity === "object" && rawCity?.name ? rawCity.name : (wc.city_name || rawCity || wc.location || "");
        const category = (typeof wc.category === "object" && wc.category?.name ? wc.category.name : (wc.category || "public")).toLowerCase();
        const validCats = ["traffic", "tourism", "ports", "weather", "public"];

        const payload: any = {
          name: wcName,
          country,
          city,
          category: validCats.includes(category) ? category : "public",
          source_type: detection.source_type === "youtube" ? "embed_page" : (detection.stream_type_detected === "hls" ? "hls" : "embed_page"),
          source_name: "OpenWebcamDB",
          embed_url: detection.source_type === "youtube" && detection.youtube_video_id
            ? `https://www.youtube.com/embed/${detection.youtube_video_id}`
            : (primaryUrl.includes("youtube") ? primaryUrl : null),
          stream_url: detection.stream_type_detected === "hls" ? primaryUrl : null,
          snapshot_url: detection.stream_type_detected === "snapshot" ? primaryUrl : null,
          thumbnail_url: thumbnailUrl,
          original_url: primaryUrl,
          lat,
          lng,
          is_active: true,
          status: "active",
          youtube_video_id: detection.youtube_video_id,
          playable_url: detection.playable_url,
          verification_status: detection.verification_status,
          stream_type_detected: detection.stream_type_detected,
          is_verified: ["verified_youtube", "verified_hls", "verified_snapshot", "verified_mjpeg"].includes(detection.verification_status),
          failure_count: 0,
          last_checked_at: new Date().toISOString(),
        };

        const { data: created, error: insertErr } = await supabase.from("cameras").insert(payload).select().single();
        if (created) {
          inserted.push(created);
          existingUrls.add(primaryUrl);
          existingNames.add(wcName.toLowerCase());
        } else if (insertErr) {
          console.error(`Insert error for ${wcName}:`, insertErr.message);
          skipped.push(wcName);
        }
      }

      return new Response(JSON.stringify({
        source: "OpenWebcamDB",
        fetched: webcamList.length,
        inserted: inserted.length,
        skipped: skipped.length,
        skipped_names: skipped,
        cameras: inserted,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CRUD ──
    if (action === "create") {
      const camData = body.camera;
      const primaryUrl = camData.embed_url || camData.stream_url || camData.snapshot_url;
      if (primaryUrl) {
        const detection = await detectSourceType(primaryUrl);
        camData.original_url = primaryUrl;
        camData.youtube_video_id = detection.youtube_video_id;
        camData.playable_url = detection.playable_url;
        camData.verification_status = detection.verification_status;
        camData.stream_type_detected = detection.stream_type_detected;
        camData.is_verified = ["verified_youtube", "verified_hls", "verified_snapshot", "verified_mjpeg"].includes(detection.verification_status);
      }
      const { data, error } = await supabase.from("cameras").insert(camData).select().single();
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
