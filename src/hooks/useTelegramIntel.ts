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

  const fetch_ = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("telegram-intel", {
        body: force ? { force: true } : undefined,
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const incoming: TelegramMarker[] = data?.markers || [];

      // Accumulate markers, deduplicate by ID
      setMarkers(prev => {
        const merged = new Map(prev.map(m => [m.id, m]));
        incoming.forEach(m => merged.set(m.id, m));
        return Array.from(merged.values());
      });
    } catch (e) {
      console.error("Telegram intel error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(() => fetch_(), 90000); // 90s refresh
    return () => clearInterval(interval);
  }, [fetch_]);

  const refresh = useCallback(() => fetch_(true), [fetch_]);

  return { markers, loading, error, refresh };
}
