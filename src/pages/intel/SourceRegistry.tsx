import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, ExternalLink, MapPin, CheckCircle, Clock, XCircle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type IntelSource = {
  id: string;
  source_name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  source_type: string;
  category: string;
  source_url: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  provider_name: string;
  review_status: string;
  reliability_score: number;
  tags: string[];
  created_at: string;
};

const REVIEW_BADGE: Record<string, { color: string; icon: any }> = {
  approved: { color: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
  pending: { color: "text-amber-400 bg-amber-400/10", icon: Clock },
  rejected: { color: "text-destructive bg-destructive/10", icon: XCircle },
};

const SourceRegistry = () => {
  const { isAdmin, isAnalyst, user } = useAuth();
  const { toast } = useToast();
  const [sources, setSources] = useState<IntelSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showCSV, setShowCSV] = useState(false);

  // Add form state
  const [form, setForm] = useState({
    source_name: "", country: "", city: "", lat: "", lng: "",
    source_type: "youtube_live", category: "city_view",
    source_url: "", embed_url: "", provider_name: "", notes: "", tags: "",
  });

  const fetchSources = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("intel_sources").select("*").order("created_at", { ascending: false }).limit(500);
    if (search) query = query.or(`source_name.ilike.%${search}%,country.ilike.%${search}%,city.ilike.%${search}%,provider_name.ilike.%${search}%`);
    const { data, error } = await query;
    if (!error && data) setSources(data as any);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      source_name: form.source_name,
      country: form.country,
      city: form.city,
      lat: parseFloat(form.lat) || 0,
      lng: parseFloat(form.lng) || 0,
      source_type: form.source_type as any,
      category: form.category as any,
      source_url: form.source_url || null,
      embed_url: form.embed_url || null,
      provider_name: form.provider_name,
      notes: form.notes,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()) : [],
      review_status: "pending" as const,
      submitted_by: user?.id,
    };
    const { error } = await supabase.from("intel_sources").insert([payload]);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Source submitted", description: "Entered review queue." });
      setShowAdd(false);
      setForm({ source_name: "", country: "", city: "", lat: "", lng: "", source_type: "youtube_live", category: "city_view", source_url: "", embed_url: "", provider_name: "", notes: "", tags: "" });
      fetchSources();
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) { toast({ title: "Error", description: "CSV must have header + data rows", variant: "destructive" }); return; }
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values = line.split(",");
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i]?.trim() || ""; });
      return obj;
    });

    let imported = 0;
    for (const row of rows) {
      const row_payload: any = {
        source_name: row.source_name || row.name || "Unknown",
        country: row.country || "",
        city: row.city || "",
        lat: parseFloat(row.lat || row.latitude) || 0,
        lng: parseFloat(row.lng || row.longitude) || 0,
        source_type: row.source_type || "official_webcam_page",
        category: row.category || "city_view",
        source_url: row.source_url || row.url || null,
        embed_url: row.embed_url || null,
        provider_name: row.provider_name || row.provider || "",
        review_status: "pending" as const,
        submitted_by: user?.id,
      };
      const { error } = await supabase.from("intel_sources").insert([row_payload]);
      if (!error) imported++;
    }
    toast({ title: "CSV Import", description: `Imported ${imported}/${rows.length} sources into review queue.` });
    setShowCSV(false);
    fetchSources();
  };

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
          <h1 className="text-lg font-mono font-bold text-foreground">SOURCE REGISTRY</h1>
          <span className="text-xs text-muted-foreground font-mono">{sources.length} sources</span>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-48 text-xs bg-secondary/50" />
          </div>
          <Button size="sm" variant="outline" onClick={fetchSources} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={() => setShowCSV(true)} className="h-8 gap-1"><Upload className="h-3.5 w-3.5" />CSV</Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 gap-1"><Plus className="h-3.5 w-3.5" />Add Source</Button>
        </div>

        {/* Add Source Modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-sm font-mono font-bold mb-4">ADD NEW SOURCE</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <Input placeholder="Source Name *" required value={form.source_name} onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))} className="text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Country *" required value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="text-xs" />
                  <Input placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Latitude" type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} className="text-xs" />
                  <Input placeholder="Longitude" type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} className="text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))} className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-xs">
                    {["youtube_live","hls_stream","mjpeg_stream","image_snapshot","official_webcam_page","external_embed","traffic_api","incident_feed","partner_feed"].map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                  </select>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-xs">
                    {["traffic","tourism","city_view","weather","port","airport_public","parking","event_venue_public","border_wait_time_data","road_status","incident_reporting"].map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
                  </select>
                </div>
                <Input placeholder="Source URL" value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} className="text-xs" />
                <Input placeholder="Embed URL" value={form.embed_url} onChange={e => setForm(f => ({ ...f, embed_url: e.target.value }))} className="text-xs" />
                <Input placeholder="Provider Name" value={form.provider_name} onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))} className="text-xs" />
                <Input placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="text-xs" />
                <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full h-16 rounded-md border border-input bg-secondary/50 px-3 py-2 text-xs resize-none" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button type="submit" size="sm">Submit for Review</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCSV && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowCSV(false)}>
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h2 className="text-sm font-mono font-bold mb-3">CSV BULK IMPORT</h2>
              <p className="text-xs text-muted-foreground mb-4">Upload a CSV with columns: source_name, country, city, lat, lng, source_type, category, source_url, embed_url, provider_name</p>
              <input type="file" accept=".csv" onChange={handleCSVImport} className="text-xs" />
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCSV(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-left text-muted-foreground font-mono uppercase">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sources.map(s => {
                  const badge = REVIEW_BADGE[s.review_status] || REVIEW_BADGE.pending;
                  const Icon = badge.icon;
                  return (
                    <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">{s.source_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.city ? `${s.city}, ` : ""}{s.country}</span>
                      </td>
                      <td className="px-3 py-2"><span className="bg-secondary/80 px-1.5 py-0.5 rounded text-[10px]">{s.source_type.replace(/_/g," ")}</span></td>
                      <td className="px-3 py-2"><span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{s.category.replace(/_/g," ")}</span></td>
                      <td className="px-3 py-2 text-muted-foreground">{s.provider_name || "—"}</td>
                      <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${badge.color}`}><Icon className="h-3 w-3" />{s.review_status}</span></td>
                      <td className="px-3 py-2"><span className={`font-mono ${s.reliability_score >= 70 ? "text-emerald-400" : s.reliability_score >= 40 ? "text-amber-400" : "text-destructive"}`}>{s.reliability_score}</span></td>
                      <td className="px-3 py-2">
                        {(s.source_url || s.embed_url) && (
                          <a href={s.source_url || s.embed_url || ""} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80"><ExternalLink className="h-3.5 w-3.5" /></a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && sources.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No sources found. Add your first source above.</div>
          )}
        </div>
      </div>
    </IntelLayout>
  );
};

export default SourceRegistry;
