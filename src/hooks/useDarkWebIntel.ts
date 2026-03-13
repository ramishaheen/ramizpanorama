import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CyberThreat } from "@/hooks/useCyberThreats";

export interface DarkWebEntry {
  id: string;
  type: "onion" | "paste" | "forum" | "marketplace" | "exit_node" | "hidden_service" | "ransomware_leak" | "exploit_trade" | "credential_dump" | "botnet_c2";
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

/* ── Indicator Extraction ── */
export interface NetworkIP { value: string; country: string; flag: string; reputation: string; activity: string; asn: string; }
export interface NetworkDomain { value: string; registrar: string; reputation: string; activity: string; }
export interface NetworkURL { value: string; category: string; }
export interface NetworkASN { value: string; name: string; country: string; maliciousCount: number; }
export interface NetworkPort { port: number; service: string; exposureCount: number; risk: string; }

export interface VulnCVE { id: string; cvss: number; description: string; exploitAvailable: boolean; patchAvailable: boolean; discussedInForums: boolean; }
export interface VulnExploit { name: string; targetCVE: string; availability: string; price: string; }
export interface VulnPatch { cve: string; vendor: string; status: string; }

export interface MalwareHash { value: string; family: string; type: string; firstSeen: string; }
export interface MalwareFamily { name: string; type: string; activeC2Count: number; recentActivity: string; }
export interface C2Server { ip: string; domain: string; malware: string; port: number; protocol: string; country: string; flag: string; status: string; }

export interface APTGroup { name: string; country: string; flag: string; activeCampaigns: number; primaryTargets: string[]; }
export interface RansomwareGang { name: string; activeLeaks: number; totalVictims: number; avgRansom: string; }
export interface HacktivistGroup { name: string; motivation: string; recentTargets: string[]; }

export interface CryptoWallet { address: string; currency: string; associatedGroup: string; estimatedValue: string; }

export interface IndicatorExtraction {
  network: { ips: NetworkIP[]; domains: NetworkDomain[]; urls: NetworkURL[]; asns: NetworkASN[]; ports: NetworkPort[]; };
  vulnerability: { cves: VulnCVE[]; exploits: VulnExploit[]; patches: VulnPatch[]; };
  malware: { hashes: MalwareHash[]; families: MalwareFamily[]; c2Servers: C2Server[]; };
  actors: { aptGroups: APTGroup[]; ransomwareGangs: RansomwareGang[]; hacktivistGroups: HacktivistGroup[]; };
  financial: { cryptoWallets: CryptoWallet[]; };
}

/* ── Threat Correlation ── */
export interface CorrelationStage { stage: string; detail: string; timestamp: string; }
export interface ThreatCorrelation {
  id: string;
  title: string;
  stages: CorrelationStage[];
  earlyWarning: boolean;
  severity: string;
  affectedSectors: string[];
  recommendation: string;
}

/* ── Forum Analysis ── */
export interface ForumPost {
  id: string;
  title: string;
  forum: string;
  author: string;
  riskLevel: string;
  category: string;
  snippet: string;
  timestamp: string;
  language: string;
  relatedActors: string[];
}

/* ── Ransomware Leaks ── */
export interface RansomwareLeak {
  id: string;
  group: string;
  victim: string;
  sector: string;
  country: string;
  flag: string;
  dataSize: string;
  deadline: string;
  status: string;
  leakSiteOnion: string;
}

/* ── Alert Rules ── */
export interface AlertRule {
  id: string;
  type: string;
  message: string;
  severity: string;
  triggeredAt: string;
  relatedIndicators: string[];
}

/* ── Dashboard Stats ── */
export interface CountryStat { country: string; flag: string; count: number; }
export interface RansomwareGroupStat { name: string; activeLeaks: number; }
export interface CVEStat { id: string; mentions: number; severity: string; }
export interface BotnetStat { name: string; estimatedSize: number; primaryMalware: string; }

export interface DashboardStats {
  topAttackingCountries: CountryStat[];
  topTargetedCountries: CountryStat[];
  activeRansomwareGroups: RansomwareGroupStat[];
  mostDiscussedCVEs: CVEStat[];
  largestBotnets: BotnetStat[];
}

/* ── Temporal Trends ── */
export interface TemporalTrend {
  period: string;
  malwareIncidents: number;
  ransomwareIncidents: number;
  exploitDiscussions: number;
  dataBreaches: number;
  trend: string;
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
  indicatorExtraction: IndicatorExtraction | null;
  threatCorrelation: ThreatCorrelation[];
  forumAnalysis: ForumPost[];
  ransomwareLeaks: RansomwareLeak[];
  alertRules: AlertRule[];
  dashboardStats: DashboardStats | null;
  temporalTrends: TemporalTrend[];
  loading: boolean;
  error: string | null;
}

interface DossierState {
  dossier: ActorDossier | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: DarkWebState = {
  entries: [], torAnalysis: null, indicatorExtraction: null,
  threatCorrelation: [], forumAnalysis: [], ransomwareLeaks: [],
  alertRules: [], dashboardStats: null, temporalTrends: [],
  loading: false, error: null,
};

  /** Merge indicator extraction data — append unique items */
  const mergeIndicators = (existing: IndicatorExtraction | null, incoming: IndicatorExtraction): IndicatorExtraction => {
    if (!existing) return incoming;
    const dedup = <T>(a: T[], b: T[]): T[] => {
      const key = (item: T) => {
        const o = item as Record<string, unknown>;
        return String(o.value ?? o.id ?? o.name ?? o.port ?? o.cve ?? o.address ?? JSON.stringify(item));
      };
      const seen = new Set(a.map(key));
      return [...a, ...b.filter(item => !seen.has(key(item)))];
    };
    return {
      network: {
        ips: dedup(existing.network.ips, incoming.network.ips),
        domains: dedup(existing.network.domains, incoming.network.domains),
        urls: dedup(existing.network.urls, incoming.network.urls),
        asns: dedup(existing.network.asns, incoming.network.asns),
        ports: dedup(existing.network.ports, incoming.network.ports),
      },
      vulnerability: {
        cves: dedup(existing.vulnerability.cves, incoming.vulnerability.cves),
        exploits: dedup(existing.vulnerability.exploits, incoming.vulnerability.exploits),
        patches: dedup(existing.vulnerability.patches, incoming.vulnerability.patches),
      },
      malware: {
        hashes: dedup(existing.malware.hashes, incoming.malware.hashes),
        families: dedup(existing.malware.families, incoming.malware.families),
        c2Servers: dedup(existing.malware.c2Servers, incoming.malware.c2Servers),
      },
      actors: {
        aptGroups: dedup(existing.actors.aptGroups, incoming.actors.aptGroups),
        ransomwareGangs: dedup(existing.actors.ransomwareGangs, incoming.actors.ransomwareGangs),
        hacktivistGroups: dedup(existing.actors.hacktivistGroups, incoming.actors.hacktivistGroups),
      },
      financial: {
        cryptoWallets: dedup(existing.financial.cryptoWallets, incoming.financial.cryptoWallets),
      },
    };
  };

export function useDarkWebIntel(threats: CyberThreat[]) {
  const [darkWeb, setDarkWeb] = useState<DarkWebState>(EMPTY_STATE);
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

      // Merge new data with existing, deduplicating by id
      setDarkWeb(prev => {
        const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
          const map = new Map<string, T>();
          existing.forEach(item => map.set(item.id, item));
          incoming.forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        };

        const newEntries = data?.entries || [];
        const newCorrelation = data?.threatCorrelation || [];
        const newForum = data?.forumAnalysis || [];
        const newLeaks = data?.ransomwareLeaks || [];
        const newAlerts = data?.alertRules || [];
        const newTrends = data?.temporalTrends || [];

        return {
          entries: mergeById(prev.entries, newEntries),
          torAnalysis: data?.torAnalysis || prev.torAnalysis,
          indicatorExtraction: data?.indicatorExtraction
            ? mergeIndicators(prev.indicatorExtraction, data.indicatorExtraction)
            : prev.indicatorExtraction,
          threatCorrelation: mergeById(prev.threatCorrelation, newCorrelation),
          forumAnalysis: mergeById(prev.forumAnalysis, newForum),
          ransomwareLeaks: mergeById(prev.ransomwareLeaks, newLeaks),
          alertRules: mergeById(prev.alertRules, newAlerts),
          dashboardStats: data?.dashboardStats || prev.dashboardStats,
          temporalTrends: newTrends.length > 0 ? newTrends : prev.temporalTrends,
          loading: false,
          error: null,
        };
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
