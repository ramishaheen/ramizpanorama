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
    // Fetch the public Telegram channel page
    const res = await fetch("https://t.me/s/WarsLeaks", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)",
      },
    });

    if (!res.ok) {
      throw new Error(`Telegram responded with ${res.status}`);
    }

    const html = await res.text();

    // Parse posts from the HTML
    const posts: Array<{ id: number; text: string; date: string; views?: string }> = [];

    // Match message blocks
    const messageRegex = /data-post="WarsLeaks\/(\d+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time[^>]*datetime="([^"]*)"[^>]*>/g;
    
    let match;
    while ((match = messageRegex.exec(html)) !== null) {
      const id = parseInt(match[1]);
      // Strip HTML tags from text
      const text = match[2]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      const date = match[3];

      if (text.length > 0) {
        posts.push({ id, text, date });
      }
    }

    // Try to extract views
    const viewRegex = /data-post="WarsLeaks\/(\d+)"[\s\S]*?<span class="tgme_widget_message_views"[^>]*>([\s\S]*?)<\/span>/g;
    let viewMatch;
    while ((viewMatch = viewRegex.exec(html)) !== null) {
      const id = parseInt(viewMatch[1]);
      const views = viewMatch[2].trim();
      const post = posts.find(p => p.id === id);
      if (post) {
        post.views = views;
      }
    }

    // Return latest 20 posts, newest first
    const sorted = posts.sort((a, b) => b.id - a.id).slice(0, 20);

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
