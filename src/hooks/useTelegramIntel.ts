import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TelegramMarker {
  id: string;
  lat: number;
  lng: number;
  headline: string;
  summary: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  special: boolean;
  source: string;
  timestamp: string;
}

export function useTelegramIntel() {
  const [markers, setMarkers] = useState<TelegramMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("telegram-intel");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setMarkers(data?.markers || []);
    } catch (e) {
      console.error("Telegram intel error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 120000); // refresh every 2 min
    return () => clearInterval(interval);
  }, [fetch_]);

  return { markers, loading, error, refresh: fetch_ };
}
