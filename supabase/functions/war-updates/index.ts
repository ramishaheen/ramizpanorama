import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory cache
let cachedResponse: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 120_000; // 2 min

const FALLBACK_DATA = {
  updates: [
    { id: "fb-1", headline: "IDF confirms interceptor deployment along northern border", body: "The Israeli Defense Forces have confirmed the deployment of additional Iron Dome batteries along the northern border with Lebanon. The deployment comes amid increased drone activity detected over the Golan Heights region. Military officials stated the move is precautionary.", category: "MILITARY", severity: "high", region: "Golan Heights, Israel", lat: 33.0, lng: 35.75, timestamp: new Date().toISOString(), source: "IDF Spokesperson" },
    { id: "fb-2", headline: "UN Security Council emergency session on Iran tensions", body: "The United Nations Security Council has convened an emergency session to discuss escalating tensions between Iran and regional powers. Diplomats from P5+1 nations are presenting proposals for de-escalation. Russia and China have called for restraint from all parties.", category: "DIPLOMATIC", severity: "medium", region: "International", lat: 40.75, lng: -73.97, timestamp: new Date().toISOString(), source: "UN Press Office" },
    { id: "fb-3", headline: "Strait of Hormuz shipping traffic disrupted by naval exercises", body: "Commercial shipping through the Strait of Hormuz has been disrupted by Iranian Revolutionary Guard naval exercises. At least 12 tankers have been rerouted through alternative channels. Insurance premiums for Gulf shipping have risen 40% in the past 48 hours.", category: "MARITIME", severity: "high", region: "Strait of Hormuz", lat: 26.6, lng: 56.2, timestamp: new Date().toISOString(), source: "Lloyd's Maritime Intelligence" },
    { id: "fb-4", headline: "Baghdad Green Zone placed on heightened security alert", body: "The Baghdad Green Zone has been placed on heightened security alert following intelligence reports of potential rocket attacks by Iran-aligned militia groups. US Embassy personnel have been moved to hardened shelters. Iraqi security forces have established additional checkpoints.", category: "MILITARY", severity: "critical", region: "Baghdad, Iraq", lat: 33.31, lng: 44.37, timestamp: new Date().toISOString(), source: "CENTCOM" },
    { id: "fb-5", headline: "Jordan closes airspace over eastern provinces", body: "Jordanian authorities have closed airspace over the eastern provinces bordering Iraq as a precautionary measure. Royal Jordanian Airlines has rerouted 15 flights. The closure affects commercial and military aviation in the Al-Mafraq and Zarqa governorates.", category: "AIRSPACE", severity: "high", region: "Eastern Jordan", lat: 32.3, lng: 37.5, timestamp: new Date().toISOString(), source: "JCAA" },
    { id: "fb-6", headline: "UNHCR reports surge in displacement from southern Iraq", body: "The UN High Commissioner for Refugees reports a significant increase in internally displaced persons from southern Iraq. Approximately 15,000 families have fled Basra province in the past 72 hours. Emergency shelters are being established in Najaf and Karbala.", category: "HUMANITARIAN", severity: "medium", region: "Basra, Iraq", lat: 30.51, lng: 47.81, timestamp: new Date().toISOString(), source: "UN OCHA" },
    { id: "fb-7", headline: "Saudi Aramco activates contingency plans for Gulf facilities", body: "Saudi Aramco has activated contingency plans for its Gulf coast facilities amid rising regional tensions. The Ras Tanura terminal has increased security patrols and activated missile defense systems. Oil production remains at current levels but emergency protocols are in place.", category: "ECONOMIC", severity: "high", region: "Ras Tanura, Saudi Arabia", lat: 26.64, lng: 50.17, timestamp: new Date().toISOString(), source: "Reuters" },
    { id: "fb-8", headline: "IRGC missile units on elevated readiness in western Iran", body: "Satellite imagery indicates Iranian Revolutionary Guard Corps missile units in western Iran have been placed on elevated readiness. Mobile launchers have been dispersed from known garrison locations near Kermanshah. The deployment pattern is consistent with preparation for medium-range ballistic missile operations.", category: "MISSILE", severity: "critical", region: "Kermanshah, Iran", lat: 34.31, lng: 47.06, timestamp: new Date().toISOString(), source: "Satellite Analysis" },
  ],
  situation_summary: "Regional tensions remain critically elevated with active military deployments across multiple theaters. The Strait of Hormuz shipping disruption and airspace closures indicate preparation for potential escalation. Diplomatic efforts continue at the UN level but have not yet produced concrete de-escalation measures. Humanitarian concerns are growing in Iraq with significant population displacement.",
  threat_level: "SEVERE",
  last_updated: new Date().toISOString(),
  _fallback: true,
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gemini-2.5-flash", messages }),
      signal: controller.signal,
    });

    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI_UNAVAILABLE");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_UNAVAILABLE");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

const categoryToGeoType: Record<string, string> = {
  MILITARY: "MILITARY", DIPLOMATIC: "DIPLOMATIC", HUMANITARIAN: "HUMANITARIAN",
  ECONOMIC: "ECONOMIC", AIRSPACE: "MILITARY", MARITIME: "MILITARY",
  MISSILE: "MILITARY", CIVILIAN: "HUMANITARIAN",
};

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
    const { context } = await req.json().catch(() => ({ context: '' }));
    const now = new Date().toISOString();

    const prompt = `You are a military intelligence analyst providing REAL-TIME war situation updates. Current time: ${now}

${context ? `Current dashboard data context:\n${context}\n` : ''}

FOCUS AREA: Your updates MUST be located ONLY within these regions:
1. IRAN 2. ISRAEL 3. JORDAN 4. GULF AREA (UAE, Bahrain, Kuwait, Qatar, Oman, Saudi Arabia) 5. IRAQ 6. SYRIA 7. LEBANON

Generate exactly 8 intelligence updates in JSON format — at least 1 update per region above.

CRITICAL: Each update MUST include precise "lat" and "lng" coordinates.

Respond ONLY with valid JSON:
{
  "updates": [
    { "id": "unique-id", "headline": "Short headline", "body": "2-3 sentences.", "category": "MILITARY|DIPLOMATIC|HUMANITARIAN|ECONOMIC|AIRSPACE|MARITIME|MISSILE|CIVILIAN", "severity": "low|medium|high|critical", "region": "name", "lat": 31.4, "lng": 34.4, "timestamp": "${now}", "source": "source name" }
  ],
  "situation_summary": "One paragraph.",
  "threat_level": "ELEVATED|HIGH|SEVERE|CRITICAL",
  "last_updated": "${now}"
}`;

    const content = await callAI([
      { role: 'system', content: 'You are a military intelligence analyst. Output only valid JSON. Be realistic and specific. Always include accurate lat/lng coordinates.' },
      { role: 'user', content: prompt },
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");

    const sanitized = jsonMatch[0].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    let parsed: any;
    try {
      parsed = JSON.parse(sanitized);
    } catch {
      const fixed = sanitized.replace(/,\s*([\]}])/g, '$1');
      parsed = JSON.parse(fixed);
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
          title: u.headline || "AI Intelligence Update",
          summary: u.body || "",
          severity: u.severity || "medium",
          source: `AI-NEWS: ${u.source || "Intelligence Analysis"}`,
          timestamp: u.timestamp || now,
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

    // On any AI failure, return cached data or fallback
    const fallback = cachedResponse || { ...FALLBACK_DATA, last_updated: new Date().toISOString() };
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
