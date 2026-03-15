import { useState, useCallback } from "react";
import { Search, ExternalLink, RefreshCw, Globe, FileText, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ValyuResult {
  title?: string;
  url?: string;
  content?: string;
  source?: string;
  relevance_score?: number;
}

interface ValyuSearchPanelProps {
  onLocate?: (lat: number, lng: number) => void;
}

const SEARCH_TYPE_OPTIONS = [
  { value: "all", label: "ALL", icon: "🌐" },
  { value: "web", label: "WEB", icon: "🔍" },
  { value: "proprietary", label: "DATA", icon: "📊" },
  { value: "news", label: "NEWS", icon: "📰" },
];

const QUICK_QUERIES = [
  "Middle East geopolitical tensions",
  "Iran nuclear program updates",
  "NATO defense posture changes",
  "Cyber attacks critical infrastructure",
  "Global supply chain disruptions",
  "Maritime security threats",
];

export const ValyuSearchPanel = ({ onLocate }: ValyuSearchPanelProps) => {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [results, setResults] = useState<ValyuResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const doSearch = useCallback(async (q: string, type: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setLastQuery(q);
    try {
      const { data, error } = await supabase.functions.invoke("valyu-search", {
        body: { query: q, search_type: type, max_num_results: 15 },
      });
      if (error) throw error;
      const items = data?.results || data?.data || [];
      setResults(Array.isArray(items) ? items : []);
      if (Array.isArray(items) && items.length === 0) {
        toast.info("No results found");
      }
    } catch (err: any) {
      toast.error("Valyu search failed: " + (err.message || "Unknown error"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, searchType);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[13px]">⚡</span>
          <span className="text-[10px] font-bold tracking-[0.15em] text-foreground uppercase font-mono">
            VALYU DEEPSEARCH
          </span>
          <span className="ml-auto text-[9px] font-mono text-primary">
            {results.length} results
          </span>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search intelligence, news, data..."
            className="w-full bg-secondary/40 text-[10px] font-mono text-foreground placeholder:text-muted-foreground pl-7 pr-16 py-1.5 rounded border border-border focus:border-primary/50 outline-none"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[8px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-40 transition-colors"
          >
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : "SEARCH"}
          </button>
        </form>
      </div>

      {/* Search type chips */}
      <div className="px-3 py-1.5 border-b border-border flex-shrink-0">
        <div className="flex flex-wrap gap-1">
          {SEARCH_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSearchType(opt.value)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold tracking-wider border transition-colors ${
                searchType === opt.value
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <span className="text-[10px]">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results or quick queries */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {results.length === 0 && !loading && (
          <div className="px-3 py-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Quick Queries
            </div>
            {QUICK_QUERIES.map((q, i) => (
              <button
                key={i}
                onClick={() => { setQuery(q); doSearch(q, searchType); }}
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-secondary/40 transition-colors group mb-0.5"
              >
                <Search className="h-3 w-3 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                <span className="text-[9px] font-mono text-foreground/80 group-hover:text-primary truncate">
                  {q}
                </span>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="px-4 py-8 text-center">
            <RefreshCw className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
            <div className="text-[10px] font-mono text-muted-foreground">
              Searching Valyu...
            </div>
          </div>
        )}

        {results.map((result, i) => (
          <div key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
            <div className="px-3 py-2">
              <div className="flex items-start gap-2">
                <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono font-bold text-foreground truncate">
                    {result.title || "Untitled"}
                  </div>
                  {result.source && (
                    <div className="text-[8px] font-mono text-primary/70 mt-0.5">
                      {result.source}
                    </div>
                  )}
                  {result.content && (
                    <div className="text-[8px] font-mono text-muted-foreground mt-1 line-clamp-3">
                      {result.content.slice(0, 300)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[7px] font-mono text-primary hover:underline"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        {(() => { try { return new URL(result.url).hostname; } catch { return "link"; } })()}
                      </a>
                    )}
                    {result.relevance_score !== undefined && (
                      <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {(result.relevance_score * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border flex-shrink-0">
        <div className="text-[7px] font-mono text-muted-foreground">
          Powered by{" "}
          <a
            href="https://valyu.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Valyu DeepSearch API
          </a>
          {lastQuery && (
            <span className="ml-1">• Last: "{lastQuery.slice(0, 30)}{lastQuery.length > 30 ? "..." : ""}"</span>
          )}
        </div>
      </div>
    </div>
  );
};
