import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CountrySafety {
  code: string;
  name: string;
  safety_score: number;
  level: "SAFE" | "CAUTION" | "ELEVATED" | "DANGER" | "CRITICAL";
  status: string;
  threats: string[];
}

export interface SecurityData {
  countries: CountrySafety[];
  overall_assessment: string;
  last_analyzed: string;
  error?: string;
}

export function useCitizenSecurity() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSecurity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("citizen-security");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData);
    } catch (e) {
      console.error("Citizen security fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced refresh to avoid spamming the AI when multiple DB changes arrive at once
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      console.log("[CitizenSecurity] New incident detected — auto-recalculating...");
      fetchSecurity();
    }, 3000); // 3s debounce to batch rapid changes
  }, [fetchSecurity]);

  useEffect(() => {
    fetchSecurity();
    const interval = setInterval(fetchSecurity, 60000);

    // Subscribe to realtime changes on incident-related tables
    const channel = supabase
      .channel('citizen-security-incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'geo_alerts' }, () => {
        console.log("[CitizenSecurity] New geo_alert detected");
        debouncedRefresh();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rockets' }, () => {
        console.log("[CitizenSecurity] New rocket launch detected");
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rockets' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          console.log("[CitizenSecurity] Rocket status updated");
          debouncedRefresh();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'airspace_alerts' }, () => {
        console.log("[CitizenSecurity] New airspace alert detected");
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_scores' }, () => {
        console.log("[CitizenSecurity] Risk scores updated");
        debouncedRefresh();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchSecurity, debouncedRefresh]);

  return { data, loading, error, refresh: fetchSecurity };
}
