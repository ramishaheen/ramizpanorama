import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RadiationStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country: string;
  network: string;
  dose_rate: number;
  unit: string;
  status: string;
  timestamp: string;
  source: string;
}

export interface NuclearFacility {
  name: string;
  lat: number;
  lng: number;
  country: string;
  type: string;
  capacity_mw?: number;
  status: string;
  source: string;
}

export function useNuclearMonitors() {
  const [stations, setStations] = useState<RadiationStation[]>([]);
  const [facilities, setFacilities] = useState<NuclearFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("nuclear-monitors");
      if (fnError) throw fnError;
      setStations(data?.stations || []);
      setFacilities(data?.facilities || []);
    } catch (e) {
      console.error("Nuclear monitors error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const delay = setTimeout(fetch_, 8000); // Stagger load
    const interval = setInterval(fetch_, 600_000); // 10 min refresh
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, [fetch_]);

  return { stations, facilities, loading, error, refresh: fetch_ };
}
