import { useState, useMemo } from "react";
import { Search, ExternalLink, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { osintMapData, OSINT_CATEGORIES, CATEGORY_LABELS, CATEGORY_ICONS, type OSINTCategory, type OSINTCountry } from "@/data/osintMapData";

interface OSINTLinksPanelProps {
  onLocate: (lat: number, lng: number) => void;
  mapCenter?: { lat: number; lng: number };
  mapAltitude?: number;
  filterCountry?: string | null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const OSINTLinksPanel = ({ onLocate, mapCenter, mapAltitude, filterCountry }: OSINTLinksPanelProps) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<OSINTCategory | null>(null);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set(filterCountry ? [filterCountry] : []));

  const sortedCountries = useMemo(() => {
    let filtered = osintMapData;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c =>
        c.country.toLowerCase().includes(q) ||
        c.links.some(l => l.label.toLowerCase().includes(q) || l.category.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (activeCategory) {
      filtered = filtered.filter(c => c.links.some(l => l.category === activeCategory));
    }

    // Filter country from globe click
    if (filterCountry) {
      const fc = filterCountry.toLowerCase();
      const exact = filtered.filter(c => c.country.toLowerCase() === fc);
      if (exact.length > 0) return exact;
    }

    // Sort by proximity to map center
    if (mapCenter) {
      return [...filtered].sort((a, b) =>
        haversineDistance(mapCenter.lat, mapCenter.lng, a.lat, a.lng) -
        haversineDistance(mapCenter.lat, mapCenter.lng, b.lat, b.lng)
      );
    }

    return filtered;
  }, [search, activeCategory, mapCenter, filterCountry]);

  const toggleExpand = (country: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country); else next.add(country);
      return next;
    });
  };

  const getLinksForCountry = (country: OSINTCountry) => {
    if (!activeCategory) return country.links;
    return country.links.filter(l => l.category === activeCategory);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[13px]">🌐</span>
          <span className="text-[10px] font-bold tracking-[0.15em] text-foreground uppercase font-mono">OSINT RESOURCES</span>
          <span className="ml-auto text-[9px] font-mono text-primary">{sortedCountries.length} countries</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search countries, resources..."
            className="w-full bg-secondary/40 text-[10px] font-mono text-foreground placeholder:text-muted-foreground pl-7 pr-3 py-1.5 rounded border border-border focus:border-primary/50 outline-none"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="px-3 py-1.5 border-b border-border flex-shrink-0">
        <div className="flex flex-wrap gap-1">
          {OSINT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold tracking-wider border transition-colors ${
                activeCategory === cat
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <span className="text-[10px]">{CATEGORY_ICONS[cat]}</span>
              {CATEGORY_LABELS[cat].split(" ")[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Country list */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {sortedCountries.map((country) => {
          const isExpanded = expandedCountries.has(country.country);
          const links = getLinksForCountry(country);
          const dist = mapCenter ? Math.round(haversineDistance(mapCenter.lat, mapCenter.lng, country.lat, country.lng)) : null;

          return (
            <div key={country.country} className="border-b border-border/40">
              <button
                onClick={() => toggleExpand(country.country)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-primary flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-[13px]">🌐</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono font-bold text-foreground truncate">{country.country}</div>
                  <div className="text-[8px] font-mono text-muted-foreground">
                    {links.length} resources
                    {dist !== null && <span className="ml-1">• {dist > 1000 ? `${(dist / 1000).toFixed(1)}K` : dist} km</span>}
                  </div>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {links.length}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onLocate(country.lat, country.lng); }}
                  className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors flex-shrink-0"
                >
                  <MapPin className="h-3 w-3" />
                </button>
              </button>

              {isExpanded && (
                <div className="pb-2 px-3">
                  {links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-secondary/40 transition-colors group"
                    >
                      <span className="text-[10px]">{CATEGORY_ICONS[link.category as OSINTCategory] || "🔍"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-mono text-foreground truncate group-hover:text-primary transition-colors">{link.label}</div>
                        <div className="text-[7px] font-mono text-muted-foreground truncate">{new URL(link.url).hostname}</div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                    </a>
                  ))}
                  <button
                    onClick={() => onLocate(country.lat, country.lng)}
                    className="mt-1 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[8px] font-mono font-bold tracking-wider border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                  >
                    <MapPin className="h-3 w-3" /> FLY TO {country.country.toUpperCase()}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {sortedCountries.length === 0 && (
          <div className="px-4 py-8 text-center text-[10px] font-mono text-muted-foreground">No countries match your search</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border flex-shrink-0">
        <div className="text-[7px] font-mono text-muted-foreground">
          Source: <a href="https://github.com/cipher387/osintmap" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">cipher387/osintmap</a> • {osintMapData.reduce((acc, c) => acc + c.links.length, 0)} total links
        </div>
      </div>
    </div>
  );
};
