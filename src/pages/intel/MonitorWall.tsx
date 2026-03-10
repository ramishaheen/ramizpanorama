import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Grid3X3, List, Search, RefreshCw, Pin, ExternalLink, MapPin } from "lucide-react";

const MonitorWall = () => {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  const fetchApproved = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("intel_sources").select("*").eq("review_status", "approved").order("reliability_score", { ascending: false }).limit(200);
    if (search) query = query.or(`source_name.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`);
    if (categoryFilter) query = query.eq("category", categoryFilter);
    if (countryFilter) query = query.eq("country", countryFilter);
    const { data } = await query;
    setSources(data || []);
    setLoading(false);
  }, [search, categoryFilter, countryFilter]);

  useEffect(() => { fetchApproved(); }, [fetchApproved]);

  const renderEmbed = (s: any) => {
    if (s.source_type === "youtube_live" && (s.embed_url || s.source_url)) {
      const ytId = s.embed_url?.match(/embed\/([^?]+)/)?.[1] || s.source_url?.match(/v=([^&]+)/)?.[1];
      if (ytId) return <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=0&mute=1`} className="w-full h-full rounded" allow="autoplay; encrypted-media" allowFullScreen />;
    }
    if (s.thumbnail_url) return <img src={s.thumbnail_url} alt={s.source_name} className="w-full h-full object-cover rounded" />;
    return (
      <div className="w-full h-full bg-secondary/50 rounded flex items-center justify-center">
        <span className="text-muted-foreground text-xs font-mono">NO PREVIEW</span>
      </div>
    );
  };

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
          <h1 className="text-lg font-mono font-bold text-foreground">MONITOR WALL</h1>
          <span className="text-xs text-muted-foreground font-mono">{sources.length} sources</span>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-40 text-xs bg-secondary/50" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-8 rounded-md border border-input bg-secondary/50 px-2 text-xs">
            <option value="">All Categories</option>
            {["traffic","tourism","city_view","weather","port","airport_public"].map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={fetchApproved} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <div className="flex border border-border rounded-md overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={`px-2 py-1 ${viewMode === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}><Grid3X3 className="h-4 w-4" /></button>
            <button onClick={() => setViewMode("list")} className={`px-2 py-1 ${viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {sources.map(s => (
                <div key={s.id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors group">
                  <div className="aspect-video relative">{renderEmbed(s)}</div>
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-foreground truncate">{s.source_name}</h3>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />{s.city ? `${s.city}, ` : ""}{s.country}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="bg-primary/10 text-primary px-1 py-0.5 rounded text-[9px]">{s.category.replace(/_/g," ")}</span>
                      <span className={`ml-auto text-[9px] font-mono ${s.reliability_score >= 70 ? "text-emerald-400" : "text-amber-400"}`}>{s.reliability_score}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-left text-muted-foreground font-mono uppercase">
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sources.map(s => (
                  <tr key={s.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-2 font-medium text-foreground">{s.source_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.city ? `${s.city}, ` : ""}{s.country}</td>
                    <td className="px-3 py-2">{s.source_type.replace(/_/g," ")}</td>
                    <td className="px-3 py-2">{s.category.replace(/_/g," ")}</td>
                    <td className="px-3 py-2 font-mono">{s.reliability_score}</td>
                    <td className="px-3 py-2">
                      {(s.source_url || s.embed_url) && <a href={s.source_url || s.embed_url} target="_blank" rel="noopener noreferrer" className="text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && sources.length === 0 && <div className="text-center text-muted-foreground text-sm mt-8">No approved sources yet.</div>}
        </div>
      </div>
    </IntelLayout>
  );
};

export default MonitorWall;
