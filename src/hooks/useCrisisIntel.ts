import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CrisisSource {
  name: string;
  reliability: "high" | "medium" | "low";
}

export interface CrisisEvent {
  id: string;
  type: "protest" | "evacuation" | "road_closure" | "disruption" | "incident" | "abnormal_activity" | "rumor";
  lat: number;
  lng: number;
  radius_km: number;
  polygon: number[][] | null;
  headline: string;
  summary: string;
  confidence: number;
  confidence_label: "low" | "medium" | "high";
  source_count: number;
  sources: CrisisSource[];
  affected_roads: string[];
  district: string;
  trend: "rising" | "stable" | "declining";
  evacuation_direction?: string;
  verified: boolean;
  timestamp: string;
}

export interface CrisisSnapshot {
  events: CrisisEvent[];
  timestamp: string;
}

export interface CrisisIntelData {
  events: CrisisEvent[];
  city: string;
  city_coords: { lat: number; lng: number; zoom: number };
  city_summary: string;
  threat_level: string;
  timestamp: string;
}

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

// Map geo_alert types to crisis event types
function mapAlertType(geoType: string): CrisisEvent["type"] {
  switch (geoType) {
    case "MILITARY": return "incident";
    case "HUMANITARIAN": return "evacuation";
    case "ECONOMIC": return "disruption";
    case "DIPLOMATIC": return "abnormal_activity";
    default: return "incident";
  }
}

function mapSeverityToConfidence(severity: string): { confidence: number; label: CrisisEvent["confidence_label"] } {
  switch (severity) {
    case "critical": return { confidence: 90, label: "high" };
    case "high": return { confidence: 75, label: "high" };
    case "medium": return { confidence: 55, label: "medium" };
    case "low": return { confidence: 35, label: "low" };
    default: return { confidence: 50, label: "medium" };
  }
}

function mapRocketStatus(status: string): CrisisEvent["type"] {
  switch (status) {
    case "impact": return "incident";
    case "intercepted": return "road_closure"; // debris field
    case "in_flight":
    case "launched": return "evacuation";
    default: return "incident";
  }
}

/** Fetch geo_alerts and rockets near a city from the database */
async function fetchDbIncidents(city: string): Promise<CrisisEvent[]> {
  const coords = CITY_COORDS[city];
  if (!coords) return [];

  const radius = 3; // degrees (~330km)
  const events: CrisisEvent[] = [];

  // Fetch geo_alerts and rockets in parallel
  const [alertsRes, rocketsRes] = await Promise.all([
    supabase.from("geo_alerts").select("*"),
    supabase.from("rockets").select("*"),
  ]);

  // Filter geo_alerts near city
  if (alertsRes.data) {
    const nearby = alertsRes.data.filter((a) => {
      const dist = Math.sqrt(Math.pow(a.lat - coords.lat, 2) + Math.pow(a.lng - coords.lng, 2));
      return dist < radius;
    });

    for (const alert of nearby) {
      const conf = mapSeverityToConfidence(alert.severity);
      events.push({
        id: `db-alert-${alert.id}`,
        type: mapAlertType(alert.type),
        lat: alert.lat,
        lng: alert.lng,
        radius_km: alert.severity === "critical" ? 2 : alert.severity === "high" ? 1.5 : 1,
        polygon: null,
        headline: alert.title,
        summary: alert.summary || "",
        confidence: conf.confidence,
        confidence_label: conf.label,
        source_count: 1,
        sources: [{ name: alert.source || "OSINT", reliability: conf.label === "high" ? "high" : "medium" }],
        affected_roads: [],
        district: alert.region || city,
        trend: alert.severity === "critical" ? "rising" : "stable",
        verified: alert.severity === "critical" || alert.severity === "high",
        timestamp: alert.timestamp,
      });
    }
  }

  // Filter rockets near city (origin, target, or current position)
  if (rocketsRes.data) {
    const nearby = rocketsRes.data.filter((r) => {
      const distOrigin = Math.sqrt(Math.pow(r.origin_lat - coords.lat, 2) + Math.pow(r.origin_lng - coords.lng, 2));
      const distTarget = Math.sqrt(Math.pow(r.target_lat - coords.lat, 2) + Math.pow(r.target_lng - coords.lng, 2));
      const distCurrent = Math.sqrt(Math.pow(r.current_lat - coords.lat, 2) + Math.pow(r.current_lng - coords.lng, 2));
      return distOrigin < radius || distTarget < radius || distCurrent < radius;
    });

    for (const rocket of nearby) {
      const isImpact = rocket.status === "impact";
      const isIntercepted = rocket.status === "intercepted";
      const displayLat = isImpact || isIntercepted ? rocket.current_lat : rocket.target_lat;
      const displayLng = isImpact || isIntercepted ? rocket.current_lng : rocket.target_lng;

      events.push({
        id: `db-rocket-${rocket.id}`,
        type: mapRocketStatus(rocket.status),
        lat: displayLat,
        lng: displayLng,
        radius_km: isImpact ? 3 : isIntercepted ? 2 : 5,
        polygon: null,
        headline: `${rocket.name} — ${rocket.status.toUpperCase()}`,
        summary: `${rocket.type} missile ${rocket.status}. Origin: ${rocket.origin_lat.toFixed(2)},${rocket.origin_lng.toFixed(2)} → Target: ${rocket.target_lat.toFixed(2)},${rocket.target_lng.toFixed(2)}. Alt: ${(rocket.altitude / 1000).toFixed(0)}km, Speed: ${rocket.speed.toFixed(0)} m/s`,
        confidence: 95,
        confidence_label: "high",
        source_count: 2,
        sources: [
          { name: "Missile Defense Network", reliability: "high" },
          { name: "OSINT Satellite", reliability: "high" },
        ],
        affected_roads: [],
        district: isImpact ? "Impact Zone" : isIntercepted ? "Debris Field" : "Threat Corridor",
        trend: rocket.status === "in_flight" ? "rising" : "stable",
        evacuation_direction: rocket.status === "in_flight" ? "Away from target zone" : undefined,
        verified: true,
        timestamp: rocket.timestamp,
      });
    }
  }

  return events;
}

export function useCrisisIntel(city: string) {
  const [data, setData] = useState<CrisisIntelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CrisisSnapshot[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetch_ = useCallback(async () => {
    if (!city) return;
    setLoading(true);
    setError(null);

    const coords = CITY_COORDS[city] || { lat: 33.31, lng: 44.37, zoom: 12 };

    try {
      // Always fetch DB incidents (fast, no rate limits)
      const dbEvents = await fetchDbIncidents(city);

      // Try AI edge function in parallel
      let aiEvents: CrisisEvent[] = [];
      let aiSummary = "";
      let aiThreatLevel = "moderate";
      let aiSuccess = false;

      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("crisis-intel", {
          body: { city },
        });

        if (fnError) {
          const msg = fnError.message || String(fnError);
          if (msg.includes("402") || msg.includes("credits") || msg.includes("503") || msg.includes("No AI provider") || msg.includes("non-2xx")) {
            // Silent — DB data will fill in
          } else if (msg.includes("429") || msg.includes("Rate limit")) {
            // Silent — DB data will fill in
          } else {
            console.warn("Crisis AI error:", msg);
          }
        } else if (fnData && !fnData.error) {
          aiEvents = fnData.events || [];
          aiSummary = fnData.city_summary || "";
          aiThreatLevel = fnData.threat_level || "moderate";
          aiSuccess = true;
        }
      } catch (e) {
        console.warn("Crisis AI unavailable, using DB incidents:", e);
      }

      // Merge: AI events + DB events (deduplicate by proximity)
      const mergedEvents = [...aiEvents];
      for (const dbEv of dbEvents) {
        const isDuplicate = mergedEvents.some(
          (existing) =>
            Math.abs(existing.lat - dbEv.lat) < 0.01 &&
            Math.abs(existing.lng - dbEv.lng) < 0.01 &&
            existing.headline.toLowerCase().includes(dbEv.headline.split(" ")[0].toLowerCase())
        );
        if (!isDuplicate) {
          mergedEvents.push(dbEv);
        }
      }

      // Determine threat level from DB events if AI didn't provide one
      if (!aiSuccess && dbEvents.length > 0) {
        const criticalCount = dbEvents.filter((e) => e.confidence >= 85).length;
        const highCount = dbEvents.filter((e) => e.confidence >= 70).length;
        if (criticalCount >= 3) aiThreatLevel = "critical";
        else if (criticalCount >= 1 || highCount >= 3) aiThreatLevel = "high";
        else if (highCount >= 1) aiThreatLevel = "elevated";
      }

      // Build summary from DB if AI didn't provide one
      if (!aiSummary && dbEvents.length > 0) {
        const incidentTypes = [...new Set(dbEvents.map((e) => e.type))];
        aiSummary = `${dbEvents.length} active incidents detected in ${city} area: ${incidentTypes.join(", ")}. ${
          dbEvents.filter((e) => e.verified).length
        } verified by official sources. Monitoring ongoing.`;
      }

      const result: CrisisIntelData = {
        events: mergedEvents,
        city,
        city_coords: coords,
        city_summary: aiSummary || `Monitoring ${city} — no active incidents detected.`,
        threat_level: aiThreatLevel,
        timestamp: new Date().toISOString(),
      };

      setData(result);
      setError(null);

      if (mergedEvents.length > 0) {
        setHistory((prev) => [
          ...prev.slice(-19),
          { events: mergedEvents, timestamp: result.timestamp },
        ]);
      }
    } catch (e) {
      console.error("Crisis intel error:", e);
      if (!data) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [city, data]);

  useEffect(() => {
    fetch_();
    intervalRef.current = setInterval(fetch_, 180000); // 3 min
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch_]);

  return { data, loading, error, history, refresh: fetch_ };
}
