import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAIError } from "@/lib/ai-error-handler";

interface SectorCost {
  name: string;
  daily_cost_millions: number;
  description: string;
  live_modifier?: "normal" | "elevated" | "critical";
  cost_per_second?: number;
}

interface CountryCost {
  country: string;
  code: string;
  total_cost_billions: number;
  daily_cost_millions: number;
  breakdown: string;
  trend?: "rising" | "falling" | "stable";
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
  scenarios?: {
    conservative_billions: number;
    base_billions: number;
    severe_billions: number;
  };
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
      handleAIError(e, "War Costs");
      if (!data) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Stagger initial fetch to avoid Gemini rate limits (all hooks fire at once)
    const initialDelay = setTimeout(fetchCosts, 2000);
    const interval = setInterval(fetchCosts, 180_000);
    return () => { clearTimeout(initialDelay); clearInterval(interval); };
  }, [fetchCosts]);

  return { data, loading, error, refresh: fetchCosts };
}
