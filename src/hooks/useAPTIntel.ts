import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface APTGroup {
  id: string;
  name: string;
  aliases: string[];
  country: string;
  flag: string;
  sponsorship: string;
  active_since: string;
  description: string;
  target_sectors: string[];
  target_countries: string[];
  mitre_techniques: { id: string; name: string; tactic: string }[];
  known_campaigns: { name: string; year: string; description: string }[];
  tools: string[];
  risk_level: "critical" | "high" | "medium" | "low";
  last_activity: string;
  iocs_count: number;
}

const CACHE_KEY = "waros-apt-intel-v1";
const CACHE_DURATION = 15 * 60 * 1000;

export function useAPTIntel() {
  const [groups, setGroups] = useState<APTGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    // Check cache
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setGroups(parsed.data);
          return;
        }
      }
    } catch {}

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('apt-intel');
      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Failed');

      const fetched: APTGroup[] = data.data || [];
      setGroups(fetched);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: fetched, timestamp: Date.now() })); } catch {}
    } catch (err) {
      console.error('APT intel fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { groups, loading, error, fetchGroups };
}
