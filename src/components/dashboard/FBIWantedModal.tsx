import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Search, RefreshCw, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight,
  Skull, Shield, Eye, Globe, Radio, CheckCircle, XCircle, HelpCircle, Plus, Trash2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/* ═══════════════════════════════════════════
   FBI Most Wanted types & logic
   ═══════════════════════════════════════════ */

interface FBIWantedPerson {
  uid: string;
  title: string;
  description: string | null;
  images: { original: string; thumb: string; large: string; caption: string | null }[];
  subjects: string[];
  aliases: string[] | null;
  race: string | null;
  sex: string | null;
  nationality: string | null;
  dates_of_birth_used: string[] | null;
  place_of_birth: string | null;
  hair: string | null;
  eyes: string | null;
  height_min: number | null;
  height_max: number | null;
  weight_min: string | null;
  weight_max: string | null;
  reward_text: string | null;
  reward_min: number | null;
  reward_max: number | null;
  warning_message: string | null;
  details: string | null;
  caution: string | null;
  url: string;
  field_offices: string[] | null;
  status: string | null;
  poster_classification: string | null;
  person_classification: string | null;
}

/* ═══════════════════════════════════════════
   FBI Watchdog types
   ═══════════════════════════════════════════ */

interface WatchdogDomainResult {
  domain: string;
  status: "clean" | "seized" | "suspicious" | "unreachable" | "error";
  checks: {
    dns: { status: string; records?: string[]; seizureSignal?: boolean };
    http: { status: string; statusCode?: number; seizureKeywords?: string[]; redirectTarget?: string; serverHeader?: string };
  };
  lastChecked: string;
  seizureEvidence?: string[];
}

const DEFAULT_WATCHLIST = [
  "breachforums.st", "leakbase.io", "raidforums.com",
  "genesis.market", "hydramarket.com", "alphabaymarket.com",
  "silkroad.com", "darkode.cc", "jokersstash.com",
  "trygoal.com", "xss.is", "exploit.in",
];

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  clean: { icon: CheckCircle, color: "text-green-500", label: "CLEAN" },
  seized: { icon: XCircle, color: "text-destructive", label: "SEIZED" },
  suspicious: { icon: AlertTriangle, color: "text-yellow-500", label: "SUSPICIOUS" },
  unreachable: { icon: HelpCircle, color: "text-muted-foreground", label: "UNREACHABLE" },
  error: { icon: HelpCircle, color: "text-muted-foreground", label: "ERROR" },
};

/* ═══════════════════════════════════════════
   FBI Watchdog Panel Component
   ═══════════════════════════════════════════ */

function WatchdogPanel() {
  const [domains, setDomains] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("fbi-watchdog-domains");
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch { return DEFAULT_WATCHLIST; }
  });
  const [results, setResults] = useState<WatchdogDomainResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<WatchdogDomainResult | null>(null);

  useEffect(() => {
    localStorage.setItem("fbi-watchdog-domains", JSON.stringify(domains));
  }, [domains]);

  const runScan = useCallback(async () => {
    if (domains.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fbi-watchdog`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ domains }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults(json.results || []);
      setLastChecked(json.checkedAt);
    } catch (e: any) {
      console.error("Watchdog scan failed:", e);
    } finally {
      setLoading(false);
    }
  }, [domains]);

  // Auto-scan on mount
  useEffect(() => { runScan(); }, []);

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (d && !domains.includes(d)) {
      setDomains(prev => [...prev, d]);
      setNewDomain("");
    }
  };

  const removeDomain = (d: string) => {
    setDomains(prev => prev.filter(x => x !== d));
    setResults(prev => prev.filter(r => r.domain !== d));
  };

  const seized = results.filter(r => r.status === "seized").length;
  const suspicious = results.filter(r => r.status === "suspicious").length;

  return (
    <div className="border-t border-border bg-card/30">
      {/* Watchdog Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
        <Eye className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-foreground">
          FBI <span className="text-primary">WATCHDOG</span>
        </span>
        <Badge variant="outline" className="text-[7px] font-mono border-primary/30 text-primary">
          v3.0 · {domains.length} DOMAINS
        </Badge>
        {seized > 0 && (
          <Badge className="text-[7px] font-mono bg-destructive/20 text-destructive border border-destructive/30">
            {seized} SEIZED
          </Badge>
        )}
        {suspicious > 0 && (
          <Badge className="text-[7px] font-mono bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">
            {suspicious} SUSPICIOUS
          </Badge>
        )}
        <div className="flex-1" />
        {lastChecked && (
          <span className="text-[7px] font-mono text-muted-foreground/50">
            ↻ {new Date(lastChecked).toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={runScan}
          disabled={loading}
          className="p-1 border border-border/50 hover:border-primary/50 hover:text-primary transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Add domain row */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/50">
        <Globe className="h-3 w-3 text-muted-foreground" />
        <Input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDomain()}
          placeholder="Add domain to monitor…"
          className="h-6 text-[9px] font-mono bg-background/50 border-border flex-1"
        />
        <button
          onClick={addDomain}
          className="p-1 border border-border/50 hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Results */}
      <div className="flex overflow-hidden" style={{ maxHeight: "240px" }}>
        <ScrollArea className={`${selectedResult ? "w-1/2" : "w-full"} transition-all`}>
          <div className="divide-y divide-border/30">
            {(results.length > 0 ? results : domains.map(d => ({ domain: d, status: "clean" as const, checks: { dns: { status: "pending" }, http: { status: "pending" } }, lastChecked: "", }))).map((r) => {
              const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.error;
              const Icon = cfg.icon;
              return (
                <button
                  key={r.domain}
                  onClick={() => setSelectedResult(r as WatchdogDomainResult)}
                  className={`w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-secondary/30 transition-colors ${
                    selectedResult?.domain === r.domain ? "bg-secondary/40" : ""
                  }`}
                >
                  {loading && !r.lastChecked ? (
                    <RefreshCw className="h-3 w-3 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <Icon className={`h-3 w-3 ${cfg.color} flex-shrink-0`} />
                  )}
                  <span className="text-[9px] font-mono text-foreground flex-1 truncate">{r.domain}</span>
                  <span className={`text-[7px] font-mono font-bold ${cfg.color}`}>{cfg.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDomain(r.domain); }}
                    className="p-0.5 opacity-30 hover:opacity-100 hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Detail panel */}
        {selectedResult && (
          <div className="w-1/2 border-l border-border bg-background/50">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
              <Radio className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-mono font-bold tracking-wider">SCAN REPORT</span>
              <div className="flex-1" />
              <button onClick={() => setSelectedResult(null)} className="p-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-3 space-y-3">
                <div>
                  <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Domain</p>
                  <p className="text-[11px] font-mono font-bold text-foreground">{selectedResult.domain}</p>
                </div>

                <div>
                  <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Status</p>
                  <Badge className={`text-[8px] font-mono ${
                    selectedResult.status === "seized" ? "bg-destructive/20 text-destructive border-destructive/30" :
                    selectedResult.status === "suspicious" ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" :
                    selectedResult.status === "clean" ? "bg-green-500/20 text-green-500 border-green-500/30" :
                    "bg-muted/20 text-muted-foreground border-muted/30"
                  }`}>
                    {selectedResult.status.toUpperCase()}
                  </Badge>
                </div>

                {/* DNS */}
                <div>
                  <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">DNS Check</p>
                  <p className="text-[9px] font-mono text-foreground/80">
                    Status: {selectedResult.checks.dns.status}
                    {selectedResult.checks.dns.seizureSignal && (
                      <span className="text-destructive ml-2">⚠ SEIZURE SIGNAL</span>
                    )}
                  </p>
                  {selectedResult.checks.dns.records && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedResult.checks.dns.records.map((r, i) => (
                        <span key={i} className="text-[7px] font-mono px-1 py-0.5 bg-muted/30 border border-border rounded">{r}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* HTTP */}
                <div>
                  <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">HTTP Check</p>
                  <p className="text-[9px] font-mono text-foreground/80">
                    Status: {selectedResult.checks.http.status}
                    {selectedResult.checks.http.statusCode && ` (${selectedResult.checks.http.statusCode})`}
                  </p>
                  {selectedResult.checks.http.serverHeader && (
                    <p className="text-[8px] font-mono text-muted-foreground">Server: {selectedResult.checks.http.serverHeader}</p>
                  )}
                  {selectedResult.checks.http.redirectTarget && (
                    <p className="text-[8px] font-mono text-yellow-500">→ {selectedResult.checks.http.redirectTarget}</p>
                  )}
                </div>

                {/* Seizure Evidence */}
                {selectedResult.seizureEvidence && selectedResult.seizureEvidence.length > 0 && (
                  <div className="p-2 border border-destructive/30 bg-destructive/5 rounded">
                    <p className="text-[8px] font-mono font-bold text-destructive uppercase tracking-wider mb-1">Seizure Evidence</p>
                    {selectedResult.seizureEvidence.map((e, i) => (
                      <p key={i} className="text-[8px] font-mono text-destructive/80">• {e}</p>
                    ))}
                  </div>
                )}

                {selectedResult.lastChecked && (
                  <p className="text-[7px] font-mono text-muted-foreground/50">
                    Checked: {new Date(selectedResult.lastChecked).toLocaleString()}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="flex items-center gap-2 px-4 py-1 border-t border-border/30">
        <span className="text-[7px] font-mono text-muted-foreground/40">
          Powered by FBI Watchdog v3.0 · DarkWebInformer
        </span>
        <a
          href="https://github.com/DarkWebInformer/FBI_Watchdog"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[7px] font-mono text-primary/50 hover:text-primary flex items-center gap-1"
        >
          <ExternalLink className="h-2 w-2" /> GitHub
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Modal
   ═══════════════════════════════════════════ */

interface FBIWantedModalProps {
  onClose: () => void;
}

const CLASSIFICATIONS = ["All", "Main", "Ten Most Wanted", "Cyber", "Terrorism", "Seeking Information", "Kidnappings/Missing Persons"];

export function FBIWantedModal({ onClose }: FBIWantedModalProps) {
  const [persons, setPersons] = useState<FBIWantedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<FBIWantedPerson | null>(null);
  const [activeTab, setActiveTab] = useState<"wanted" | "watchdog">("wanted");
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("title", search);
      if (classification !== "All") {
        const classMap: Record<string, string> = {
          "Main": "main", "Ten Most Wanted": "ten", "Cyber": "cyber",
          "Terrorism": "terrorism", "Seeking Information": "information",
          "Kidnappings/Missing Persons": "kidnapping",
        };
        params.set("poster_classification", classMap[classification] || "");
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fbi-wanted?${params.toString()}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPersons(json.items || []);
      setTotal(json.total || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, classification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / pageSize);

  return createPortal(
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm text-foreground flex flex-col" style={{ zIndex: 100001 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/80">
        <div className="w-[3px] h-5 bg-destructive flex-shrink-0" />
        <Skull className="h-4 w-4 text-destructive flex-shrink-0" />
        <h1 className="text-[11px] font-mono font-bold tracking-[0.2em] flex-shrink-0">
          FBI <span className="text-destructive">INTELLIGENCE</span>
        </h1>

        {/* Tab switches */}
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={() => setActiveTab("wanted")}
            className={`text-[8px] font-mono font-bold px-2 py-1 border transition-colors ${
              activeTab === "wanted"
                ? "border-destructive/50 bg-destructive/15 text-destructive"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Skull className="h-2.5 w-2.5 inline mr-1" />MOST WANTED
          </button>
          <button
            onClick={() => setActiveTab("watchdog")}
            className={`text-[8px] font-mono font-bold px-2 py-1 border transition-colors ${
              activeTab === "watchdog"
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-2.5 w-2.5 inline mr-1" />WATCHDOG
          </button>
        </div>

        <Badge variant="outline" className="text-[7px] font-mono border-destructive/30 text-destructive ml-2">
          {total} RECORDS
        </Badge>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {activeTab === "wanted" && (
            <>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search name…"
                  className="h-7 pl-7 pr-2 text-[10px] font-mono w-40 bg-background/50 border-border"
                />
              </div>
              <select
                value={classification}
                onChange={(e) => { setClassification(e.target.value); setPage(1); }}
                className="h-7 text-[9px] font-mono bg-background/50 border border-border rounded px-2 text-foreground"
              >
                {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={fetchData} className="p-1 border border-border/50 hover:border-primary/50 hover:text-primary transition-colors">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1 border border-border/50 hover:border-destructive/50 hover:text-destructive transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "wanted" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* List */}
          <ScrollArea className={`${selected ? "w-1/2" : "w-full"} border-r border-border transition-all`}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                  <RefreshCw className="h-6 w-6 text-primary animate-spin mx-auto" />
                  <p className="text-[10px] font-mono text-muted-foreground">Fetching FBI records…</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-2">
                  <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                  <p className="text-[10px] font-mono text-destructive">{error}</p>
                  <button onClick={fetchData} className="text-[9px] text-primary hover:underline">Retry</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
                {persons.map((p) => (
                  <button
                    key={p.uid}
                    onClick={() => setSelected(p)}
                    className={`text-left border rounded-lg overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg ${
                      selected?.uid === p.uid ? "border-primary ring-1 ring-primary/30" : "border-border"
                    } bg-card/50`}
                  >
                    <div className="aspect-[3/4] bg-muted/20 overflow-hidden relative">
                      {p.images?.[0]?.thumb ? (
                        <img src={p.images[0].thumb} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Skull className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      {p.reward_text && (
                        <div className="absolute top-1 right-1">
                          <Badge className="text-[6px] bg-destructive/90 text-destructive-foreground border-0 px-1 py-0">REWARD</Badge>
                        </div>
                      )}
                      {p.warning_message && (
                        <div className="absolute top-1 left-1">
                          <AlertTriangle className="h-3 w-3 text-destructive drop-shadow-lg" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-[10px] font-mono font-bold text-foreground line-clamp-2 leading-tight">{p.title}</p>
                      {p.subjects?.[0] && (
                        <p className="text-[8px] font-mono text-primary/80 line-clamp-1">{p.subjects[0]}</p>
                      )}
                      {p.poster_classification && (
                        <Badge variant="outline" className="text-[6px] font-mono border-muted-foreground/30 text-muted-foreground">
                          {p.poster_classification}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-3 border-t border-border">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1 border border-border rounded hover:border-primary/50 disabled:opacity-30">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-[9px] font-mono text-muted-foreground">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="p-1 border border-border rounded hover:border-primary/50 disabled:opacity-30">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </ScrollArea>

          {/* Detail Panel */}
          {selected && (
            <div className="w-1/2 flex flex-col bg-background/50">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <Shield className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[10px] font-mono font-bold tracking-wider">SUBJECT DOSSIER</span>
                <div className="flex-1" />
                <button onClick={() => setSelected(null)} className="p-1 hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {selected.images?.[0] && (
                    <div className="flex justify-center">
                      <img src={selected.images[0].large || selected.images[0].original} alt={selected.title} className="max-h-64 rounded border border-border object-contain" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-mono font-bold text-foreground">{selected.title}</h2>
                    {selected.person_classification && (
                      <Badge variant="outline" className="text-[7px] mt-1 border-destructive/30 text-destructive">{selected.person_classification}</Badge>
                    )}
                  </div>
                  {selected.warning_message && (
                    <div className="flex items-start gap-2 p-2 border border-destructive/30 bg-destructive/5 rounded">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-[9px] font-mono text-destructive" dangerouslySetInnerHTML={{ __html: selected.warning_message }} />
                    </div>
                  )}
                  {selected.reward_text && (
                    <div className="p-2 border border-primary/30 bg-primary/5 rounded">
                      <p className="text-[8px] font-mono font-bold text-primary uppercase tracking-wider mb-1">Reward</p>
                      <p className="text-[9px] font-mono text-foreground" dangerouslySetInnerHTML={{ __html: selected.reward_text }} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      ["Aliases", selected.aliases?.join(", ")], ["Sex", selected.sex], ["Race", selected.race],
                      ["Nationality", selected.nationality], ["DOB", selected.dates_of_birth_used?.join(", ")],
                      ["Birthplace", selected.place_of_birth], ["Hair", selected.hair], ["Eyes", selected.eyes],
                      ["Status", selected.status], ["Field Offices", selected.field_offices?.join(", ")],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-[9px] font-mono text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                  {selected.subjects?.length > 0 && (
                    <div>
                      <p className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Subjects</p>
                      <div className="flex flex-wrap gap-1">
                        {selected.subjects.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[7px] font-mono">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selected.description && (
                    <div>
                      <p className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                      <p className="text-[9px] font-mono text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.description }} />
                    </div>
                  )}
                  {selected.caution && (
                    <div>
                      <p className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Caution</p>
                      <p className="text-[9px] font-mono text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.caution }} />
                    </div>
                  )}
                  {selected.url && (
                    <a href={selected.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[9px] font-mono text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> View on FBI.gov
                    </a>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      ) : (
        /* Watchdog Tab */
        <div className="flex-1 overflow-auto">
          <WatchdogPanel />
        </div>
      )}
    </div>,
    document.body
  );
}
