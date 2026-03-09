import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: Record<string, any> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const action = body.action || "proxy";

    // ── PROXY: fetch a URL server-side and return binary with CORS ──
    if (action === "proxy") {
      const url = body.url;
      if (!url) return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StreamProxy/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Upstream ${resp.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contentType = resp.headers.get("content-type") || "application/octet-stream";
      const data = await resp.arrayBuffer();

      return new Response(data, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-store",
          "X-Proxied-From": new URL(url).hostname,
        },
      });
    }

    // ── DETECT: probe a URL and determine stream type ──
    if (action === "detect") {
      const url = body.url;
      if (!url) return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Check by URL pattern first
      if (/\.m3u8(\?|$)/i.test(url)) {
        return new Response(JSON.stringify({ type: "hls", confidence: "high" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (/rtsp:\/\//i.test(url)) {
        return new Response(JSON.stringify({ type: "rtsp", confidence: "high" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/i.test(url)) {
        return new Response(JSON.stringify({ type: "embed", confidence: "high" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Probe with HEAD
      try {
        const headResp = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
        const ct = (headResp.headers.get("content-type") || "").toLowerCase();

        if (ct.includes("mpegurl") || ct.includes("x-mpegurl")) {
          return new Response(JSON.stringify({ type: "hls", confidence: "high", contentType: ct }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (ct.includes("multipart/x-mixed-replace") || ct.includes("mjpeg")) {
          return new Response(JSON.stringify({ type: "mjpeg", confidence: "high", contentType: ct }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (ct.includes("image/")) {
          return new Response(JSON.stringify({ type: "snapshot", confidence: "high", contentType: ct }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (ct.includes("text/html")) {
          return new Response(JSON.stringify({ type: "embed", confidence: "medium", contentType: ct }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ type: "unknown", confidence: "low", contentType: ct }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ type: "unknown", confidence: "low", error: e instanceof Error ? e.message : "probe failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── RTSP_CHECK: basic RTSP availability check ──
    if (action === "rtsp_check") {
      const url = body.url;
      if (!url || !url.startsWith("rtsp://")) {
        return new Response(JSON.stringify({ reachable: false, error: "Not an RTSP URL" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // We can't actually connect to RTSP from edge functions (no TCP socket API),
      // but we can validate the URL format and report it as "rtsp detected"
      try {
        const parsed = new URL(url);
        return new Response(JSON.stringify({
          reachable: false,
          type: "rtsp",
          host: parsed.hostname,
          port: parsed.port || "554",
          note: "RTSP requires native client; browser proxy not available in edge runtime",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ reachable: false, error: "Invalid RTSP URL" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Stream proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
