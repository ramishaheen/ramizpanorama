import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAIError } from "@/lib/ai-error-handler";

interface SectorPrediction {
  name: string;
  impact: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "SEVERE";
  trend: "UP" | "DOWN" | "STABLE" | "VOLATILE";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  prediction: string;
  opportunities: string[];
  risks: string[];
}

interface CountryPrediction {
  code: string;
  name: string;
  overall_outlook: "POSITIVE" | "CAUTIOUS" | "NEGATIVE" | "CRITICAL";
  sectors: SectorPrediction[];
}

export interface SectorPredictionsData {
  countries: CountryPrediction[];
  regional_summary: string;
  last_analyzed: string;
  error?: string;
}

export function useSectorPredictions() {
  const [data, setData] = useState<SectorPredictionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("sector-predictions");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData);
    } catch (e) {
      console.error("Sector predictions fetch error:", e);
      handleAIError(e, "Sector Predictions");
      if (!data) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, 120_000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  return { data, loading, error, refresh: fetchPredictions };
}
