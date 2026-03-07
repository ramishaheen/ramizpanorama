import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
      signal: controller.signal,
    });

    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI error ${response.status}: ${t}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTelegramPosts(): Promise<Array<{ id: number; text: string; date: string }>> {
  const res = await fetch("https://t.me/s/WarsLeaks", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" },
  });
  if (!res.ok) throw new Error(`Telegram responded with ${res.status}`);
  const html = await res.text();

  const posts: Array<{ id: number; text: string; date: string }> = [];
  const messageBlocks = html.split('data-post="WarsLeaks/');

  for (let i = 1; i < messageBlocks.length; i++) {
    const block = messageBlocks[i];
    const idMatch = block.match(/^(\d+)"/);
    if (!idMatch) continue;
    const id = parseInt(idMatch[1]);

    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = textMatch
      ? textMatch[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .trim()
      : "";

    const dateMatch = block.match(/<time[^>]*datetime="([^"]*)"[^>]*>/);
    const date = dateMatch ? dateMatch[1] : "";

    if (text.length > 20) {
      posts.push({ id, text, date });
    }
  }

  return posts.sort((a, b) => b.id - a.id).slice(0, 15);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const posts = await fetchTelegramPosts();

    if (posts.length === 0) {
      return new Response(JSON.stringify({ markers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postsSummary = posts.map((p, i) => `[${i}] ${p.text.slice(0, 300)}`).join("\n---\n");

    const prompt = `You are a military intelligence geo-analyst. Analyze these WarsLeaks Telegram posts and extract ONLY those that mention specific military events, attacks, missile launches, drone strikes, troop movements, naval incidents, or geopolitical events that can be pinpointed to a specific location.

FOCUS REGIONS: Jordan, Iraq, Israel/Palestine, Gulf Area (UAE, Saudi Arabia, Bahrain, Qatar, Kuwait, Oman), Iran, Yemen, Lebanon, Syria.

For each relevant post, provide:
- lat/lng coordinates (be precise — use known city/base/border coordinates)
- A short English headline (max 60 chars)
- A brief English summary (max 120 chars)
- category: one of MISSILE, MILITARY, NAVAL, DRONE, AIRSTRIKE, EXPLOSION, PROTEST, DIPLOMATIC, HUMANITARIAN
- severity: low, medium, high, or critical
- Whether this is a "special" event (Iran-related, missiles, rockets, drones targeting Jordan/Gulf) → mark as special: true

Reference coordinates for accuracy:
- Tehran: 35.69, 51.39 | Isfahan: 32.65, 51.68 | Bandar Abbas: 27.18, 56.27
- Baghdad: 33.31, 44.37 | Basra: 30.51, 47.81 | Erbil: 36.19, 44.01
- Amman: 31.95, 35.93 | Aqaba: 29.53, 35.01
- Gaza: 31.50, 34.47 | Tel Aviv: 32.07, 34.78 | Haifa: 32.79, 34.99
- Riyadh: 24.71, 46.67 | Dubai: 25.20, 55.27 | Doha: 25.29, 51.53
- Sanaa: 15.37, 44.21 | Aden: 12.79, 45.02
- Beirut: 33.89, 35.50 | Damascus: 33.51, 36.29
- Strait of Hormuz: 26.57, 56.25 | Bab el-Mandeb: 12.58, 43.33

Return ONLY valid JSON array:
[
  {
    "postIndex": 0,
    "lat": 33.31,
    "lng": 44.37,
    "headline": "Explosion near Baghdad Green Zone",
    "summary": "Reports of a large explosion heard near the Green Zone in central Baghdad",
    "category": "EXPLOSION",
    "severity": "high",
    "special": false
  }
]

If no posts are geo-locatable, return an empty array: []

POSTS:
${postsSummary}`;

    const aiResponse = await callAI([
      { role: "system", content: "You are a precise military intelligence geo-analyst. Return ONLY valid JSON, no markdown." },
      { role: "user", content: prompt },
    ]);

    let markers: any[] = [];
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        markers = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e, aiResponse);
    }

    // Validate and clean markers
    markers = markers
      .filter((m: any) => m.lat && m.lng && m.headline)
      .map((m: any, i: number) => ({
        id: `tg-${posts[m.postIndex]?.id || i}-${Date.now()}`,
        lat: Number(m.lat),
        lng: Number(m.lng),
        headline: String(m.headline).slice(0, 80),
        summary: String(m.summary || "").slice(0, 150),
        category: m.category || "MILITARY",
        severity: m.severity || "medium",
        special: Boolean(m.special),
        source: "WarsLeaks",
        timestamp: posts[m.postIndex]?.date || new Date().toISOString(),
      }));

    return new Response(JSON.stringify({ markers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Telegram intel error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg === "RATE_LIMIT") {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly", markers: [] }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "AI credits exhausted", markers: [] }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: msg, markers: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
