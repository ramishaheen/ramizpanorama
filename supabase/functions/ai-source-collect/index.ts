import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const lat = body.lat ?? 32.0;
    const lng = body.lng ?? 35.0;
    const radiusKm = body.radius_km ?? 50;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Rough degree offset for radius
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    // Parallel DB queries
    const [geoAlerts, intelEvents, targetTracks, sensorFeeds, forceUnits, cameras] =
      await Promise.all([
        sb
          .from("geo_alerts")
          .select("*")
          .gte("lat", lat - dLat).lte("lat", lat + dLat)
          .gte("lng", lng - dLng).lte("lng", lng + dLng)
          .limit(50),
        sb
          .from("intel_events")
          .select("*")
          .gte("lat", lat - dLat).lte("lat", lat + dLat)
          .gte("lng", lng - dLng).lte("lng", lng + dLng)
          .limit(50),
        sb
          .from("target_tracks")
          .select("*")
          .gte("lat", lat - dLat).lte("lat", lat + dLat)
          .gte("lng", lng - dLng).lte("lng", lng + dLng)
          .limit(50),
        sb
          .from("sensor_feeds")
          .select("*")
          .gte("lat", lat - dLat).lte("lat", lat + dLat)
          .gte("lng", lng - dLng).lte("lng", lng + dLng)
          .limit(50),
        sb
          .from("force_units")
          .select("*")
          .gte("lat", lat - dLat).lte("lat", lat + dLat)
          .gte("lng", lng - dLng).lte("lng", lng + dLng)
          .limit(50),
        sb
          .from("cameras")
          .select("id, name, lat, lng, city, country, status, category")
          .gte("lat", lat - dLat).lte("lat", lat + dLat)
          .gte("lng", lng - dLng).lte("lng", lng + dLng)
          .limit(30),
      ]);

    // Call external edge functions in parallel for environmental data
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
    };

    const [eqRes, fireRes, vesselRes, weatherRes, aqRes, conflictRes] =
      await Promise.allSettled([
        fetch(`${supabaseUrl}/functions/v1/usgs-earthquakes`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        }).then((r) => r.json()),
        fetch(`${supabaseUrl}/functions/v1/nasa-wildfires`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        }).then((r) => r.json()),
        fetch(`${supabaseUrl}/functions/v1/ais-vessels`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            lamin: lat - dLat,
            lamax: lat + dLat,
            lomin: lng - dLng,
            lomax: lng + dLng,
          }),
        }).then((r) => r.json()),
        fetch(`${supabaseUrl}/functions/v1/weather-data`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        }).then((r) => r.json()),
        fetch(`${supabaseUrl}/functions/v1/air-quality`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        }).then((r) => r.json()),
        fetch(`${supabaseUrl}/functions/v1/conflict-events`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        }).then((r) => r.json()),
      ]);

    const extract = (r: PromiseSettledResult<any>) =>
      r.status === "fulfilled" ? r.value : null;

    // Filter nearby environmental data
    const earthquakes = (extract(eqRes)?.earthquakes || []).filter(
      (e: any) =>
        Math.abs(e.lat - lat) < dLat && Math.abs(e.lng - lng) < dLng
    );
    const wildfires = (extract(fireRes)?.fires || []).filter(
      (f: any) =>
        Math.abs(f.lat - lat) < dLat && Math.abs(f.lng - lng) < dLng
    );
    const vessels = (extract(vesselRes)?.vessels || []).slice(0, 20);
    const weather = (extract(weatherRes)?.weather || []).slice(0, 5);
    const airQuality = (extract(aqRes)?.stations || []).filter(
      (s: any) =>
        Math.abs(s.lat - lat) < dLat && Math.abs(s.lng - lng) < dLng
    );
    const conflicts = (extract(conflictRes)?.data || []).filter(
      (c: any) =>
        Math.abs(c.lat - lat) < dLat && Math.abs(c.lng - lng) < dLng
    );

    // Build source categories
    const sources = {
      GEOINT: [
        ...(geoAlerts.data || []).map((a: any) => ({
          id: a.id, type: "geo_alert", title: a.title, lat: a.lat, lng: a.lng,
          severity: a.severity, confidence: 0.8, source: a.source,
        })),
        ...(targetTracks.data || []).map((t: any) => ({
          id: t.id, type: "target_track", title: `${t.classification} - ${t.track_id}`,
          lat: t.lat, lng: t.lng, severity: t.priority, confidence: t.confidence,
          source: t.source_sensor,
        })),
      ],
      OSINT: [
        ...(intelEvents.data || []).map((e: any) => ({
          id: e.id, type: "intel_event", title: e.title, lat: e.lat, lng: e.lng,
          severity: e.severity, confidence: e.confidence, source: "intel_events",
        })),
        ...conflicts.map((c: any) => ({
          id: c.id, type: "conflict", title: `${c.event_type} - ${c.location}`,
          lat: c.lat, lng: c.lng, severity: c.severity, confidence: 0.7, source: "ACLED/GDELT",
        })),
      ],
      SIGINT: (sensorFeeds.data || [])
        .filter((s: any) => ["sigint", "elint", "comint"].includes(s.feed_type))
        .map((s: any) => ({
          id: s.id, type: "sensor_feed", title: s.source_name, lat: s.lat, lng: s.lng,
          severity: s.status === "active" ? "low" : "medium", confidence: s.health_score / 100,
          source: s.feed_type,
        })),
      IMINT: [
        ...(cameras.data || []).map((c: any) => ({
          id: c.id, type: "camera", title: c.name, lat: c.lat, lng: c.lng,
          severity: "low", confidence: 0.6, source: "CCTV",
        })),
        ...(sensorFeeds.data || [])
          .filter((s: any) => ["satellite", "cctv", "eo_ir"].includes(s.feed_type))
          .map((s: any) => ({
            id: s.id, type: "sensor_feed", title: s.source_name, lat: s.lat, lng: s.lng,
            severity: "low", confidence: s.health_score / 100, source: s.feed_type,
          })),
      ],
      TACTICAL: (forceUnits.data || []).map((u: any) => ({
        id: u.id, type: "force_unit", title: `${u.name} (${u.unit_type})`,
        lat: u.lat, lng: u.lng, severity: u.affiliation === "hostile" ? "critical" : "low",
        confidence: 0.85, source: u.source, affiliation: u.affiliation,
      })),
      ENVIRONMENTAL: [
        ...earthquakes.map((e: any) => ({
          id: e.id, type: "earthquake", title: `M${e.magnitude} - ${e.place}`,
          lat: e.lat, lng: e.lng, severity: e.magnitude >= 5 ? "critical" : e.magnitude >= 3 ? "medium" : "low",
          confidence: 0.95, source: "USGS",
        })),
        ...wildfires.map((f: any) => ({
          id: f.id, type: "wildfire", title: `Thermal ${f.brightness}K`,
          lat: f.lat, lng: f.lng, severity: f.frp > 50 ? "high" : "medium",
          confidence: parseFloat(f.confidence) / 100 || 0.7, source: "NASA FIRMS",
        })),
        ...airQuality.map((a: any) => ({
          id: a.id, type: "air_quality", title: `AQI ${a.aqi} - ${a.city}`,
          lat: a.lat, lng: a.lng, severity: (a.aqi || 0) > 150 ? "high" : "low",
          confidence: 0.9, source: "OpenAQ",
        })),
      ],
      MARITIME: vessels.map((v: any) => ({
        id: v.mmsi, type: "vessel", title: `${v.name} (${v.type})`,
        lat: v.lat, lng: v.lng, severity: "low", confidence: 0.8,
        source: "AIS", flag: v.flag,
      })),
    };

    const totalSources = Object.values(sources).reduce(
      (sum, arr) => sum + arr.length, 0
    );

    // AI Assessment using Lovable AI
    let aiAssessment = "";
    let localizationConfidence = 0;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && totalSources > 0) {
      try {
        const summaryData = Object.entries(sources)
          .map(([cat, items]) => `${cat}: ${items.length} sources${items.length > 0 ? ` — ${items.slice(0, 3).map((i: any) => i.title).join(", ")}` : ""}`)
          .join("\n");

        const aiResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a military intelligence analyst. Provide a concise situational assessment (3-5 sentences) for a given location based on multi-source intelligence data. Include threat level estimation, notable patterns, and a localization confidence percentage (0-100) indicating how precisely the situation is understood based on source convergence. Format: Start with the assessment, then on a new line write CONFIDENCE: XX%",
                },
                {
                  role: "user",
                  content: `Location: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E (radius ${radiusKm}km)\nTotal sources collected: ${totalSources}\n\n${summaryData}\n\nWeather: ${weather.length > 0 ? weather.map((w: any) => `${w.city}: ${w.condition} ${w.temp}°C`).join(", ") : "No data"}`,
                },
              ],
            }),
          }
        );

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const confMatch = content.match(/CONFIDENCE:\s*(\d+)%/i);
          localizationConfidence = confMatch ? parseInt(confMatch[1]) : 50;
          aiAssessment = content.replace(/CONFIDENCE:\s*\d+%/i, "").trim();
        }
      } catch (e) {
        console.error("AI assessment error:", e);
        aiAssessment = `Multi-source intelligence collected: ${totalSources} sources across ${Object.keys(sources).filter((k) => (sources as any)[k].length > 0).length} categories within ${radiusKm}km radius.`;
        localizationConfidence = Math.min(totalSources * 5, 85);
      }
    } else {
      aiAssessment = `Aggregated ${totalSources} intelligence sources within ${radiusKm}km of coordinates ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E.`;
      localizationConfidence = Math.min(totalSources * 5, 85);
    }

    return new Response(
      JSON.stringify({
        sources,
        totalSources,
        aiAssessment,
        localizationConfidence,
        location: { lat, lng, radiusKm },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-source-collect error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
