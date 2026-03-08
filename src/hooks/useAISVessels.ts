import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AISVessel {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  type: string;
  flag: string;
  destination: string | null;
  source: string;
}

export function useAISVessels() {
  const [data, setData] = useState<AISVessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  const fetch_ = useCallback(async (bounds?: { lamin: number; lamax: number; lomin: number; lomax: number }) => {
    setLoading(true);
    setError(null);
    try {
      const bbox = bounds || { lamin: 10, lamax: 45, lomin: 25, lomax: 65 };
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ais-vessels", { body: bbox });
      if (fnError) throw fnError;
      setData(fnData?.vessels || []);
      setSource(fnData?.source || "");
    } catch (e) {
      console.error("AIS vessels error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => fetch_(), 6000);
    const interval = setInterval(() => fetch_(), 120_000); // 2 min refresh
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, [fetch_]);

  return { data, loading, error, source, refresh: fetch_ };
}
