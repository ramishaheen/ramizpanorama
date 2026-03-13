import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Vendor Adapter Map ──
const VENDOR_ADAPTERS: Record<string, (p: any) => any> = {
  dji: (p) => ({
    entity_type: "drone_detection",
    name: p.droneId || p.serial || `DJI-${Date.now()}`,
    lat: p.location?.lat ?? p.latitude ?? 0,
    lng: p.location?.lon ?? p.location?.lng ?? p.longitude ?? 0,
    confidence: p.confidence ?? 0.7,
    affiliation: p.affiliation || "unknown",
    attributes: {
      vendor: "dji",
      model: p.model || p.droneModel || "",
      altitude_m: p.altitude ?? p.location?.alt ?? 0,
      heading: p.heading ?? p.yaw ?? 0,
      speed_ms: p.speed ?? 0,
      battery_pct: p.battery ?? p.batteryLevel ?? 100,
      gimbal_pitch: p.gimbalPitch ?? 0,
      encoding: p.videoEncoding || "h265",
    },
  }),

  mavlink: (p) => ({
    entity_type: p.type === "gcs" ? "ground_station" : "drone_detection",
    name: p.sysid ? `MAV-${p.sysid}` : p.callsign || `MAVLink-${Date.now()}`,
    lat: p.lat ?? (p.lat_degE7 ? p.lat_degE7 / 1e7 : 0),
    lng: p.lon ?? p.lng ?? (p.lon_degE7 ? p.lon_degE7 / 1e7 : 0),
    confidence: p.fix_type >= 3 ? 0.9 : 0.6,
    affiliation: p.affiliation || "friendly",
    attributes: {
      vendor: "mavlink",
      sysid: p.sysid,
      compid: p.compid,
      altitude_m: p.alt ?? (p.alt_mm ? p.alt_mm / 1000 : 0),
      heading_deg: p.hdg ?? (p.hdg_cdeg ? p.hdg_cdeg / 100 : 0),
      groundspeed_ms: p.groundspeed ?? (p.vx != null ? Math.sqrt(p.vx ** 2 + p.vy ** 2) / 100 : 0),
      fix_type: p.fix_type,
      satellites_visible: p.satellites_visible,
      battery_remaining: p.battery_remaining,
      protocol: "mavlink_v2",
    },
  }),

  adsb: (p) => ({
    entity_type: "aircraft",
    name: p.callsign?.trim() || p.flight?.trim() || `ADSB-${p.hex || Date.now()}`,
    lat: p.lat ?? 0,
    lng: p.lon ?? p.lng ?? 0,
    confidence: p.seen_pos != null && p.seen_pos < 10 ? 0.95 : 0.7,
    affiliation: p.mil ? "hostile" : "neutral",
    attributes: {
      vendor: "adsb",
      icao_hex: p.hex,
      squawk: p.squawk,
      altitude_ft: p.alt_baro ?? p.alt_geom,
      ground_speed_kts: p.gs,
      track_deg: p.track,
      vert_rate_fpm: p.baro_rate,
      category: p.category,
      registration: p.r,
      aircraft_type: p.t,
    },
  }),

  generic_cv: (p) => ({
    entity_type: p.class || "equipment",
    name: p.label || p.class || `Detection-${Date.now()}`,
    lat: p.lat ?? p.geo?.lat ?? 0,
    lng: p.lng ?? p.lon ?? p.geo?.lng ?? 0,
    confidence: p.confidence ?? p.score ?? 0.5,
    affiliation: p.affiliation || "unknown",
    attributes: {
      vendor: "generic_cv",
      bbox: p.bbox,
      frame_id: p.frame_id,
      model_name: p.model,
      encoding: p.encoding || "h264",
      stream_protocol: p.protocol || "rtsp",
    },
  }),

  stanag_4586: (p) => ({
    entity_type: p.vehicleType === "UAV" ? "drone_detection" : "equipment",
    name: p.vehicleId || p.tailNumber || `STANAG-${Date.now()}`,
    lat: p.position?.lat ?? p.lat ?? 0,
    lng: p.position?.lon ?? p.lng ?? 0,
    confidence: 0.85,
    affiliation: p.force || "friendly",
    attributes: {
      vendor: "stanag_4586",
      vehicle_type: p.vehicleType,
      mission_id: p.missionId,
      payload_type: p.payloadType,
      loi: p.levelOfInteroperability,
      altitude_m: p.position?.alt ?? p.altitude ?? 0,
      heading_deg: p.heading ?? 0,
      speed_ms: p.speed ?? 0,
    },
  }),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { action } = body;

    // ── NORMALIZE: Translate vendor payloads to Universal Ontology ──
    if (action === "normalize") {
      const { vendor, payloads } = body;
      if (!vendor || !payloads?.length) throw new Error("vendor and payloads[] required");

      const adapter = VENDOR_ADAPTERS[vendor];
      if (!adapter) throw new Error(`Unknown vendor: ${vendor}. Supported: ${Object.keys(VENDOR_ADAPTERS).join(", ")}`);

      const t0 = performance.now();
      const normalized = payloads.map((p: any) => {
        try { return { ...adapter(p), _raw_vendor: vendor }; }
        catch { return null; }
      }).filter(Boolean);
      const latency_ms = Math.round(performance.now() - t0);

      return new Response(JSON.stringify({
        normalized,
        count: normalized.length,
        vendor,
        latency_ms,
        schema: "ontology_entities",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── REGISTER_FEED: Create a new sensor_feeds row ──
    if (action === "register_feed") {
      const { source_name, feed_type, protocol, lat, lng, coverage_radius_km, data_rate_hz, classification_level, config } = body;
      if (!source_name || !feed_type) throw new Error("source_name and feed_type required");

      const { data, error } = await sb.from("sensor_feeds").insert({
        source_name,
        feed_type,
        protocol: protocol || "api_rest",
        lat: lat ?? 0,
        lng: lng ?? 0,
        coverage_radius_km: coverage_radius_km ?? 10,
        data_rate_hz: data_rate_hz ?? 1,
        classification_level: classification_level || "unclassified",
        config: config || {},
        status: "active",
        health_score: 100,
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ feed: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── TELEMETRY: Update sensor feed with latest platform state ──
    if (action === "telemetry") {
      const { feed_id, lat, lng, alt, heading, speed, battery, extras } = body;
      if (!feed_id) throw new Error("feed_id required");

      const { data: feed, error: feedErr } = await sb.from("sensor_feeds").select("config").eq("id", feed_id).single();
      if (feedErr) throw feedErr;

      const updatedConfig = {
        ...(typeof feed.config === "object" ? feed.config : {}),
        last_telemetry: {
          lat, lng, alt, heading, speed, battery,
          ...(extras || {}),
          received_at: new Date().toISOString(),
        },
      };

      const { error: updateErr } = await sb.from("sensor_feeds").update({
        config: updatedConfig,
        last_data_at: new Date().toISOString(),
        lat: lat ?? undefined,
        lng: lng ?? undefined,
      }).eq("id", feed_id);

      if (updateErr) throw updateErr;
      return new Response(JSON.stringify({ ok: true, feed_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST_ADAPTERS: Show available vendor adapters ──
    if (action === "list_adapters") {
      return new Response(JSON.stringify({
        adapters: Object.keys(VENDOR_ADAPTERS),
        protocols: ["mavlink", "stanag_4586", "rtsp", "srt", "stac_api", "ais_nmea", "api_rest"],
        encodings: ["h264", "h265", "mjpeg"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: normalize, register_feed, telemetry, list_adapters" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sensor-adapt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
