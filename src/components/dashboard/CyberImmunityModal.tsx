import { useState, useMemo, useCallback, useEffect, useRef, FormEvent } from "react";
import warosLogo from "@/assets/waros-logo.png";
import { createPortal } from "react-dom";
import {
  X, RefreshCw, ShieldAlert, Search,
  Activity, Globe, AlertTriangle, Zap, Network,
  Target, Bug, Radio, ChevronRight, ExternalLink,
  Play, Pause, SkipBack, SkipForward, Clock, Copy, Check,
  Eye, EyeOff, Skull, Link2, FileWarning, Hash,
  UserSearch, Shield, Crosshair, Fingerprint, Server,
  Layers, Lock, Key, Wifi
} from "lucide-react";
import { useCyberThreats, type CyberThreat } from "@/hooks/useCyberThreats";
import { useDarkWebIntel, type ActorDossier, type DarkWebEntry, type TorAnalysis, type IndicatorExtraction, type ThreatCorrelation, type ForumPost, type RansomwareLeak, type AlertRule, type DashboardStats, type TemporalTrend } from "@/hooks/useDarkWebIntel";
import CyberThreatMapLeaflet from "@/components/dashboard/cyber/CyberThreatMapLeaflet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { MapLayersPanel, useMapLayers, filterByLayers } from "@/components/dashboard/cyber/MapLayersPanel";
import { APTIntelPanel } from "@/components/dashboard/cyber/APTIntelPanel";
import { IncidentTimeline } from "@/components/dashboard/cyber/IncidentTimeline";
import InteractiveMapSummary from "@/components/dashboard/InteractiveMapSummary";

import { CyberAlertBanner } from "@/components/dashboard/cyber/CyberAlertBanner";
import { useIOCLookup, type IOCResult } from "@/hooks/useIOCLookup";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface OsintGeoAlert {
  id: string;
  type: string;
  region: string;
  title: string;
  severity: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface CyberImmunityModalProps {
  onClose: () => void;
  geoAlerts?: OsintGeoAlert[];
}

/* ── country coordinates (kept for RelationshipGraph) ── */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Iran: [53, 32], Israel: [35, 31], USA: [-98, 38], "United States": [-98, 38],
  Russia: [60, 55], China: [104, 35], "North Korea": [127, 40],
  "Saudi Arabia": [45, 24], UAE: [54, 24], Qatar: [51, 25],
  Turkey: [35, 39], Syria: [38, 35], Lebanon: [35.8, 33.9],
  Iraq: [44, 33], Yemen: [48, 15], Pakistan: [69, 30],
  India: [78, 21], Ukraine: [32, 49], Germany: [10, 51],
  UK: [-2, 54], France: [2, 47], "Multiple": [10, 20],
  Unknown: [0, 10], Japan: [138, 36], "South Korea": [127, 36],
  Egypt: [30, 27], Jordan: [36, 31], Bahrain: [50.5, 26],
  Kuwait: [47.5, 29.3], Oman: [57, 21], Libya: [17, 27],
  Tunisia: [9, 34], Algeria: [3, 28], Morocco: [-5, 32],
  Sudan: [30, 15], Ethiopia: [40, 9], Kenya: [38, 0],
  Nigeria: [8, 10], "South Africa": [25, -30], Brazil: [-51, -14],
  Canada: [-106, 56], Mexico: [-102, 23], Australia: [133, -25],
};

function hashCountryCoords(name: string): [number, number] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const lon = ((h & 0xFFFF) / 0xFFFF) * 300 - 150;
  const lat = (((h >> 16) & 0xFFFF) / 0xFFFF) * 120 - 60;
  return [lon, lat];
}

function getCountryCoords(name: string): [number, number] {
  return COUNTRY_COORDS[name] || hashCountryCoords(name);
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0 90% 55%)",
  high: "hsl(25 95% 55%)",
  medium: "hsl(45 95% 55%)",
  low: "hsl(190 80% 55%)",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-primary/20 text-primary border-primary/30",
};

const COUNTRY_FILTERS = ["All", "Israel", "Iran", "Jordan", "Oman", "Qatar", "Bahrain", "USA", "Russia", "China", "Saudi Arabia", "UAE", "Turkey", "Syria"];
const SPEEDS = [1, 2, 5] as const;
const SPEED_INTERVALS: Record<number, number> = { 1: 1500, 2: 750, 5: 300 };
const EXPECTED_SOURCES = ["CISA KEV", "AlienVault OTX", "abuse.ch URLhaus", "NIST NVD", "CERT-FR", "ThreatFox", "Feodo Tracker", "Ransomwatch", "Cisco Talos", "BleepingComputer"];

const LOADING_MESSAGES = [
  "Scanning OSINT feeds…",
  "Decrypting threat corridors…",
  "Parsing CVE databases…",
  "Mapping attack vectors…",
  "Correlating IOC signatures…",
  "Indexing dark web chatter…",
  "Syncing threat actor profiles…",
  "Calibrating risk matrices…",
];

function CyberLoadingScreen({ sources }: { sources: string[] }) {
  const [simulatedStep, setSimulatedStep] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const dataArrived = sources.length > 0;

  useEffect(() => {
    if (dataArrived) {
      setSimulatedStep(EXPECTED_SOURCES.length);
      return;
    }
    const timer = setInterval(() => {
      setSimulatedStep((prev) => (prev < EXPECTED_SOURCES.length ? prev + 1 : prev));
    }, 800);
    return () => clearInterval(timer);
  }, [dataArrived]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const progress = dataArrived ? 100 : Math.min((simulatedStep / EXPECTED_SOURCES.length) * 100, 95);

  return (
    <div className="flex items-center justify-center h-full bg-background/95">
      <div className="text-center space-y-5 max-w-xs">
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-1 rounded-full border border-dashed border-primary/40 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
          <div className="absolute inset-3 flex items-center justify-center">
            <img src={warosLogo} alt="WAROS" className="w-16 h-16 object-contain animate-pulse" />
          </div>
        </div>
        <div>
          <p className="text-xs text-primary font-mono font-bold tracking-[0.15em]">INITIALIZING THREAT INTELLIGENCE</p>
          <p className="text-[9px] text-muted-foreground/60 mt-1 transition-opacity duration-500">{LOADING_MESSAGES[msgIndex]}</p>
        </div>
        <Progress value={progress} className="h-1.5 bg-muted/30" />
        <div className="space-y-1 mt-2">
          {EXPECTED_SOURCES.map((s, i) => {
            const connected = dataArrived ? sources.includes(s) : simulatedStep > i;
            return (
              <div key={s} className="flex items-center gap-2 text-[8px]">
                {connected ? (
                  <Check className="h-2.5 w-2.5 text-green-500" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 animate-pulse" />
                )}
                <span className={connected ? "text-muted-foreground" : "text-muted-foreground/40"}>{s}</span>
                {!connected && <span className="text-[7px] text-muted-foreground/30 italic">connecting…</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function lonLatToSvg(lon: number, lat: number, w: number, h: number): [number, number] {
  return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
}

/* ── Threat Map (Leaflet-based) ── */
function ThreatMap({ threats, onSelect, selectedId }: { threats: CyberThreat[]; onSelect: (t: CyberThreat) => void; selectedId?: string }) {
  return (
    <div className="relative w-full h-full cyber-threat-map">
      <CyberThreatMapLeaflet threats={threats} onSelect={onSelect} selectedId={selectedId} />
    </div>
  );
}

/* ── IOC Search + Live Scan Section ── */
function IOCSearchSection({ search, setSearch }: { search: string; setSearch: (v: string) => void }) {
  const { data, loading, error, scan, reset } = useIOCLookup();
  const [scanInput, setScanInput] = useState("");

  const handleScan = (e?: FormEvent) => {
    e?.preventDefault();
    const target = scanInput.trim() || search.trim();
    if (target) scan(target);
  };

  const scoreColor = (s: number) => s >= 70 ? "text-destructive" : s >= 40 ? "text-orange-400" : s >= 15 ? "text-yellow-400" : "text-primary";
  const scoreLabel = (s: number) => s >= 70 ? "MALICIOUS" : s >= 40 ? "SUSPICIOUS" : s >= 15 ? "LOW RISK" : "CLEAN";

  return (
    <div className="space-y-2">
      <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">IOC / Threat Search</label>
      {/* Filter input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter threats..." className="h-7 pl-7 text-[10px] bg-background/50 border-border" />
      </div>
      {/* SCAN input */}
      <form onSubmit={handleScan} className="flex gap-1">
        <Input
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          placeholder="185.234.218.91"
          className="h-7 text-[10px] bg-background/50 border-border font-mono flex-1"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-7 px-2.5 rounded text-[9px] font-mono font-bold border transition-colors bg-destructive/20 text-destructive border-destructive/40 hover:bg-destructive/30 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Crosshair className="h-3 w-3 inline mr-1" />SCAN
            </>
          )}
        </button>
      </form>
      <div className="flex gap-1 flex-wrap">
        {["IP", "CVE", "Domain", "APT", "Malware", "Country"].map(chip => (
          <button key={chip} onClick={() => setSearch(chip === "CVE" ? "CVE-" : chip === "IP" ? "." : "")} className="text-[7px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors font-mono">
            {chip}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-[9px] font-mono text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
          ⚠ {error}
        </div>
      )}

      {/* Loading animation */}
      {loading && (
        <div className="border border-border rounded p-2 space-y-1.5 bg-background/30">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-primary">
            <RefreshCw className="h-3 w-3 animate-spin" />
            SCANNING TARGET...
          </div>
          <Progress value={undefined} className="h-1" />
          <div className="text-[8px] font-mono text-muted-foreground space-y-0.5">
            <div className="animate-pulse">→ Querying Shodan InternetDB...</div>
            <div className="animate-pulse" style={{ animationDelay: "0.2s" }}>→ Querying ip-api geolocation...</div>
            <div className="animate-pulse" style={{ animationDelay: "0.4s" }}>→ Querying ThreatFox IOC database...</div>
            <div className="animate-pulse" style={{ animationDelay: "0.6s" }}>→ Querying Feodo Tracker...</div>
            <div className="animate-pulse" style={{ animationDelay: "0.8s" }}>→ AI threat assessment...</div>
          </div>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="border border-border rounded bg-background/30 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-2 border-b border-border bg-card/50">
            <div className="flex items-center gap-1.5">
              <Target className="h-3 w-3 text-destructive" />
              <span className="text-[9px] font-mono font-bold text-foreground">{data.ioc}</span>
              <Badge variant="outline" className="text-[7px] px-1 py-0 h-4">{data.type}</Badge>
            </div>
            <button onClick={reset} className="text-[8px] text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {/* Threat Score */}
          <div className="p-2 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-mono text-muted-foreground">THREAT SCORE</span>
              <span className={`text-[11px] font-mono font-bold ${scoreColor(data.threatScore)}`}>
                {data.threatScore}/100 · {scoreLabel(data.threatScore)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${data.threatScore >= 70 ? "bg-destructive" : data.threatScore >= 40 ? "bg-orange-500" : data.threatScore >= 15 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${data.threatScore}%` }}
              />
            </div>
          </div>

          {/* Geolocation */}
          {data.geolocation && (
            <div className="p-2 border-b border-border text-[9px] font-mono space-y-0.5">
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1">Geolocation</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="text-foreground">{data.geolocation.city}, {data.geolocation.country}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ISP</span><span className="text-foreground truncate ml-2 max-w-[140px]">{data.geolocation.isp}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Org</span><span className="text-foreground truncate ml-2 max-w-[140px]">{data.geolocation.org}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ASN</span><span className="text-foreground truncate ml-2 max-w-[140px]">{data.geolocation.as}</span></div>
              <div className="flex gap-1 mt-1">
                {data.geolocation.isProxy && <Badge variant="destructive" className="text-[7px] px-1 py-0 h-4">PROXY</Badge>}
                {data.geolocation.isHosting && <Badge variant="secondary" className="text-[7px] px-1 py-0 h-4">HOSTING</Badge>}
                {data.geolocation.isMobile && <Badge variant="outline" className="text-[7px] px-1 py-0 h-4">MOBILE</Badge>}
              </div>
            </div>
          )}

          {/* Open Ports */}
          {data.shodan && data.shodan.ports.length > 0 && (
            <div className="p-2 border-b border-border text-[9px] font-mono">
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1">Open Ports ({data.shodan.ports.length})</div>
              <div className="flex flex-wrap gap-1">
                {data.shodan.ports.map(p => (
                  <span key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* CVEs */}
          {data.shodan && data.shodan.vulns.length > 0 && (
            <div className="p-2 border-b border-border text-[9px] font-mono">
              <div className="text-[8px] text-destructive uppercase tracking-wider mb-1">CVEs ({data.shodan.vulns.length})</div>
              <div className="flex flex-wrap gap-1">
                {data.shodan.vulns.slice(0, 8).map(v => (
                  <span key={v} className="text-[8px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">{v}</span>
                ))}
                {data.shodan.vulns.length > 8 && <span className="text-[8px] text-muted-foreground">+{data.shodan.vulns.length - 8} more</span>}
              </div>
            </div>
          )}

          {/* Malware Associations */}
          {(data.threatfox.found || data.feodoTracker.found) && (
            <div className="p-2 border-b border-border text-[9px] font-mono">
              <div className="text-[8px] text-destructive uppercase tracking-wider mb-1 flex items-center gap-1"><Bug className="h-3 w-3" /> Malware Intel</div>
              {data.threatfox.matches.map((m, i) => (
                <div key={i} className="flex justify-between py-0.5"><span className="text-destructive">{m.malware}</span><span className="text-muted-foreground">{m.threat_type}</span></div>
              ))}
              {data.feodoTracker.matches.map((m, i) => (
                <div key={`f${i}`} className="flex justify-between py-0.5"><span className="text-destructive">{m.malware}</span><span className="text-muted-foreground">Port {m.port}</span></div>
              ))}
            </div>
          )}

          {/* AI Analysis */}
          {data.aiAnalysis && (
            <div className="p-2 text-[9px] font-mono">
              <div className="text-[8px] text-primary uppercase tracking-wider mb-1 flex items-center gap-1"><Zap className="h-3 w-3" /> AI Assessment</div>
              <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{data.aiAnalysis}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Relationship Graph ── */
function RelationshipGraph({ threats }: { threats: CyberThreat[] }) {
  const W = 900, H = 450, CX = W / 2, CY = H / 2;
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, { id: string; type: string; count: number }>();
    const linkArr: { source: string; target: string; severity: string }[] = [];
    threats.slice(0, 25).forEach((t) => {
      const aKey = `actor:${t.attacker}`;
      const tKey = `target:${t.target}`;
      const typeKey = `type:${t.type}`;
      nodeMap.set(aKey, { id: aKey, type: "actor", count: (nodeMap.get(aKey)?.count || 0) + 1 });
      nodeMap.set(tKey, { id: tKey, type: "target", count: (nodeMap.get(tKey)?.count || 0) + 1 });
      nodeMap.set(typeKey, { id: typeKey, type: "type", count: (nodeMap.get(typeKey)?.count || 0) + 1 });
      linkArr.push({ source: aKey, target: tKey, severity: t.severity });
      linkArr.push({ source: aKey, target: typeKey, severity: t.severity });
    });
    const nodesArr = Array.from(nodeMap.values());
    const angleStep = (2 * Math.PI) / nodesArr.length;
    const positioned = nodesArr.map((n, i) => {
      const radiusMult = n.type === "actor" ? 0.7 : n.type === "target" ? 0.9 : 0.5;
      const r = Math.min(CX, CY) * radiusMult;
      return { ...n, x: CX + r * Math.cos(i * angleStep - Math.PI / 2), y: CY + r * Math.sin(i * angleStep - Math.PI / 2) };
    });
    return { nodes: positioned, links: linkArr };
  }, [threats]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => m.set(n.id, { x: n.x, y: n.y }));
    return m;
  }, [nodes]);

  const typeColors: Record<string, string> = { actor: "hsl(0 80% 60%)", target: "hsl(190 80% 55%)", type: "hsl(45 80% 55%)" };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ background: "hsl(var(--background))" }}>
      {links.map((l, i) => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (!s || !t) return null;
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={SEVERITY_COLORS[l.severity] || "hsl(var(--border))"} strokeWidth={0.8} opacity={0.3} />;
      })}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={Math.min(5 + n.count * 2, 16)} fill={typeColors[n.type]} opacity={0.6} />
          <circle cx={n.x} cy={n.y} r={3} fill={typeColors[n.type]} />
          <text x={n.x} y={n.y + Math.min(5 + n.count * 2, 16) + 10} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={7} opacity={0.6}>
            {n.id.split(":")[1]?.substring(0, 18)}
          </text>
        </g>
      ))}
      {[{ label: "Threat Actor", color: typeColors.actor, y: 20 }, { label: "Target", color: typeColors.target, y: 34 }, { label: "Attack Type", color: typeColors.type, y: 48 }].map((l) => (
        <g key={l.label}>
          <circle cx={16} cy={l.y} r={5} fill={l.color} opacity={0.7} />
          <text x={26} y={l.y + 3} fill="hsl(var(--foreground))" fontSize={9} opacity={0.7}>{l.label}</text>
        </g>
      ))}
    </svg>
  );
}
/* ── Threat Actor Dossier Panel ── */
function ThreatActorDossierPanel({ dossier, loading, error, onClose }: {
  dossier: ActorDossier | null; loading: boolean; error: string | null; onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="absolute inset-4 bg-card/98 backdrop-blur-lg border border-border rounded-lg shadow-2xl flex flex-col items-center justify-center" style={{ zIndex: 20 }}>
        <UserSearch className="h-10 w-10 text-primary animate-pulse mb-3" />
        <p className="text-xs font-mono text-muted-foreground">COMPILING ACTOR DOSSIER...</p>
        <p className="text-[9px] text-muted-foreground/60 mt-1">Querying dark web intelligence feeds</p>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="absolute inset-4 bg-card/98 backdrop-blur-lg border border-border rounded-lg shadow-2xl flex flex-col items-center justify-center" style={{ zIndex: 20 }}>
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-xs text-destructive font-mono">{error || "Failed to load dossier"}</p>
        <button onClick={onClose} className="mt-3 text-[9px] px-3 py-1 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors font-mono">CLOSE</button>
      </div>
    );
  }

  const riskColors: Record<string, string> = {
    critical: "text-destructive", high: "text-orange-400", medium: "text-yellow-400", low: "text-primary",
  };

  return (
    <div className="absolute inset-4 bg-card/98 backdrop-blur-lg border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden" style={{ zIndex: 20 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/50">
        <div className="flex items-center gap-3">
          <UserSearch className="h-4 w-4 text-primary" />
          <span className="text-[9px] px-2 py-0.5 rounded border font-mono uppercase font-bold bg-destructive/20 text-destructive border-destructive/30">
            {dossier.risk_assessment}
          </span>
          <span className="text-xs font-bold">{dossier.flag} {dossier.name}</span>
          <span className="text-[9px] font-mono text-muted-foreground">{dossier.type} · Since {dossier.active_since}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Overview */}
          <div className="p-3 rounded border border-border bg-background/50">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Overview</div>
            <p className="text-[11px] text-foreground leading-relaxed">{dossier.description}</p>
            {dossier.aliases.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {dossier.aliases.map((a, i) => (
                  <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground font-mono">{a}</span>
                ))}
              </div>
            )}
          </div>

          {/* TTPs */}
          <div className="p-3 rounded border border-destructive/20 bg-destructive/5">
            <div className="text-[9px] font-mono text-destructive uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Crosshair className="h-3 w-3" /> MITRE ATT&CK TTPs
            </div>
            <div className="space-y-1.5">
              {dossier.ttps.slice(0, 8).map((ttp, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <span className="font-mono text-destructive font-bold flex-shrink-0 w-12">{ttp.technique}</span>
                  <div className="flex-1">
                    <span className="font-bold text-foreground">{ttp.tactic}</span>
                    <span className="text-muted-foreground ml-1">— {ttp.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaigns */}
          <div className="p-3 rounded border border-border bg-background/50">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target className="h-3 w-3" /> Known Campaigns
            </div>
            <div className="space-y-2">
              {dossier.campaigns.slice(0, 5).map((c, i) => (
                <div key={i} className="p-2 rounded bg-muted/20 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-foreground">{c.name}</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{c.year}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">{c.description}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[8px] text-muted-foreground">Targets:</span>
                    <span className="text-[8px] text-primary">{c.targets}</span>
                  </div>
                  {c.malware.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {c.malware.map((m, j) => (
                        <span key={j} className="text-[7px] px-1 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-mono">{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Targeting Patterns */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded border border-border bg-background/50">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Target Sectors</div>
              <div className="space-y-1">
                {dossier.targeting_patterns.sectors.map((s, i) => (
                  <div key={i} className="text-[9px] text-foreground">• {s}</div>
                ))}
              </div>
            </div>
            <div className="p-3 rounded border border-border bg-background/50">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Target Countries</div>
              <div className="space-y-1">
                {dossier.targeting_patterns.countries.map((c, i) => (
                  <div key={i} className="text-[9px] text-foreground">• {c}</div>
                ))}
              </div>
            </div>
            <div className="p-3 rounded border border-border bg-background/50">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Infrastructure</div>
              <div className="space-y-1">
                {dossier.targeting_patterns.infrastructure.map((inf, i) => (
                  <div key={i} className="text-[9px] text-foreground">• {inf}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Tools & Malware */}
          <div className="p-3 rounded border border-border bg-background/50">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bug className="h-3 w-3" /> Tools & Malware Arsenal
            </div>
            <div className="flex gap-1 flex-wrap">
              {dossier.tools_and_malware.map((t, i) => (
                <span key={i} className="text-[8px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">{t}</span>
              ))}
            </div>
          </div>

          {/* Dark Web & Tor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded border border-purple-500/20 bg-purple-500/5">
              <div className="text-[9px] font-mono text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Skull className="h-3 w-3" /> Dark Web Presence
              </div>
              <div className="space-y-1.5 text-[9px]">
                <div><span className="text-muted-foreground">Forums:</span> <span className="text-foreground">{dossier.dark_web_presence.forums.join(", ") || "None detected"}</span></div>
                <div><span className="text-muted-foreground">Paste Activity:</span> <span className="text-foreground">{dossier.dark_web_presence.paste_activity}</span></div>
                {dossier.dark_web_presence.onion_services.map((s, i) => (
                  <div key={i} className="text-[8px] font-mono text-purple-400 truncate">🧅 {s}</div>
                ))}
              </div>
            </div>
            <div className="p-3 rounded border border-primary/20 bg-primary/5">
              <div className="text-[9px] font-mono text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Fingerprint className="h-3 w-3" /> Tor Infrastructure
              </div>
              <div className="space-y-1.5 text-[9px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Hidden Services</span><span className="text-foreground font-bold">{dossier.tor_infrastructure.hidden_services_count}</span></div>
                <div><span className="text-muted-foreground">Relay Patterns:</span> <span className="text-foreground">{dossier.tor_infrastructure.relay_patterns}</span></div>
                {dossier.tor_infrastructure.known_exit_nodes.slice(0, 3).map((n, i) => (
                  <div key={i} className="text-[8px] font-mono text-primary truncate">⊕ {n}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="p-3 rounded border border-yellow-500/20 bg-yellow-500/5">
            <div className="text-[9px] font-mono text-yellow-400 uppercase tracking-wider mb-1.5">Recent Activity</div>
            <p className="text-[10px] text-foreground leading-relaxed">{dossier.recent_activity}</p>
          </div>

          {/* Countermeasures */}
          <div className="p-3 rounded border border-green-500/20 bg-green-500/5">
            <div className="text-[9px] font-mono text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="h-3 w-3" /> Recommended Countermeasures
            </div>
            <div className="space-y-1">
              {dossier.countermeasures.map((c, i) => (
                <div key={i} className="text-[9px] text-foreground flex items-start gap-1.5">
                  <span className="text-green-400">✓</span> {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Enhanced Dark Web CTI Dashboard ── */
function EnhancedDarkWebMonitor({ entries, torAnalysis, indicatorExtraction, threatCorrelation, forumAnalysis, ransomwareLeaks, alertRules, dashboardStats, temporalTrends, loading, onFetchDossier }: {
  entries: DarkWebEntry[]; torAnalysis: TorAnalysis | null;
  indicatorExtraction: IndicatorExtraction | null; threatCorrelation: ThreatCorrelation[];
  forumAnalysis: ForumPost[]; ransomwareLeaks: RansomwareLeak[];
  alertRules: AlertRule[]; dashboardStats: DashboardStats | null;
  temporalTrends: TemporalTrend[];
  loading: boolean; onFetchDossier: (actor: string) => void;
}) {
  const [subTab, setSubTab] = useState<"overview" | "indicators" | "forum" | "ransomware" | "correlation" | "entries">("overview");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const copyToClipboard = (v: string) => { navigator.clipboard.writeText(v); setCopiedValue(v); setTimeout(() => setCopiedValue(null), 1500); };

  const typeLabels: Record<string, string> = { onion: ".ONION", paste: "PASTE", forum: "FORUM", marketplace: "MARKET", exit_node: "EXIT NODE", hidden_service: "HIDDEN SVC", ransomware_leak: "RANSOM LEAK", exploit_trade: "EXPLOIT", credential_dump: "CRED DUMP", botnet_c2: "BOTNET C2" };
  const typeBg: Record<string, string> = {
    onion: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    paste: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    forum: "bg-primary/15 text-primary border-primary/30",
    marketplace: "bg-destructive/15 text-destructive border-destructive/30",
    exit_node: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    hidden_service: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    ransomware_leak: "bg-destructive/15 text-destructive border-destructive/30",
    exploit_trade: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    credential_dump: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    botnet_c2: "bg-primary/15 text-primary border-primary/30",
  };
  const typeIcons: Record<string, typeof Skull> = { onion: Eye, paste: FileWarning, forum: Hash, marketplace: Link2, exit_node: Server, hidden_service: Fingerprint, ransomware_leak: Lock, exploit_trade: Zap, credential_dump: Key, botnet_c2: Wifi };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: "hsl(var(--background))" }}>
        <Skull className="h-10 w-10 mb-3 animate-pulse text-purple-400" />
        <span className="text-xs font-mono font-bold text-foreground tracking-wider">SCANNING DARK WEB & DEEP WEB</span>
        <span className="text-[9px] text-muted-foreground mt-1">Analyzing .onion infrastructure, paste sites, underground forums…</span>
        <div className="mt-4 space-y-1 text-[8px] font-mono text-muted-foreground/60">
          <div className="animate-pulse">→ Enumerating hidden services…</div>
          <div className="animate-pulse" style={{ animationDelay: "0.3s" }}>→ Extracting IOCs from paste monitors…</div>
          <div className="animate-pulse" style={{ animationDelay: "0.6s" }}>→ Correlating threat actor infrastructure…</div>
          <div className="animate-pulse" style={{ animationDelay: "0.9s" }}>→ Scanning ransomware leak sites…</div>
          <div className="animate-pulse" style={{ animationDelay: "1.2s" }}>→ Processing forum intelligence…</div>
        </div>
      </div>
    );
  }

  const SUB_TABS = [
    { key: "overview" as const, label: "OVERVIEW", icon: Activity },
    { key: "indicators" as const, label: "INDICATORS", icon: Target },
    { key: "forum" as const, label: "FORUM INTEL", icon: Hash },
    { key: "ransomware" as const, label: "RANSOMWARE", icon: Lock },
    { key: "correlation" as const, label: "CORRELATION", icon: Network },
    { key: "entries" as const, label: "ENTRIES", icon: Eye },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: "hsl(var(--background))" }}>
      {/* Alert ticker */}
      {alertRules.length > 0 && (
        <div className="px-3 py-1 border-b border-destructive/30 bg-destructive/5 flex items-center gap-2 overflow-hidden">
          <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0 animate-pulse" />
          <div className="flex gap-6 text-[8px] font-mono overflow-x-auto whitespace-nowrap">
            {alertRules.slice(0, 6).map((a, i) => (
              <span key={i} className={`${a.severity === "critical" ? "text-destructive" : a.severity === "high" ? "text-orange-400" : "text-yellow-400"}`}>
                ▲ {a.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card/30">
        <Skull className="h-3.5 w-3.5 text-purple-400 mr-1" />
        <span className="text-[9px] font-mono font-bold text-foreground uppercase tracking-wider mr-3">CTI ENGINE</span>
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              className={`px-2 py-0.5 rounded text-[8px] font-mono border transition-colors flex items-center gap-1 ${subTab === t.key ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-2.5 w-2.5" />{t.label}
            </button>
          );
        })}
        <span className="text-[8px] font-mono text-muted-foreground ml-auto">{entries.length} entries</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* ═══ OVERVIEW ═══ */}
          {subTab === "overview" && (
            <div className="space-y-3">
              {torAnalysis && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded bg-purple-500/10 border border-purple-500/20">
                    <div className="text-lg font-black text-purple-400">{torAnalysis.hiddenServiceStats.newServicesDetected}</div>
                    <div className="text-[7px] font-mono text-muted-foreground">New Hidden Svcs</div>
                  </div>
                  <div className="text-center p-2 rounded bg-destructive/10 border border-destructive/20">
                    <div className="text-lg font-black text-destructive">{torAnalysis.hiddenServiceStats.c2PanelsIdentified}</div>
                    <div className="text-[7px] font-mono text-muted-foreground">C2 Panels</div>
                  </div>
                  <div className="text-center p-2 rounded bg-orange-500/10 border border-orange-500/20">
                    <div className="text-lg font-black text-orange-400">{torAnalysis.hiddenServiceStats.marketplacesActive}</div>
                    <div className="text-[7px] font-mono text-muted-foreground">Marketplaces</div>
                  </div>
                  <div className="text-center p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <div className="text-lg font-black text-yellow-400">{torAnalysis.hiddenServiceStats.pasteMonitorsTriggered}</div>
                    <div className="text-[7px] font-mono text-muted-foreground">Paste Alerts</div>
                  </div>
                </div>
              )}

              {dashboardStats && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded border border-destructive/20 bg-destructive/5">
                    <div className="text-[8px] font-mono text-destructive uppercase tracking-wider mb-2 flex items-center gap-1"><Crosshair className="h-3 w-3" /> Top Attacking Countries</div>
                    <div className="space-y-1">
                      {dashboardStats.topAttackingCountries.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[9px]">
                          <span className="w-3 text-muted-foreground">{i + 1}.</span><span>{c.flag}</span>
                          <span className="flex-1 text-foreground">{c.country}</span>
                          <span className="font-mono font-bold text-destructive">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded border border-primary/20 bg-primary/5">
                    <div className="text-[8px] font-mono text-primary uppercase tracking-wider mb-2 flex items-center gap-1"><Target className="h-3 w-3" /> Top Targeted Countries</div>
                    <div className="space-y-1">
                      {dashboardStats.topTargetedCountries.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[9px]">
                          <span className="w-3 text-muted-foreground">{i + 1}.</span><span>{c.flag}</span>
                          <span className="flex-1 text-foreground">{c.country}</span>
                          <span className="font-mono font-bold text-primary">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded border border-destructive/20 bg-destructive/5">
                    <div className="text-[8px] font-mono text-destructive uppercase tracking-wider mb-2 flex items-center gap-1"><Lock className="h-3 w-3" /> Active Ransomware Groups</div>
                    <div className="space-y-1">
                      {dashboardStats.activeRansomwareGroups.slice(0, 5).map((g, i) => (
                        <div key={i} className="flex items-center justify-between text-[9px]">
                          <span className="text-foreground font-bold">{g.name}</span>
                          <span className="font-mono text-destructive">{g.activeLeaks} leaks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded border border-orange-500/20 bg-orange-500/5">
                    <div className="text-[8px] font-mono text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Bug className="h-3 w-3" /> Most Discussed CVEs</div>
                    <div className="space-y-1">
                      {dashboardStats.mostDiscussedCVEs.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-[9px]">
                          <span className="font-mono text-foreground">{c.id}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[7px] px-1 py-0.5 rounded border font-mono uppercase ${SEVERITY_BG[c.severity]}`}>{c.severity}</span>
                            <span className="font-mono text-muted-foreground">{c.mentions}x</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {temporalTrends.length > 0 && (
                <div className="p-3 rounded border border-border bg-card/50">
                  <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Activity className="h-3 w-3" /> 4-Week Trend Analysis</div>
                  <div className="grid grid-cols-4 gap-2">
                    {temporalTrends.map((t, i) => (
                      <div key={i} className="p-2 rounded bg-background/50 border border-border text-center">
                        <div className="text-[8px] font-mono text-muted-foreground mb-1">{t.period.replace("_", " ").toUpperCase()}</div>
                        <div className="space-y-0.5 text-[8px]">
                          <div className="flex justify-between"><span className="text-muted-foreground">Malware</span><span className="text-destructive font-bold">{t.malwareIncidents}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Ransom</span><span className="text-orange-400 font-bold">{t.ransomwareIncidents}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Exploits</span><span className="text-yellow-400 font-bold">{t.exploitDiscussions}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Breaches</span><span className="text-purple-400 font-bold">{t.dataBreaches}</span></div>
                        </div>
                        <div className={`text-[7px] font-mono mt-1 ${t.trend === "rising" ? "text-destructive" : t.trend === "declining" ? "text-green-400" : "text-muted-foreground"}`}>
                          {t.trend === "rising" ? "▲ RISING" : t.trend === "declining" ? "▼ DECLINING" : "— STABLE"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {torAnalysis && torAnalysis.suspiciousExitNodes.length > 0 && (
                <div className="p-3 rounded border border-orange-500/20 bg-orange-500/5">
                  <div className="text-[8px] font-mono text-orange-400 uppercase tracking-wider mb-2">Suspicious Tor Exit Nodes</div>
                  <div className="grid grid-cols-2 gap-1">
                    {torAnalysis.suspiciousExitNodes.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 text-[8px] p-1.5 rounded bg-background/30 border border-border">
                        <span>{n.flag}</span>
                        <span className="font-mono text-foreground">{n.ip}</span>
                        <span className={`text-[7px] px-1 rounded border font-mono ${n.risk === "high" ? "text-destructive border-destructive/30" : "text-yellow-400 border-yellow-500/30"}`}>{n.risk}</span>
                        <span className="text-muted-foreground truncate flex-1">{n.activity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {torAnalysis?.networkTrends && <p className="text-[9px] text-muted-foreground italic px-1">{torAnalysis.networkTrends}</p>}

              {dashboardStats && dashboardStats.largestBotnets.length > 0 && (
                <div className="p-3 rounded border border-primary/20 bg-primary/5">
                  <div className="text-[8px] font-mono text-primary uppercase tracking-wider mb-2 flex items-center gap-1"><Wifi className="h-3 w-3" /> Largest Botnets</div>
                  <div className="space-y-1">
                    {dashboardStats.largestBotnets.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-[9px]">
                        <span className="text-foreground font-bold">{b.name}</span>
                        <span className="text-muted-foreground font-mono">{b.primaryMalware}</span>
                        <span className="font-mono text-primary font-bold">{b.estimatedSize.toLocaleString()} nodes</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ INDICATORS ═══ */}
          {subTab === "indicators" && indicatorExtraction && (
            <div className="space-y-3">
              {indicatorExtraction.network.ips.length > 0 && (
                <div className="p-3 rounded border border-border bg-card/50">
                  <div className="text-[8px] font-mono text-destructive uppercase tracking-wider mb-2 flex items-center gap-1"><Globe className="h-3 w-3" /> Network IPs ({indicatorExtraction.network.ips.length})</div>
                  <div className="space-y-1">
                    {indicatorExtraction.network.ips.map((ip, i) => (
                      <div key={i} className="flex items-center gap-2 text-[8px] p-1 rounded bg-background/30 border border-border group">
                        <span>{ip.flag}</span>
                        <span className="font-mono text-foreground">{ip.value}</span>
                        <span className={`text-[7px] px-1 rounded border font-mono ${ip.reputation === "malicious" ? "text-destructive border-destructive/30 bg-destructive/10" : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"}`}>{ip.reputation}</span>
                        <span className="text-muted-foreground">{ip.activity}</span>
                        <span className="text-muted-foreground/60 font-mono ml-auto">{ip.asn}</span>
                        <button onClick={() => copyToClipboard(ip.value)} className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity">
                          {copiedValue === ip.value ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {indicatorExtraction.network.domains.length > 0 && (
                <div className="p-3 rounded border border-border bg-card/50">
                  <div className="text-[8px] font-mono text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Link2 className="h-3 w-3" /> Domains ({indicatorExtraction.network.domains.length})</div>
                  <div className="space-y-1">
                    {indicatorExtraction.network.domains.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-[8px] p-1 rounded bg-background/30 border border-border group">
                        <span className="font-mono text-foreground">{d.value}</span>
                        <span className={`text-[7px] px-1 rounded border font-mono ${d.reputation === "malicious" ? "text-destructive border-destructive/30" : "text-yellow-400 border-yellow-500/30"}`}>{d.reputation}</span>
                        <span className="text-muted-foreground">{d.activity}</span>
                        <button onClick={() => copyToClipboard(d.value)} className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity ml-auto">
                          {copiedValue === d.value ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {indicatorExtraction.vulnerability.cves.length > 0 && (
                <div className="p-3 rounded border border-destructive/20 bg-destructive/5">
                  <div className="text-[8px] font-mono text-destructive uppercase tracking-wider mb-2 flex items-center gap-1"><Bug className="h-3 w-3" /> CVEs ({indicatorExtraction.vulnerability.cves.length})</div>
                  <div className="space-y-1.5">
                    {indicatorExtraction.vulnerability.cves.map((c, i) => (
                      <div key={i} className="p-2 rounded bg-background/30 border border-border">
                        <div className="flex items-center gap-2 text-[9px] mb-1">
                          <a href={`https://nvd.nist.gov/vuln/detail/${c.id}`} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-destructive hover:underline flex items-center gap-1">{c.id} <ExternalLink className="h-2.5 w-2.5" /></a>
                          <span className="text-[8px] font-mono text-orange-400 font-bold">CVSS {c.cvss}</span>
                          {c.exploitAvailable && <span className="text-[7px] px-1 rounded bg-destructive/20 text-destructive border border-destructive/30 font-mono">EXPLOIT AVAIL</span>}
                          {c.discussedInForums && <span className="text-[7px] px-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-mono">FORUM BUZZ</span>}
                          {c.patchAvailable && <span className="text-[7px] px-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 font-mono">PATCH</span>}
                        </div>
                        <p className="text-[8px] text-muted-foreground">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {indicatorExtraction.malware.families.length > 0 && (
                <div className="p-3 rounded border border-purple-500/20 bg-purple-500/5">
                  <div className="text-[8px] font-mono text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Skull className="h-3 w-3" /> Malware Families ({indicatorExtraction.malware.families.length})</div>
                  <div className="space-y-1">
                    {indicatorExtraction.malware.families.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-[8px] p-1.5 rounded bg-background/30 border border-border">
                        <span className="font-bold text-foreground">{f.name}</span>
                        <span className="text-[7px] px-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-mono">{f.type}</span>
                        <span className="text-muted-foreground">C2: {f.activeC2Count}</span>
                        <span className="text-muted-foreground truncate flex-1">{f.recentActivity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {indicatorExtraction.malware.c2Servers.length > 0 && (
                <div className="p-3 rounded border border-border bg-card/50">
                  <div className="text-[8px] font-mono text-primary uppercase tracking-wider mb-2 flex items-center gap-1"><Server className="h-3 w-3" /> C2 Infrastructure ({indicatorExtraction.malware.c2Servers.length})</div>
                  <div className="space-y-1">
                    {indicatorExtraction.malware.c2Servers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-[8px] p-1 rounded bg-background/30 border border-border group">
                        <span>{s.flag}</span>
                        <span className="font-mono text-foreground">{s.ip}:{s.port}</span>
                        <span className="text-muted-foreground">{s.domain}</span>
                        <span className="text-[7px] px-1 rounded bg-destructive/10 text-destructive border border-destructive/20 font-mono">{s.malware}</span>
                        <span className={`text-[7px] font-mono ml-auto ${s.status === "active" ? "text-destructive" : "text-muted-foreground"}`}>● {s.status}</span>
                        <button onClick={() => copyToClipboard(s.ip)} className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity">
                          {copiedValue === s.ip ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {indicatorExtraction.financial.cryptoWallets.length > 0 && (
                <div className="p-3 rounded border border-yellow-500/20 bg-yellow-500/5">
                  <div className="text-[8px] font-mono text-yellow-400 uppercase tracking-wider mb-2">💰 Crypto Wallets Linked to Threat Actors</div>
                  <div className="space-y-1">
                    {indicatorExtraction.financial.cryptoWallets.map((w, i) => (
                      <div key={i} className="flex items-center gap-2 text-[8px] p-1 rounded bg-background/30 border border-border group">
                        <span className="font-mono text-foreground truncate max-w-[200px]">{w.address}</span>
                        <span className="text-[7px] px-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-mono">{w.currency}</span>
                        <span className="text-muted-foreground">{w.associatedGroup}</span>
                        <span className="font-mono text-yellow-400 ml-auto">{w.estimatedValue}</span>
                        <button onClick={() => copyToClipboard(w.address)} className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity">
                          {copiedValue === w.address ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {indicatorExtraction.actors.aptGroups.length > 0 && (
                <div className="p-3 rounded border border-destructive/20 bg-destructive/5">
                  <div className="text-[8px] font-mono text-destructive uppercase tracking-wider mb-2 flex items-center gap-1"><UserSearch className="h-3 w-3" /> Active APT Groups</div>
                  <div className="space-y-1">
                    {indicatorExtraction.actors.aptGroups.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 text-[9px] p-1.5 rounded bg-background/30 border border-border">
                        <span>{g.flag}</span>
                        <button onClick={() => onFetchDossier(g.name)} className="font-bold text-foreground hover:text-primary hover:underline transition-colors">{g.name}</button>
                        <span className="text-muted-foreground">{g.country}</span>
                        <span className="font-mono text-destructive ml-auto">{g.activeCampaigns} campaigns</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {subTab === "indicators" && !indicatorExtraction && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <EyeOff className="h-8 w-8 mb-2 opacity-40" />
              <span className="text-xs font-mono">No indicator extraction data available</span>
            </div>
          )}

          {/* ═══ FORUM INTEL ═══ */}
          {subTab === "forum" && (
            <div className="space-y-2">
              {forumAnalysis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Hash className="h-8 w-8 mb-2 opacity-40" />
                  <span className="text-xs font-mono">No forum intelligence available</span>
                </div>
              ) : forumAnalysis.map((post) => (
                <div key={post.id} className="p-3 rounded border border-border bg-card/50 hover:bg-card/80 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${SEVERITY_BG[post.riskLevel]}`}>{post.riskLevel}</span>
                    <span className="text-[7px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground font-mono">{post.category}</span>
                    <span className="text-[7px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono">{post.forum}</span>
                    <span className="text-[8px] font-mono text-muted-foreground">by <span className="text-foreground">{post.author}</span></span>
                    <span className="text-[7px] font-mono text-muted-foreground/60 ml-auto">{post.language} · {post.timestamp?.split("T")[0]}</span>
                  </div>
                  <h4 className="text-[11px] font-bold text-foreground mb-1">{post.title}</h4>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">{post.snippet}</p>
                  {post.relatedActors.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {post.relatedActors.map((actor, i) => (
                        <button key={i} onClick={() => onFetchDossier(actor)} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-colors">
                          <UserSearch className="h-2.5 w-2.5 inline mr-0.5" />{actor}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ═══ RANSOMWARE ═══ */}
          {subTab === "ransomware" && (
            <div className="space-y-2">
              {ransomwareLeaks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Lock className="h-8 w-8 mb-2 opacity-40" />
                  <span className="text-xs font-mono">No ransomware leak data available</span>
                </div>
              ) : (
                <div className="border border-border rounded overflow-hidden">
                  <div className="grid grid-cols-[1fr_1.2fr_0.7fr_0.7fr_0.6fr_0.5fr_0.7fr] gap-1 px-3 py-1.5 bg-card/70 border-b border-border text-[7px] font-mono text-muted-foreground uppercase tracking-wider">
                    <span>Group</span><span>Victim</span><span>Sector</span><span>Country</span><span>Data</span><span>Status</span><span>Deadline</span>
                  </div>
                  {ransomwareLeaks.map((leak) => {
                    const isUrgent = leak.status === "countdown";
                    return (
                      <div key={leak.id} className={`grid grid-cols-[1fr_1.2fr_0.7fr_0.7fr_0.6fr_0.5fr_0.7fr] gap-1 px-3 py-2 border-b border-border text-[9px] hover:bg-card/50 transition-colors ${isUrgent ? "bg-destructive/5" : ""}`}>
                        <span className="font-bold text-destructive truncate">{leak.group}</span>
                        <span className="text-foreground truncate">{leak.victim}</span>
                        <span className="text-muted-foreground truncate">{leak.sector}</span>
                        <span className="truncate">{leak.flag} {leak.country}</span>
                        <span className="font-mono text-muted-foreground">{leak.dataSize}</span>
                        <span className={`text-[7px] font-mono font-bold ${leak.status === "published" ? "text-destructive" : leak.status === "countdown" ? "text-orange-400" : "text-yellow-400"}`}>{leak.status.toUpperCase()}</span>
                        <span className="font-mono text-muted-foreground text-[8px]">{leak.deadline?.split("T")[0]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ CORRELATION ═══ */}
          {subTab === "correlation" && (
            <div className="space-y-3">
              {threatCorrelation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Network className="h-8 w-8 mb-2 opacity-40" />
                  <span className="text-xs font-mono">No threat correlation data available</span>
                </div>
              ) : threatCorrelation.map((corr) => (
                <div key={corr.id} className={`p-3 rounded border ${corr.earlyWarning ? "border-destructive/30 bg-destructive/5" : "border-border bg-card/50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {corr.earlyWarning && <span className="text-[7px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 font-mono font-bold animate-pulse">⚠ EARLY WARNING</span>}
                    <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${SEVERITY_BG[corr.severity]}`}>{corr.severity}</span>
                    <span className="text-[11px] font-bold text-foreground">{corr.title}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                    {corr.stages.map((stage, i) => (
                      <div key={i} className="flex items-center gap-1 flex-shrink-0">
                        <div className="p-1.5 rounded bg-background/50 border border-border">
                          <div className="text-[7px] font-mono text-primary font-bold mb-0.5">{stage.stage}</div>
                          <div className="text-[8px] text-muted-foreground max-w-[150px]">{stage.detail}</div>
                        </div>
                        {i < corr.stages.length - 1 && <ChevronRight className="h-3 w-3 text-primary flex-shrink-0" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[8px]">
                    <span className="text-muted-foreground">Sectors:</span>
                    {corr.affectedSectors.map((s, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground font-mono">{s}</span>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[9px] text-green-400 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> {corr.recommendation}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ ENTRIES ═══ */}
          {subTab === "entries" && (
            <div className="space-y-2">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <EyeOff className="h-8 w-8 mb-2 opacity-40" />
                  <span className="text-xs font-mono">No dark web entries available</span>
                </div>
              ) : entries.map((entry) => {
                const Icon = typeIcons[entry.type] || Eye;
                return (
                  <div key={entry.id} className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded ${typeBg[entry.type] || typeBg.onion}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${typeBg[entry.type] || typeBg.onion}`}>{typeLabels[entry.type] || entry.type}</span>
                          <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${SEVERITY_BG[entry.severity]}`}>{entry.severity}</span>
                          {entry.category && <span className="text-[7px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground font-mono">{entry.category}</span>}
                          <span className="text-[8px] font-mono text-muted-foreground ml-auto">{entry.timestamp?.split("T")[0]}</span>
                        </div>
                        <h4 className="text-[11px] font-bold text-foreground mb-1">{entry.title}</h4>
                        <p className="text-[9px] text-muted-foreground leading-relaxed">{entry.detail}</p>
                        {entry.torExitNodes && entry.torExitNodes.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {entry.torExitNodes.map((node, i) => (
                              <span key={i} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 truncate max-w-[200px]">⊕ {node}</span>
                            ))}
                          </div>
                        )}
                        {entry.hiddenServiceFingerprint && (
                          <div className="mt-1"><span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">🧅 {entry.hiddenServiceFingerprint}</span></div>
                        )}
                        {entry.indicators && entry.indicators.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {entry.indicators.map((ioc, i) => (
                              <span key={i} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground truncate max-w-[200px]">{ioc}</span>
                            ))}
                          </div>
                        )}
                        {entry.relatedActors && entry.relatedActors.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {entry.relatedActors.map((actor, i) => (
                              <button key={i} onClick={() => onFetchDossier(actor)} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer">
                                <UserSearch className="h-2.5 w-2.5 inline mr-0.5" />{actor}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Sparkline (last 24h attack frequency) ── */
function AttackSparkline({ threats }: { threats: CyberThreat[] }) {
  const bars = useMemo(() => {
    const now = Date.now();
    const buckets = new Array(24).fill(0);
    threats.forEach((t) => {
      const dt = new Date(t.date).getTime();
      const hoursAgo = Math.floor((now - dt) / 3600000);
      if (hoursAgo >= 0 && hoursAgo < 24) buckets[23 - hoursAgo]++;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((v) => v / max);
  }, [threats]);

  return (
    <svg viewBox="0 0 96 24" className="w-full h-6">
      {bars.map((v, i) => (
        <rect key={i} x={i * 4} y={24 - v * 22} width={3} height={v * 22} rx={0.5} fill="hsl(var(--primary))" opacity={0.6 + v * 0.4} />
      ))}
    </svg>
  );
}

/* ── Rich Threat Detail Card ── */
function ThreatDetailCard({ threat, onClose }: { threat: CyberThreat; onClose: () => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyIOC = (ioc: string, idx: number) => {
    navigator.clipboard.writeText(ioc);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="absolute inset-4 bg-card/98 backdrop-blur-lg border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden" style={{ zIndex: 10 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/50">
        <div className="flex items-center gap-3">
          <span className={`text-[9px] px-2 py-0.5 rounded border font-mono uppercase font-bold ${SEVERITY_BG[threat.severity]}`}>{threat.severity}</span>
          <span className="text-xs font-bold">{threat.attackerFlag} {threat.attacker}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-bold">{threat.targetFlag} {threat.target}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Attacker / Target profiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded border border-destructive/20 bg-destructive/5">
              <div className="text-[9px] font-mono text-destructive uppercase tracking-wider mb-1.5">Attacker Profile</div>
              <div className="text-sm font-bold">{threat.attackerFlag} {threat.attacker}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{threat.attackerCountry || "Unknown origin"}</div>
            </div>
            <div className="p-3 rounded border border-primary/20 bg-primary/5">
              <div className="text-[9px] font-mono text-primary uppercase tracking-wider mb-1.5">Target Profile</div>
              <div className="text-sm font-bold">{threat.targetFlag} {threat.target}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{threat.targetCountry || "Unknown target"}</div>
            </div>
          </div>

          {/* Attack details */}
          <div className="p-3 rounded border border-border bg-background/50">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Attack Vector</div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-[9px] px-2 py-0.5 rounded bg-muted/50 border border-border font-mono">{threat.type}</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-muted/50 border border-border font-mono">{threat.date}</span>
              {threat.cve && (
                <a href={`https://nvd.nist.gov/vuln/detail/${threat.cve}`} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] px-2 py-0.5 rounded bg-destructive/10 border border-destructive/20 font-mono text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1">
                  {threat.cve} <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-foreground leading-relaxed">{threat.details}</p>
          </div>

          {/* IOCs */}
          <div className="p-3 rounded border border-border bg-background/50">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Bug className="h-3 w-3" /> Indicators of Compromise
            </div>
            {threat.iocs && threat.iocs.length > 0 ? (
              <div className="space-y-1">
                {threat.iocs.map((ioc, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/30 border border-border group">
                    <span className="text-[9px] font-mono text-foreground truncate">{ioc}</span>
                    <button onClick={() => copyIOC(ioc, i)} className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {copiedIdx === i ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[9px] text-muted-foreground italic p-2 rounded bg-muted/20 border border-border">No IOCs available for this incident</div>
            )}
          </div>

          {/* Source */}
          <div className="p-3 rounded border border-border bg-background/50">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Source Intelligence</div>
            {threat.source ? (
              <a href={threat.source} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                {threat.sourceName || threat.source}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : (
              <div className="text-[9px] text-muted-foreground italic">No source link available — derived from OSINT analysis</div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Main Modal ── */
export const CyberImmunityModal = ({ onClose, geoAlerts = [] }: CyberImmunityModalProps) => {
  const { threats: cyberThreats, loading, error, lastUpdated, sources, refresh } = useCyberThreats();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [showIntelMap, setShowIntelMap] = useState(false);

  // Merge cyber threats with OSINT geo alerts converted to CyberThreat format
  const threats = useMemo(() => {
    const osintAsCyber: CyberThreat[] = geoAlerts.map(g => ({
      id: `osint-${g.id}`,
      date: g.timestamp,
      attacker: g.type,
      attackerCountry: g.region,
      attackerFlag: "🌐",
      target: g.region,
      targetCountry: g.region,
      targetFlag: "🎯",
      type: g.type,
      severity: (["critical", "high", "medium", "low"].includes(g.severity) ? g.severity : "medium") as CyberThreat["severity"],
      description: g.title,
      details: `OSINT alert: ${g.title}`,
      source: "OSINT",
      sourceName: "WarOS OSINT",
      verified: true,
    }));
    const merged = new Map(cyberThreats.map(t => [t.id, t]));
    osintAsCyber.forEach(t => merged.set(t.id, t));
    return Array.from(merged.values());
  }, [cyberThreats, geoAlerts]);
  const { darkWeb, dossier, fetchDarkWeb, fetchDossier, clearDossier } = useDarkWebIntel(threats);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("Jordan");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [centerView, setCenterView] = useState<"map" | "graph" | "darkweb" | "apt" | "timeline" | "interactive">("map");
  const [selectedThreat, setSelectedThreat] = useState<CyberThreat | null>(null);
  const [showDossier, setShowDossier] = useState(false);
  const { layers, toggleLayer } = useMapLayers();

  /* Auto-fetch dark web intel when switching to darkweb tab */
  useEffect(() => {
    if (centerView === "darkweb" && darkWeb.entries.length === 0 && !darkWeb.loading && threats.length > 0) {
      fetchDarkWeb();
    }
  }, [centerView, threats.length]);

  const handleFetchDossier = useCallback((actorName: string) => {
    setShowDossier(true);
    fetchDossier(actorName);
  }, [fetchDossier]);

  /* ── Timeline state ── */
  const [timelinePos, setTimelinePos] = useState(100); // 0-100, 100 = now (LIVE)
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const isLive = timelinePos >= 99;

  /* ── Timeline playback ── */
  useEffect(() => {
    if (playRef.current) { clearInterval(playRef.current); playRef.current = null; }
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setTimelinePos((prev) => {
          const next = prev + 0.5;
          if (next >= 100) { setIsPlaying(false); return 100; }
          return next;
        });
      }, SPEED_INTERVALS[speed] || 1500);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [isPlaying, speed]);

  /* auto-scroll feed when live */
  useEffect(() => {
    if (isLive && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [isLive, threats]);

  /* ── Timeline-based filtering ── */
  const timelineFiltered = useMemo(() => {
    if (isLive) return threats;
    // Map 0-100 to 24h window
    const now = Date.now();
    const windowMs = 28 * 24 * 60 * 60 * 1000;
    const cutoffTime = now - windowMs + (timelinePos / 100) * windowMs;
    return threats.filter((t) => {
      const tTime = new Date(t.date).getTime();
      // If date has no time, treat as within range if date <= cutoff date
      if (isNaN(tTime)) return true;
      return tTime <= cutoffTime;
    });
  }, [threats, timelinePos, isLive]);

  const filtered = useMemo(() => {
    let r = timelineFiltered;
    if (countryFilter !== "All") r = r.filter((t) => t.attackerCountry === countryFilter || t.targetCountry === countryFilter || t.attacker.includes(countryFilter) || t.target.includes(countryFilter));
    if (severityFilter !== "all") r = r.filter((t) => t.severity === severityFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => t.attacker.toLowerCase().includes(q) || t.target.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.details.toLowerCase().includes(q) || (t.cve && t.cve.toLowerCase().includes(q)) || (t.iocs && t.iocs.some((i) => i.toLowerCase().includes(q))));
    }
    return r;
  }, [timelineFiltered, countryFilter, severityFilter, search]);

  /* stats */
  const stats = useMemo(() => {
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    const attackerCounts: Record<string, number> = {};
    const targetCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const allIocs: string[] = [];

    filtered.forEach((t) => {
      severityCounts[t.severity]++;
      const a = t.attackerCountry || t.attacker;
      attackerCounts[a] = (attackerCounts[a] || 0) + 1;
      const tgt = t.targetCountry || t.target;
      targetCounts[tgt] = (targetCounts[tgt] || 0) + 1;
      typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
      if (t.iocs) allIocs.push(...t.iocs);
    });

    const topAttacker = Object.entries(attackerCounts).sort((a, b) => b[1] - a[1])[0];
    const topTarget = Object.entries(targetCounts).sort((a, b) => b[1] - a[1])[0];
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topActors = Object.entries(attackerCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

    let threatLevel: string;
    if (severityCounts.critical >= 5) threatLevel = "CRITICAL";
    else if (severityCounts.critical >= 2 || severityCounts.high >= 5) threatLevel = "HIGH";
    else if (severityCounts.high >= 2) threatLevel = "ELEVATED";
    else threatLevel = "MODERATE";

    const anomalies: string[] = [];
    if (severityCounts.critical >= 4) anomalies.push("⚠ Elevated critical volume detected");
    if (topAttacker && topAttacker[1] >= 4) anomalies.push(`⚠ Concentrated offensive from ${topAttacker[0]}`);
    if (topTarget && topTarget[1] >= 4) anomalies.push(`⚠ Sustained targeting of ${topTarget[0]}`);
    if (filtered.some((t) => t.cve)) anomalies.push("⚠ Zero-day exploitation detected");

    return { severityCounts, topAttacker, topTarget, topTypes, topActors, threatLevel, anomalies, allIocs: allIocs.slice(0, 10) };
  }, [filtered]);

  const threatLevelColor: Record<string, string> = {
    CRITICAL: "text-destructive", HIGH: "text-orange-400", ELEVATED: "text-yellow-400", MODERATE: "text-primary",
  };

  const handleSelect = useCallback((t: CyberThreat) => setSelectedThreat(t), []);

  /* ── Timeline time label ── */
  const timelineLabel = useMemo(() => {
    if (isLive) return "NOW";
    const now = Date.now();
    const windowMs = 28 * 24 * 60 * 60 * 1000;
    const ts = now - windowMs + (timelinePos / 100) * windowMs;
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [timelinePos, isLive]);

  const hoursAgoLabel = useMemo(() => {
    if (isLive) return "";
    const daysAgo = ((100 - timelinePos) / 100) * 28;
    if (daysAgo < 1) return `${(daysAgo * 24).toFixed(0)}h ago`;
    if (daysAgo < 7) return `${daysAgo.toFixed(1)}d ago`;
    return `${(daysAgo / 7).toFixed(1)}w ago`;
  }, [timelinePos, isLive]);

  return createPortal(
    <div className="fixed inset-0 bg-background text-foreground flex flex-col" style={{ zIndex: 99999 }}>
      {/* Scanline overlay */}
      <div className="cyber-scanline-overlay" />

      {/* ═══ HEADER — Gotham Command Bar ═══ */}
      <div className="cyber-command-bar">
        <div className="w-[3px] h-5 bg-primary mr-3 flex-shrink-0" />
        <ShieldAlert className="h-4 w-4 text-primary flex-shrink-0 mr-2" />
        <h1 className="text-[11px] font-mono font-bold tracking-[0.2em] flex-shrink-0 mr-3">
          CYBER <span className="text-primary">IMMUNITY</span>
        </h1>

        {/* Threat level badge */}
        <span className={`cyber-stat-chip ${threatLevelColor[stats.threatLevel]} px-2 py-0.5 border border-current/30 mr-3`}>
          ■ {stats.threatLevel}
        </span>

        {/* Severity counts inline */}
        <div className="flex items-center gap-2 mr-3 max-sm:hidden">
          <span className="cyber-stat-chip text-destructive">C:{stats.severityCounts.critical}</span>
          <span className="cyber-stat-chip text-orange-400">H:{stats.severityCounts.high}</span>
          <span className="cyber-stat-chip text-yellow-400">M:{stats.severityCounts.medium}</span>
          <span className="cyber-stat-chip text-primary">L:{stats.severityCounts.low}</span>
          <span className="text-[8px] font-mono text-muted-foreground/60">T:{filtered.length}</span>
        </div>

        {/* Live / Replay badge */}
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[8px] font-mono font-bold text-destructive px-2 py-0.5 border border-destructive/30 bg-destructive/10 mr-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />LIVE
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[8px] font-mono font-bold text-yellow-400 px-2 py-0.5 border border-yellow-500/30 bg-yellow-500/10 mr-auto">
            <Clock className="h-3 w-3" />REPLAY · {hoursAgoLabel}
          </span>
        )}

        {/* Right controls */}
        {lastUpdated && <span className="text-[8px] font-mono text-muted-foreground/50 mr-2 max-sm:hidden">{new Date(lastUpdated).toLocaleTimeString()}</span>}
        <button onClick={refresh} className="p-1 border border-border/50 hover:border-primary/50 hover:text-primary transition-colors mr-1" title="Refresh">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button onClick={onClose} className="p-1 border border-border/50 hover:border-destructive/50 hover:text-destructive transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* ═══ TAB BAR — Gotham Segmented Control ═══ */}
      <div className="flex items-center border-b border-border bg-card/20 overflow-x-auto scrollbar-hide">
        {([
          { key: "map" as const, label: "MAP", icon: Globe },
          { key: "graph" as const, label: "GRAPH", icon: Network },
          { key: "darkweb" as const, label: "DARK WEB", icon: Skull },
          { key: "apt" as const, label: "APT INTEL", icon: Shield },
          { key: "timeline" as const, label: "TIMELINE", icon: Clock },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setCenterView(tab.key)}
              className={`cyber-tab flex items-center gap-1.5 flex-shrink-0 ${centerView === tab.key ? "cyber-tab-active" : ""}`}
            >
              <Icon className="h-3 w-3" />{tab.label}
            </button>
          );
        })}
        {/* INTEL MAP — opens as popup */}
        <button
          onClick={() => setShowIntelMap(true)}
          className={`cyber-tab flex items-center gap-1.5 flex-shrink-0 ${showIntelMap ? "cyber-tab-active" : ""}`}
        >
          <Globe className="h-3 w-3" />INTEL MAP
        </button>
        {/* Separator + source count */}
        <div className="ml-auto flex items-center gap-2 px-3 flex-shrink-0">
          {sources.length > 0 && <span className="text-[7px] font-mono text-primary/50">{sources.length} FEEDS</span>}
        </div>
      </div>

      {/* ═══ ALERT BANNERS ═══ */}
      <CyberAlertBanner threats={filtered} />

      {/* ═══ MAIN 3-COLUMN LAYOUT ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        <div className={`border-r border-border bg-card/20 cyber-grid-bg flex flex-col transition-all duration-200 max-md:hidden ${leftCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[260px]"}`}>
          {!leftCollapsed && (
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {/* IOC Scanner Section */}
                <div>
                  <div className="cyber-section-header">IOC SCANNER</div>
                  <IOCSearchSection search={search} setSearch={setSearch} />
                </div>

                {/* Country Filter — Compact Dropdown */}
                <div>
                  <div className="cyber-section-header">COUNTRY FILTER</div>
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="w-full h-7 text-[9px] font-mono bg-background/60 border border-border text-foreground px-2 focus:border-primary/50 focus:outline-none transition-colors"
                  >
                    {COUNTRY_FILTERS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Severity Filter — Dot Toggles */}
                <div>
                  <div className="cyber-section-header">SEVERITY</div>
                  <div className="flex items-center gap-2">
                    {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSeverityFilter(s)}
                        className={`flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 border transition-all ${severityFilter === s ? "border-primary/50 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      >
                        {s !== "all" && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: SEVERITY_COLORS[s] }} />}
                        {s === "all" ? "ALL" : s.charAt(0).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intelligence Summary */}
                <div>
                  <div className="cyber-section-header">INTEL SUMMARY</div>
                  <div className="space-y-1.5 text-[9px]">
                    {stats.topAttacker && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Top Attacker</span>
                        <span className="text-destructive font-bold font-mono">{stats.topAttacker[0]} ({stats.topAttacker[1]})</span>
                      </div>
                    )}
                    {stats.topTarget && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Top Target</span>
                        <span className="text-primary font-bold font-mono">{stats.topTarget[0]} ({stats.topTarget[1]})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attack Types */}
                <div>
                  <div className="cyber-section-header">ATTACK TYPES</div>
                  <div className="space-y-1">
                    {stats.topTypes.map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2 text-[8px]">
                        <div className="flex-1 bg-border/20 h-1">
                          <div className="bg-primary/50 h-full" style={{ width: `${Math.min((count / (stats.topTypes[0]?.[1] || 1)) * 100, 100)}%` }} />
                        </div>
                        <span className="text-muted-foreground w-20 truncate font-mono">{type}</span>
                        <span className="text-foreground font-mono w-4 text-right">{count}</span>
                      </div>
                    ))}
                    {stats.topTypes.length === 0 && <span className="text-[8px] text-muted-foreground/50 italic font-mono">No data</span>}
                  </div>
                </div>

                {/* Active Sources */}
                <div>
                  <div className="cyber-section-header">ACTIVE SOURCES</div>
                  <div className="space-y-0.5">
                    {(sources.length > 0 ? sources : EXPECTED_SOURCES).map((s) => (
                      <div key={s} className="flex items-center gap-2 text-[8px] font-mono">
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${sources.includes(s) ? "bg-green-500 animate-pulse" : "bg-muted-foreground/20"}`} />
                        <span className={sources.includes(s) ? "text-muted-foreground" : "text-muted-foreground/30"}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="hidden md:flex w-4 items-center justify-center border-r border-border bg-card/30 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary flex-shrink-0"
          title={leftCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${leftCollapsed ? "" : "rotate-180"}`} />
        </button>

        {/* ── CENTER PANEL ── */}
        <div className="flex-1 flex flex-col min-w-0 relative cyber-inset-glow">
          <div className="flex-1 min-h-0 relative">
            {loading && threats.length === 0 ? (
              <CyberLoadingScreen sources={sources} />
            ) : threats.length === 0 && !loading ? (
              <div className="flex items-center justify-center h-full bg-background/95">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="relative mx-auto w-20 h-20">
                    <div className="absolute inset-0 rounded-full border border-primary/15" />
                    <div className="absolute inset-2 flex items-center justify-center">
                      <img src={warosLogo} alt="WAROS" className="w-14 h-14 object-contain opacity-60" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono font-bold tracking-[0.12em]">AWAITING INTELLIGENCE DATA</p>
                  <p className="text-[9px] text-muted-foreground/60">OSINT feeds initializing — data will populate automatically</p>
                  <button onClick={refresh} className="mt-2 text-[9px] px-3 py-1 border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-mono">
                    RETRY FETCH
                  </button>
                </div>
              </div>
            ) : centerView === "map" ? (
              <div className="relative w-full h-full">
                <ThreatMap threats={filterByLayers(filtered, layers)} onSelect={handleSelect} selectedId={selectedThreat?.id} />
                <MapLayersPanel layers={layers} onToggle={toggleLayer} />
              </div>
            ) : centerView === "graph" ? (
              <RelationshipGraph threats={filtered} />
            ) : centerView === "apt" ? (
              <APTIntelPanel />
            ) : centerView === "timeline" ? (
              <IncidentTimeline threats={filtered} onSelect={handleSelect} />
            ) : (
              <EnhancedDarkWebMonitor
                entries={darkWeb.entries}
                torAnalysis={darkWeb.torAnalysis}
                indicatorExtraction={darkWeb.indicatorExtraction}
                threatCorrelation={darkWeb.threatCorrelation}
                forumAnalysis={darkWeb.forumAnalysis}
                ransomwareLeaks={darkWeb.ransomwareLeaks}
                alertRules={darkWeb.alertRules}
                dashboardStats={darkWeb.dashboardStats}
                temporalTrends={darkWeb.temporalTrends}
                loading={darkWeb.loading}
                onFetchDossier={handleFetchDossier}
              />
            )}
          </div>

          {/* Threat detail overlay */}
          {selectedThreat && (
            <ThreatDetailCard threat={selectedThreat} onClose={() => setSelectedThreat(null)} />
          )}

          {/* Actor Dossier overlay */}
          {showDossier && (
            <ThreatActorDossierPanel
              dossier={dossier.dossier}
              loading={dossier.loading}
              error={dossier.error}
              onClose={() => { setShowDossier(false); clearDossier(); }}
            />
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="w-[250px] border-l border-border bg-card/20 cyber-grid-bg flex flex-col max-lg:hidden">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Threat Level Gauge */}
              <div className="cyber-panel p-3 text-center">
                <div className="text-[7px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-1">AI THREAT ASSESSMENT</div>
                <div className={`text-xl font-black font-mono ${threatLevelColor[stats.threatLevel]}`}>{stats.threatLevel}</div>
                <div className="text-[8px] text-muted-foreground/60 mt-0.5">Global Cyber Threat Level</div>
              </div>

              {/* Severity Breakdown */}
              <div className="cyber-panel p-3">
                <div className="cyber-section-header">SEVERITY BREAKDOWN</div>
                <div className="space-y-1.5">
                  {(["critical", "high", "medium", "low"] as const).map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[8px]">
                      <span className="capitalize w-11 text-muted-foreground font-mono">{s}</span>
                      <div className="flex-1 bg-border/15 h-1.5">
                        <div className="h-full transition-all" style={{ width: `${Math.min((stats.severityCounts[s] / Math.max(filtered.length, 1)) * 100, 100)}%`, background: SEVERITY_COLORS[s] }} />
                      </div>
                      <span className="font-mono w-4 text-right text-foreground">{stats.severityCounts[s]}</span>
                    </div>
                  ))}
                </div>
                {/* Inline sparkline */}
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="text-[7px] font-mono text-muted-foreground/50 uppercase mb-1">4-WEEK FREQUENCY</div>
                  <AttackSparkline threats={threats} />
                </div>
              </div>

              {/* Anomaly Detection */}
              <div className={`${stats.anomalies.length > 0 ? "cyber-panel-destructive" : "cyber-panel"} p-3`}>
                <div className="cyber-section-header">
                  <AlertTriangle className="h-3 w-3" /> ANOMALY DETECTION
                </div>
                <div className="space-y-1">
                  {stats.anomalies.length > 0 ? stats.anomalies.map((a, i) => (
                    <div key={i} className="text-[8px] font-mono p-1.5 bg-destructive/10 text-destructive border border-destructive/20">{a}</div>
                  )) : (
                    <div className="text-[8px] font-mono p-1.5 bg-primary/10 text-primary border border-primary/20">✓ No anomalies detected</div>
                  )}
                </div>
              </div>

              {/* Top Threat Actors */}
              <div className="cyber-panel p-3">
                <div className="cyber-section-header">TOP ACTORS</div>
                <div className="space-y-1">
                  {stats.topActors.map(([actor, count], i) => (
                    <div key={actor} className="flex items-center gap-1.5 text-[8px]">
                      <span className="text-muted-foreground/50 font-mono w-3">{i + 1}.</span>
                      <span className="flex-1 truncate font-mono">{actor}</span>
                      <div className="w-12 bg-border/15 h-1">
                        <div className="bg-destructive/50 h-full" style={{ width: `${(count / (stats.topActors[0]?.[1] || 1)) * 100}%` }} />
                      </div>
                      <span className="font-mono w-3 text-right text-destructive">{count}</span>
                    </div>
                  ))}
                  {stats.topActors.length === 0 && <span className="text-[8px] text-muted-foreground/40 italic font-mono">No data</span>}
                </div>
              </div>

              {/* Most Targeted */}
              <div className="cyber-panel p-3">
                <div className="cyber-section-header">MOST TARGETED</div>
                <div className="space-y-1">
                  {Object.entries(
                    filtered.reduce((acc: Record<string, number>, t) => {
                      const tgt = t.targetCountry || t.target;
                      acc[tgt] = (acc[tgt] || 0) + 1;
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([country, count], i) => (
                    <div key={country} className="flex items-center gap-1.5 text-[8px]">
                      <span className="text-muted-foreground/50 font-mono w-3">{i + 1}.</span>
                      <span className="flex-1 truncate font-mono">{country}</span>
                      <span className="font-mono w-3 text-right text-primary">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent IOCs */}
              <div className="cyber-panel p-3">
                <div className="cyber-section-header">
                  <Bug className="h-3 w-3" /> RECENT IOCs
                </div>
                <div className="space-y-0.5">
                  {stats.allIocs.length > 0 ? stats.allIocs.map((ioc, i) => (
                    <div key={i} className="text-[7px] font-mono text-muted-foreground/70 truncate">{ioc}</div>
                  )) : (
                    <span className="text-[8px] text-muted-foreground/40 italic font-mono">No IOCs available</span>
                  )}
                </div>
              </div>

              {/* Active Threat Categories */}
              <div className="cyber-panel p-3">
                <div className="cyber-section-header">THREAT CATEGORIES</div>
                <div className="space-y-1">
                  {["Ransomware", "Wiper Malware", "DDoS Attack", "Espionage", "Zero-Day Exploit", "Phishing Campaign"].map(cat => {
                    const count = filtered.filter(t => t.type.includes(cat) || t.description.toLowerCase().includes(cat.toLowerCase())).length;
                    if (count === 0) return null;
                    return (
                      <div key={cat} className="flex items-center justify-between text-[8px] font-mono">
                        <span className="text-muted-foreground">{cat}</span>
                        <span className="text-foreground font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ═══ BOTTOM ZONE — Consolidated ═══ */}
      {/* Histogram + Timeline combined strip */}
      {(() => {
        const now = new Date();
        const msPerDay = 86400000;
        const buckets = Array.from({ length: 28 }, (_, i) => {
          const dayStart = new Date(now.getTime() - (27 - i) * msPerDay);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart.getTime() + msPerDay);
          const dayThreats = threats.filter(t => {
            const d = new Date(t.date);
            return d >= dayStart && d < dayEnd;
          });
          const peakSev = dayThreats.reduce((peak, t) => {
            const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
            return (order[t.severity] || 0) > (order[peak] || 0) ? t.severity : peak;
          }, "low");
          return { date: dayStart.toISOString().split("T")[0], count: dayThreats.length, peakSev };
        });
        const maxCount = Math.max(...buckets.map(b => b.count), 1);
        const sevColor: Record<string, string> = { critical: "hsl(0 90% 55%)", high: "hsl(25 95% 55%)", medium: "hsl(45 95% 55%)", low: "hsl(190 80% 55%)" };

        const criticalThreats = threats.filter(t => t.severity === "critical");

        return (
          <div className="border-t border-border bg-card/30">
            {/* Histogram + slider row */}
            <div className="flex items-end gap-0 px-3 pt-1">
              {/* Mini histogram */}
              <div className="flex-1 relative h-[28px] flex items-end gap-[1px]">
                {buckets.map((b, i) => (
                  <div key={i} className="flex-1 relative group cursor-pointer" style={{ height: "100%" }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 transition-all hover:opacity-80"
                      style={{
                        height: b.count > 0 ? `${Math.max((b.count / maxCount) * 100, 8)}%` : "2px",
                        background: b.count > 0 ? sevColor[b.peakSev] || sevColor.low : "hsl(var(--border))",
                        opacity: b.count > 0 ? 0.7 : 0.2,
                      }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-popover border border-border text-[7px] font-mono text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                      {b.date} · {b.count}
                    </div>
                  </div>
                ))}
                {/* Position indicator */}
                <div className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_6px_hsl(var(--primary))] pointer-events-none z-10" style={{ left: `${timelinePos}%` }} />
              </div>
            </div>

            {/* Timeline controls */}
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => setTimelinePos(Math.max(0, timelinePos - 4.17))} className="p-0.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <SkipBack className="h-3 w-3" />
                </button>
                <button onClick={() => { setIsPlaying(!isPlaying); if (timelinePos >= 100) setTimelinePos(0); }} className="p-0.5 hover:bg-secondary transition-colors text-primary">
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </button>
                <button onClick={() => setTimelinePos(Math.min(100, timelinePos + 4.17))} className="p-0.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                  <SkipForward className="h-3 w-3" />
                </button>
                <div className="hidden sm:flex items-center gap-0.5 ml-1 border-l border-border/30 pl-1">
                  {SPEEDS.map((s) => (
                    <button key={s} onClick={() => setSpeed(s)} className={`px-1 py-0.5 text-[7px] font-mono font-bold transition-all ${speed === s ? "bg-primary/15 text-primary" : "text-muted-foreground/40 hover:text-foreground"}`}>
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-[8px] font-mono text-muted-foreground/40 hidden sm:block">-4w</span>
              <div className="flex-1 min-w-0">
                <input
                  type="range" min={0} max={100} step={0.5} value={timelinePos}
                  onChange={(e) => { setTimelinePos(parseFloat(e.target.value)); setIsPlaying(false); }}
                  className="w-full h-0.5 bg-secondary appearance-none cursor-pointer accent-primary"
                />
              </div>
              <span className={`text-[9px] font-mono font-bold w-12 text-right flex-shrink-0 ${isLive ? "text-destructive" : "text-primary"}`}>
                {timelineLabel}
              </span>
              <button onClick={() => { setTimelinePos(100); setIsPlaying(false); }} className={`text-[7px] px-1.5 py-0.5 border font-mono font-bold transition-all flex-shrink-0 ${isLive ? "bg-destructive/15 text-destructive border-destructive/30" : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"}`}>
                LIVE
              </button>
            </div>

            {/* Critical Ultra — thin alert bar */}
            {criticalThreats.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 border-t border-destructive/15 bg-destructive/5">
                <Skull className="h-3 w-3 text-destructive flex-shrink-0" />
                <span className="text-[7px] font-mono font-bold text-destructive uppercase tracking-wider">CRITICAL</span>
                <span className="text-[7px] font-mono px-1 bg-destructive/15 text-destructive border border-destructive/20">{criticalThreats.length}</span>
                <div className="flex gap-2 overflow-x-auto flex-1 scrollbar-hide">
                  {criticalThreats.slice(0, 4).map(ct => (
                    <button
                      key={ct.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 border border-destructive/20 bg-destructive/5 text-[7px] font-mono flex-shrink-0 hover:bg-destructive/10 transition-colors"
                      onClick={() => setSelectedThreat(ct)}
                    >
                      <span className="h-1 w-1 rounded-full bg-destructive animate-pulse" />
                      <span>{ct.attackerFlag} {ct.attacker}</span>
                      <ChevronRight className="h-2 w-2 text-destructive/50" />
                      <span>{ct.targetFlag} {ct.target}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ COLLAPSIBLE EVENT FEED ═══ */}
      <div className={`border-t border-border bg-card/20 flex flex-col transition-all duration-200 ${feedCollapsed ? "h-[28px]" : "h-[100px]"}`}>
        <button
          onClick={() => setFeedCollapsed(!feedCollapsed)}
          className="flex items-center justify-between px-3 py-1 border-b border-border/50 hover:bg-card/30 transition-colors flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Radio className={`h-3 w-3 ${isLive ? "text-destructive animate-pulse" : "text-yellow-400"}`} />
            <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">
              {isLive ? "Live Feed" : `Replay · ${hoursAgoLabel}`}
            </span>
            <span className="text-[7px] font-mono text-muted-foreground/50">{filtered.length} events</span>
          </div>
          <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${feedCollapsed ? "rotate-90" : "-rotate-90"}`} />
        </button>
        {!feedCollapsed && (
          <ScrollArea className="flex-1">
            <div className="px-2 py-1 space-y-0.5" ref={feedRef}>
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 px-2 py-0.5 hover:bg-muted/20 cursor-pointer transition-colors text-[8px] font-mono group ${selectedThreat?.id === t.id ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                  onClick={() => setSelectedThreat(t)}
                >
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: SEVERITY_COLORS[t.severity] }} />
                  <span className="text-muted-foreground/50 w-14 flex-shrink-0">{t.date}</span>
                  <span className="flex-shrink-0">{t.attackerFlag}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleFetchDossier(t.attacker); }} className="font-bold truncate w-24 flex-shrink-0 text-left hover:text-primary hover:underline transition-colors cursor-pointer">{t.attacker}</button>
                  <ChevronRight className="h-2 w-2 text-muted-foreground/30 flex-shrink-0" />
                  <span className="flex-shrink-0">{t.targetFlag}</span>
                  <span className="truncate w-20 flex-shrink-0">{t.target}</span>
                  <span className="text-muted-foreground/50 truncate flex-1">{t.description}</span>
                  <span className={`px-1 py-0.5 border text-[6px] uppercase flex-shrink-0 ${SEVERITY_BG[t.severity]}`}>{t.severity}</span>
                  {t.verified && <span className="text-[6px] text-green-500">✓</span>}
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="text-center text-[9px] text-muted-foreground/50 py-3 font-mono">
                  {threats.length > 0 ? "No threats match current filters" : "Awaiting intelligence data"}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {error && (
        <div className="absolute bottom-[160px] left-1/2 -translate-x-1/2 bg-destructive/20 text-destructive text-[8px] px-3 py-1 border border-destructive/30 font-mono z-50">
          {error}
        </div>
      )}

      {/* ═══ INTEL MAP POPUP ═══ */}
      {showIntelMap && createPortal(
        <div className="fixed inset-0 flex flex-col bg-background text-foreground" style={{ zIndex: 100000 }}>
          {/* Popup header */}
          <div className="cyber-command-bar flex-shrink-0">
            <div className="w-[3px] h-5 bg-primary mr-3 flex-shrink-0" />
            <Globe className="h-4 w-4 text-primary mr-2" />
            <h2 className="text-[11px] font-mono font-bold tracking-[0.2em] mr-auto">
              INTERACTIVE <span className="text-primary">INTEL MAP</span>
            </h2>
            <button
              onClick={() => setShowIntelMap(false)}
              className="p-1 border border-border/50 hover:border-destructive/50 hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Map content */}
          <div className="flex-1 min-h-0 relative cyber-inset-glow">
            <InteractiveMapSummary />
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
};
