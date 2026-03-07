import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FusionEvent {
  event_id: string;
  event_type: "airstrike" | "missile_launch" | "drone_attack" | "explosion" | "border_clash" | "airspace_closure" | "shipping_disruption" | "infrastructure_damage" | "political_announcement" | "satellite_observation" | "fire_hotspot";
  country: string;
  location: string;
  lat: number;
  lng: number;
  timestamp: string;
  description: string;
  source: string;
  confidence: "high" | "medium" | "low";
  severity: number; // 1-5
}

export interface CountryStatus {
  conflict_intensity: number;
  latest_events: number;
  risk_level: "Low" | "Moderate" | "Elevated" | "High" | "Critical";
  visibility_status: "clear" | "hazy" | "obscured";
  weather_risk: "low" | "moderate" | "high";
  aviation_status: "normal" | "disrupted" | "closed";
  shipping_status: "normal" | "congested" | "disrupted";
  infrastructure_status: "normal" | "partial_disruption" | "major_disruption";
  public_alert_level: "green" | "yellow" | "orange" | "red";
  fire_hotspots: number;
  latest_summary: string;
}

export interface CountryRiskIndex {
  conflict_intensity: number;
  infrastructure_disruption: number;
  regional_escalation: number;
  overall: number;
}

export interface FusionImageryLayer {
  id: string;
  title: string;
  category: string;
  tile_url: string;
  maxZoom: number;
  opacity: number;
}

export interface FusionSummary {
  country: string;
  text: string;
}

export interface GeoFusionData {
  generated_at: string;
  conflict: string;
  countries_monitored: string[];
  events: FusionEvent[];
  layers: Record<string, string[]>;
  country_status: Record<string, CountryStatus>;
  country_summaries: FusionSummary[];
  risk_index?: Record<string, CountryRiskIndex>;
  imagery_layers?: FusionImageryLayer[];
  exclusions: string[];
  _sources?: string[];
  _cached?: boolean;
  _rate_limited?: boolean;
}

export function useGeoFusion() {
  const [data, setData] = useState<GeoFusionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizeEvents = (events: any[]): FusionEvent[] => {
    const typeMap: Record<string, string> = {
      aviation: "airspace_closure", security: "explosion", diplomatic: "political_announcement",
      humanitarian: "infrastructure_damage", weather: "satellite_observation",
      fire_hotspot: "fire_hotspot", shipping: "shipping_disruption",
    };
    const sevMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

    return (events || []).map((evt: any) => ({
      event_id: evt.event_id || `evt_${Math.random().toString(36).slice(2, 8)}`,
      event_type: evt.event_type || typeMap[evt.category] || "explosion",
      country: evt.country || "Unknown",
      location: evt.location || evt.title || "",
      lat: evt.lat || 0,
      lng: evt.lng || 0,
      timestamp: evt.timestamp || evt.time_utc || new Date().toISOString(),
      description: evt.description || "",
      source: evt.source || evt.source_type || "Unknown",
      confidence: (evt.confidence || "medium").toLowerCase() as "high" | "medium" | "low",
      severity: typeof evt.severity === "number" ? evt.severity : (sevMap[evt.severity] || 2),
    }));
  };

  const fetchFusion = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("geo-fusion");
      if (fnError) throw fnError;
      if (fnData?.error) {
        if (fnData.error === "Rate limit exceeded." && data) {
          console.warn("[GeoFusion] Rate limited, keeping cached data");
          setLoading(false);
          return;
        }
        throw new Error(fnData.error);
      }
      // Normalize events to match our type schema
      const normalized = { ...fnData, events: normalizeEvents(fnData.events) };
      console.log(`[GeoFusion] ${normalized.events.length} events, ${fnData._sources?.length || 0} sources`);
      setData(normalized);
    } catch (e) {
      console.error("GeoFusion fetch error:", e);
      if (!data) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    fetchFusion();
    const interval = setInterval(fetchFusion, 180000); // 3 min refresh
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, refresh: fetchFusion };
}
