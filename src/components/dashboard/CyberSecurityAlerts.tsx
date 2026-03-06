import { useState } from "react";
import { ShieldAlert, Globe, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useCyberThreats, CyberThreat } from "@/hooks/useCyberThreats";

// Static fallback data used when live feed is unavailable
const FALLBACK_ATTACKS: CyberThreat[] = [
  {
    id: "cy-001",
    date: "2026-03-05",
    attacker: "Israel (Unit 8200)",
    attackerFlag: "🇮🇱",
    target: "Iran Nuclear Facilities",
    targetFlag: "🇮🇷",
    type: "SCADA/ICS Attack",
    severity: "critical",
    description: "Stuxnet-variant malware deployed against Iranian uranium enrichment centrifuges at Natanz",
    details: "Advanced persistent threat targeting Siemens S7-400 PLCs controlling gas centrifuge cascades. Caused physical damage to ~1,000 IR-6 centrifuges, setting back enrichment program by estimated 6 months.",
    source: "https://www.reuters.com",
  },
  {
    id: "cy-004",
    date: "2026-03-05",
    attacker: "USA (Cyber Command)",
    attackerFlag: "🇺🇸",
    target: "Iranian Military Networks",
    targetFlag: "🇮🇷",
    type: "Network Disruption",
    severity: "critical",
    description: "USCYBERCOM offensive operation against IRGC command-and-control infrastructure",
    details: "Operation 'Digital Fury' — coordinated takedown of IRGC C2 nodes across 14 military bases. Disrupted drone control systems, missile telemetry networks, and logistics databases.",
    source: "https://www.defense.gov",
  },
  {
    id: "cy-007",
    date: "2026-03-05",
    attacker: "Iran (APT33/Elfin)",
    attackerFlag: "🇮🇷",
    target: "Israeli Water Systems",
    targetFlag: "🇮🇱",
    type: "Critical Infrastructure",
    severity: "critical",
    description: "Attempted manipulation of chlorine levels in Israeli water treatment facilities",
    details: "APT33 gained access to SCADA systems at 6 water treatment plants via spear-phishing. Attempted to alter chemical dosing parameters. Neutralized within 2 hours.",
    source: "https://www.jpost.com",
  },
  {
    id: "cy-009",
    date: "2026-03-03",
    attacker: "Iran (Charming Kitten)",
    attackerFlag: "🇮🇷",
    target: "Saudi Aramco",
    targetFlag: "🇸🇦",
    type: "Wiper Malware",
    severity: "critical",
    description: "Shamoon-4 wiper malware deployed against Saudi Aramco IT and OT networks",
    details: "New Shamoon variant targeted both IT workstations and OT networks controlling pipeline SCADA. 12,000+ endpoints affected.",
  },
  {
    id: "cy-010",
    date: "2026-03-05",
    attacker: "UAE (DarkMatter/Edge Group)",
    attackerFlag: "🇦🇪",
    target: "Houthi C2 Networks",
    targetFlag: "🇾🇪",
    type: "Offensive Cyber",
    severity: "high",
    description: "Disruption of Houthi drone command-and-control and targeting systems",
    details: "UAE cyber operators compromised satellite communication links used by Houthi forces for drone operations. Injected false GPS coordinates causing 4 armed drones to crash.",
  },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-critical/20 text-critical border-critical/30",
  high: "bg-warning/20 text-warning border-warning/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-critical",
  high: "bg-warning",
  medium: "bg-primary",
  low: "bg-muted-foreground",
};

const ATTACK_TYPE_ICON: Record<string, string> = {
  "SCADA/ICS Attack": "⚡",
  "Signal Intelligence": "📡",
  "Electronic Warfare": "🛡️",
  "Network Disruption": "🌐",
  "Financial Disruption": "💰",
  "Information Operations": "📰",
  "Critical Infrastructure": "🏗️",
  "Espionage": "🕵️",
  "Wiper Malware": "💀",
  "Offensive Cyber": "⚔️",
  "Counter-Intelligence": "🔍",
  "Defensive/Counter-IO": "🛡️",
  "Defensive": "🔒",
  "Ransomware": "🔐",
  "Supply Chain": "🔗",
  "Zero-Day Exploit": "💥",
  "DDoS Attack": "🌊",
  "Phishing Campaign": "🎣",
};

type FilterCountry = "all" | "🇮🇱" | "🇺🇸" | "🇮🇷" | "🇦🇪" | "🇸🇦" | "🇶🇦" | "🇯🇴";
const FILTER_OPTIONS: { flag: FilterCountry; label: string }[] = [
  { flag: "all", label: "ALL" },
  { flag: "🇮🇱", label: "Israel" },
  { flag: "🇺🇸", label: "USA" },
  { flag: "🇮🇷", label: "Iran" },
  { flag: "🇦🇪", label: "UAE" },
  { flag: "🇸🇦", label: "Saudi" },
  { flag: "🇶🇦", label: "Qatar" },
  { flag: "🇯🇴", label: "Jordan" },
];

export const CyberSecurityAlerts = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterCountry>("all");
  const { t } = useLanguage();
  const { threats: liveThreats, loading, error, lastUpdated, sources, refresh } = useCyberThreats();

  // Use live data if available, fallback to static
  const allAttacks = liveThreats.length > 0 ? liveThreats : FALLBACK_ATTACKS;
  const isLive = liveThreats.length > 0;

  const filtered = filter === "all"
    ? allAttacks
    : allAttacks.filter((a) => a.attackerFlag === filter);

  const criticalCount = allAttacks.filter((a) => a.severity === "critical").length;
  const highCount = allAttacks.filter((a) => a.severity === "high").length;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-critical" />
          {t("Cybersecurity Alerts", "تنبيهات الأمن السيبراني")}
          <span className="text-[8px] font-mono text-critical ml-1">
            {criticalCount} {t("CRIT", "حرج")}
          </span>
          <span className="text-[8px] font-mono text-warning">
            {highCount} {t("HIGH", "عالي")}
          </span>
        </h4>
        <div className="flex items-center gap-1.5">
          {isLive ? (
            <Wifi className="h-2.5 w-2.5 text-green-400" />
          ) : (
            <WifiOff className="h-2.5 w-2.5 text-muted-foreground" />
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="p-0.5 rounded hover:bg-secondary/50 transition-colors disabled:opacity-50"
            title={t("Refresh threat feed", "تحديث موجز التهديدات")}
          >
            <RefreshCw className={`h-2.5 w-2.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="text-[7px] font-mono text-muted-foreground">{filtered.length} {t("OPS", "عمليات")}</span>
        </div>
      </div>

      {/* Live status bar */}
      {lastUpdated && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className={`h-1 w-1 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-[6px] font-mono text-muted-foreground">
            {isLive ? "LIVE" : "CACHED"} • {new Date(lastUpdated).toLocaleTimeString()}
            {sources.length > 0 && ` • ${sources.join(", ")}`}
          </span>
        </div>
      )}

      {error && (
        <div className="text-[7px] font-mono text-warning bg-warning/10 rounded px-1.5 py-0.5 mb-1.5">
          ⚠ {t("Using cached data", "استخدام البيانات المخزنة")} — {error}
        </div>
      )}

      {/* Country filter */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.flag}
            onClick={() => setFilter(opt.flag)}
            className={`flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-[7px] transition-colors whitespace-nowrap ${
              filter === opt.flag
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.flag !== "all" && opt.flag} {opt.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && allAttacks.length === 0 && (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded p-2 animate-pulse">
              <div className="h-2 bg-muted rounded w-1/3 mb-1" />
              <div className="h-2 bg-muted rounded w-2/3 mb-1" />
              <div className="h-2 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Attack list */}
      <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent space-y-1.5">
        {filtered.map((attack) => (
          <div
            key={attack.id}
            className={`border rounded p-2 transition-all cursor-pointer hover:bg-secondary/30 ${SEVERITY_COLORS[attack.severity] || SEVERITY_COLORS.medium}`}
            onClick={() => setExpandedId(expandedId === attack.id ? null : attack.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[attack.severity] || SEVERITY_DOT.medium} ${attack.severity === "critical" ? "animate-pulse" : ""}`} />
                  <span className="text-[8px] font-mono font-bold uppercase">{attack.severity}</span>
                  <span className="text-[7px] font-mono text-muted-foreground">{attack.date}</span>
                </div>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[10px]">{ATTACK_TYPE_ICON[attack.type] || "⚡"}</span>
                  <span className="text-[8px] font-mono font-bold text-foreground truncate">{attack.type}</span>
                </div>
                <p className="text-[8px] font-mono text-foreground/90 leading-tight">{attack.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[7px] font-mono text-muted-foreground">
                    {attack.attackerFlag} {attack.attacker}
                  </span>
                  <span className="text-[7px] text-muted-foreground">→</span>
                  <span className="text-[7px] font-mono text-muted-foreground">
                    {attack.targetFlag} {attack.target}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                {expandedId === attack.id ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>

            {expandedId === attack.id && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-[8px] font-mono text-foreground/80 leading-relaxed">{attack.details}</p>
                {attack.source && (
                  <a
                    href={attack.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 mt-1.5 text-[7px] font-mono text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    {t("Source", "المصدر")}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
