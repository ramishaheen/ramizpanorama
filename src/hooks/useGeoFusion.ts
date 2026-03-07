import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FusionEvent {
  event_id: string;
  title: string;
  category: "fire_hotspot" | "aviation" | "shipping" | "infrastructure" | "humanitarian" | "weather" | "security";
  country: string;
  lat: number;
  lng: number;
  time_utc: string;
  description: string;
  source_type: "satellite_derived" | "official_alert" | "public_news";
  confidence: "High" | "Medium" | "Low";
  severity: "low" | "medium" | "high" | "critical";
}

export interface CountryStatus {
  visibility_status: "clear" | "hazy" | "obscured";
  weather_risk: "low" | "moderate" | "high";
  aviation_status: "normal" | "disrupted" | "closed";
  shipping_status: "normal" | "congested" | "disrupted";
  infrastructure_status: "normal" | "partial_disruption" | "major_disruption";
  public_alert_level: "green" | "yellow" | "orange" | "red";
  fire_hotspots: number;
  latest_summary: string;
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
  region: string;
  generated_at_utc: string;
  countries: string[];
  country_status: Record<string, CountryStatus>;
  events: FusionEvent[];
  imagery_layers: FusionImageryLayer[];
  summaries: FusionSummary[];
  exclusions: string[];
  _cached?: boolean;
  _rate_limited?: boolean;
}

export function useGeoFusion() {
  const [data, setData] = useState<GeoFusionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef(0);

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
      setData(fnData);
      retryRef.current = 0;
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
