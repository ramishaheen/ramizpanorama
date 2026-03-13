import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CyberThreat } from "@/hooks/useCyberThreats";

export interface DarkWebEntry {
  id: string;
  type: "onion" | "paste" | "forum" | "marketplace" | "exit_node" | "hidden_service";
  title: string;
  detail: string;
  severity: string;
  timestamp: string;
  indicators: string[];
  torExitNodes: string[];
  hiddenServiceFingerprint: string | null;
  relatedActors: string[];
  region?: string;
  category?: string;
}

export interface TorExitNode {
  ip: string;
  country: string;
  flag: string;
  risk: string;
  activity: string;
}

export interface TorAnalysis {
  suspiciousExitNodes: TorExitNode[];
  hiddenServiceStats: {
    newServicesDetected: number;
    c2PanelsIdentified: number;
    marketplacesActive: number;
    pasteMonitorsTriggered: number;
  };
  networkTrends: string;
}

export interface ActorDossier {
  name: string;
  aliases: string[];
  country: string;
  flag: string;
  type: string;
  active_since: string;
  confidence: string;
  description: string;
  ttps: Array<{ tactic: string; technique: string; description: string }>;
  campaigns: Array<{ name: string; year: string; targets: string; description: string; malware: string[] }>;
  targeting_patterns: { sectors: string[]; countries: string[]; infrastructure: string[] };
  tools_and_malware: string[];
  dark_web_presence: { forums: string[]; onion_services: string[]; paste_activity: string };
  tor_infrastructure: { known_exit_nodes: string[]; relay_patterns: string; hidden_services_count: number };
  recent_activity: string;
  risk_assessment: string;
  countermeasures: string[];
}

interface DarkWebState {
  entries: DarkWebEntry[];
  torAnalysis: TorAnalysis | null;
  loading: boolean;
  error: string | null;
}

interface DossierState {
  dossier: ActorDossier | null;
  loading: boolean;
  error: string | null;
}

export function useDarkWebIntel(threats: CyberThreat[]) {
  const [darkWeb, setDarkWeb] = useState<DarkWebState>({ entries: [], torAnalysis: null, loading: false, error: null });
  const [dossier, setDossier] = useState<DossierState>({ dossier: null, loading: false, error: null });

  const fetchDarkWeb = useCallback(async () => {
    setDarkWeb(prev => ({ ...prev, loading: true, error: null }));
    try {
      const context = threats.slice(0, 8).map(t => ({
        attacker: t.attacker, target: t.target, type: t.type,
        severity: t.severity, cve: t.cve, iocs: t.iocs,
      }));
      const { data, error } = await supabase.functions.invoke("dark-web-intel", {
        body: { threatContext: context },
      });
      if (error) throw new Error(error.message);
      setDarkWeb({
        entries: data?.entries || [],
        torAnalysis: data?.torAnalysis || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Dark web intel error:", err);
      setDarkWeb(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : "Failed" }));
    }
  }, [threats]);

  const fetchDossier = useCallback(async (actorName: string) => {
    setDossier({ dossier: null, loading: true, error: null });
    try {
      const context = threats
        .filter(t => t.attacker.includes(actorName) || t.attackerCountry === actorName)
        .slice(0, 5)
        .map(t => ({ attacker: t.attacker, target: t.target, type: t.type, severity: t.severity, details: t.details }));
      const { data, error } = await supabase.functions.invoke("dark-web-intel", {
        body: { actor: actorName, threatContext: context },
      });
      if (error) throw new Error(error.message);
      setDossier({ dossier: data?.actor || null, loading: false, error: null });
    } catch (err) {
      console.error("Dossier error:", err);
      setDossier({ dossier: null, loading: false, error: err instanceof Error ? err.message : "Failed" });
    }
  }, [threats]);

  const clearDossier = useCallback(() => setDossier({ dossier: null, loading: false, error: null }), []);

  return { darkWeb, dossier, fetchDarkWeb, fetchDossier, clearDossier };
}
