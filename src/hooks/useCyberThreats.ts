import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CyberThreat {
  id: string;
  date: string;
  attacker: string;
  attackerCountry?: string;
  attackerFlag: string;
  target: string;
  targetCountry?: string;
  targetFlag: string;
  type: string;
  categories?: string[];
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  details: string;
  source?: string;
  sourceName?: string;
  cve?: string;
  iocs?: string[];
  verified?: boolean;
}

interface CyberThreatsState {
  threats: CyberThreat[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  sources: string[];
  refresh: () => void;
}

const CACHE_KEY = "waros-cyber-threats-v2";
const CACHE_DURATION = 90 * 1000; // 90 seconds for fresher data

function getCached(): { data: CyberThreat[]; lastUpdated: string; sources: string[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_DURATION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCache(data: CyberThreat[], lastUpdated: string, sources: string[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, lastUpdated, sources, timestamp: Date.now() }));
  } catch {}
}

export function useCyberThreats(): CyberThreatsState {
  const [threats, setThreats] = useState<CyberThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);

  const fetchThreats = useCallback(async (skipCache = false) => {
    if (!skipCache) {
      const cached = getCached();
      if (cached) {
        setThreats(cached.data);
        setLastUpdated(cached.lastUpdated);
        setSources(cached.sources);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('cyber-threats');

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch threats');

      const fetchedThreats: CyberThreat[] = (data.data || []).map((t: any) => ({
        ...t,
        severity: ['critical', 'high', 'medium', 'low'].includes(t.severity) ? t.severity : 'medium',
        attackerCountry: t.attackerCountry || '',
        targetCountry: t.targetCountry || '',
        sourceName: t.sourceName || '',
        cve: t.cve || '',
        iocs: Array.isArray(t.iocs) ? t.iocs : [],
        categories: Array.isArray(t.categories) ? t.categories : [],
        verified: typeof t.verified === 'boolean' ? t.verified : false,
      }));

      // Accumulate threats across refreshes (deduplicate by ID)
      setThreats(prev => {
        const merged = new Map(prev.map(t => [t.id, t]));
        fetchedThreats.forEach(t => merged.set(t.id, t));
        return Array.from(merged.values());
      });
      setLastUpdated(data.lastUpdated);
      setSources(data.sources || []);
      setCache(fetchedThreats, data.lastUpdated, data.sources || []);
    } catch (err) {
      console.error('Failed to fetch cyber threats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreats();
    const interval = setInterval(() => fetchThreats(true), CACHE_DURATION);
    return () => { clearInterval(interval); };
  }, [fetchThreats]);

  const refresh = useCallback(() => fetchThreats(true), [fetchThreats]);

  return { threats, loading, error, lastUpdated, sources, refresh };
}
