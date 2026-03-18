import { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X, Search, UserSearch, Globe, CheckCircle, XCircle,
  AlertTriangle, Loader2, ExternalLink, Copy, Check,
  Filter, BarChart3, Eye, FileText, Share2, Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

type ResultStatus = "found" | "not_found" | "error" | "checking";

interface PlatformResult {
  platform: string;
  url: string;
  status: ResultStatus;
  category: string;
  http_status?: number;
  response_time_ms?: number;
}

interface RelationshipGroup {
  category: string;
  platforms: string[];
}

interface ScanData {
  username: string;
  total_checked: number;
  found_count: number;
  not_found_count: number;
  error_count: number;
  avg_response_time_ms: number;
  results: PlatformResult[];
  relationships: RelationshipGroup[];
  categories_active: string[];
  scan_time: string;
}

interface SocialAnalyzerModalProps {
  onClose: () => void;
}

const CATEGORIES = ["all", "social", "coding", "professional", "gaming", "blog", "design", "music", "photo", "art", "tech", "security", "personal"];

const CAT_COLORS: Record<string, string> = {
  social: "#3b82f6",
  coding: "#22c55e",
  professional: "#f59e0b",
  gaming: "#a855f7",
  blog: "#ec4899",
  design: "#06b6d4",
  music: "#f97316",
  photo: "#14b8a6",
  art: "#e11d48",
  tech: "#6366f1",
  security: "#ef4444",
  personal: "#8b5cf6",
};

type ViewTab = "grid" | "graph" | "report";

export const SocialAnalyzerModal = ({ onClose }: SocialAnalyzerModalProps) => {
  const [username, setUsername] = useState("");
  const [results, setResults] = useState<PlatformResult[]>([]);
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<"all" | "found" | "not_found" | "error">("all");
  const [catFilter, setCatFilter] = useState("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("grid");
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("sa-history") || "[]"); } catch { return []; }
  });

  const runScan = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed || scanning) return;

    setScanning(true);
    setProgress(10);
    setScanData(null);
    setResults([]);
    setFilter("all");
    setViewTab("grid");

    // Save history
    const hist = [trimmed, ...searchHistory.filter(h => h !== trimmed)].slice(0, 10);
    setSearchHistory(hist);
    localStorage.setItem("sa-history", JSON.stringify(hist));

    // Animate progress while waiting
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 8, 90));
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke("social-analyzer", {
        body: { username: trimmed },
      });

      clearInterval(progressInterval);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setScanData(data as ScanData);
      setResults(data.results || []);
      setProgress(100);
    } catch (e) {
      console.error("Social analyzer scan failed:", e);
      clearInterval(progressInterval);
    } finally {
      setScanning(false);
      setProgress(100);
    }
  }, [username, scanning, searchHistory]);

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  const filtered = results.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (catFilter !== "all" && r.category !== catFilter) return false;
    return true;
  });

  const foundCount = results.filter(r => r.status === "found").length;
  const notFoundCount = results.filter(r => r.status === "not_found").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: 100002, background: "hsl(var(--background))" }}
    >
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-card/90 backdrop-blur-sm flex-shrink-0">
        <UserSearch className="h-5 w-5 text-primary" />
        <div className="flex flex-col">
          <span className="text-xs font-bold font-mono tracking-wider text-foreground">
            SOCIAL ANALYZER
          </span>
          <span className="text-[8px] text-muted-foreground font-mono">
            OSINT USERNAME ENUMERATION • SERVER-SIDE ANALYSIS
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-[8px] font-mono border-primary/30 text-primary">
            v3.0 • qeeqbox
          </Badge>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ═══ SEARCH BAR ═══ */}
      <div className="px-4 py-3 border-b border-border/30 bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runScan()}
              placeholder="Enter username to analyze..."
              className="pl-10 font-mono text-sm bg-background/80 border-border/50"
            />
          </div>
          <button
            onClick={runScan}
            disabled={!username.trim() || scanning}
            className="px-4 py-2 text-xs font-mono font-bold bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            {scanning ? "SCANNING…" : "SCAN"}
          </button>
        </div>

        {searchHistory.length > 0 && !scanning && results.length === 0 && (
          <div className="flex items-center gap-1.5 mt-2 max-w-2xl mx-auto flex-wrap">
            <span className="text-[8px] text-muted-foreground font-mono mr-1">RECENT:</span>
            {searchHistory.map(h => (
              <button
                key={h}
                onClick={() => setUsername(h)}
                className="text-[9px] font-mono px-2 py-0.5 bg-accent/50 text-accent-foreground rounded hover:bg-accent transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ PROGRESS ═══ */}
      {scanning && (
        <div className="px-4 py-1.5 border-b border-border/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[9px] font-mono text-muted-foreground">
              SERVER-SIDE SCANNING {Math.round(progress)}%
            </span>
            <Progress value={progress} className="flex-1 h-1.5" />
          </div>
        </div>
      )}

      {/* ═══ VIEW TABS + STATS ═══ */}
      {results.length > 0 && (
        <div className="px-4 py-2 border-b border-border/30 flex items-center gap-2 flex-shrink-0 bg-card/30 flex-wrap">
          {/* View tabs */}
          <div className="flex items-center gap-0.5 border border-border/40 rounded p-0.5 mr-3">
            {([
              { key: "grid" as ViewTab, icon: BarChart3, label: "GRID" },
              { key: "graph" as ViewTab, icon: Share2, label: "GRAPH" },
              { key: "report" as ViewTab, icon: FileText, label: "REPORT" },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setViewTab(t.key)}
                className={`flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded transition-colors ${
                  viewTab === t.key ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>

          {/* Status filters */}
          <button onClick={() => setFilter("all")} className={`flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${filter === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            ALL ({results.length})
          </button>
          <button onClick={() => setFilter("found")} className={`flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${filter === "found" ? "bg-green-500/20 text-green-400" : "text-muted-foreground hover:text-foreground"}`}>
            <CheckCircle className="h-3 w-3" /> FOUND ({foundCount})
          </button>
          <button onClick={() => setFilter("not_found")} className={`flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${filter === "not_found" ? "bg-muted text-muted-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <XCircle className="h-3 w-3" /> NOT FOUND ({notFoundCount})
          </button>
          <button onClick={() => setFilter("error")} className={`flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${filter === "error" ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:text-foreground"}`}>
            <AlertTriangle className="h-3 w-3" /> ERROR ({errorCount})
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="text-[9px] font-mono bg-background border border-border/50 rounded px-1.5 py-0.5 text-foreground"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <ScrollArea className="flex-1">
        {results.length === 0 && !scanning ? (
          <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
            <div className="relative">
              <Globe className="h-16 w-16 text-primary/20" />
              <UserSearch className="h-8 w-8 text-primary absolute bottom-0 right-0" />
            </div>
            <div className="text-center">
              <p className="text-sm font-mono font-semibold text-foreground">Social Media OSINT Scanner</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1 max-w-sm">
                Enter a username to scan across 45+ platforms server-side.
                Returns relationship graphs and detailed intelligence reports.
              </p>
            </div>
          </div>
        ) : viewTab === "grid" ? (
          <ResultsGrid filtered={filtered} copied={copied} onCopy={copyUrl} />
        ) : viewTab === "graph" ? (
          <RelationshipGraph scanData={scanData} />
        ) : (
          <IntelReport scanData={scanData} />
        )}
      </ScrollArea>

      {/* ═══ FOOTER ═══ */}
      <div className="px-4 py-1.5 border-t border-border/30 bg-card/50 flex items-center gap-3 flex-shrink-0">
        <span className="text-[7px] text-muted-foreground font-mono">
          SOCIAL ANALYZER • OSINT TOOL • BASED ON QEEQBOX/SOCIAL-ANALYZER
        </span>
        {scanData && (
          <span className="text-[7px] text-muted-foreground font-mono ml-auto">
            {scanData.found_count} FOUND / {scanData.total_checked} CHECKED • AVG {scanData.avg_response_time_ms}ms
          </span>
        )}
      </div>
    </div>,
    document.body
  );
};

/* ════════════════════════════════════════════════════════════
   RESULTS GRID SUB-COMPONENT
   ════════════════════════════════════════════════════════════ */
function ResultsGrid({ filtered, copied, onCopy }: { filtered: PlatformResult[]; copied: string | null; onCopy: (u: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 p-4">
      {filtered.map(r => (
        <div
          key={r.platform}
          className={`border rounded-md p-3 flex flex-col gap-2 transition-all ${
            r.status === "found"
              ? "border-green-500/40 bg-green-500/5"
              : r.status === "not_found"
              ? "border-border/20 bg-card/30 opacity-60"
              : r.status === "error"
              ? "border-destructive/30 bg-destructive/5"
              : "border-primary/20 bg-primary/5 animate-pulse"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-foreground truncate">{r.platform}</span>
            {r.status === "found" && <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />}
            {r.status === "not_found" && <XCircle className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            {r.status === "error" && <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[7px] font-mono w-fit border-border/30">{r.category}</Badge>
            {r.response_time_ms != null && (
              <span className="text-[7px] font-mono text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2 w-2" />{r.response_time_ms}ms
              </span>
            )}
          </div>
          {r.status === "found" && (
            <div className="flex items-center gap-1 mt-auto">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-primary hover:underline font-mono flex items-center gap-0.5">
                <ExternalLink className="h-2.5 w-2.5" /> OPEN
              </a>
              <button onClick={() => onCopy(r.url)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                {copied === r.url ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RELATIONSHIP GRAPH (SVG)
   ════════════════════════════════════════════════════════════ */
function RelationshipGraph({ scanData }: { scanData: ScanData | null }) {
  const svgContent = useMemo(() => {
    if (!scanData || !scanData.relationships?.length) return null;

    const cx = 400, cy = 300;
    const groups = scanData.relationships.filter(g => g.platforms.length > 0);
    const userRadius = 32;
    const catRadius = 160;
    const platformRadius = 50;

    const nodes: { x: number; y: number; label: string; color: string; r: number; type: "user" | "cat" | "platform"; url?: string }[] = [];
    const edges: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];

    // Center node = username
    nodes.push({ x: cx, y: cy, label: scanData.username, color: "hsl(var(--primary))", r: userRadius, type: "user" });

    groups.forEach((g, gi) => {
      const angle = (2 * Math.PI * gi) / groups.length - Math.PI / 2;
      const gx = cx + Math.cos(angle) * catRadius;
      const gy = cy + Math.sin(angle) * catRadius;
      const color = CAT_COLORS[g.category] || "#888";

      nodes.push({ x: gx, y: gy, label: g.category.toUpperCase(), color, r: 22, type: "cat" });
      edges.push({ x1: cx, y1: cy, x2: gx, y2: gy, color });

      // Platform child nodes
      g.platforms.forEach((p, pi) => {
        const subAngle = angle + ((pi - (g.platforms.length - 1) / 2) * 0.35);
        const pr = catRadius + platformRadius + 20;
        const px = cx + Math.cos(subAngle) * pr;
        const py = cy + Math.sin(subAngle) * pr;
        nodes.push({ x: px, y: py, label: p, color, r: 14, type: "platform" });
        edges.push({ x1: gx, y1: gy, x2: px, y2: py, color });
      });
    });

    return { nodes, edges };
  }, [scanData]);

  if (!scanData) return <div className="flex items-center justify-center h-64 text-muted-foreground text-xs font-mono">Run a scan first</div>;
  if (!svgContent) return <div className="flex items-center justify-center h-64 text-muted-foreground text-xs font-mono">No profiles found to graph</div>;

  return (
    <div className="p-4 flex flex-col items-center">
      <div className="text-[10px] font-mono text-muted-foreground mb-2 flex items-center gap-1.5">
        <Share2 className="h-3 w-3" /> RELATIONSHIP GRAPH — "{scanData.username}" across {scanData.found_count} platforms
      </div>
      <svg viewBox="0 0 800 600" className="w-full max-w-4xl" style={{ maxHeight: "65vh" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {svgContent.edges.map((e, i) => (
          <line key={`e${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} strokeWidth={1.5} strokeOpacity={0.4} />
        ))}

        {/* Nodes */}
        {svgContent.nodes.map((n, i) => (
          <g key={`n${i}`}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.type === "user" ? n.color : "transparent"}
              stroke={n.color} strokeWidth={n.type === "user" ? 3 : 1.5}
              opacity={n.type === "platform" ? 0.7 : 1}
              filter={n.type === "user" ? "url(#glow)" : undefined}
            />
            {n.type === "user" ? (
              <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">
                {n.label.length > 8 ? n.label.slice(0, 7) + "…" : n.label}
              </text>
            ) : (
              <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" fill={n.color} fontSize={n.type === "cat" ? "9" : "7"} fontFamily="monospace" fontWeight={n.type === "cat" ? "bold" : "normal"}>
                {n.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {scanData.relationships.filter(g => g.platforms.length > 0).map(g => (
          <div key={g.category} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[g.category] || "#888" }} />
            <span className="text-[8px] font-mono text-muted-foreground">
              {g.category.toUpperCase()} ({g.platforms.length})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   INTELLIGENCE REPORT
   ════════════════════════════════════════════════════════════ */
function IntelReport({ scanData }: { scanData: ScanData | null }) {
  if (!scanData) return <div className="flex items-center justify-center h-64 text-muted-foreground text-xs font-mono">Run a scan first</div>;

  const found = scanData.results.filter(r => r.status === "found");
  const hitRate = ((scanData.found_count / scanData.total_checked) * 100).toFixed(1);
  const categories = scanData.relationships.filter(g => g.platforms.length > 0);
  const digitalFootprint = scanData.found_count >= 15 ? "HIGH" : scanData.found_count >= 8 ? "MODERATE" : scanData.found_count >= 3 ? "LOW" : "MINIMAL";
  const riskColor = scanData.found_count >= 15 ? "text-destructive" : scanData.found_count >= 8 ? "text-yellow-400" : "text-green-400";

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      {/* Report Header */}
      <div className="border border-border/40 rounded-lg p-4 bg-card/50">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-bold text-foreground">OSINT INTELLIGENCE REPORT</span>
          <span className="text-[8px] font-mono text-muted-foreground ml-auto">{new Date(scanData.scan_time).toLocaleString()}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-border/30 rounded p-2 text-center">
            <div className="text-lg font-mono font-bold text-primary">{scanData.found_count}</div>
            <div className="text-[8px] font-mono text-muted-foreground">PROFILES FOUND</div>
          </div>
          <div className="border border-border/30 rounded p-2 text-center">
            <div className="text-lg font-mono font-bold text-foreground">{scanData.total_checked}</div>
            <div className="text-[8px] font-mono text-muted-foreground">PLATFORMS CHECKED</div>
          </div>
          <div className="border border-border/30 rounded p-2 text-center">
            <div className="text-lg font-mono font-bold text-foreground">{hitRate}%</div>
            <div className="text-[8px] font-mono text-muted-foreground">HIT RATE</div>
          </div>
          <div className="border border-border/30 rounded p-2 text-center">
            <div className={`text-lg font-mono font-bold ${riskColor}`}>{digitalFootprint}</div>
            <div className="text-[8px] font-mono text-muted-foreground">DIGITAL FOOTPRINT</div>
          </div>
        </div>
      </div>

      {/* Subject Summary */}
      <div className="border border-border/40 rounded-lg p-4 bg-card/50">
        <h3 className="text-[10px] font-mono font-bold text-foreground mb-2">■ SUBJECT SUMMARY</h3>
        <div className="space-y-1.5 text-[10px] font-mono text-muted-foreground">
          <p><span className="text-foreground font-semibold">Username:</span> {scanData.username}</p>
          <p><span className="text-foreground font-semibold">Active categories:</span> {categories.map(c => c.category).join(", ") || "None"}</p>
          <p><span className="text-foreground font-semibold">Primary presence:</span> {categories.sort((a, b) => b.platforms.length - a.platforms.length)[0]?.category || "N/A"} ({categories[0]?.platforms.length || 0} platforms)</p>
          <p><span className="text-foreground font-semibold">Avg response time:</span> {scanData.avg_response_time_ms}ms</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="border border-border/40 rounded-lg p-4 bg-card/50">
        <h3 className="text-[10px] font-mono font-bold text-foreground mb-3">■ CATEGORY BREAKDOWN</h3>
        <div className="space-y-2">
          {categories.map(g => (
            <div key={g.category} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[g.category] || "#888" }} />
              <span className="text-[9px] font-mono text-foreground w-24 flex-shrink-0">{g.category.toUpperCase()}</span>
              <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(g.platforms.length / scanData.found_count) * 100}%`, background: CAT_COLORS[g.category] || "#888" }} />
              </div>
              <span className="text-[8px] font-mono text-muted-foreground w-8 text-right">{g.platforms.length}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Found Profiles Table */}
      <div className="border border-border/40 rounded-lg p-4 bg-card/50">
        <h3 className="text-[10px] font-mono font-bold text-foreground mb-3">■ DETECTED PROFILES ({found.length})</h3>
        <div className="space-y-1">
          {found.map(r => (
            <div key={r.platform} className="flex items-center gap-2 py-1 border-b border-border/10 last:border-b-0">
              <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />
              <span className="text-[9px] font-mono text-foreground w-28 flex-shrink-0">{r.platform}</span>
              <Badge variant="outline" className="text-[7px] font-mono border-border/30 flex-shrink-0" style={{ borderColor: CAT_COLORS[r.category] + "60", color: CAT_COLORS[r.category] }}>
                {r.category}
              </Badge>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-primary hover:underline font-mono truncate ml-auto flex items-center gap-0.5">
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" /> {r.url}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="border border-border/40 rounded-lg p-4 bg-card/50">
        <h3 className="text-[10px] font-mono font-bold text-foreground mb-2">■ EXPOSURE ASSESSMENT</h3>
        <div className="text-[10px] font-mono text-muted-foreground space-y-1.5">
          <p>The username "<span className="text-foreground">{scanData.username}</span>" was detected on <span className="text-foreground font-bold">{scanData.found_count}</span> out of {scanData.total_checked} platforms scanned.</p>
          <p>Digital footprint level: <span className={`font-bold ${riskColor}`}>{digitalFootprint}</span></p>
          {scanData.found_count >= 10 && <p className="text-yellow-400">⚠ High cross-platform visibility — username reuse detected across multiple categories. Consider operational security review.</p>}
          {categories.length >= 4 && <p className="text-yellow-400">⚠ Presence spans {categories.length} distinct categories — broad digital footprint increases correlation risk.</p>}
          {scanData.found_count < 3 && <p className="text-green-400">✓ Limited online footprint — low exposure risk for this username.</p>}
        </div>
      </div>
    </div>
  );
}
