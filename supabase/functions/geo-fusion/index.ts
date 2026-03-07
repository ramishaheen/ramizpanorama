import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_COUNTRIES = ["Iran", "Israel", "Jordan", "UAE", "Bahrain", "Kuwait", "Qatar", "Oman"];

const COUNTRY_BBOX: Record<string, [number, number, number, number]> = {
  Iran: [44.0, 25.0, 63.5, 40.0],
  Israel: [34.0, 29.0, 36.0, 33.5],
  Jordan: [34.8, 29.0, 39.5, 33.5],
  UAE: [51.0, 22.5, 56.5, 26.5],
  Bahrain: [50.3, 25.7, 50.8, 26.4],
  Kuwait: [46.5, 28.5, 48.5, 30.2],
  Qatar: [50.7, 24.4, 51.7, 26.2],
  Oman: [52.0, 16.5, 60.0, 26.5],
};

// City coordinates for geolocation fallback
const CITY_COORDS: Record<string, [number, number]> = {
  "Tehran": [51.389, 35.689], "Isfahan": [51.677, 32.652], "Shiraz": [52.531, 29.591],
  "Tabriz": [46.292, 38.080], "Mashhad": [59.606, 36.297], "Bandar Abbas": [56.274, 27.176],
  "Bushehr": [50.837, 28.968], "Kharg Island": [50.326, 29.233], "Chabahar": [60.643, 25.296],
  "Kerman": [57.078, 30.283], "Ahvaz": [48.684, 31.318], "Qom": [50.876, 34.639],
  "Natanz": [51.727, 33.513], "Fordow": [51.580, 34.880], "Arak": [49.689, 34.091],
  "Parchin": [51.770, 35.520], "Dezful": [48.393, 32.381],
  "Tel Aviv": [34.780, 32.085], "Jerusalem": [35.213, 31.769], "Haifa": [34.989, 32.794],
  "Beer Sheva": [34.791, 31.252], "Dimona": [35.033, 31.067], "Eilat": [34.948, 29.557],
  "Nevatim": [34.917, 31.208], "Ramon": [34.667, 30.776],
  "Amman": [35.930, 31.950], "Aqaba": [35.006, 29.527], "Irbid": [35.857, 32.556],
  "Dubai": [55.270, 25.205], "Abu Dhabi": [54.366, 24.453], "Al Dhafra": [54.547, 24.248],
  "Fujairah": [56.326, 25.129], "Jebel Ali": [55.028, 25.015],
  "Manama": [50.583, 26.228], "Isa Air Base": [50.591, 25.918],
  "Kuwait City": [47.978, 29.376], "Ali Al Salem": [47.521, 29.347],
  "Doha": [51.531, 25.286], "Al Udeid": [51.315, 25.117],
  "Muscat": [58.386, 23.588], "Duqm": [57.633, 19.665], "Salalah": [54.092, 17.017],
  "Strait of Hormuz": [56.400, 26.600], "Bab el-Mandeb": [43.300, 12.600],
};

function getCountryForPoint(lat: number, lng: number): string | null {
  for (const [country, [minLon, minLat, maxLon, maxLat]] of Object.entries(COUNTRY_BBOX)) {
    if (lat >= minLat && lat <= maxLat && lng >= minLon && lng <= maxLon) return country;
  }
  return null;
}

// In-memory cache
let cachedResult: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 180_000; // 3 minutes

// ── Perplexity Web Search ──
async function searchWarNews(): Promise<{ content: string; citations: string[] }> {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) {
    console.warn("PERPLEXITY_API_KEY not set, skipping web search");
    return { content: "", citations: [] };
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a geopolitical intelligence analyst. Report ONLY verified facts from the last 24 hours about the Iran-Israel war and regional military situation. Focus on: missile strikes, drone attacks, airstrikes, airspace closures, shipping disruptions, infrastructure damage, military movements, and diplomatic developments. Cover ONLY: Iran, Israel, Jordan, UAE, Bahrain, Kuwait, Qatar, Oman. For each event, include the city/location, country, and what happened. Be specific with locations."
          },
          {
            role: "user",
            content: "What are the latest developments in the Iran-Israel war in the last 24 hours? Include all military strikes, missile launches, drone attacks, airspace closures, shipping disruptions, infrastructure damage, and diplomatic responses across Iran, Israel, Jordan, UAE, Bahrain, Kuwait, Qatar, and Oman."
          }
        ],
        search_recency_filter: "day",
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity error:", response.status, errText);
      return { content: "", citations: [] };
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      citations: data.citations || [],
    };
  } catch (e) {
    console.error("Perplexity search failed:", e);
    return { content: "", citations: [] };
  }
}

// ── Lovable AI for structuring ──
async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

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

// ── NASA FIRMS fires for target region ──
async function fetchFIRMSFires(): Promise<any[]> {
  try {
    const resp = await fetch(
      "https://firms.modaps.eosdis.nasa.gov/api/area/csv/FIRMS_MAP_KEY/VIIRS_SNPP_NRT/world/1",
      { signal: AbortSignal.timeout(12000) }
    ).catch(() => null);

    if (resp && resp.ok) {
      const csvText = await resp.text();
      const lines = csvText.trim().split("\n");
      if (lines.length > 1) {
        const headers = lines[0].split(",");
        const latIdx = headers.indexOf("latitude");
        const lngIdx = headers.indexOf("longitude");
        const frpIdx = headers.indexOf("frp");
        const confIdx = headers.indexOf("confidence");
        const dateIdx = headers.indexOf("acq_date");

        return lines.slice(1).map((line, i) => {
          const cols = line.split(",");
          const lat = parseFloat(cols[latIdx]) || 0;
          const lng = parseFloat(cols[lngIdx]) || 0;
          const country = getCountryForPoint(lat, lng);
          if (!country) return null;
          return {
            id: `firms-${i}`, lat, lng, country,
            frp: parseFloat(cols[frpIdx]) || 0,
            confidence: cols[confIdx] || "nominal",
            date: cols[dateIdx] || new Date().toISOString().split("T")[0],
          };
        }).filter(Boolean);
      }
    }
  } catch (e) {
    console.error("FIRMS fetch error:", e);
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Return cached result if fresh
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
      console.log("Returning cached geo-fusion result");
      return new Response(JSON.stringify(cachedResult.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── STEP 1: Parallel data collection ──
    const [warNews, firmsData, geoRes, airspaceRes, rocketsRes, riskRes, vesselsRes] = await Promise.all([
      searchWarNews(),
      fetchFIRMSFires(),
      supabase.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(30),
      supabase.from("airspace_alerts").select("*").eq("active", true).limit(15),
      supabase.from("rockets").select("*").order("timestamp", { ascending: false }).limit(20),
      supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
      supabase.from("vessels").select("*").limit(30),
    ]);

    const now = new Date().toISOString();
    const risk = riskRes.data?.[0] || {};

    // Build summaries from DB
    const firesByCountry: Record<string, number> = {};
    (firmsData || []).forEach((f: any) => { firesByCountry[f.country] = (firesByCountry[f.country] || 0) + 1; });

    const airspaceByCountry: Record<string, string[]> = {};
    (airspaceRes.data || []).forEach((a: any) => {
      const arr = airspaceByCountry[a.region] || [];
      arr.push(`${a.type}: ${a.description} (${a.severity})`);
      airspaceByCountry[a.region] = arr;
    });

    const rocketsSummary = (rocketsRes.data || []).map((r: any) =>
      `${r.name} [${r.type}] status:${r.status} near ${r.current_lat.toFixed(1)},${r.current_lng.toFixed(1)}`
    ).join("; ") || "No active missiles";

    const alertsSummary = (geoRes.data || []).slice(0, 10).map((a: any) =>
      `[${a.severity}] ${a.type}: ${a.title} (${a.region})`
    ).join("; ") || "No alerts";

    const vesselCount = vesselsRes.data?.length || 0;

    // ── STEP 2: AI Fusion with live news ──
    const citationText = warNews.citations.length > 0
      ? `\nSOURCES: ${warNews.citations.slice(0, 10).join(", ")}`
      : "";

    let aiResult: any;
    try {
      const content = await callAI([
        {
          role: "system",
          content: `You are a geopolitical intelligence fusion engine for the Iran War 2026 situation map.

WAR CONTEXT: On 28 February 2026, Israel and the United States launched coordinated strikes on Iranian targets. Iran retaliated with missile and drone attacks. The conflict includes missile exchanges, regional military responses, infrastructure disruption, and geopolitical escalation across the Middle East.

Your task: Convert ALL provided intelligence (live news, sensor data, DB alerts) into structured geospatial events.

CITY COORDINATES REFERENCE (use these for geolocation):
${Object.entries(CITY_COORDS).map(([city, [lng, lat]]) => `${city}: [${lat}, ${lng}]`).join("\n")}

Return ONLY valid JSON matching this EXACT schema:
{
  "generated_at": "${now}",
  "conflict": "Iran War 2026",
  "countries_monitored": ${JSON.stringify(TARGET_COUNTRIES)},
  "events": [
    {
      "event_id": "evt_001",
      "event_type": "airstrike|missile_launch|drone_attack|explosion|border_clash|airspace_closure|shipping_disruption|infrastructure_damage|political_announcement|satellite_observation|fire_hotspot",
      "country": "Country",
      "location": "City or region name",
      "lat": 35.689,
      "lng": 51.389,
      "timestamp": "${now}",
      "description": "Detailed description of what happened",
      "source": "Reuters|BBC|Perplexity|NASA FIRMS|DB Alert",
      "confidence": "high|medium|low",
      "severity": 1-5
    }
  ],
  "layers": {
    "conflict_events": ["evt_xxx"],
    "missile_strike_reports": ["evt_xxx"],
    "airspace_disruptions": ["evt_xxx"],
    "shipping_disruptions": ["evt_xxx"],
    "infrastructure_damage": ["evt_xxx"],
    "political_announcements": ["evt_xxx"],
    "satellite_observations": ["evt_xxx"],
    "fire_hotspots": ["evt_xxx"]
  },
  "country_status": {
    "<COUNTRY>": {
      "conflict_intensity": 0-100,
      "latest_events": 0,
      "risk_level": "Low|Moderate|Elevated|High|Critical",
      "visibility_status": "clear|hazy|obscured",
      "weather_risk": "low|moderate|high",
      "aviation_status": "normal|disrupted|closed",
      "shipping_status": "normal|congested|disrupted",
      "infrastructure_status": "normal|partial_disruption|major_disruption",
      "public_alert_level": "green|yellow|orange|red",
      "fire_hotspots": 0,
      "latest_summary": "One sentence current situation"
    }
  },
  "country_summaries": [
    { "country": "Country", "text": "Detailed paragraph assessment" }
  ],
  "risk_index": {
    "<COUNTRY>": {
      "conflict_intensity": 0-100,
      "infrastructure_disruption": 0-100,
      "regional_escalation": 0-100,
      "overall": 0-100
    }
  },
  "exclusions": ["No operational military intelligence", "Public information only"]
}

RULES:
- Generate 15-30 events from the combined intelligence
- Use EXACT coordinates from the reference above
- Assign each event to the correct layer category
- Every country MUST have a country_status entry
- Severity: 1=minor, 2=localized, 3=multiple attacks, 4=regional escalation, 5=major war escalation
- Deduplicate: don't repeat the same event with different wording
- Geographic filter: ONLY events inside the 8 target countries`
        },
        {
          role: "user",
          content: `LIVE INTELLIGENCE FEEDS — FUSE ALL INTO MAP EVENTS:

═══ PERPLEXITY WEB SEARCH (Last 24h verified news) ═══
${warNews.content || "No live news available"}${citationText}

═══ SENSOR DATA ═══
FIRE HOTSPOTS (NASA FIRMS): ${Object.entries(firesByCountry).map(([c, n]) => `${c}: ${n}`).join(", ") || "None in region"}
ACTIVE MISSILES: ${rocketsSummary}
AIRSPACE ALERTS: ${Object.entries(airspaceByCountry).map(([r, arr]) => `${r}: ${arr.join(", ")}`).join("; ") || "None"}
MARITIME: ${vesselCount} tracked vessels
GEO ALERTS: ${alertsSummary}
RISK SCORE: Overall ${risk.overall || 'N/A'}/100, Trend: ${risk.trend || 'stable'}

Generate comprehensive structured intelligence for all 8 countries.`
        }
      ]);

      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const objMatch = (jsonMatch[1] || content).trim().match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(objMatch ? objMatch[0] : (jsonMatch[1] || content).trim());

      // Attach citations from Perplexity
      if (warNews.citations.length > 0) {
        aiResult._sources = warNews.citations;
      }

    } catch (e) {
      console.error("AI fusion error:", e);

      // Fallback: build from raw data without AI
      const fallbackEvents: any[] = [];
      let evtCounter = 1;

      // Convert FIRMS fires to events
      (firmsData || []).slice(0, 15).forEach((f: any) => {
        fallbackEvents.push({
          event_id: `evt_${String(evtCounter++).padStart(3, "0")}`,
          event_type: "fire_hotspot",
          country: f.country,
          location: f.country,
          lat: f.lat, lng: f.lng,
          timestamp: now,
          description: `NASA FIRMS thermal anomaly detected (FRP: ${f.frp}MW)`,
          source: "NASA FIRMS",
          confidence: f.confidence === "high" ? "high" : "medium",
          severity: f.frp > 100 ? 3 : f.frp > 30 ? 2 : 1,
        });
      });

      // Convert DB alerts to events
      (geoRes.data || []).slice(0, 10).forEach((a: any) => {
        const coords = CITY_COORDS[a.region] || [a.lng, a.lat];
        fallbackEvents.push({
          event_id: `evt_${String(evtCounter++).padStart(3, "0")}`,
          event_type: a.type === "MILITARY" ? "airstrike" : a.type === "DIPLOMATIC" ? "political_announcement" : "explosion",
          country: a.region,
          location: a.region,
          lat: a.lat, lng: a.lng,
          timestamp: a.timestamp,
          description: a.summary || a.title,
          source: a.source || "DB Alert",
          confidence: a.severity === "critical" ? "high" : "medium",
          severity: a.severity === "critical" ? 4 : a.severity === "high" ? 3 : 2,
        });
      });

      const countryStatus: Record<string, any> = {};
      TARGET_COUNTRIES.forEach(c => {
        const evts = fallbackEvents.filter(e => e.country === c);
        countryStatus[c] = {
          conflict_intensity: evts.length * 10,
          latest_events: evts.length,
          risk_level: evts.length > 3 ? "High" : evts.length > 0 ? "Moderate" : "Low",
          visibility_status: "clear", weather_risk: "low",
          aviation_status: airspaceByCountry[c] ? "disrupted" : "normal",
          shipping_status: "normal",
          infrastructure_status: "normal",
          public_alert_level: evts.some(e => e.severity >= 3) ? "orange" : evts.length > 0 ? "yellow" : "green",
          fire_hotspots: firesByCountry[c] || 0,
          latest_summary: `${evts.length} events detected. ${firesByCountry[c] || 0} fire hotspots.`,
        };
      });

      aiResult = {
        generated_at: now,
        conflict: "Iran War 2026",
        countries_monitored: TARGET_COUNTRIES,
        events: fallbackEvents,
        layers: { conflict_events: [], missile_strike_reports: [], airspace_disruptions: [], shipping_disruptions: [], infrastructure_damage: [], political_announcements: [], satellite_observations: [], fire_hotspots: fallbackEvents.filter(e => e.event_type === "fire_hotspot").map(e => e.event_id) },
        country_status: countryStatus,
        country_summaries: TARGET_COUNTRIES.map(c => ({ country: c, text: `${c}: ${countryStatus[c].latest_summary}` })),
        risk_index: {},
        exclusions: ["No operational military intelligence", "Public information only"],
      };

      if (e instanceof Error && e.message === "RATE_LIMIT") {
        aiResult._rate_limited = true;
      }
    }

    // ── STEP 3: Inject additional FIRMS fire events not already covered ──
    const existingFireIds = new Set((aiResult.events || []).filter((e: any) => e.event_type === "fire_hotspot").map((e: any) => e.event_id));
    const maxEvtId = Math.max(0, ...(aiResult.events || []).map((e: any) => {
      const m = e.event_id?.match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    }));

    let nextId = maxEvtId + 1;
    const additionalFires = (firmsData || [])
      .filter((_: any, i: number) => !existingFireIds.has(`firms-${i}`))
      .slice(0, 20)
      .map((f: any) => ({
        event_id: `evt_${String(nextId++).padStart(3, "0")}`,
        event_type: "fire_hotspot",
        country: f.country,
        location: f.country,
        lat: f.lat, lng: f.lng,
        timestamp: now,
        description: `NASA FIRMS VIIRS detection (FRP: ${f.frp}MW, Confidence: ${f.confidence})`,
        source: "NASA FIRMS",
        confidence: f.confidence === "high" ? "high" : "medium",
        severity: f.frp > 100 ? 3 : f.frp > 30 ? 2 : 1,
      }));

    if (additionalFires.length > 0) {
      aiResult.events = [...(aiResult.events || []), ...additionalFires];
    }

    // ── STEP 4: Add GIBS imagery layer references ──
    const today = new Date().toISOString().split("T")[0];
    aiResult.imagery_layers = [
      { id: "gibs-modis-truecolor", title: "NASA MODIS True Color", category: "base_imagery", tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, maxZoom: 9, opacity: 0.5 },
      { id: "gibs-modis-fires", title: "NASA MODIS Thermal Anomalies", category: "fire_hotspots", tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Thermal_Anomalies_Day/default/${today}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`, maxZoom: 7, opacity: 0.7 },
      { id: "gibs-viirs-fires", title: "NASA VIIRS Active Fires", category: "fire_hotspots", tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_Day/default/${today}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`, maxZoom: 8, opacity: 0.7 },
      { id: "gibs-aerosol", title: "NASA Aerosol (Smoke/Dust)", category: "smoke_dust", tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol_Optical_Depth_3km/default/${today}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`, maxZoom: 6, opacity: 0.5 },
    ];

    // Cache result
    cachedResult = { data: aiResult, timestamp: Date.now() };

    console.log(`Geo-fusion: ${(aiResult.events || []).length} events, ${warNews.citations.length} sources, ${(firmsData || []).length} FIRMS points`);

    return new Response(JSON.stringify(aiResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "RATE_LIMIT") {
      if (cachedResult) {
        return new Response(JSON.stringify({ ...cachedResult.data as any, _cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("Geo-fusion error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
