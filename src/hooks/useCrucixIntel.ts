import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FredIndicator {
  id: string;
  label: string;
  unit: string;
  value: number | null;
  prevValue: number | null;
  change: number | null;
  date: string | null;
}

export interface FirmsHotspot {
  region: string;
  fires: { id: string; lat: number; lng: number; brightness: number; frp: number; confidence: string; date: string; time: string }[];
}

export interface EiaSeries {
  id: string;
  label: string;
  unit: string;
  value: number | null;
  prev: number | null;
  change: number | null;
  date: string | null;
}

export interface AisChokepoint {
  chokepoint: string;
  lat: number;
  lng: number;
  vesselCount: number;
  vessels: { mmsi: string; lat: number; lng: number; heading: number; speed: number; type: string; name: string }[];
}

export interface CrucixIntelData {
  fred: { indicators: FredIndicator[]; timestamp: string } | null;
  firms: { hotspots: FirmsHotspot[]; totalGlobal: number; timestamp: string } | null;
  eia: { series: EiaSeries[]; timestamp: string } | null;
  ais: { chokepoints: AisChokepoint[]; totalVessels: number; timestamp: string } | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const REFRESH_MS = 15 * 60 * 1000;

export function useCrucixIntel(): CrucixIntelData {
  const [fred, setFred] = useState<CrucixIntelData["fred"]>(null);
  const [firms, setFirms] = useState<CrucixIntelData["firms"]>(null);
  const [eia, setEia] = useState<CrucixIntelData["eia"]>(null);
  const [ais, setAis] = useState<CrucixIntelData["ais"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fredRes, firmsRes, eiaRes, aisRes] = await Promise.allSettled([
        supabase.functions.invoke("crucix-fred"),
        supabase.functions.invoke("crucix-firms"),
        supabase.functions.invoke("crucix-eia"),
        supabase.functions.invoke("crucix-ais"),
      ]);
      if (!mountedRef.current) return;

      if (fredRes.status === "fulfilled" && fredRes.value.data) setFred(fredRes.value.data);
      if (firmsRes.status === "fulfilled" && firmsRes.value.data) setFirms(firmsRes.value.data);
      if (eiaRes.status === "fulfilled" && eiaRes.value.data) setEia(eiaRes.value.data);
      if (aisRes.status === "fulfilled" && aisRes.value.data) setAis(aisRes.value.data);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : "Failed to fetch intel");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const t = setTimeout(fetchAll, 500);
    const i = setInterval(fetchAll, REFRESH_MS);
    return () => { mountedRef.current = false; clearTimeout(t); clearInterval(i); };
  }, [fetchAll]);

  return { fred, firms, eia, ais, loading, error, refresh: fetchAll };
}
