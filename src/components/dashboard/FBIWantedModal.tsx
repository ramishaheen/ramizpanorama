import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Search, RefreshCw, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight, Skull, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

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
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("title", search);
      if (classification !== "All") {
        const classMap: Record<string, string> = {
          "Main": "main",
          "Ten Most Wanted": "ten",
          "Cyber": "cyber",
          "Terrorism": "terrorism",
          "Seeking Information": "information",
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
          FBI <span className="text-destructive">MOST WANTED</span>
        </h1>
        <Badge variant="outline" className="text-[7px] font-mono border-destructive/30 text-destructive">
          {total} RECORDS
        </Badge>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
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
          <button onClick={onClose} className="p-1 border border-border/50 hover:border-destructive/50 hover:text-destructive transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
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
                        <Badge className="text-[6px] bg-destructive/90 text-destructive-foreground border-0 px-1 py-0">
                          REWARD
                        </Badge>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-3 border-t border-border">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1 border border-border rounded hover:border-primary/50 disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="text-[9px] font-mono text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1 border border-border rounded hover:border-primary/50 disabled:opacity-30"
              >
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
                {/* Photo */}
                {selected.images?.[0] && (
                  <div className="flex justify-center">
                    <img
                      src={selected.images[0].large || selected.images[0].original}
                      alt={selected.title}
                      className="max-h-64 rounded border border-border object-contain"
                    />
                  </div>
                )}

                {/* Name */}
                <div>
                  <h2 className="text-sm font-mono font-bold text-foreground">{selected.title}</h2>
                  {selected.person_classification && (
                    <Badge variant="outline" className="text-[7px] mt-1 border-destructive/30 text-destructive">
                      {selected.person_classification}
                    </Badge>
                  )}
                </div>

                {/* Warning */}
                {selected.warning_message && (
                  <div className="flex items-start gap-2 p-2 border border-destructive/30 bg-destructive/5 rounded">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] font-mono text-destructive" dangerouslySetInnerHTML={{ __html: selected.warning_message }} />
                  </div>
                )}

                {/* Reward */}
                {selected.reward_text && (
                  <div className="p-2 border border-primary/30 bg-primary/5 rounded">
                    <p className="text-[8px] font-mono font-bold text-primary uppercase tracking-wider mb-1">Reward</p>
                    <p className="text-[9px] font-mono text-foreground" dangerouslySetInnerHTML={{ __html: selected.reward_text }} />
                  </div>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    ["Aliases", selected.aliases?.join(", ")],
                    ["Sex", selected.sex],
                    ["Race", selected.race],
                    ["Nationality", selected.nationality],
                    ["DOB", selected.dates_of_birth_used?.join(", ")],
                    ["Birthplace", selected.place_of_birth],
                    ["Hair", selected.hair],
                    ["Eyes", selected.eyes],
                    ["Status", selected.status],
                    ["Field Offices", selected.field_offices?.join(", ")],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-[9px] font-mono text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Subjects */}
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

                {/* Description */}
                {selected.description && (
                  <div>
                    <p className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                    <p className="text-[9px] font-mono text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.description }} />
                  </div>
                )}

                {/* Caution */}
                {selected.caution && (
                  <div>
                    <p className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Caution</p>
                    <p className="text-[9px] font-mono text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.caution }} />
                  </div>
                )}

                {/* FBI Link */}
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[9px] font-mono text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View on FBI.gov
                  </a>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
