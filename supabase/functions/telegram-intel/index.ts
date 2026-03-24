import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_HOURS = 1; // Reduced from 24h for fresher data

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function callAI(messages: Array<{ role: string; content: string }>) {
  // Try Lovable AI Gateway first (no API key needed), then fall back to direct Gemini
  const lovableKey = Deno.env.get("NVIDIA_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    // Attempt 1: Lovable AI Gateway
    if (lovableKey) {
      try {
        const resp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "moonshotai/kimi-k2-thinking", messages }),
          signal: controller.signal,
        });
        if (resp.status === 429) throw new Error("RATE_LIMIT");
        if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
        if (resp.ok) {
          const data = await resp.json();
          let content = data.choices?.[0]?.message?.content || "";
          content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          return content;
        }
        console.warn("Lovable AI failed, falling back to Gemini:", resp.status);
      } catch (e) {
        if (e instanceof Error && (e.message === "RATE_LIMIT" || e.message === "PAYMENT_REQUIRED")) throw e;
        console.warn("Lovable AI error, falling back:", e);
      }
    }

    // Attempt 2: Direct Gemini API
    if (!geminiKey) throw new Error("No AI provider available");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gemini-2.5-flash", messages }),
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

  return posts.sort((a, b) => b.id - a.id).slice(0, 50);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = getSupabase();

    // Check if force refresh requested
    let force = false;
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch { /* no body is fine */ }

    // Check cache — return cached markers if less than TTL old
    if (!force) {
      const { data: cached } = await sb
        .from("telegram_intel_cache")
        .select("markers, fetched_at")
        .eq("region_focus", "middle_east")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        const ttl = CACHE_TTL_HOURS * 60 * 60 * 1000;
        if (age < ttl) {
          console.log(`Returning cached markers (age: ${Math.round(age / 60000)}min)`);
          return new Response(JSON.stringify({ markers: cached.markers, cached: true, age_minutes: Math.round(age / 60000) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Cache expired or missing — fetch fresh data
    const posts = await fetchTelegramPosts();

    if (posts.length === 0) {
      return new Response(JSON.stringify({ markers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString().split("T")[0];
    const BATCH_SIZE = 20;
    const batches: Array<Array<{ id: number; text: string; date: string }>> = [];
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      batches.push(posts.slice(i, i + BATCH_SIZE));
    }

    const allMarkers: any[] = [];

    for (const batch of batches) {
      const postsSummary = batch.map((p, i) => `[${i}] (posted: ${p.date || "unknown"}) ${p.text.slice(0, 300)}`).join("\n---\n");

      const prompt = `You are a military intelligence geo-analyst. Today's date is ${now}. Analyze these WarsLeaks Telegram posts and extract ALL that mention specific military events, attacks, missile launches, drone strikes, troop movements, naval incidents, protests, airstrikes, explosions, or geopolitical events.

PRIORITY REGIONS (extract ALL events from these):
- JORDAN: Amman, Aqaba, Zarqa, Mafraq, border areas, al-Tanf
- GULF COUNTRIES: Saudi Arabia, UAE, Bahrain, Qatar, Kuwait, Oman — all cities, bases, ports
- IRAN: Tehran, Isfahan, Natanz, Bushehr, Bandar Abbas, Chabahar, Shiraz, Tabriz, IRGC bases
- IRAQ: Baghdad, Basra, Erbil, Kirkuk, Ain al-Asad, al-Taji
- ISRAEL/PALESTINE: Gaza, West Bank, Tel Aviv, Haifa, Golan, Negev, Rafah, Khan Younis
- YEMEN: Sanaa, Aden, Hodeidah, Marib — Houthi-related
- LEBANON: Beirut, South Lebanon, Bekaa
- SYRIA: Damascus, Aleppo, Deir ez-Zor, Latakia, T4 airbase

Also include: Red Sea, Strait of Hormuz, Bab el-Mandeb, Suez Canal events.

For each relevant post, provide:
- lat/lng coordinates (be precise — use known city/base/border coordinates)
- A short English headline (max 60 chars)
- A brief English summary (max 120 chars)
- category: one of MISSILE, MILITARY, NAVAL, DRONE, AIRSTRIKE, EXPLOSION, PROTEST, DIPLOMATIC, HUMANITARIAN
- severity: low, medium, high, or critical
- Whether this is a "special" event (Iran-related, missiles, rockets, drones, Houthi attacks) → special: true

Reference coordinates:
- Amman: 31.95, 35.93 | Aqaba: 29.53, 35.01 | Mafraq: 32.34, 36.21
- Tehran: 35.69, 51.39 | Isfahan: 32.65, 51.68 | Bandar Abbas: 27.18, 56.27 | Natanz: 33.51, 51.92 | Bushehr: 28.97, 50.84 | Shiraz: 29.59, 52.58
- Baghdad: 33.31, 44.37 | Basra: 30.51, 47.81 | Erbil: 36.19, 44.01 | Ain al-Asad: 33.79, 42.44
- Riyadh: 24.71, 46.67 | Jeddah: 21.49, 39.19 | Dubai: 25.20, 55.27 | Abu Dhabi: 24.45, 54.65 | Doha: 25.29, 51.53 | Kuwait City: 29.38, 47.99 | Manama: 26.23, 50.59 | Muscat: 23.61, 58.59
- Gaza: 31.50, 34.47 | Tel Aviv: 32.07, 34.78 | Haifa: 32.79, 34.99 | Rafah: 31.28, 34.24 | Khan Younis: 31.35, 34.30
- Sanaa: 15.37, 44.21 | Aden: 12.79, 45.02 | Hodeidah: 14.80, 42.95 | Marib: 15.46, 45.33
- Beirut: 33.89, 35.50 | Damascus: 33.51, 36.29 | Aleppo: 36.20, 37.15
- Strait of Hormuz: 26.57, 56.25 | Bab el-Mandeb: 12.58, 43.33 | Suez Canal: 30.46, 32.35

Return ONLY valid JSON array. If no posts are geo-locatable, return: []

[{"postIndex": 0, "lat": 33.31, "lng": 44.37, "headline": "Explosion near Baghdad", "summary": "Reports of explosion near Green Zone", "category": "EXPLOSION", "severity": "high", "special": false}]

POSTS:
${postsSummary}`;

      try {
        const aiResponse = await callAI([
          { role: "system", content: "You are a precise military intelligence geo-analyst. Return ONLY valid JSON, no markdown. Extract ALL geo-locatable events especially from Jordan, Gulf countries, and Iran." },
          { role: "user", content: prompt },
        ]);

        let batchMarkers: any[] = [];
        try {
          const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            batchMarkers = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("Failed to parse AI response:", e);
        }

        batchMarkers
          .filter((m: any) => m.lat && m.lng && m.headline)
          .forEach((m: any, i: number) => {
            allMarkers.push({
              id: `tg-${batch[m.postIndex]?.id || i}-${Date.now()}-${allMarkers.length}`,
              lat: Number(m.lat),
              lng: Number(m.lng),
              headline: String(m.headline).slice(0, 80),
              summary: String(m.summary || "").slice(0, 150),
              category: m.category || "MILITARY",
              severity: m.severity || "medium",
              special: Boolean(m.special),
              source: "WarsLeaks",
              timestamp: batch[m.postIndex]?.date || new Date().toISOString(),
            });
          });
      } catch (e) {
        console.error("Batch AI error:", e);
      }
    }

    // Store in cache — delete old entries first, then insert fresh
    await sb.from("telegram_intel_cache").delete().eq("region_focus", "middle_east");
    await sb.from("telegram_intel_cache").insert({
      markers: allMarkers,
      region_focus: "middle_east",
      fetched_at: new Date().toISOString(),
    });

    console.log(`Cached ${allMarkers.length} markers for ${CACHE_TTL_HOURS}h`);

    return new Response(JSON.stringify({ markers: allMarkers, cached: false }), {
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
