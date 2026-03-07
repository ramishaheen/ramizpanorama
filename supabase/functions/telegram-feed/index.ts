import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const res = await fetch("https://t.me/s/WarsLeaks", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)",
      },
    });

    if (!res.ok) {
      throw new Error(`Telegram responded with ${res.status}`);
    }

    const html = await res.text();

    const posts: Array<{ id: number; text: string; date: string; views?: string; media?: string; mediaType?: "photo" | "video" }> = [];

    // Split HTML into message blocks for better parsing
    const messageBlocks = html.split('data-post="WarsLeaks/');
    
    for (let i = 1; i < messageBlocks.length; i++) {
      const block = messageBlocks[i];
      
      // Extract post ID
      const idMatch = block.match(/^(\d+)"/);
      if (!idMatch) continue;
      const id = parseInt(idMatch[1]);

      // Extract text
      const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const text = textMatch
        ? textMatch[1]
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim()
        : "";

      // Extract date
      const dateMatch = block.match(/<time[^>]*datetime="([^"]*)"[^>]*>/);
      const date = dateMatch ? dateMatch[1] : "";

      // Extract media - photo
      let media: string | undefined;
      let mediaType: "photo" | "video" | undefined;

      // Check for photo (background-image style)
      const photoMatch = block.match(/tgme_widget_message_photo_wrap[\s\S]*?background-image:\s*url\('([^']+)'\)/);
      if (photoMatch) {
        media = photoMatch[1];
        mediaType = "photo";
      }

      // Check for video thumbnail
      if (!media) {
        const videoThumbMatch = block.match(/tgme_widget_message_video_thumb[\s\S]*?background-image:\s*url\('([^']+)'\)/);
        if (videoThumbMatch) {
          media = videoThumbMatch[1];
          mediaType = "video";
        }
      }

      // Also check for <img> inside photo wrap
      if (!media) {
        const imgMatch = block.match(/tgme_widget_message_photo[\s\S]*?<img[^>]+src="([^"]+)"/);
        if (imgMatch) {
          media = imgMatch[1];
          mediaType = "photo";
        }
      }

      // Check for round video / video player thumb
      if (!media) {
        const roundVideoMatch = block.match(/tgme_widget_message_roundvideo_thumb[\s\S]*?background-image:\s*url\('([^']+)'\)/);
        if (roundVideoMatch) {
          media = roundVideoMatch[1];
          mediaType = "video";
        }
      }

      // Extract views
      const viewsMatch = block.match(/<span class="tgme_widget_message_views"[^>]*>([\s\S]*?)<\/span>/);
      const views = viewsMatch ? viewsMatch[1].trim() : undefined;

      if (text.length > 0 || media) {
        posts.push({ id, text, date, views, media, mediaType });
      }
    }

    const sorted = posts
      .filter(p => p.text.length > 0)
      .sort((a, b) => b.id - a.id)
      .slice(0, 50);

    return new Response(JSON.stringify({ posts: sorted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Telegram feed error:", error);
    return new Response(
      JSON.stringify({ error: error.message, posts: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
