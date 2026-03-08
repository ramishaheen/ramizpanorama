import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAIError } from "@/lib/ai-error-handler";

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
      if (fnData?.error) {
        const err = new Error(fnData.error);
        if (handleAIError(err, "Citizen Security")) {
          setLoading(false);
          return;
        }
        throw err;
      }
      setData(fnData);
    } catch (e) {
      console.error("Citizen security fetch error:", e);
      // Only set error if we have no existing data
      if (!data) setError(e instanceof Error ? e.message : "Failed to load");
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
    }, 15000); // 15s debounce to avoid rate limits
  }, [fetchSecurity]);

  useEffect(() => {
    const initialDelay = setTimeout(fetchSecurity, 8000);
    const interval = setInterval(fetchSecurity, 86_400_000); // once per day
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchSecurity]);

  return { data, loading, error, refresh: fetchSecurity };
}
