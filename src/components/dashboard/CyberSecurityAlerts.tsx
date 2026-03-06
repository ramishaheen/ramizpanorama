import { useState } from "react";
import { Shield, ShieldAlert, ShieldOff, Globe, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface CyberAttack {
  id: string;
  date: string;
  attacker: string;
  attackerFlag: string;
  target: string;
  targetFlag: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  details: string;
  source?: string;
}

const cyberAttacks: CyberAttack[] = [
  // Israel
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
    details: "Advanced persistent threat targeting Siemens S7-400 PLCs controlling gas centrifuge cascades. Caused physical damage to ~1,000 IR-6 centrifuges, setting back enrichment program by estimated 6 months. Malware showed signatures consistent with Unit 8200 toolkits.",
    source: "https://www.reuters.com",
  },
  {
    id: "cy-002",
    date: "2026-03-04",
    attacker: "Israel (Mossad Cyber)",
    attackerFlag: "🇮🇱",
    target: "Hezbollah Communications",
    targetFlag: "🇱🇧",
    type: "Signal Intelligence",
    severity: "high",
    description: "Compromise of Hezbollah encrypted messaging infrastructure across Lebanon and Syria",
    details: "Exploited zero-day in custom-built encrypted messenger app used by Hezbollah commanders. Intercepted operational communications for 72+ hours before detection. Led to targeted strikes on 3 weapons depots.",
    source: "https://www.timesofisrael.com",
  },
  {
    id: "cy-003",
    date: "2026-03-03",
    attacker: "Israel (IDF Cyber Command)",
    attackerFlag: "🇮🇱",
    target: "Syrian Air Defense",
    targetFlag: "🇸🇾",
    type: "Electronic Warfare",
    severity: "high",
    description: "Disabled Syrian S-300 radar systems via cyber intrusion prior to airstrikes",
    details: "Remote exploitation of radar command-and-control software allowed suppression of enemy air defenses (SEAD) without kinetic strikes. Russian-supplied S-300PM2 batteries in Latakia and Damascus rendered blind for 4-hour window.",
  },
  // USA
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
    details: "Operation 'Digital Fury' — coordinated takedown of IRGC C2 nodes across 14 military bases. Disrupted drone control systems, missile telemetry networks, and logistics databases. Timed to coincide with kinetic Operation Epic Fury strikes.",
    source: "https://www.defense.gov",
  },
  {
    id: "cy-005",
    date: "2026-03-04",
    attacker: "USA (NSA/TAO)",
    attackerFlag: "🇺🇸",
    target: "Iranian Banking System",
    targetFlag: "🇮🇷",
    type: "Financial Disruption",
    severity: "high",
    description: "Disruption of Iran's SEPAM interbank transfer system and Central Bank networks",
    details: "Tailored Access Operations compromised Iran's domestic banking backbone, causing 36-hour transaction freeze. ATM networks across Tehran, Isfahan, and Shiraz went offline. Estimated $2.1B in frozen transactions.",
  },
  {
    id: "cy-006",
    date: "2026-03-02",
    attacker: "USA (FBI/CISA)",
    attackerFlag: "🇺🇸",
    target: "Iranian State Media",
    targetFlag: "🇮🇷",
    type: "Information Operations",
    severity: "medium",
    description: "Takedown of Iranian state propaganda websites and social media bot networks",
    details: "Coordinated with tech platforms to dismantle 1,200+ bot accounts and 47 domains used for disinformation. Targeted IRIB-linked outlets spreading false casualty reports and fabricated surrender claims.",
  },
  // Iran
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
    details: "APT33 gained access to SCADA systems at 6 water treatment plants via spear-phishing of maintenance contractors. Attempted to alter chemical dosing parameters. Detected and neutralized by Israel National Cyber Directorate within 2 hours. No public health impact.",
    source: "https://www.jpost.com",
  },
  {
    id: "cy-008",
    date: "2026-03-04",
    attacker: "Iran (MuddyWater)",
    attackerFlag: "🇮🇷",
    target: "US Military Contractors",
    targetFlag: "🇺🇸",
    type: "Espionage",
    severity: "high",
    description: "Data exfiltration from 3 US defense contractors working on Iron Dome upgrades",
    details: "MuddyWater APT used compromised VPN credentials to infiltrate networks of Raytheon, Lockheed Martin, and Rafael subcontractors. Exfiltrated technical specifications related to David's Sling and Arrow-3 missile defense systems.",
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
    details: "New variant of Shamoon destructive malware targeted both IT workstations and operational technology networks controlling pipeline SCADA. 12,000+ endpoints affected. Emergency isolation prevented spread to refinery control systems. Production briefly disrupted at Ras Tanura facility.",
  },
  // Arab Countries
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
    details: "UAE cyber operators compromised satellite communication links used by Houthi forces for drone operations. Injected false GPS coordinates causing 4 armed drones to crash in empty desert. Also disrupted anti-ship missile targeting data.",
  },
  {
    id: "cy-011",
    date: "2026-03-04",
    attacker: "Saudi Arabia (NCA)",
    attackerFlag: "🇸🇦",
    target: "Iranian Proxy Networks",
    targetFlag: "🇮🇶",
    type: "Counter-Intelligence",
    severity: "medium",
    description: "Saudi National Cybersecurity Authority dismantled Iranian intelligence network in Iraq",
    details: "Identified and neutralized network of compromised devices used by IRGC-QF to coordinate militia operations in southern Iraq. Exposed communication channels between Tehran and Popular Mobilization Forces leadership.",
  },
  {
    id: "cy-012",
    date: "2026-03-03",
    attacker: "Qatar (NCSA)",
    attackerFlag: "🇶🇦",
    target: "Disinformation Networks",
    targetFlag: "🌍",
    type: "Defensive/Counter-IO",
    severity: "low",
    description: "Qatar's NCSA neutralized coordinated disinformation campaign targeting Gulf state unity",
    details: "Detected and disrupted state-sponsored social media manipulation campaign using AI-generated deepfakes of Gulf leaders. Over 800 fake accounts and 15 domains taken down in coordination with Meta and X platforms.",
  },
  {
    id: "cy-013",
    date: "2026-03-02",
    attacker: "Iran (APT34/OilRig)",
    attackerFlag: "🇮🇷",
    target: "Bahrain Government",
    targetFlag: "🇧🇭",
    type: "Espionage",
    severity: "high",
    description: "APT34 penetrated Bahrain Ministry of Interior and intelligence agency networks",
    details: "Spear-phishing campaign using lures related to Iran-US negotiations. Deployed custom backdoor 'SideTwist' variant. Exfiltrated diplomatic cables and security cooperation documents with US 5th Fleet. Active for estimated 3 weeks before detection.",
  },
  {
    id: "cy-014",
    date: "2026-03-01",
    attacker: "Jordan (JCERT)",
    attackerFlag: "🇯🇴",
    target: "Border Surveillance Systems",
    targetFlag: "🇯🇴",
    type: "Defensive",
    severity: "medium",
    description: "Jordan CERT repelled coordinated attack on border monitoring and refugee tracking systems",
    details: "Detected and blocked intrusion attempts targeting sensor networks along Jordan-Syria and Jordan-Iraq borders. Attack originated from compromised servers in Turkey. Reinforced monitoring of refugee camp registration databases.",
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

  const filtered = filter === "all"
    ? cyberAttacks
    : cyberAttacks.filter((a) => a.attackerFlag === filter);

  const criticalCount = cyberAttacks.filter((a) => a.severity === "critical").length;
  const highCount = cyberAttacks.filter((a) => a.severity === "high").length;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
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
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="text-[7px] font-mono text-muted-foreground">{filtered.length} {t("OPS", "عمليات")}</span>
        </div>
      </div>

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

      {/* Attack list */}
      <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent space-y-1.5">
        {filtered.map((attack) => (
          <div
            key={attack.id}
            className={`border rounded p-2 transition-all cursor-pointer hover:bg-secondary/30 ${SEVERITY_COLORS[attack.severity]}`}
            onClick={() => setExpandedId(expandedId === attack.id ? null : attack.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[attack.severity]} ${attack.severity === "critical" ? "animate-pulse" : ""}`} />
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
