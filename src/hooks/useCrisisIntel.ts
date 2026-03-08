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
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("crisis-intel", {
        body: { city },
      });
      if (fnError) throw fnError;
      if (fnData?.error) {
        if (fnData.error.includes("Rate limited")) {
          toast.error("Crisis Intel rate limited — retrying shortly");
        } else if (fnData.error.includes("credits")) {
          toast.error("AI credits exhausted for Crisis Intel");
        }
        throw new Error(fnData.error);
      }
      setData(fnData);
      // Append to history for timeline replay
      if (fnData?.events?.length) {
        setHistory(prev => [
          ...prev.slice(-19), // keep last 20 snapshots
          { events: fnData.events, timestamp: fnData.timestamp },
        ]);
      }
    } catch (e) {
      console.error("Crisis intel error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetch_();
    intervalRef.current = setInterval(fetch_, 180000); // 3 min
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch_]);

  return { data, loading, error, history, refresh: fetch_ };
}
