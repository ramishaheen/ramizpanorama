import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, RefreshCw, Shield, ShieldAlert, Search, Filter,
  Activity, Globe, AlertTriangle, Zap, Eye, Network,
  TrendingUp, Target, Bug, Radio, ChevronRight, ExternalLink
} from "lucide-react";
import { useCyberThreats, type CyberThreat } from "@/hooks/useCyberThreats";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface CyberImmunityModalProps {
  onClose: () => void;
}

/* ── country coordinates for the SVG threat map ── */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Iran: [53, 32], Israel: [35, 31], USA: [-98, 38], "United States": [-98, 38],
  Russia: [60, 55], China: [104, 35], "North Korea": [127, 40],
  "Saudi Arabia": [45, 24], UAE: [54, 24], Qatar: [51, 25],
  Turkey: [35, 39], Syria: [38, 35], Lebanon: [35.8, 33.9],
  Iraq: [44, 33], Yemen: [48, 15], Pakistan: [69, 30],
  India: [78, 21], Ukraine: [32, 49], Germany: [10, 51],
  UK: [-2, 54], France: [2, 47], "Multiple": [10, 20],
  Unknown: [0, 10],
};

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

const COUNTRY_FILTERS = ["All", "Israel", "Iran", "USA", "Russia", "China", "Saudi Arabia", "UAE", "Turkey", "Syria"];

function lonLatToSvg(lon: number, lat: number, w: number, h: number): [number, number] {
  return [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
}

function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.15 - 20;
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
}

/* ── Threat Map (SVG equirectangular) ── */
function ThreatMap({ threats, onSelect }: { threats: CyberThreat[]; onSelect: (t: CyberThreat) => void }) {
  const W = 900, H = 450;

  const nodes = useMemo(() => {
    const map = new Map<string, { country: string; count: number; severity: string; x: number; y: number }>();
    threats.forEach((t) => {
      for (const c of [t.attackerCountry || t.attacker, t.targetCountry || t.target]) {
        const key = c || "Unknown";
        const coords = COUNTRY_COORDS[key] || [Math.random() * 60 - 30, Math.random() * 40];
        const [x, y] = lonLatToSvg(coords[0], coords[1], W, H);
        const existing = map.get(key);
        if (existing) {
          existing.count++;
          if (t.severity === "critical" || (t.severity === "high" && existing.severity !== "critical")) existing.severity = t.severity;
        } else {
          map.set(key, { country: key, count: 1, severity: t.severity, x, y });
        }
      }
    });
    return Array.from(map.values());
  }, [threats]);

  const arcs = useMemo(() => {
    return threats.slice(0, 30).map((t, i) => {
      const ac = t.attackerCountry || t.attacker || "Unknown";
      const tc = t.targetCountry || t.target || "Unknown";
      const a = COUNTRY_COORDS[ac] || [0, 10];
      const b = COUNTRY_COORDS[tc] || [10, 20];
      const [x1, y1] = lonLatToSvg(a[0], a[1], W, H);
      const [x2, y2] = lonLatToSvg(b[0], b[1], W, H);
      return { id: t.id, d: arcPath(x1, y1, x2, y2), color: SEVERITY_COLORS[t.severity] || SEVERITY_COLORS.medium, threat: t, i };
    });
  }, [threats]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ background: "hsl(var(--background))" }}>
      {/* grid */}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * (H / 6)} x2={W} y2={i * (H / 6)} stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.3} />
      ))}
      {Array.from({ length: 13 }, (_, i) => (
        <line key={`v${i}`} x1={i * (W / 12)} y1={0} x2={i * (W / 12)} y2={H} stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.3} />
      ))}
      {/* arcs */}
      {arcs.map((a) => (
        <g key={a.id} onClick={() => onSelect(a.threat)} className="cursor-pointer">
          <path d={a.d} fill="none" stroke={a.color} strokeWidth={1.5} opacity={0.5} />
          <path d={a.d} fill="none" stroke={a.color} strokeWidth={1.5} strokeDasharray="6,4" opacity={0.9}>
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur={`${1.5 + a.i * 0.1}s`} repeatCount="indefinite" />
          </path>
        </g>
      ))}
      {/* nodes */}
      {nodes.map((n) => (
        <g key={n.country}>
          <circle cx={n.x} cy={n.y} r={Math.min(4 + n.count * 1.5, 18)} fill={SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.medium} opacity={0.25}>
            <animate attributeName="r" values={`${Math.min(4 + n.count * 1.5, 18)};${Math.min(6 + n.count * 1.5, 22)};${Math.min(4 + n.count * 1.5, 18)}`} dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={n.x} cy={n.y} r={3} fill={SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.medium} />
          <text x={n.x} y={n.y - 8} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={8} opacity={0.7}>{n.country}</text>
        </g>
      ))}
    </svg>
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
      {/* legend */}
      {[{ label: "Threat Actor", color: typeColors.actor, y: 20 }, { label: "Target", color: typeColors.target, y: 34 }, { label: "Attack Type", color: typeColors.type, y: 48 }].map((l) => (
        <g key={l.label}>
          <circle cx={16} cy={l.y} r={5} fill={l.color} opacity={0.7} />
          <text x={26} y={l.y + 3} fill="hsl(var(--foreground))" fontSize={9} opacity={0.7}>{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Main Modal ── */
export const CyberImmunityModal = ({ onClose }: CyberImmunityModalProps) => {
  const { threats, loading, error, lastUpdated, sources, refresh } = useCyberThreats();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [centerView, setCenterView] = useState<"map" | "graph">("map");
  const [selectedThreat, setSelectedThreat] = useState<CyberThreat | null>(null);

  const filtered = useMemo(() => {
    let r = threats;
    if (countryFilter !== "All") r = r.filter((t) => t.attackerCountry === countryFilter || t.targetCountry === countryFilter || t.attacker.includes(countryFilter) || t.target.includes(countryFilter));
    if (severityFilter !== "all") r = r.filter((t) => t.severity === severityFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => t.attacker.toLowerCase().includes(q) || t.target.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.details.toLowerCase().includes(q) || (t.cve && t.cve.toLowerCase().includes(q)) || (t.iocs && t.iocs.some((i) => i.toLowerCase().includes(q))));
    }
    return r;
  }, [threats, countryFilter, severityFilter, search]);

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

  return createPortal(
    <div className="fixed inset-0 bg-background text-foreground flex flex-col" style={{ zIndex: 99999 }}>
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-bold tracking-wider">CYBER <span className="text-primary">IMMUNITY</span></h1>
          <span className="text-[9px] font-mono text-muted-foreground">OSINT OPERATIONS CENTER</span>
          {sources.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {sources.map((s) => (
                <span key={s} className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">{s}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="text-[9px] font-mono text-muted-foreground">Updated: {new Date(lastUpdated).toLocaleTimeString()}</span>}
          <button onClick={refresh} className="p-1.5 rounded border border-border hover:border-primary/50 hover:text-primary transition-colors" title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded border border-border hover:border-destructive/50 hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── THREAT LEVEL BAR ── */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-card/50 text-[10px] font-mono">
        <div className="flex items-center gap-4">
          <span className={`font-bold ${threatLevelColor[stats.threatLevel]}`}>■ THREAT LEVEL: {stats.threatLevel}</span>
          <span className="text-destructive">CRITICAL: {stats.severityCounts.critical}</span>
          <span className="text-orange-400">HIGH: {stats.severityCounts.high}</span>
          <span className="text-yellow-400">MEDIUM: {stats.severityCounts.medium}</span>
          <span className="text-primary">LOW: {stats.severityCounts.low}</span>
          <span className="text-muted-foreground">TOTAL: {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCenterView("map")} className={`px-2 py-0.5 rounded text-[9px] border transition-colors ${centerView === "map" ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <Globe className="h-3 w-3 inline mr-1" />MAP
          </button>
          <button onClick={() => setCenterView("graph")} className={`px-2 py-0.5 rounded text-[9px] border transition-colors ${centerView === "graph" ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <Network className="h-3 w-3 inline mr-1" />GRAPH
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL */}
        <div className="w-[272px] border-r border-border bg-card/30 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* IOC search */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">IOC / Threat Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="IP, CVE, domain, actor..." className="h-7 pl-7 text-[10px] bg-background/50 border-border" />
                </div>
              </div>

              {/* Country filter */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Country Filter</label>
                <div className="flex flex-wrap gap-1">
                  {COUNTRY_FILTERS.map((c) => (
                    <button key={c} onClick={() => setCountryFilter(c)} className={`text-[8px] px-1.5 py-0.5 rounded border font-mono transition-colors ${countryFilter === c ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity filter */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Severity</label>
                <div className="flex gap-1">
                  {["all", "critical", "high", "medium", "low"].map((s) => (
                    <button key={s} onClick={() => setSeverityFilter(s)} className={`text-[8px] px-1.5 py-0.5 rounded border font-mono transition-colors capitalize ${severityFilter === s ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Intelligence Summary</label>
                <div className="space-y-1 text-[10px]">
                  {stats.topAttacker && <div className="flex justify-between"><span className="text-muted-foreground">Top Attacker</span><span className="text-destructive font-bold">{stats.topAttacker[0]} ({stats.topAttacker[1]})</span></div>}
                  {stats.topTarget && <div className="flex justify-between"><span className="text-muted-foreground">Top Target</span><span className="text-primary font-bold">{stats.topTarget[0]} ({stats.topTarget[1]})</span></div>}
                </div>
              </div>

              {/* Attack Types */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Attack Types</label>
                <div className="space-y-1">
                  {stats.topTypes.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2 text-[9px]">
                      <div className="flex-1 bg-border/30 rounded-full h-1.5">
                        <div className="bg-primary/60 h-full rounded-full" style={{ width: `${Math.min((count / (stats.topTypes[0]?.[1] || 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-muted-foreground w-20 truncate">{type}</span>
                      <span className="text-foreground font-mono w-4 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Active Sources</label>
                <div className="space-y-1">
                  {sources.map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[9px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-muted-foreground">{s}</span>
                    </div>
                  ))}
                  {sources.length === 0 && <span className="text-[9px] text-muted-foreground">Loading sources...</span>}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* CENTER PANEL */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 min-h-0">
            {loading && threats.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <ShieldAlert className="h-8 w-8 text-primary animate-pulse mx-auto" />
                  <p className="text-[11px] text-muted-foreground font-mono">INITIALIZING THREAT INTELLIGENCE...</p>
                </div>
              </div>
            ) : centerView === "map" ? (
              <ThreatMap threats={filtered} onSelect={handleSelect} />
            ) : (
              <RelationshipGraph threats={filtered} />
            )}
          </div>

          {/* Detail overlay */}
          {selectedThreat && (
            <div className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border p-3 max-h-[40%] overflow-auto">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${SEVERITY_BG[selectedThreat.severity]}`}>{selectedThreat.severity}</span>
                  <span className="text-[11px] font-bold">{selectedThreat.attackerFlag} {selectedThreat.attacker} → {selectedThreat.targetFlag} {selectedThreat.target}</span>
                </div>
                <button onClick={() => setSelectedThreat(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              <p className="text-[10px] text-muted-foreground mb-1">{selectedThreat.type} · {selectedThreat.date}</p>
              <p className="text-[10px] mb-2">{selectedThreat.details}</p>
              <div className="flex gap-3 text-[9px]">
                {selectedThreat.cve && <span className="text-primary font-mono">{selectedThreat.cve}</span>}
                {selectedThreat.source && (
                  <a href={selectedThreat.source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    {selectedThreat.sourceName || "Source"} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
              {selectedThreat.iocs && selectedThreat.iocs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedThreat.iocs.map((ioc, i) => (
                    <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono border border-border">{ioc}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[272px] border-l border-border bg-card/30 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* AI Threat Score */}
              <div className="text-center p-3 rounded border border-border bg-background/50">
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block mb-2">AI Threat Assessment</label>
                <div className={`text-2xl font-black ${threatLevelColor[stats.threatLevel]}`}>{stats.threatLevel}</div>
                <div className="text-[9px] text-muted-foreground mt-1">Global Cyber Threat Level</div>
              </div>

              {/* Severity Breakdown */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Severity Breakdown</label>
                <div className="space-y-1">
                  {(["critical", "high", "medium", "low"] as const).map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[9px]">
                      <span className="capitalize w-12 text-muted-foreground">{s}</span>
                      <div className="flex-1 bg-border/30 rounded-full h-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((stats.severityCounts[s] / Math.max(filtered.length, 1)) * 100, 100)}%`, background: SEVERITY_COLORS[s] }} />
                      </div>
                      <span className="font-mono w-4 text-right">{stats.severityCounts[s]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anomaly Detection */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Anomaly Detection
                </label>
                <div className="space-y-1">
                  {stats.anomalies.length > 0 ? stats.anomalies.map((a, i) => (
                    <div key={i} className="text-[9px] p-1.5 rounded bg-destructive/10 text-destructive border border-destructive/20">{a}</div>
                  )) : (
                    <div className="text-[9px] p-1.5 rounded bg-primary/10 text-primary border border-primary/20">✓ No anomalies detected</div>
                  )}
                </div>
              </div>

              {/* Top Actors */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">Top Threat Actors</label>
                <div className="space-y-1">
                  {stats.topActors.map(([actor, count], i) => (
                    <div key={actor} className="flex items-center gap-2 text-[9px]">
                      <span className="text-muted-foreground w-3">{i + 1}.</span>
                      <span className="flex-1 truncate">{actor}</span>
                      <div className="w-16 bg-border/30 rounded-full h-1.5">
                        <div className="bg-destructive/60 h-full rounded-full" style={{ width: `${(count / (stats.topActors[0]?.[1] || 1)) * 100}%` }} />
                      </div>
                      <span className="font-mono w-4 text-right text-destructive">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent IOCs */}
              <div>
                <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Bug className="h-3 w-3" /> Recent IOCs
                </label>
                <div className="space-y-0.5">
                  {stats.allIocs.length > 0 ? stats.allIocs.map((ioc, i) => (
                    <div key={i} className="text-[8px] font-mono text-muted-foreground truncate">{ioc}</div>
                  )) : (
                    <span className="text-[9px] text-muted-foreground">No IOCs available</span>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ── BOTTOM PANEL — Event Feed ── */}
      <div className="h-[176px] border-t border-border bg-card/30 flex flex-col">
        <div className="flex items-center justify-between px-3 py-1 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-destructive animate-pulse" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Live Operations Feed</span>
          </div>
          <span className="text-[9px] font-mono text-muted-foreground">{filtered.length} events</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer transition-colors text-[9px] group"
                onClick={() => setSelectedThreat(t)}
              >
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: SEVERITY_COLORS[t.severity] }} />
                <span className="text-muted-foreground font-mono w-16 flex-shrink-0">{t.date}</span>
                <span className="flex-shrink-0">{t.attackerFlag}</span>
                <span className="font-bold truncate w-28 flex-shrink-0">{t.attacker}</span>
                <ChevronRight className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-shrink-0">{t.targetFlag}</span>
                <span className="truncate w-24 flex-shrink-0">{t.target}</span>
                <span className="text-muted-foreground truncate flex-1">{t.description}</span>
                <span className={`px-1 py-0.5 rounded border text-[7px] uppercase font-mono flex-shrink-0 ${SEVERITY_BG[t.severity]}`}>{t.severity}</span>
              </div>
            ))}
            {filtered.length === 0 && !loading && (
              <div className="text-center text-[10px] text-muted-foreground py-4">No threats match current filters</div>
            )}
          </div>
        </ScrollArea>
      </div>

      {error && (
        <div className="absolute bottom-[180px] left-1/2 -translate-x-1/2 bg-destructive/20 text-destructive text-[9px] px-3 py-1 rounded border border-destructive/30 font-mono">
          {error}
        </div>
      )}
    </div>,
    document.body
  );
};
