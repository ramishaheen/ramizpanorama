import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Search, BarChart3, PieChart, TrendingUp,
  AlertTriangle, MessageSquareShare, Globe, Hash
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart as RePie, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";

interface SentimentData {
  query: { country: string; topic: string; date_range: string; platforms: string[] };
  collection_summary: { posts_collected: number; posts_used: number; country_match_confidence: string; sampling_note: string };
  sentiment_summary: { with_percent: number; against_percent: number; neutral_percent: number; unclear_percent: number; overall_label: string; overall_confidence: string };
  diagram_data: {
    pie: { label: string; value: number }[];
    bar: { label: string; with: number; against: number; neutral: number; unclear: number }[];
    trend: { date: string; with: number; against: number; neutral: number }[];
  };
  themes: { theme: string; share: number }[];
  sample_insights: { theme: string; summary: string; confidence: string }[];
  ui_box: { title: string; country: string; topic: string; headline_result: string; headline_percent: number; sample_size: number; confidence: string; warning: string };
}

const PIE_COLORS = ["hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(var(--warning))"];
const PIE_COLORS_HEX = ["#22c55e", "#ef4444", "#94a3b8", "#f59e0b"];

const PLATFORMS = ["X", "Reddit", "YouTube", "Telegram"];
const DATE_RANGES = [
  { value: "last_24h", label: "Last 24h" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SocialSentimentModal = ({ open, onClose }: Props) => {
  const [country, setCountry] = useState("Jordan");
  const [topic, setTopic] = useState("Iran war");
  const [dateRange, setDateRange] = useState("last_7_days");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(PLATFORMS);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SentimentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleSearch = useCallback(async () => {
    if (!country.trim() || !topic.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("social-sentiment", {
        body: { country, topic, date_range: dateRange, platforms: selectedPlatforms, max_posts: 500 },
      });

      if (fnError) {
        console.error("Social sentiment invoke error:", fnError);
        const msg = typeof fnError === "object" && fnError !== null
          ? (fnError as any).message || JSON.stringify(fnError)
          : String(fnError);
        throw new Error(`Edge function error: ${msg}`);
      }

      if (!fnData) {
        throw new Error("No data returned from edge function");
      }

      if (fnData.error && !fnData.sentiment_summary) {
        throw new Error(`API error: ${fnData.error}`);
      }

      if (!fnData.sentiment_summary) {
        console.error("Unexpected response shape:", JSON.stringify(fnData).slice(0, 500));
        throw new Error(`Unexpected response format — missing sentiment_summary. Keys: ${Object.keys(fnData).join(", ")}`);
      }

      setData(fnData);
    } catch (e) {
      console.error("Social sentiment fetch failed:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch sentiment data");
    } finally {
      setLoading(false);
    }
  }, [country, topic, dateRange, selectedPlatforms]);

  if (!open) return null;

  const labelColor = (label: string) => {
    if (label === "With" || label === "POSITIVE") return "text-success";
    if (label === "Against" || label === "NEGATIVE") return "text-destructive";
    if (label === "Mixed" || label === "CAUTIOUS") return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-card border border-border rounded-xl shadow-2xl w-[95vw] max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <MessageSquareShare className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold font-mono tracking-wide text-foreground">SOCIAL MEDIA HARVESTING</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Input form */}
          <div className="px-5 py-3 border-b border-border space-y-3 bg-background/50">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Country</label>
                <div className="relative">
                  <Globe className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={country} onChange={(e) => setCountry(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Jordan"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Topic</label>
                <div className="relative">
                  <Hash className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={topic} onChange={(e) => setTopic(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Iran war"
                  />
                </div>
              </div>
              <div className="min-w-[120px]">
                <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Date Range</label>
                <select
                  value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                  className="w-full py-1.5 px-2 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {DATE_RANGES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Platforms:</span>
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors font-mono ${
                    selectedPlatforms.includes(p)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/30 border-border text-muted-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={handleSearch}
                disabled={loading || !country.trim() || !topic.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-primary-foreground text-sm font-mono hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {loading ? "Analyzing…" : "Harvest"}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-mono">Harvesting social media data…</p>
                <p className="text-[10px] text-muted-foreground">Searching {selectedPlatforms.join(", ")} for "{topic}" in {country}</p>
              </div>
            )}

            {data && !loading && (
              <>
                {/* Headline box */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="col-span-1 p-4 rounded-lg border border-border bg-secondary/20">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Overall Sentiment</p>
                    <p className={`text-2xl font-bold mt-1 ${labelColor(data.sentiment_summary.overall_label)}`}>
                      {data.sentiment_summary.overall_label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.ui_box.headline_percent}% dominant · {data.collection_summary.posts_used} posts
                    </p>
                    <div className="flex gap-1 mt-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        Confidence: {data.sentiment_summary.overall_confidence}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        Match: {data.collection_summary.country_match_confidence}
                      </span>
                    </div>
                  </div>

                  {/* Sentiment bars */}
                  <div className="col-span-1 p-4 rounded-lg border border-border bg-secondary/20 space-y-2">
                    {[
                      { label: "With", val: data.sentiment_summary.with_percent, color: "bg-success" },
                      { label: "Against", val: data.sentiment_summary.against_percent, color: "bg-destructive" },
                      { label: "Neutral", val: data.sentiment_summary.neutral_percent, color: "bg-muted-foreground" },
                      { label: "Unclear", val: data.sentiment_summary.unclear_percent, color: "bg-warning" },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-0.5">
                          <span>{s.label}</span><span>{s.val}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Themes */}
                  <div className="col-span-1 p-4 rounded-lg border border-border bg-secondary/20">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Key Themes</p>
                    <div className="space-y-1.5">
                      {data.themes?.slice(0, 5).map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full bg-primary flex-shrink-0" style={{ width: `${t.share}%`, minWidth: 4 }} />
                          <span className="text-xs text-foreground truncate">{t.theme}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{t.share}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Pie */}
                  <div className="p-3 rounded-lg border border-border bg-secondary/10">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1">
                      <PieChart className="h-3 w-3" /> Sentiment Distribution
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                      <RePie>
                        <Pie data={data.diagram_data.pie} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={60} innerRadius={30} strokeWidth={1}>
                          {data.diagram_data.pie.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS_HEX[i % PIE_COLORS_HEX.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                      </RePie>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar */}
                  <div className="p-3 rounded-lg border border-border bg-secondary/10">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" /> By Platform
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data.diagram_data.bar} barSize={12}>
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="with" fill="#22c55e" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="against" fill="#ef4444" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="neutral" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Trend */}
                  <div className="p-3 rounded-lg border border-border bg-secondary/10">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Trend
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={data.diagram_data.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="with" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="against" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="neutral" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Insights */}
                {data.sample_insights?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Insights</p>
                    {data.sample_insights.map((ins, i) => (
                      <div key={i} className="p-2.5 rounded border border-border bg-secondary/10 text-xs text-foreground">
                        <span className="font-semibold text-primary">{ins.theme}:</span> {ins.summary}
                        <span className="ml-1 text-[9px] text-muted-foreground">(confidence: {ins.confidence})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cached indicator */}
                {(data as any)._cached && (
                  <div className="flex items-start gap-2 p-2.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Showing {(data as any)._stale ? "last available" : "cached"} results from {new Date((data as any)._cached_at).toLocaleString()}.
                      {(data as any)._stale && " Live data temporarily unavailable."}
                    </span>
                  </div>
                )}

                {/* Warning */}
                <div className="flex items-start gap-2 p-2.5 rounded bg-warning/10 border border-warning/20 text-[10px] text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{data.collection_summary.sampling_note}</span>
                </div>
              </>
            )}

            {!data && !loading && !error && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MessageSquareShare className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-mono">Enter a country and topic, then click Harvest</p>
                <p className="text-[10px] mt-1">Analyzes public sentiment from X, Reddit, YouTube & Telegram</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
