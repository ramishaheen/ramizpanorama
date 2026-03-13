import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SensorFeed {
  id: string;
  feed_type: string;
  source_name: string;
  protocol: string;
  lat: number;
  lng: number;
  coverage_radius_km: number;
  status: string;
  health_score: number;
  last_data_at: string;
  data_rate_hz: number;
  classification_level: string;
  config: Record<string, any>;
  linked_camera_id: string | null;
  linked_unit_id: string | null;
  created_at: string;
}

export interface SensorHealthSummary {
  [category: string]: { total: number; active: number; degraded: number; offline: number };
}

export function useSensorFeeds() {
  const [feeds, setFeeds] = useState<SensorFeed[]>([]);
  const [summary, setSummary] = useState<SensorHealthSummary>({});
  const [loading, setLoading] = useState(false);

  const fetchFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensor-ingest", {
        body: { action: "health" },
      });
      if (!error && data) {
        setFeeds(data.feeds || []);
        setSummary(data.summary || {});
      }
    } catch (e) {
      console.error("Failed to fetch sensor feeds:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
    const iv = setInterval(fetchFeeds, 15000);
    const ch = supabase
      .channel("sensor_feeds_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sensor_feeds" }, () => fetchFeeds())
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [fetchFeeds]);

  const feedsByCategory = useCallback(() => {
    const cats: Record<string, SensorFeed[]> = {
      satellite: [], drone: [], cctv: [], sigint: [], osint: [], ground: [], iot: [],
    };
    feeds.forEach(f => {
      const prefix = f.feed_type.split("_")[0];
      if (cats[prefix]) cats[prefix].push(f);
      else cats.osint.push(f);
    });
    return cats;
  }, [feeds]);

  return { feeds, summary, loading, fetchFeeds, feedsByCategory };
}
