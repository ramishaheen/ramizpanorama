import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let cachedResponse: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 120_000; // 2 min

const categoryToGeoType: Record<string, string> = {
  MILITARY: "MILITARY", DIPLOMATIC: "DIPLOMATIC", HUMANITARIAN: "HUMANITARIAN",
  ECONOMIC: "ECONOMIC", AIRSPACE: "MILITARY", MARITIME: "MILITARY",
  MISSILE: "MILITARY", CIVILIAN: "HUMANITARIAN",
};

// Use Perplexity sonar for real-time web-grounded news
async function fetchRealTimeIntel(): Promise<any> {
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not configured");

  const now = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are a military intelligence analyst providing REAL war situation updates based on current real news. You have access to live web data. Current time: ${now}.

CRITICAL RULES:
1. Report ONLY real, verified events from actual news sources — NO fabrication
2. Include precise lat/lng coordinates for each event
3. Focus on: Iran, Israel, Palestine, Lebanon, Syria, Iraq, Yemen, Jordan, Saudi Arabia, UAE, Gulf region, Red Sea
4. Each update must cite a real source (Reuters, AP, Al Jazeera, BBC, Times of Israel, IRNA, etc.)
5. Include the most recent events from the last 24-48 hours

Respond ONLY with valid JSON (no markdown):
{
  "updates": [
    {
      "id": "unique-id",
      "headline": "Factual headline from real news",
      "body": "2-3 sentences with factual details from real reporting.",
      "category": "MILITARY|DIPLOMATIC|HUMANITARIAN|ECONOMIC|AIRSPACE|MARITIME|MISSILE|CIVILIAN",
      "severity": "low|medium|high|critical",
      "region": "Specific location name",
      "lat": 31.4,
      "lng": 34.4,
      "timestamp": "${now}",
      "source": "Actual news source name"
    }
  ],
  "situation_summary": "One paragraph summary of current situation based on real events.",
  "threat_level": "ELEVATED|HIGH|SEVERE|CRITICAL",
  "last_updated": "${now}"
}`
          },
          {
            role: "user",
            content: `What are the latest military, conflict, and geopolitical developments in the Middle East in the last 24-48 hours? Include events from Israel/Palestine, Iran, Lebanon, Syria, Iraq, Yemen, and the Gulf region. Provide exactly 8-10 updates with real news and precise coordinates.`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity API error:", response.status, errText);
      throw new Error(`Perplexity error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty Perplexity response");

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse response JSON");

    const sanitized = jsonMatch[0].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    let parsed: any;
    try {
      parsed = JSON.parse(sanitized);
    } catch {
      const fixed = sanitized.replace(/,\s*([\]}])/g, '$1');
      parsed = JSON.parse(fixed);
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

// Fallback: use Gemini if Perplexity fails
async function fetchGeminiIntel(): Promise<any> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const now = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: 'system', content: 'You are a military intelligence analyst. Output only valid JSON. Be realistic and specific with coordinates. Base your reports on plausible current events.' },
          { role: 'user', content: `Generate 8 intelligence situation updates for the Middle East. Current time: ${now}. Focus on Iran, Israel, Lebanon, Syria, Iraq, Yemen, Gulf. Include lat/lng. Format: {"updates":[{"id":"","headline":"","body":"","category":"MILITARY|DIPLOMATIC|HUMANITARIAN|ECONOMIC|AIRSPACE|MARITIME|MISSILE","severity":"low|medium|high|critical","region":"","lat":0,"lng":0,"timestamp":"${now}","source":""}],"situation_summary":"","threat_level":"HIGH","last_updated":"${now}"}` }
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("Gemini API failed");

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty Gemini response");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse Gemini response");

    const sanitized = jsonMatch[0].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    try {
      return JSON.parse(sanitized);
    } catch {
      return JSON.parse(sanitized.replace(/,\s*([\]}])/g, '$1'));
    }
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Return cache if fresh
  if (cachedResponse && Date.now() - cacheTimestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cachedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Try Perplexity first (real-time web-grounded data)
    let parsed: any;
    try {
      parsed = await fetchRealTimeIntel();
      parsed._source = "perplexity_live";
    } catch (perplexityErr) {
      console.warn("Perplexity failed, falling back to Gemini:", perplexityErr);
      parsed = await fetchGeminiIntel();
      parsed._source = "gemini_fallback";
    }

    // Cache successful response
    cachedResponse = parsed;
    cacheTimestamp = Date.now();

    // Write to DB (non-fatal)
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const updates = parsed.updates || [];
      const geoAlerts = updates
        .filter((u: any) => u.lat != null && u.lng != null)
        .map((u: any) => ({
          id: `ai-news-${u.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: categoryToGeoType[u.category] || "MILITARY",
          region: u.region || "Unknown",
          title: u.headline || "Intelligence Update",
          summary: u.body || "",
          severity: u.severity || "medium",
          source: `NEWS: ${u.source || "Intelligence Analysis"}`,
          timestamp: u.timestamp || new Date().toISOString(),
          lat: u.lat, lng: u.lng,
        }));
      if (geoAlerts.length > 0) {
        await supabase.from("geo_alerts").insert(geoAlerts);
        const { data: oldAiAlerts } = await supabase.from("geo_alerts").select("id").like("id", "ai-news-%").order("timestamp", { ascending: false });
        if (oldAiAlerts && oldAiAlerts.length > 24) {
          const toDelete = oldAiAlerts.slice(24).map((a: any) => a.id);
          await supabase.from("geo_alerts").delete().in("id", toDelete);
        }
      }
    } catch (dbErr) {
      console.error("DB write error (non-fatal):", dbErr);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown";
    console.error('War updates error:', errMsg);

    // Return cached data or minimal fallback
    if (cachedResponse) {
      return new Response(JSON.stringify(cachedResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Minimal fallback — just status info, no fake events
    const fallback = {
      updates: [],
      situation_summary: "Intelligence feeds are currently being refreshed. Data will update shortly.",
      threat_level: "HIGH",
      last_updated: new Date().toISOString(),
      _fallback: true,
    };
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
