import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WarUpdate {
  id: string;
  headline: string;
  body: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  region: string;
  timestamp: string;
  source: string;
}

export interface WarUpdatesData {
  updates: WarUpdate[];
  situation_summary: string;
  threat_level: string;
  last_updated: string;
}

export function useWarUpdates() {
  const [data, setData] = useState<WarUpdatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("war-updates");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData);
    } catch (e) {
      console.error("War updates fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 90000); // refresh every 90s
    return () => clearInterval(interval);
  }, [fetch_]);

  return { data, loading, error, refresh: fetch_ };
}
