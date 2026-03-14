import { useState, useCallback, MutableRefObject } from "react";
import {
  Brain, Radio, Eye, Satellite, Shield, Anchor, Thermometer,
  ChevronDown, ChevronRight, MapPin, Loader2, RefreshCw, X,
  Target, Camera, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface SourceItem {
  id: string;
  type: string;
  title: string;
  lat: number;
  lng: number;
  severity: string;
  confidence: number;
  source: string;
  affiliation?: string;
  flag?: string;
}

interface SourceCategories {
  GEOINT: SourceItem[];
  OSINT: SourceItem[];
  SIGINT: SourceItem[];
  IMINT: SourceItem[];
  TACTICAL: SourceItem[];
  ENVIRONMENTAL: SourceItem[];
  MARITIME: SourceItem[];
}

interface AISourceCollectorProps {
  lat: number;
  lng: number;
  mapRef: MutableRefObject<any>;
  onClose: () => void;
}

const CAT_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  GEOINT: { icon: Satellite, color: "#3b82f6", label: "GEO-INT" },
  OSINT: { icon: Eye, color: "#22c55e", label: "OS-INT" },
  SIGINT: { icon: Radio, color: "#a855f7", label: "SIG-INT" },
  IMINT: { icon: Camera, color: "#06b6d4", label: "IM-INT" },
  TACTICAL: { icon: Shield, color: "#ef4444", label: "TACTICAL" },
  ENVIRONMENTAL: { icon: Thermometer, color: "#f97316", label: "ENV" },
  MARITIME: { icon: Anchor, color: "#0ea5e9", label: "MARITIME" },
};

const SEV_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#6b7280",
};

export const AISourceCollector = ({ lat, lng, mapRef, onClose }: AISourceCollectorProps) => {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<SourceCategories | null>(null);
  const [totalSources, setTotalSources] = useState(0);
  const [aiAssessment, setAiAssessment] = useState("");
  const [locConfidence, setLocConfidence] = useState(0);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [plottedMarkers, setPlottedMarkers] = useState<any[]>([]);
  const [radiusKm, setRadiusKm] = useState(50);

  const collect = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-source-collect", {
        body: { lat, lng, radius_km: radiusKm },
      });
      if (error) throw error;
      setSources(data.sources);
      setTotalSources(data.totalSources);
      setAiAssessment(data.aiAssessment);
      setLocConfidence(data.localizationConfidence);
      // Auto-expand categories with data
      const expanded: Record<string, boolean> = {};
      Object.entries(data.sources).forEach(([k, v]: [string, any]) => {
        if (v.length > 0) expanded[k] = true;
      });
      setExpandedCats(expanded);
      toast({ title: "Collection complete", description: `${data.totalSources} sources aggregated.` });
    } catch (e) {
      console.error("Collection error:", e);
      toast({ title: "Collection failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radiusKm]);

  const plotSource = (src: SourceItem) => {
    const google = (window as any).google;
    const map = mapRef.current;
    if (!map || !google?.maps) return;

    const sevColor = SEV_COLORS[src.severity] || "#6b7280";
    const marker = new google.maps.Marker({
      map,
      position: { lat: src.lat, lng: src.lng },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: sevColor,
        fillOpacity: 0.9,
        strokeColor: "#fff",
        strokeWeight: 1.5,
      },
      title: src.title,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="font-family:monospace;font-size:11px;max-width:200px">
        <strong>${src.title}</strong><br/>
        <span style="color:${sevColor}">● ${src.severity?.toUpperCase()}</span> | ${src.source}<br/>
        <span style="color:#888">Confidence: ${Math.round(src.confidence * 100)}%</span>
      </div>`,
    });
    marker.addListener("click", () => info.open(map, marker));

    setPlottedMarkers((prev) => [...prev, marker]);
    toast({ title: "Source plotted", description: src.title });
  };

  const plotAllCategory = (items: SourceItem[]) => {
    items.forEach(plotSource);
  };

  const clearPlotted = () => {
    plottedMarkers.forEach((m) => { try { m.setMap(null); } catch {} });
    setPlottedMarkers([]);
  };

  const confColor =
    locConfidence >= 75 ? "#22c55e" : locConfidence >= 50 ? "#eab308" : "#ef4444";

  return (
    <div className="absolute top-0 right-0 z-40 w-[320px] h-full flex flex-col bg-[hsl(220,15%,5%)]/95 backdrop-blur-md border-l border-border/30">
      {/* Header */}
      <div className="shrink-0 px-3 py-3 border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
              AI Source Collector
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 flex items-center gap-1 px-2 py-1 rounded-sm bg-muted/20 border border-border/20 text-[8px] font-mono text-muted-foreground">
            <MapPin className="h-2.5 w-2.5 text-primary" />
            <span>{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</span>
          </div>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="h-6 px-1.5 text-[8px] font-mono bg-muted/20 border border-border/20 rounded-sm text-foreground"
          >
            <option value={10}>10km</option>
            <option value={25}>25km</option>
            <option value={50}>50km</option>
            <option value={100}>100km</option>
          </select>
        </div>

        <button
          onClick={collect}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm bg-primary/20 border border-primary/50 text-primary text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-primary/30 disabled:opacity-50 transition-all"
        >
          {loading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Collecting...</>
          ) : (
            <><Zap className="h-3.5 w-3.5" /> Collect All Sources</>
          )}
        </button>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* AI Assessment */}
          {aiAssessment && (
            <div className="rounded-sm border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain className="h-3 w-3 text-primary" />
                <span className="text-[8px] font-mono font-bold text-primary uppercase tracking-wider">
                  AI Situational Assessment
                </span>
              </div>
              <p className="text-[9px] font-mono text-foreground/90 leading-relaxed">
                {aiAssessment}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-mono text-muted-foreground">SOURCES</span>
                  <span className="text-[9px] font-mono font-bold text-foreground">{totalSources}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-mono text-muted-foreground">LOC CONFIDENCE</span>
                  <span className="text-[9px] font-mono font-bold" style={{ color: confColor }}>
                    {locConfidence}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Category badges */}
          {sources && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(sources).map(([cat, items]) => {
                const meta = CAT_META[cat];
                if (!meta || (items as SourceItem[]).length === 0) return null;
                return (
                  <Badge
                    key={cat}
                    variant="outline"
                    className="text-[7px] font-mono px-1.5 py-0.5 border-border/40"
                    style={{ color: meta.color, borderColor: meta.color + "40" }}
                  >
                    {meta.label}: {(items as SourceItem[]).length}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Source categories */}
          {sources &&
            Object.entries(sources).map(([cat, items]) => {
              const catItems = items as SourceItem[];
              if (catItems.length === 0) return null;
              const meta = CAT_META[cat];
              if (!meta) return null;
              const Icon = meta.icon;
              const isExpanded = expandedCats[cat] ?? false;

              return (
                <div key={cat} className="border border-border/20 rounded-sm bg-muted/5">
                  <button
                    onClick={() =>
                      setExpandedCats((p) => ({ ...p, [cat]: !p[cat] }))
                    }
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted/15 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <Icon className="h-3 w-3" style={{ color: meta.color }} />
                    <span
                      className="text-[9px] font-mono font-bold uppercase tracking-wider"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-muted/30 text-foreground">
                      {catItems.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-1">
                      <button
                        onClick={() => plotAllCategory(catItems)}
                        className="w-full text-[7px] font-mono text-primary hover:text-primary/80 text-left px-1 py-0.5 transition-colors"
                      >
                        ▸ Plot all on map
                      </button>
                      {catItems.map((src) => (
                        <div
                          key={src.id}
                          className="flex items-start gap-2 px-2 py-1.5 rounded-sm border border-border/15 bg-muted/10 hover:border-primary/20 transition-colors group"
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                            style={{
                              backgroundColor:
                                SEV_COLORS[src.severity] || "#6b7280",
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[8px] font-mono font-bold text-foreground truncate">
                              {src.title}
                            </div>
                            <div className="flex items-center gap-2 text-[7px] font-mono text-muted-foreground">
                              <span>{src.source}</span>
                              <span>•</span>
                              <span>
                                {Math.round(src.confidence * 100)}% conf
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => plotSource(src)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Plot on map"
                          >
                            <Target className="h-3 w-3 text-primary" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* No data state */}
          {!sources && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Brain className="h-8 w-8 opacity-20 mb-3" />
              <span className="text-[9px] font-mono">
                Click "Collect All Sources" to aggregate intelligence
              </span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {plottedMarkers.length > 0 && (
        <div className="shrink-0 px-3 py-2 border-t border-border/30 flex items-center justify-between">
          <span className="text-[8px] font-mono text-muted-foreground">
            {plottedMarkers.length} markers plotted
          </span>
          <button
            onClick={clearPlotted}
            className="text-[8px] font-mono text-destructive hover:text-destructive/80 transition-colors"
          >
            Clear markers
          </button>
        </div>
      )}
    </div>
  );
};
