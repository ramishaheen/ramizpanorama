import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache
let cache: { city: string; data: any; ts: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const CITY_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  Baghdad: { lat: 33.31, lng: 44.37, zoom: 12 },
  Tehran: { lat: 35.69, lng: 51.39, zoom: 12 },
  Beirut: { lat: 33.89, lng: 35.50, zoom: 13 },
  Damascus: { lat: 33.51, lng: 36.29, zoom: 12 },
  Amman: { lat: 31.95, lng: 35.93, zoom: 12 },
  Riyadh: { lat: 24.71, lng: 46.67, zoom: 12 },
  Dubai: { lat: 25.20, lng: 55.27, zoom: 12 },
  Cairo: { lat: 30.04, lng: 31.24, zoom: 12 },
  Sanaa: { lat: 15.37, lng: 44.21, zoom: 12 },
  Gaza: { lat: 31.50, lng: 34.47, zoom: 13 },
  Khartoum: { lat: 15.60, lng: 32.53, zoom: 12 },
  Tripoli: { lat: 32.90, lng: 13.18, zoom: 12 },
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function fetchTelegramPosts(): Promise<Array<{ id: number; text: string; date: string }>> {
  const res = await fetch("https://t.me/s/WarsLeaks", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const posts: Array<{ id: number; text: string; date: string }> = [];
  const blocks = html.split('data-post="WarsLeaks/');
  for (let i = 1; i < blocks.length && posts.length < 30; i++) {
    const block = blocks[i];
    const idMatch = block.match(/^(\d+)"/);
    if (!idMatch) continue;
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = textMatch
      ? textMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
      : "";
    const dateMatch = block.match(/<time[^>]*datetime="([^"]*)"[^>]*>/);
    if (text.length > 20) {
      posts.push({ id: parseInt(idMatch[1]), text, date: dateMatch?.[1] || "" });
    }
  }
  return posts;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let city = "Baghdad";
    try {
      const body = await req.json();
      if (body.city && CITY_COORDS[body.city]) city = body.city;
    } catch {}

    // Check cache
    if (cache && cache.city === city && Date.now() - cache.ts < CACHE_TTL) {
      return new Response(JSON.stringify(cache.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cityInfo = CITY_COORDS[city];

    // Fetch data sources in parallel
    const [telegramPosts, telegramCache] = await Promise.all([
      fetchTelegramPosts().catch(() => []),
      (async () => {
        const sb = getSupabase();
        const { data } = await sb
          .from("telegram_intel_cache")
          .select("markers")
          .eq("region_focus", "middle_east")
          .order("fetched_at", { ascending: false })
          .limit(1)
          .single();
        return (data?.markers as any[]) || [];
      })().catch(() => []),
    ]);

    // Filter telegram markers near city
    const nearbyMarkers = (telegramCache as any[]).filter((m: any) => {
      const dist = Math.sqrt(Math.pow(m.lat - cityInfo.lat, 2) + Math.pow(m.lng - cityInfo.lng, 2));
      return dist < 3;
    });

    // Build context for AI
    const postsText = telegramPosts.slice(0, 15).map((p, i) => `[${i}] ${p.text.slice(0, 200)}`).join("\n---\n");
    const markersText = nearbyMarkers.slice(0, 10).map((m: any) =>
      `• ${m.headline} (${m.severity}) at ${m.lat},${m.lng}`
    ).join("\n");

    const systemPrompt = `You are a crisis intelligence analyst specializing in urban anomaly detection for the Middle East. Analyze incoming intelligence and traffic patterns to detect: evacuation patterns, protests, road closures, abnormal city activity, incidents, and logistics disruptions.

Scoring formula: 35% source corroboration + 20% source reliability + 20% traffic anomaly + 15% geographic agreement + 10% recency.
Confidence: 0-39 = low, 40-69 = medium, 70-100 = high.

IMPORTANT: Never present single-source claims as facts. Always classify unverified claims as "rumor".`;

    const userPrompt = `Analyze crisis intelligence for ${city} (${cityInfo.lat}, ${cityInfo.lng}).

RECENT TELEGRAM INTEL:
${postsText || "No recent posts available"}

NEARBY ACTIVE MARKERS:
${markersText || "No nearby markers"}

Based on this intelligence AND your knowledge of current events in ${city}, generate crisis anomaly events. For EACH event provide structured data. Consider realistic scenarios based on the geopolitical context.

Generate 4-8 realistic events for ${city} covering different types. Include at least one of each type if intelligence supports it: protest, evacuation, road_closure, abnormal_activity, incident, disruption.

Use precise coordinates within the city bounds (±0.05 of city center).`;

    const toolDef = {
      type: "function",
      function: {
        name: "report_crisis_events",
        description: "Report detected crisis anomaly events for the city",
        parameters: {
          type: "object",
          properties: {
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["protest", "evacuation", "road_closure", "disruption", "incident", "abnormal_activity", "rumor"] },
                  lat: { type: "number" },
                  lng: { type: "number" },
                  radius_km: { type: "number", description: "Affected radius in km" },
                  polygon: { type: "array", items: { type: "array", items: { type: "number" } }, description: "Optional polygon [[lat,lng]...]" },
                  headline: { type: "string", description: "Max 80 chars" },
                  summary: { type: "string", description: "Max 200 chars" },
                  confidence: { type: "number", description: "0-100 score" },
                  confidence_label: { type: "string", enum: ["low", "medium", "high"] },
                  source_count: { type: "number" },
                  sources: { type: "array", items: { type: "object", properties: { name: { type: "string" }, reliability: { type: "string", enum: ["high", "medium", "low"] } }, required: ["name", "reliability"] } },
                  affected_roads: { type: "array", items: { type: "string" } },
                  district: { type: "string" },
                  trend: { type: "string", enum: ["rising", "stable", "declining"] },
                  evacuation_direction: { type: "string", description: "Only for evacuation type" },
                  verified: { type: "boolean" },
                },
                required: ["type", "lat", "lng", "radius_km", "headline", "summary", "confidence", "confidence_label", "source_count", "district", "trend", "verified"],
              },
            },
            city_summary: { type: "string", description: "Brief overall city assessment" },
            threat_level: { type: "string", enum: ["low", "moderate", "elevated", "high", "critical"] },
          },
          required: ["events", "city_summary", "threat_level"],
        },
      },
    };

    // Try Lovable AI first, fallback to direct Gemini API
    let result = { events: [], city_summary: "Analysis unavailable", threat_level: "moderate" };
    let aiSuccess = false;

    // Attempt 1: Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "report_crisis_events" } },
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            result = JSON.parse(toolCall.function.arguments);
            aiSuccess = true;
          }
        } else {
          console.log(`Lovable AI returned ${response.status}, falling back to Gemini`);
        }
      } catch (e) {
        console.error("Lovable AI error, falling back:", e);
      }
    }

    // Attempt 2: Direct Gemini API
    if (!aiSuccess) {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "No AI provider available", events: [] }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "report_crisis_events" } },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Gemini error ${response.status}: ${text}`);
        }

        const aiData = await response.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          result = JSON.parse(toolCall.function.arguments);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    // Add IDs and timestamps
    const events = (result.events || []).map((e: any, i: number) => ({
      ...e,
      id: `ci-${city}-${i}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sources: e.sources || [{ name: "OSINT", reliability: "medium" }],
      affected_roads: e.affected_roads || [],
      polygon: e.polygon || null,
    }));

    const output = {
      events,
      city,
      city_coords: cityInfo,
      city_summary: result.city_summary,
      threat_level: result.threat_level,
      timestamp: new Date().toISOString(),
    };

    cache = { city, data: output, ts: Date.now() };

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Crisis intel error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", events: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
