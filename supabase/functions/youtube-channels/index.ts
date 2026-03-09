import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// YouTube URL parsing
function parseYouTubeUrl(url: string): { type: string; videoId?: string; channelId?: string } {
  const trimmed = url.trim();

  // Watch URL
  const watchMatch = trimmed.match(/youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/i);
  if (watchMatch) return { type: "watch", videoId: watchMatch[1] };

  // Live URL
  const liveMatch = trimmed.match(/youtube\.com\/live\/([A-Za-z0-9_-]{11})/i);
  if (liveMatch) return { type: "live", videoId: liveMatch[1] };

  // Embed URL
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i);
  if (embedMatch) return { type: "embed", videoId: embedMatch[1] };

  // Shorts URL
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i);
  if (shortsMatch) return { type: "shorts", videoId: shortsMatch[1] };

  // Short URL
  const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/i);
  if (shortMatch) return { type: "short", videoId: shortMatch[1] };

  // Channel URL patterns
  const channelMatch = trimmed.match(/youtube\.com\/(?:channel\/|c\/|@)([A-Za-z0-9_-]+)/i);
  if (channelMatch) return { type: "channel", channelId: channelMatch[1] };

  return { type: "unknown" };
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // LIST
    if (req.method === "GET" && action === "list") {
      const { data, error } = await sb.from("youtube_channels").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ channels: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json();

      if (action === "add") {
        const { url: inputUrl, name, country, category } = body;
        if (!inputUrl) throw new Error("URL is required");
        if (!isYouTubeUrl(inputUrl)) throw new Error("Only YouTube URLs are accepted");

        const parsed = parseYouTubeUrl(inputUrl);
        if (parsed.type === "unknown") throw new Error("Could not parse YouTube URL");

        const videoId = parsed.videoId || null;
        const channelId = parsed.channelId || null;
        const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

        const record = {
          name: name || `YouTube Channel`,
          source_type: "youtube_live",
          original_url: inputUrl,
          youtube_video_id: videoId,
          youtube_channel_id: channelId,
          embed_url: embedUrl,
          status: videoId ? "online" : "offline",
          is_live: !!videoId,
          thumbnail_url: thumbnailUrl,
          country: country || "",
          category: category || "public",
        };

        const { data, error } = await sb.from("youtube_channels").insert(record).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ channel: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "update") {
        const { id, ...updates } = body;
        if (!id) throw new Error("ID is required");

        // If URL changed, re-parse
        if (updates.original_url) {
          if (!isYouTubeUrl(updates.original_url)) throw new Error("Only YouTube URLs are accepted");
          const parsed = parseYouTubeUrl(updates.original_url);
          if (parsed.type === "unknown") throw new Error("Could not parse YouTube URL");
          updates.youtube_video_id = parsed.videoId || null;
          updates.youtube_channel_id = parsed.channelId || null;
          updates.embed_url = parsed.videoId ? `https://www.youtube.com/embed/${parsed.videoId}` : null;
          updates.thumbnail_url = parsed.videoId ? `https://img.youtube.com/vi/${parsed.videoId}/mqdefault.jpg` : null;
          updates.is_live = !!parsed.videoId;
          updates.status = parsed.videoId ? "online" : "offline";
        }

        updates.updated_at = new Date().toISOString();
        const { data, error } = await sb.from("youtube_channels").update(updates).eq("id", id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ channel: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "delete") {
        const { id } = body;
        if (!id) throw new Error("ID is required");
        const { error } = await sb.from("youtube_channels").delete().eq("id", id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "refresh") {
        const { id } = body;
        if (!id) throw new Error("ID is required");
        // Just update the timestamp to trigger a "refresh"
        const { data, error } = await sb.from("youtube_channels").update({ updated_at: new Date().toISOString() }).eq("id", id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ channel: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
