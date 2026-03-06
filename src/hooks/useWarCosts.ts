import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SectorCost {
  name: string;
  daily_cost_millions: number;
  description: string;
}

interface CountryCost {
  country: string;
  code: string;
  total_cost_billions: number;
  daily_cost_millions: number;
  breakdown: string;
}

export interface WarCostsData {
  total_daily_cost_billions: number;
  sectors: SectorCost[];
  country_costs?: CountryCost[];
  cumulative_estimate_billions: number;
  cumulative_unit?: "B" | "T";
  daily_unit?: "B";
  methodology?: string;
  timestamp: string;
  error?: string;
}

export function useWarCosts() {
  const [data, setData] = useState<WarCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("war-costs");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData);
    } catch (e) {
      console.error("War costs fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
    const interval = setInterval(fetchCosts, 180_000);
    return () => clearInterval(interval);
  }, [fetchCosts]);

  return { data, loading, error, refresh: fetchCosts };
}
