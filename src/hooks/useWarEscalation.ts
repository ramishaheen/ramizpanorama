import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAIError } from "@/lib/ai-error-handler";

export interface EscalationScenario {
  name: string;
  probability: number;
  timeline: string;
  description: string;
  triggers: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "CATASTROPHIC";
}

export interface EscalationIndicator {
  indicator: string;
  significance: "HIGH" | "MEDIUM" | "LOW";
  direction: "ESCALATORY" | "DE-ESCALATORY" | "AMBIGUOUS";
  detail: string;
}

export interface ConflictPhase {
  phase: string;
  status: "ACTIVE" | "EMERGING" | "POTENTIAL" | "PASSED";
  probability: number;
  timeline: string;
}

export interface HistoricalAnalogy {
  conflict: string;
  similarity_score: number;
  current_parallel: string;
  lesson: string;
}

export interface EscalationData {
  timestamp?: string;
  current_escalation_level?: {
    kahn_rung: number;
    label: string;
    description: string;
  };
  overall_escalation_probability?: number;
  trend?: "ESCALATING" | "STABLE" | "DE-ESCALATING";
  trend_velocity?: "RAPID" | "MODERATE" | "SLOW";
  scenarios?: EscalationScenario[];
  escalation_indicators?: EscalationIndicator[];
  conflict_phases?: ConflictPhase[];
  historical_analogy?: HistoricalAnalogy;
  key_assessment?: string;
  next_24h_outlook?: string;
  recommended_posture?: "NORMAL" | "ELEVATED" | "HIGH" | "MAXIMUM";
  error?: string;
}

export function useWarEscalation() {
  const [data, setData] = useState<EscalationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEscalation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("war-escalation");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData);
    } catch (e) {
      console.error("Escalation prediction error:", e);
      handleAIError(e, "Escalation");
      if (!data) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalation();
    const interval = setInterval(fetchEscalation, 120_000);
    return () => clearInterval(interval);
  }, [fetchEscalation]);

  return { data, loading, error, refresh: fetchEscalation };
}
