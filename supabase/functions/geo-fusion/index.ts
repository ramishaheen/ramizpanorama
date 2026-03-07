import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_COUNTRIES = ["Iran", "Israel", "Jordan", "UAE", "Bahrain", "Kuwait", "Qatar", "Oman"];

// Bounding boxes for target countries [minLon, minLat, maxLon, maxLat]
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

function getCountryForPoint(lat: number, lng: number): string | null {
  for (const [country, [minLon, minLat, maxLon, maxLat]] of Object.entries(COUNTRY_BBOX)) {
    if (lat >= minLat && lat <= maxLat && lng >= minLon && lng <= maxLon) return country;
  }
  return null;
}

// In-memory cache
let cachedResult: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 180_000; // 3 minutes

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

async function fetchFIRMSFires(): Promise<any[]> {
  try {
    // Filter FIRMS fires to our target region (Middle East bounding box)
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
            id: `firms-${i}`,
            lat, lng, country,
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

    // Parallel: fetch live data + DB state
    const [firmsData, geoRes, airspaceRes, rocketsRes, riskRes, vesselsRes] = await Promise.all([
      fetchFIRMSFires(),
      supabase.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(30),
      supabase.from("airspace_alerts").select("*").eq("active", true).limit(15),
      supabase.from("rockets").select("*").order("timestamp", { ascending: false }).limit(20),
      supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
      supabase.from("vessels").select("*").limit(30),
    ]);

    const now = new Date().toISOString();
    const risk = riskRes.data?.[0] || {};

    // Build fire hotspot events per country
    const firesByCountry: Record<string, number> = {};
    (firmsData || []).forEach((f: any) => {
      firesByCountry[f.country] = (firesByCountry[f.country] || 0) + 1;
    });

    // Build aviation disruption summary
    const airspaceByCountry: Record<string, string[]> = {};
    (airspaceRes.data || []).forEach((a: any) => {
      const arr = airspaceByCountry[a.region] || [];
      arr.push(`${a.type}: ${a.description} (${a.severity})`);
      airspaceByCountry[a.region] = arr;
    });

    // Shipping summary
    const vesselsByCountry: Record<string, number> = {};
    (vesselsRes.data || []).forEach((v: any) => {
      const c = getCountryForPoint(v.lat, v.lng);
      if (c) vesselsByCountry[c] = (vesselsByCountry[c] || 0) + 1;
    });

    // Build context for AI synthesis
    const firesSummary = Object.entries(firesByCountry).map(([c, n]) => `${c}: ${n} hotspots`).join("; ") || "No active fire hotspots in target region";
    const airspaceSummary = Object.entries(airspaceByCountry).map(([r, arr]) => `${r}: ${arr.join(", ")}`).join("; ") || "No active airspace disruptions";
    const rocketsSummary = (rocketsRes.data || []).map((r: any) => `${r.name} [${r.type}] status:${r.status} near ${r.current_lat.toFixed(1)},${r.current_lng.toFixed(1)}`).join("; ") || "No active missile activity";
    const alertsSummary = (geoRes.data || []).slice(0, 10).map((a: any) => `[${a.severity}] ${a.type}: ${a.title} (${a.region})`).join("; ") || "No active geo alerts";
    const shippingSummary = Object.entries(vesselsByCountry).map(([c, n]) => `${c}: ${n} vessels`).join("; ") || "Normal shipping";

    // AI synthesis for country-level status + events
    let aiResult: any;
    try {
      const content = await callAI([
        {
          role: "system",
          content: `You are a geospatial fusion analyst for public situational awareness in the Middle East.
Analyze the provided data and return ONLY valid JSON matching this schema:
{
  "region": "Iran Conflict Public Situation Map",
  "generated_at_utc": "${now}",
  "countries": ${JSON.stringify(TARGET_COUNTRIES)},
  "country_status": {
    "<COUNTRY>": {
      "visibility_status": "clear|hazy|obscured",
      "weather_risk": "low|moderate|high",
      "aviation_status": "normal|disrupted|closed",
      "shipping_status": "normal|congested|disrupted",
      "infrastructure_status": "normal|partial_disruption|major_disruption",
      "public_alert_level": "green|yellow|orange|red",
      "fire_hotspots": 0,
      "latest_summary": "one-sentence summary"
    }
  },
  "events": [
    {
      "event_id": "evt_001",
      "title": "Short event title",
      "category": "fire_hotspot|aviation|shipping|infrastructure|humanitarian|weather|security",
      "country": "Country name",
      "lat": 0.0,
      "lng": 0.0,
      "time_utc": "${now}",
      "description": "Brief public-level description",
      "source_type": "satellite_derived|official_alert|public_news",
      "confidence": "High|Medium|Low",
      "severity": "low|medium|high|critical"
    }
  ],
  "layers": [
    {
      "layer_id": "unique_id",
      "title": "Layer title",
      "category": "smoke_dust|fire_hotspots|shipping_disruption|aviation_disruption|infrastructure|humanitarian|weather",
      "country": "Country",
      "summary": "Brief summary",
      "confidence": "High|Medium|Low"
    }
  ],
  "summaries": [
    { "country": "Country", "text": "One paragraph public assessment" }
  ],
  "exclusions": ["No military targeting content", "No missile tracking for operational use"]
}

Generate status for ALL 8 countries. Create 10-20 events based on the data. Be specific with coordinates within each country.
If data suggests suppressed military intel, replace with: "Suppressed for safety. Public-interest information only."`
        },
        {
          role: "user",
          content: `LIVE DATA FOR FUSION ANALYSIS:

FIRE HOTSPOTS (NASA FIRMS): ${firesSummary}
AIRSPACE DISRUPTIONS: ${airspaceSummary}
MISSILE/ROCKET ACTIVITY: ${rocketsSummary}
GEO ALERTS: ${alertsSummary}
MARITIME: ${shippingSummary}
RISK SCORE: Overall ${risk.overall || 'N/A'}/100, Trend: ${risk.trend || 'stable'}

Generate comprehensive situational awareness for: ${TARGET_COUNTRIES.join(", ")}`
        }
      ]);

      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const objMatch = (jsonMatch[1] || content).trim().match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(objMatch ? objMatch[0] : (jsonMatch[1] || content).trim());
    } catch (e) {
      console.error("AI fusion error:", e);
      // Fallback: build from raw data
      const countryStatus: Record<string, any> = {};
      TARGET_COUNTRIES.forEach(c => {
        countryStatus[c] = {
          visibility_status: "clear",
          weather_risk: "low",
          aviation_status: airspaceByCountry[c] ? "disrupted" : "normal",
          shipping_status: vesselsByCountry[c] && vesselsByCountry[c] > 5 ? "congested" : "normal",
          infrastructure_status: "normal",
          public_alert_level: firesByCountry[c] ? "yellow" : "green",
          fire_hotspots: firesByCountry[c] || 0,
          latest_summary: `${firesByCountry[c] || 0} fire hotspots. ${airspaceByCountry[c] ? "Airspace disruptions reported." : "Normal conditions."}`
        };
      });

      aiResult = {
        region: "Iran Conflict Public Situation Map",
        generated_at_utc: now,
        countries: TARGET_COUNTRIES,
        country_status: countryStatus,
        events: (firmsData || []).slice(0, 20).map((f: any, i: number) => ({
          event_id: `evt_fire_${i}`,
          title: `Thermal anomaly detected in ${f.country}`,
          category: "fire_hotspot",
          country: f.country,
          lat: f.lat,
          lng: f.lng,
          time_utc: now,
          description: `NASA FIRMS detected thermal anomaly (FRP: ${f.frp}MW)`,
          source_type: "satellite_derived",
          confidence: f.confidence === "high" ? "High" : "Medium",
          severity: f.frp > 100 ? "high" : f.frp > 30 ? "medium" : "low",
        })),
        layers: [],
        summaries: TARGET_COUNTRIES.map(c => ({
          country: c,
          text: `${c}: ${firesByCountry[c] || 0} active fire hotspots. ${airspaceByCountry[c] ? "Active airspace restrictions." : "Normal airspace."} ${vesselsByCountry[c] ? vesselsByCountry[c] + " tracked vessels." : ""}`
        })),
        exclusions: ["No military targeting content", "No missile tracking for operational use"],
      };

      if (e instanceof Error && e.message === "RATE_LIMIT") {
        aiResult._rate_limited = true;
      }
    }

    // Inject live FIRMS fire points into events
    const existingFireIds = new Set((aiResult.events || []).filter((e: any) => e.category === "fire_hotspot").map((e: any) => e.event_id));
    const additionalFires = (firmsData || [])
      .filter((_: any, i: number) => !existingFireIds.has(`evt_fire_${i}`))
      .slice(0, 30)
      .map((f: any, i: number) => ({
        event_id: `firms_live_${i}`,
        title: `FIRMS thermal anomaly - ${f.country}`,
        category: "fire_hotspot",
        country: f.country,
        lat: f.lat,
        lng: f.lng,
        time_utc: now,
        description: `NASA FIRMS VIIRS detection (FRP: ${f.frp}MW, Confidence: ${f.confidence})`,
        source_type: "satellite_derived",
        confidence: f.confidence === "high" ? "High" : "Medium",
        severity: f.frp > 100 ? "high" : f.frp > 30 ? "medium" : "low",
      }));

    if (additionalFires.length > 0) {
      aiResult.events = [...(aiResult.events || []), ...additionalFires];
    }

    // Inject GIBS tile layer references
    const today = new Date().toISOString().split("T")[0];
    aiResult.imagery_layers = [
      {
        id: "gibs-modis-truecolor",
        title: "NASA MODIS True Color",
        category: "base_imagery",
        tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        maxZoom: 9,
        opacity: 0.5,
      },
      {
        id: "gibs-modis-fires",
        title: "NASA MODIS Thermal Anomalies",
        category: "fire_hotspots",
        tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Thermal_Anomalies_Day/default/${today}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
        maxZoom: 7,
        opacity: 0.7,
      },
      {
        id: "gibs-viirs-fires",
        title: "NASA VIIRS Active Fires",
        category: "fire_hotspots",
        tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_Day/default/${today}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
        maxZoom: 8,
        opacity: 0.7,
      },
      {
        id: "gibs-aerosol",
        title: "NASA Aerosol Optical Depth (Smoke/Dust)",
        category: "smoke_dust",
        tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol_Optical_Depth_3km/default/${today}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        maxZoom: 6,
        opacity: 0.5,
      },
      {
        id: "gibs-dust",
        title: "NASA Dust Score",
        category: "smoke_dust",
        tile_url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/AIRS_L2_Dust_Score_Ocean_Day/default/${today}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        maxZoom: 6,
        opacity: 0.4,
      },
    ];

    // Cache result
    cachedResult = { data: aiResult, timestamp: Date.now() };

    return new Response(JSON.stringify(aiResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "RATE_LIMIT") {
      // Return cached if available on rate limit
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
