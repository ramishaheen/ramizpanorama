import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AirQualityStation {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  pm25: number | null;
  pm10: number | null;
  aqi: number | null;
  aqi_level: string;
  measurements: Record<string, { value: number; unit: string }>;
  source: string;
  last_updated: string;
}

export function useAirQuality() {
  const [data, setData] = useState<AirQualityStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("air-quality");
      if (fnError) throw fnError;
      setData(fnData?.stations || []);
    } catch (e) {
      console.error("Air quality error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const delay = setTimeout(fetch_, 12000); // Stagger load
    const interval = setInterval(fetch_, 600_000); // 10 min refresh
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, [fetch_]);

  return { data, loading, error, refresh: fetch_ };
}
