import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    fetchSecurity();
    const interval = setInterval(fetchSecurity, 60000);
    return () => clearInterval(interval);
  }, [fetchSecurity]);

  return { data, loading, error, refresh: fetchSecurity };
}
