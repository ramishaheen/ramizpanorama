import { useState } from "react";
import { Search, Satellite, Loader2, X, ChevronDown, ChevronUp, Cloud, Calendar, MapPin } from "lucide-react";
import { useUP42Catalog, type UP42Feature, type UP42SearchParams } from "@/hooks/useUP42Catalog";

interface UP42PanelProps {
  onFeaturesChange: (features: UP42Feature[]) => void;
  mapBounds?: { north: number; south: number; east: number; west: number } | null;
}

const COLLECTIONS = [
  { id: "phr", label: "Pléiades HR", res: "0.5m" },
  { id: "pneo", label: "Pléiades Neo", res: "0.3m" },
  { id: "spot", label: "SPOT", res: "1.5m" },
];

export const UP42Panel = ({ onFeaturesChange, mapBounds }: UP42PanelProps) => {
  const { features, loading, error, search, clear } = useUP42Catalog();
  const [expanded, setExpanded] = useState(false);
  const [maxCloud, setMaxCloud] = useState(20);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(["phr", "pneo"]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const toggleCollection = (id: string) => {
    setSelectedCollections(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSearch = async () => {
    const params: UP42SearchParams = {
      dateFrom: `${dateFrom}T00:00:00Z`,
      dateTo: `${dateTo}T23:59:59Z`,
      maxCloudCover: maxCloud,
      collections: selectedCollections,
      limit: 20,
    };

    if (mapBounds) {
      params.bbox = [mapBounds.west, mapBounds.south, mapBounds.east, mapBounds.north];
    }

    const results = await search(params);
    onFeaturesChange(results);
  };

  const handleClear = () => {
    clear();
    onFeaturesChange([]);
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-all ${
          features.length > 0
            ? "bg-primary/20 text-primary border border-primary/30"
            : "bg-card/90 backdrop-blur border border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        <Satellite className="h-3.5 w-3.5" />
        UP42
        {features.length > 0 && (
          <span className="bg-primary/30 text-primary text-[8px] px-1.5 rounded-full font-bold">
            {features.length}
          </span>
        )}
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="absolute bottom-full mb-1 left-0 bg-card/95 backdrop-blur-sm border border-border rounded-md p-3 min-w-[280px] max-w-[320px] shadow-xl">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>UP42 Satellite Catalog</span>
            {features.length > 0 && (
              <button onClick={handleClear} className="text-[8px] text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Collections */}
          <div className="mb-2">
            <div className="text-[8px] font-mono text-muted-foreground uppercase mb-1">Satellites</div>
            <div className="flex flex-wrap gap-1">
              {COLLECTIONS.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCollection(c.id)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
                    selectedCollections.includes(c.id)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary/30 text-muted-foreground border border-border hover:text-foreground"
                  }`}
                >
                  {c.label} ({c.res})
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="mb-2 flex gap-2">
            <div className="flex-1">
              <div className="text-[8px] font-mono text-muted-foreground uppercase mb-0.5 flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" /> From
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-secondary/30 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground"
              />
            </div>
            <div className="flex-1">
              <div className="text-[8px] font-mono text-muted-foreground uppercase mb-0.5">To</div>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full bg-secondary/30 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground"
              />
            </div>
          </div>

          {/* Cloud cover */}
          <div className="mb-3">
            <div className="text-[8px] font-mono text-muted-foreground uppercase mb-0.5 flex items-center gap-1">
              <Cloud className="h-2.5 w-2.5" /> Max Cloud Cover: {maxCloud}%
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={maxCloud}
              onChange={e => setMaxCloud(parseInt(e.target.value))}
              className="w-full h-1 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Search area hint */}
          <div className="mb-2 text-[8px] font-mono text-muted-foreground flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />
            {mapBounds ? "Search area: current map view" : "Search area: default (Middle East)"}
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={loading || selectedCollections.length === 0}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 text-primary border border-primary/30 text-[10px] font-mono font-bold hover:bg-primary/30 transition-colors disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            {loading ? "Searching…" : "Search Catalog"}
          </button>

          {/* Error */}
          {error && (
            <div className="mt-2 text-[9px] font-mono text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1">
              {error}
            </div>
          )}

          {/* Results */}
          {features.length > 0 && (
            <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
              <div className="text-[8px] font-mono text-muted-foreground uppercase">
                {features.length} imagery footprints found
              </div>
              {features.map((f, i) => (
                <div
                  key={f.id || i}
                  className="bg-secondary/20 border border-border rounded px-2 py-1"
                >
                  <div className="text-[9px] font-mono text-foreground font-bold truncate">
                    {f.properties?.constellation || f.properties?.collection || "Unknown"}
                  </div>
                  <div className="text-[8px] font-mono text-muted-foreground flex items-center gap-2">
                    <span>{f.properties?.datetime?.split("T")[0] || "N/A"}</span>
                    {f.properties?.["eo:cloud_cover"] != null && (
                      <span>☁️ {Math.round(f.properties["eo:cloud_cover"])}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 pt-1.5 border-t border-border">
            <p className="text-[7px] font-mono text-muted-foreground/50 leading-tight">
              UP42 STAC Catalog — Pléiades HR/Neo, SPOT. Footprints shown on map as polygons.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
