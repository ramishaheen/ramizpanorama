import { useState, useEffect } from "react";
import { ShieldAlert, Globe, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Wifi, WifiOff, X, Maximize2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useCyberThreats, CyberThreat } from "@/hooks/useCyberThreats";

// Static fallback data used when live feed is unavailable
const FALLBACK_ATTACKS: CyberThreat[] = [
  {
    id: "cy-001", date: "2026-03-05",
    attacker: "Israel (Unit 8200)", attackerCountry: "Israel", attackerFlag: "🇮🇱",
    target: "Iran Nuclear Facilities", targetCountry: "Iran", targetFlag: "🇮🇷",
    type: "SCADA/ICS Attack", severity: "critical",
    description: "Stuxnet-variant malware deployed against Iranian uranium enrichment centrifuges at Natanz",
    details: "Advanced persistent threat targeting Siemens S7-400 PLCs controlling gas centrifuge cascades. Caused physical damage to ~1,000 IR-6 centrifuges.",
    source: "https://www.reuters.com", sourceName: "Reuters",
  },
  {
    id: "cy-004", date: "2026-03-05",
    attacker: "USA (Cyber Command)", attackerCountry: "United States", attackerFlag: "🇺🇸",
    target: "Iranian Military Networks", targetCountry: "Iran", targetFlag: "🇮🇷",
    type: "Network Disruption", severity: "critical",
    description: "USCYBERCOM offensive operation against IRGC command-and-control infrastructure",
    details: "Operation 'Digital Fury' — coordinated takedown of IRGC C2 nodes across 14 military bases. Disrupted drone control and missile telemetry networks.",
    source: "https://www.defense.gov", sourceName: "DoD",
  },
  {
    id: "cy-007", date: "2026-03-05",
    attacker: "Iran (APT33/Elfin)", attackerCountry: "Iran", attackerFlag: "🇮🇷",
    target: "Israeli Water Systems", targetCountry: "Israel", targetFlag: "🇮🇱",
    type: "Critical Infrastructure", severity: "critical",
    description: "Attempted manipulation of chlorine levels in Israeli water treatment facilities",
    details: "APT33 gained access to SCADA systems at 6 water treatment plants via spear-phishing. Neutralized within 2 hours by IDF Cyber Defense.",
    source: "https://www.jpost.com", sourceName: "JPost",
  },
  {
    id: "cy-009", date: "2026-03-03",
    attacker: "Iran (Charming Kitten)", attackerCountry: "Iran", attackerFlag: "🇮🇷",
    target: "Saudi Aramco", targetCountry: "Saudi Arabia", targetFlag: "🇸🇦",
    type: "Wiper Malware", severity: "critical",
    description: "Shamoon-4 wiper malware deployed against Saudi Aramco IT and OT networks",
    details: "New Shamoon variant targeted both IT workstations and OT networks controlling pipeline SCADA. 12,000+ endpoints affected.",
    sourceName: "BleepingComputer",
  },
  {
    id: "cy-010", date: "2026-03-05",
    attacker: "UAE (DarkMatter/Edge Group)", attackerCountry: "UAE", attackerFlag: "🇦🇪",
    target: "Houthi C2 Networks", targetCountry: "Yemen", targetFlag: "🇾🇪",
    type: "Offensive Cyber", severity: "high",
    description: "Disruption of Houthi drone command-and-control and targeting systems",
    details: "UAE cyber operators compromised satellite communication links used by Houthi forces for drone operations. Injected false GPS coordinates.",
    sourceName: "The Record",
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
  "SCADA/ICS Attack": "⚡", "Signal Intelligence": "📡", "Electronic Warfare": "🛡️",
  "Network Disruption": "🌐", "Financial Disruption": "💰", "Information Operations": "📰",
  "Critical Infrastructure": "🏗️", "Espionage": "🕵️", "Wiper Malware": "💀",
  "Offensive Cyber": "⚔️", "Counter-Intelligence": "🔍", "Defensive/Counter-IO": "🛡️",
  "Defensive": "🔒", "Ransomware": "🔐", "Supply Chain": "🔗",
  "Zero-Day Exploit": "💥", "DDoS Attack": "🌊", "Phishing Campaign": "🎣",
};

type FilterCountry = "all" | "🇮🇱" | "🇺🇸" | "🇮🇷" | "🇦🇪" | "🇸🇦" | "🇶🇦" | "🇯🇴" | "🇷🇺" | "🇨🇳";
const FILTER_OPTIONS: { flag: FilterCountry; label: string }[] = [
  { flag: "all", label: "ALL" },
  { flag: "🇮🇱", label: "Israel" },
  { flag: "🇺🇸", label: "USA" },
  { flag: "🇮🇷", label: "Iran" },
  { flag: "🇦🇪", label: "UAE" },
  { flag: "🇸🇦", label: "Saudi" },
  { flag: "🇶🇦", label: "Qatar" },
  { flag: "🇯🇴", label: "Jordan" },
  { flag: "🇷🇺", label: "Russia" },
  { flag: "🇨🇳", label: "China" },
];

export const CyberSecurityAlerts = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterCountry>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const { t } = useLanguage();
  const { threats: liveThreats, loading, error, lastUpdated, sources, refresh } = useCyberThreats();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalOpen) setModalOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const allAttacks = liveThreats.length > 0 ? liveThreats : FALLBACK_ATTACKS;
  const isLive = liveThreats.length > 0;

  const filtered = filter === "all"
    ? allAttacks
    : allAttacks.filter((a) => a.attackerFlag === filter || a.targetFlag === filter);

  const criticalCount = allAttacks.filter((a) => a.severity === "critical").length;
  const highCount = allAttacks.filter((a) => a.severity === "high").length;

  const renderAttackCard = (attack: CyberThreat, large = false) => (
    <div
      key={attack.id}
      className={`border transition-all cursor-pointer hover:bg-secondary/30 ${SEVERITY_COLORS[attack.severity] || SEVERITY_COLORS.medium} ${large ? "rounded p-3" : "rounded p-2"}`}
      onClick={() => setExpandedId(expandedId === attack.id ? null : attack.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Severity + Date + CVE */}
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[attack.severity] || SEVERITY_DOT.medium} ${attack.severity === "critical" ? "animate-pulse" : ""}`} />
            <span className={`${large ? "text-xs" : "text-[8px]"} font-mono font-bold uppercase`}>{attack.severity}</span>
            <span className={`${large ? "text-[10px]" : "text-[7px]"} font-mono text-muted-foreground`}>{attack.date}</span>
            {attack.cve && (
              <span className={`${large ? "text-[10px]" : "text-[7px]"} font-mono text-primary bg-primary/10 px-1 rounded`}>{attack.cve}</span>
            )}
            {attack.sourceName && (
              <span className={`${large ? "text-[10px]" : "text-[7px]"} font-mono text-muted-foreground/70`}>via {attack.sourceName}</span>
            )}
          </div>

          {/* Attack Type */}
          <div className="flex items-center gap-1 mb-0.5">
            <span className={large ? "text-sm" : "text-[10px]"}>{ATTACK_TYPE_ICON[attack.type] || "⚡"}</span>
            <span className={`${large ? "text-xs" : "text-[8px]"} font-mono font-bold text-foreground truncate`}>{attack.type}</span>
          </div>

          {/* Description */}
          <p className={`${large ? "text-xs" : "text-[8px]"} font-mono text-foreground/90 leading-tight`}>{attack.description}</p>

          {/* Attacker → Target with country names */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`${large ? "text-[11px]" : "text-[8px]"} font-mono font-semibold text-foreground/80`}>
              {attack.attackerFlag} {attack.attackerCountry || attack.attacker}
            </span>
            <span className={`${large ? "text-[11px]" : "text-[8px]"} text-primary font-bold`}>→</span>
            <span className={`${large ? "text-[11px]" : "text-[8px]"} font-mono font-semibold text-foreground/80`}>
              {attack.targetFlag} {attack.targetCountry || attack.target}
            </span>
          </div>

          {/* Actor name (smaller, below country) */}
          <div className={`${large ? "text-[10px]" : "text-[7px]"} font-mono text-muted-foreground mt-0.5`}>
            {attack.attacker} → {attack.target}
          </div>
        </div>
        <div className="flex-shrink-0">
          {expandedId === attack.id ? (
            <ChevronUp className={`${large ? "h-4 w-4" : "h-3 w-3"} text-muted-foreground`} />
          ) : (
            <ChevronDown className={`${large ? "h-4 w-4" : "h-3 w-3"} text-muted-foreground`} />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expandedId === attack.id && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
          <p className={`${large ? "text-xs" : "text-[8px]"} font-mono text-foreground/80 leading-relaxed`}>{attack.details}</p>

          {/* IOCs */}
          {attack.iocs && attack.iocs.length > 0 && (
            <div>
              <span className={`${large ? "text-[10px]" : "text-[7px]"} font-mono font-bold text-warning uppercase`}>IOCs:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {attack.iocs.map((ioc, i) => (
                  <span key={i} className={`${large ? "text-[10px]" : "text-[7px]"} font-mono bg-secondary/50 text-foreground/70 px-1.5 py-0.5 rounded`}>
                    {ioc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source link */}
          {attack.source && (
            <a
              href={attack.source}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-0.5 ${large ? "text-xs" : "text-[7px]"} font-mono text-primary hover:underline`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className={large ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} />
              {attack.sourceName || t("Source", "المصدر")}
            </a>
          )}
        </div>
      )}
    </div>
  );

  const filterButtons = (large = false) => (
    <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border flex-wrap">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.flag}
          onClick={() => setFilter(opt.flag)}
          className={`flex-shrink-0 ${large ? "px-2.5 py-1" : "px-1.5 py-0.5"} rounded font-mono ${large ? "text-xs" : "text-[7px]"} transition-colors whitespace-nowrap ${
            filter === opt.flag
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.flag !== "all" && opt.flag} {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
    <div className="bg-card border border-border rounded-lg p-3" onDoubleClick={() => setModalOpen(true)}>
      <div className="flex items-center gap-1 mb-0.5">
        <Maximize2 className="h-2 w-2 text-muted-foreground/50" />
        <span className="text-[6px] font-mono text-muted-foreground/50">{t("Double-click to expand", "انقر مرتين للتوسيع")}</span>
      </div>
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

      {/* Live status bar with sources */}
      {lastUpdated && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <span className={`h-1 w-1 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-[6px] font-mono text-muted-foreground">
            {isLive ? "LIVE" : "CACHED"} • {new Date(lastUpdated).toLocaleTimeString()}
          </span>
          {sources.length > 0 && (
            <span className="text-[6px] font-mono text-primary/60">
              [{sources.join(" · ")}]
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="text-[7px] font-mono text-warning bg-warning/10 rounded px-1.5 py-0.5 mb-1.5 flex items-center gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />
          {t("Using cached data", "استخدام البيانات المخزنة")}
        </div>
      )}

      {filterButtons()}

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

      <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent space-y-1.5">
        {filtered.map((attack) => renderAttackCard(attack))}
      </div>
    </div>

    {/* Fullscreen modal */}
    {modalOpen && (
      <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex flex-col" onClick={() => setModalOpen(false)}>
        <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-critical" />
              <h2 className="text-lg font-bold text-foreground font-mono uppercase tracking-wider">
                {t("Cybersecurity Operations Center", "مركز عمليات الأمن السيبراني")}
              </h2>
              {isLive && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE FEED
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <span className="text-critical font-bold">{criticalCount} CRITICAL</span>
                <span className="text-warning font-bold">{highCount} HIGH</span>
                <span>{allAttacks.length} TOTAL</span>
              </div>
              {sources.length > 0 && (
                <div className="flex items-center gap-1">
                  {sources.map((s, i) => (
                    <span key={i} className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={refresh}
                disabled={loading}
                className="p-1.5 rounded bg-secondary/50 hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded bg-secondary/50 hover:bg-destructive/50 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {lastUpdated && (
            <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
              {isLive ? "LIVE" : "CACHED"} • Last updated: {new Date(lastUpdated).toLocaleString()}
              {sources.length > 0 && ` • Sources: ${sources.join(", ")}`}
            </div>
          )}

          {filterButtons(true)}

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent space-y-2 pr-2">
            {filtered.map((attack) => renderAttackCard(attack, true))}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground font-mono text-sm py-12">
                {t("No operations found for this filter", "لا توجد عمليات لهذا الفلتر")}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};
