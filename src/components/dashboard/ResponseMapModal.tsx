import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, Plane, Flame, AlertTriangle, Camera, Newspaper, MapPin, Filter, Clock, Shield, ChevronDown, ChevronUp, ExternalLink, Search } from "lucide-react";
import { useEarthquakes, type Earthquake } from "@/hooks/useEarthquakes";
import { useWildfires, type Wildfire } from "@/hooks/useWildfires";
import { useWarUpdates } from "@/hooks/useWarUpdates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

/* ── Types ── */
interface ResponseMapProps {
  onClose: () => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface CrisisLayer {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  enabled: boolean;
  count: number;
  loading: boolean;
  disclaimer?: string;
}

const ME_COUNTRIES = [
  "Jordan", "Iraq", "Syria", "Lebanon", "Palestine", "Israel", "Iran",
  "Saudi Arabia", "UAE", "United Arab Emirates", "Qatar", "Bahrain",
  "Kuwait", "Oman", "Yemen", "Egypt", "Libya", "Tunisia", "Algeria",
  "Morocco", "Sudan", "Turkey",
];

/* ── Utility ── */
const severityColor = (s: string) => {
  if (s === "critical") return "text-red-400";
  if (s === "high") return "text-orange-400";
  if (s === "medium") return "text-amber-400";
  return "text-emerald-400";
};

const timeAgo = (ts: string | number) => {
  const ms = typeof ts === "number" ? Date.now() - ts : Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
};

/* ── Component ── */
export const ResponseMapModal = ({ onClose, onFlyTo }: ResponseMapProps) => {
  // Data hooks
  const earthquakes = useEarthquakes();
  const wildfires = useWildfires();
  const warUpdates = useWarUpdates();

  // State
  const [activeTab, setActiveTab] = useState<"layers" | "events" | "aircraft" | "alerts">("events");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Layer toggles
  const [layerState, setLayerState] = useState({
    aircraft: true,
    thermal: true,
    geohazard: true,
    webcams: true,
    news: true,
    userRegions: false,
  });

  const toggleLayer = (key: keyof typeof layerState) =>
    setLayerState(prev => ({ ...prev, [key]: !prev[key] }));

  // Date filter cutoff
  const dateCutoff = useMemo(() => {
    const now = Date.now();
    const hours = dateFilter === "1h" ? 1 : dateFilter === "6h" ? 6 : dateFilter === "24h" ? 24 : 168;
    return now - hours * 3_600_000;
  }, [dateFilter]);

  // Filtered data
  const filteredQuakes = useMemo(() => {
    return earthquakes.data.filter(q => {
      if (q.time < dateCutoff) return false;
      if (searchQuery && !q.place.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [earthquakes.data, dateCutoff, searchQuery]);

  const filteredFires = useMemo(() => {
    return wildfires.data.filter(f => {
      if (searchQuery && !(f.region || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [wildfires.data, searchQuery]);

  const filteredNews = useMemo(() => {
    const updates = warUpdates.data?.updates || [];
    return updates.filter(u => {
      if (searchQuery && !u.headline.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedCountry !== "all" && !(u.region || "").toLowerCase().includes(selectedCountry.toLowerCase())) return false;
      return true;
    }).slice(0, 50);
  }, [warUpdates.data, searchQuery, selectedCountry]);

  // Unified event feed
  const eventFeed = useMemo(() => {
    const events: Array<{
      id: string;
      type: "earthquake" | "fire" | "news";
      title: string;
      subtitle: string;
      severity: string;
      lat: number;
      lng: number;
      time: string | number;
      details?: string;
      url?: string;
    }> = [];

    if (layerState.geohazard) {
      filteredQuakes.forEach(q => events.push({
        id: q.id,
        type: "earthquake",
        title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
        subtitle: `Depth: ${q.depth}km${q.tsunami ? " ⚠ TSUNAMI" : ""}`,
        severity: q.magnitude >= 6 ? "critical" : q.magnitude >= 4.5 ? "high" : q.magnitude >= 3 ? "medium" : "low",
        lat: q.lat,
        lng: q.lng,
        time: q.time,
        details: `Type: ${q.type} | Felt: ${q.felt ?? "N/A"} | Significance: ${q.significance}`,
        url: q.url,
      }));
    }

    if (layerState.thermal) {
      filteredFires.forEach(f => events.push({
        id: f.id,
        type: "fire",
        title: `Thermal Anomaly — ${f.region || "Unknown"}`,
        subtitle: `Brightness: ${f.brightness} | FRP: ${f.frp} | Conf: ${f.confidence}`,
        severity: f.brightness > 400 ? "critical" : f.brightness > 350 ? "high" : "medium",
        lat: f.lat,
        lng: f.lng,
        time: `${f.date}T${f.time}`,
      }));
    }

    if (layerState.news) {
      filteredNews.forEach(n => events.push({
        id: `news-${n.id}`,
        type: "news",
        title: n.headline,
        subtitle: n.region || "Global",
        severity: n.severity || "medium",
        lat: n.lat || 0,
        lng: n.lng || 0,
        time: n.timestamp || new Date().toISOString(),
        details: n.body,
        url: undefined,
      }));
    }

    // Sort by most recent
    events.sort((a, b) => {
      const ta = typeof a.time === "number" ? a.time : new Date(a.time).getTime();
      const tb = typeof b.time === "number" ? b.time : new Date(b.time).getTime();
      return tb - ta;
    });

    return events.slice(0, 200);
  }, [filteredQuakes, filteredFires, filteredNews, layerState]);

  // Alert summary
  const alertSummary = useMemo(() => ({
    critical: eventFeed.filter(e => e.severity === "critical").length,
    high: eventFeed.filter(e => e.severity === "high").length,
    medium: eventFeed.filter(e => e.severity === "medium").length,
    low: eventFeed.filter(e => e.severity === "low").length,
    earthquakes: filteredQuakes.length,
    fires: filteredFires.length,
    news: filteredNews.length,
  }), [eventFeed, filteredQuakes, filteredFires, filteredNews]);

  const layers: CrisisLayer[] = [
    { id: "aircraft", label: "Civilian Aircraft", icon: Plane, color: "text-sky-400", enabled: layerState.aircraft, count: 0, loading: false, disclaimer: "Public aviation data may be delayed, incomplete, or inaccurate." },
    { id: "thermal", label: "Thermal / Fire Anomalies", icon: Flame, color: "text-orange-400", enabled: layerState.thermal, count: filteredFires.length, loading: wildfires.loading },
    { id: "geohazard", label: "Earthquake & Geohazards", icon: AlertTriangle, color: "text-amber-400", enabled: layerState.geohazard, count: filteredQuakes.length, loading: earthquakes.loading },
    { id: "webcams", label: "Public Webcams", icon: Camera, color: "text-emerald-400", enabled: layerState.webcams, count: 0, loading: false },
    { id: "news", label: "News & Crisis Reports", icon: Newspaper, color: "text-purple-400", enabled: layerState.news, count: filteredNews.length, loading: warUpdates.loading },
    { id: "userRegions", label: "User-Defined Regions", icon: MapPin, color: "text-primary", enabled: layerState.userRegions, count: 0, loading: false },
  ];

  const refreshAll = useCallback(() => {
    earthquakes.refresh();
    wildfires.refresh();
    warUpdates.refresh();
  }, [earthquakes, wildfires, warUpdates]);

  const eventIcon = (type: string) => {
    if (type === "earthquake") return "🌍";
    if (type === "fire") return "🔥";
    return "📰";
  };

  const tabs = [
    { id: "layers" as const, label: "Layers", icon: Filter },
    { id: "events" as const, label: "Events", icon: AlertTriangle },
    { id: "aircraft" as const, label: "Aircraft", icon: Plane },
    { id: "alerts" as const, label: "Summary", icon: Shield },
  ];

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-[95vw] max-w-[900px] h-[85vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ boxShadow: "0 0 60px hsl(190 100% 50% / 0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">Response Map — Crisis Awareness</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshAll} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Refresh all data">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-destructive/20 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-secondary/20 flex-wrap">
          <div className="relative flex-1 min-w-[140px] max-w-[240px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full h-7 pl-7 pr-2 text-xs font-mono bg-background border border-border rounded text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={selectedCountry}
            onChange={e => setSelectedCountry(e.target.value)}
            className="h-7 px-2 text-[10px] font-mono bg-background border border-border rounded text-foreground"
          >
            <option value="all">All Countries</option>
            {ME_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-0.5 bg-background border border-border rounded p-0.5">
            {(["1h", "6h", "24h", "7d"] as const).map(d => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-2 py-0.5 text-[9px] font-mono rounded transition-colors ${dateFilter === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-3">
            {/* LAYERS TAB */}
            {activeTab === "layers" && (
              <div className="space-y-2">
                {layers.map(layer => {
                  const Icon = layer.icon;
                  return (
                    <div key={layer.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => toggleLayer(layer.id as keyof typeof layerState)}
                          className={`w-8 h-4 rounded-full transition-colors relative ${layer.enabled ? "bg-primary" : "bg-muted"}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${layer.enabled ? "translate-x-4.5 left-0.5" : "left-0.5"}`} style={{ left: layer.enabled ? "16px" : "2px" }} />
                        </button>
                        <Icon className={`h-4 w-4 ${layer.enabled ? layer.color : "text-muted-foreground"}`} />
                        <div>
                          <div className="text-xs font-mono font-semibold text-foreground">{layer.label}</div>
                          {layer.disclaimer && (
                            <div className="text-[8px] font-mono text-muted-foreground/60 mt-0.5 max-w-[300px]">⚠ {layer.disclaimer}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {layer.loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                        <span className={`text-xs font-mono font-bold ${layer.enabled ? layer.color : "text-muted-foreground"}`}>{layer.count}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Source attribution */}
                <div className="mt-4 p-3 rounded border border-border/30 bg-secondary/10">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider mb-2">Data Sources & Attribution</div>
                  <div className="space-y-1 text-[9px] font-mono text-muted-foreground/70">
                    <div>✈ Aircraft — OpenSky Network (opensky-network.org) — CC BY-NC 4.0</div>
                    <div>🔥 Thermal — NASA FIRMS (MODIS/VIIRS) — Public Domain</div>
                    <div>🌍 Geohazards — USGS Earthquake Hazards Program — Public Domain</div>
                    <div>📹 Webcams — Approved public providers only</div>
                    <div>📰 News — Verified public news sources with citations</div>
                  </div>
                </div>
              </div>
            )}

            {/* EVENTS TAB */}
            {activeTab === "events" && (
              <div className="space-y-1">
                {eventFeed.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground font-mono text-xs">
                    No events match current filters
                  </div>
                ) : (
                  eventFeed.map(event => (
                    <div key={event.id} className="group">
                      <button
                        onClick={() => {
                          setExpandedEvent(expandedEvent === event.id ? null : event.id);
                          if (event.lat && event.lng) onFlyTo(event.lat, event.lng, 8);
                        }}
                        className="w-full text-left flex items-start gap-2 p-2 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        <span className="text-sm mt-0.5">{eventIcon(event.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] font-mono font-bold uppercase ${severityColor(event.severity)}`}>
                              ● {event.severity}
                            </span>
                            <span className="text-[8px] font-mono text-muted-foreground">{timeAgo(event.time)}</span>
                          </div>
                          <div className="text-xs font-mono font-semibold text-foreground truncate">{event.title}</div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate">{event.subtitle}</div>
                        </div>
                        <div className="flex-shrink-0">
                          {expandedEvent === event.id ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedEvent === event.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-7 p-2 text-[10px] font-mono text-muted-foreground space-y-1 border-l-2 border-primary/20">
                              {event.details && <div>{event.details}</div>}
                              <div>📍 {event.lat.toFixed(4)}, {event.lng.toFixed(4)}</div>
                              {event.url && (
                                <a href={event.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> View source
                                </a>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* AIRCRAFT TAB */}
            {activeTab === "aircraft" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-sky-500/20 bg-sky-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-mono font-bold text-sky-400 uppercase">Civilian Aircraft Activity</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    Live aircraft state vectors from the OpenSky Network. Data shows publicly available ADS-B transponder information
                    for civilian aviation. Coverage depends on receiver network density.
                  </div>
                  <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <div className="text-[9px] font-mono text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Public aviation data may be delayed, incomplete, or inaccurate. Aircraft identification is based on publicly broadcast ADS-B data only.
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-muted-foreground space-y-1.5">
                  <div className="font-semibold text-foreground uppercase tracking-wider">How to use</div>
                  <div>• The aircraft layer on the main map shows real-time positions with heading, altitude, speed, and callsign</div>
                  <div>• Toggle the "Civilian Aircraft" layer in the Layers tab to show/hide</div>
                  <div>• Click on any aircraft marker for detailed information</div>
                  <div>• Data refreshes every 30 seconds from OpenSky Network</div>
                </div>

                <div className="p-2 rounded border border-border/30 bg-secondary/10">
                  <div className="text-[9px] font-mono text-muted-foreground">
                    Source: OpenSky Network (opensky-network.org) — CC BY-NC 4.0<br />
                    This module does not label or classify aircraft as military.
                  </div>
                </div>
              </div>
            )}

            {/* ALERTS SUMMARY TAB */}
            {activeTab === "alerts" && (
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground mb-2">Alert Summary — {dateFilter} window</div>

                {/* Severity breakdown */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Critical", count: alertSummary.critical, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                    { label: "High", count: alertSummary.high, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
                    { label: "Medium", count: alertSummary.medium, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                    { label: "Low", count: alertSummary.low, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                  ].map(s => (
                    <div key={s.label} className={`p-2.5 rounded-lg border ${s.bg} text-center`}>
                      <div className={`text-lg font-mono font-bold ${s.color}`}>{s.count}</div>
                      <div className="text-[9px] font-mono text-muted-foreground uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Category breakdown */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">By Category</div>
                  {[
                    { label: "Earthquakes & Geohazards", count: alertSummary.earthquakes, icon: "🌍" },
                    { label: "Thermal / Fire Anomalies", count: alertSummary.fires, icon: "🔥" },
                    { label: "News & Crisis Reports", count: alertSummary.news, icon: "📰" },
                  ].map(c => (
                    <div key={c.label} className="flex items-center justify-between p-2 rounded border border-border/30 bg-background/50">
                      <div className="flex items-center gap-2">
                        <span>{c.icon}</span>
                        <span className="text-xs font-mono text-foreground">{c.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-primary">{c.count}</span>
                    </div>
                  ))}
                </div>

                {/* Recent critical alerts */}
                {alertSummary.critical > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] font-mono uppercase text-red-400 tracking-wider mb-1.5">⚠ Critical Events</div>
                    {eventFeed.filter(e => e.severity === "critical").slice(0, 5).map(e => (
                      <button
                        key={e.id}
                        onClick={() => { if (e.lat && e.lng) onFlyTo(e.lat, e.lng, 8); }}
                        className="w-full text-left flex items-center gap-2 p-2 rounded border border-red-500/20 bg-red-500/5 mb-1 hover:bg-red-500/10 transition-colors"
                      >
                        <span>{eventIcon(e.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono font-semibold text-foreground truncate">{e.title}</div>
                          <div className="text-[9px] font-mono text-muted-foreground">{timeAgo(e.time)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Compliance notice */}
                <div className="mt-4 p-3 rounded border border-border/30 bg-secondary/10">
                  <div className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider mb-1">Compliance & Safety</div>
                  <div className="text-[9px] font-mono text-muted-foreground/70 leading-relaxed space-y-1">
                    <div>• This module uses only open, licensed, or officially permitted data sources</div>
                    <div>• No real-time missile detection, weapon tracking, or military target analysis</div>
                    <div>• No hostile intent inference — focused on civilian awareness & emergency response</div>
                    <div>• Data timestamps and source citations provided for all events</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/50 bg-background/60 flex items-center justify-between">
          <div className="text-[8px] font-mono text-muted-foreground/50">
            CIVILIAN AWARENESS ONLY — NOT FOR OPERATIONAL USE
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[8px] font-mono text-muted-foreground/50">
              Last refresh: {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
