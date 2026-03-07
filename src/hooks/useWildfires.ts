import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Wildfire {
  id: string;
  lat: number;
  lng: number;
  brightness: number;
  frp: number;
  confidence: string;
  date: string;
  time: string;
  region?: string;
}

export function useWildfires() {
  const [data, setData] = useState<Wildfire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("nasa-wildfires");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData.fires || []);
    } catch (e) {
      console.error("Wildfire fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 300_000); // every 5 min
    return () => clearInterval(interval);
  }, [fetch_]);

  return { data, loading, error, refresh: fetch_ };
}
