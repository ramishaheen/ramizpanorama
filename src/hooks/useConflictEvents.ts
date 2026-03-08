import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAIError } from "@/lib/ai-error-handler";

export interface ConflictEvent {
  id: string;
  event_date: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  actor2: string | null;
  country: string;
  admin1: string;
  location: string;
  lat: number;
  lng: number;
  fatalities: number;
  severity: "low" | "medium" | "high" | "critical";
  notes: string;
  source: string;
}

export function useConflictEvents() {
  const [data, setData] = useState<ConflictEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("conflict-events");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData?.data || []);
    } catch (e) {
      console.error("Conflict events fetch error:", e);
      handleAIError(e, "Conflict Events");
      if (!data.length) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 300_000); // refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetch_]);

  return { data, loading, error, refresh: fetch_ };
}
