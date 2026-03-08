import { useState, useMemo, useCallback } from "react";
import { X, RefreshCw, Plane, Flame, AlertTriangle, Camera, Newspaper, MapPin, Filter, Clock, Shield, ChevronDown, ChevronUp, ExternalLink, Search, Navigation, Ship, Rocket, Mountain, Cloud, Car, Crosshair, Radio, Radiation, Wind, Anchor } from "lucide-react";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { Wildfire } from "@/hooks/useWildfires";
import type { ConflictEvent } from "@/hooks/useConflictEvents";
import type { RadiationStation, NuclearFacility } from "@/hooks/useNuclearMonitors";
import type { AirQualityStation } from "@/hooks/useAirQuality";
import type { AISVessel } from "@/hooks/useAISVessels";
import type { WarUpdate } from "@/hooks/useWarUpdates";
import type { TelegramMarker } from "@/hooks/useTelegramIntel";
import type { LayerState } from "./LayerControls";
import type { AirspaceAlert, MaritimeVessel, GeoAlert, Rocket as RocketType } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

interface ResponseMapProps {
  onClose: () => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
  // Live data from IntelMap
  earthquakes: { data: Earthquake[]; loading: boolean; refresh: () => void };
  wildfires: { data: Wildfire[]; loading: boolean; refresh: () => void };
  conflicts: { data: ConflictEvent[]; loading: boolean };
  nuclearStations: RadiationStation[];
  nuclearFacilities: NuclearFacility[];
  airQuality: { data: AirQualityStation[]; loading: boolean };
  aisVessels: { data: AISVessel[]; loading: boolean };
  newsMarkers: WarUpdate[];
  telegramMarkers: TelegramMarker[];
  airspaceAlerts: AirspaceAlert[];
  vessels: MaritimeVessel[];
  geoAlerts: GeoAlert[];
  rockets: RocketType[];
  flightCount: number;
  // Layer sync
  layers: LayerState;
  onToggleLayer: (layer: keyof LayerState) => void;
}

const ME_COUNTRIES = [
  "Jordan", "Iraq", "Syria", "Lebanon", "Palestine", "Israel", "Iran",
  "Saudi Arabia", "UAE", "United Arab Emirates", "Qatar", "Bahrain",
  "Kuwait", "Oman", "Yemen", "Egypt", "Libya", "Tunisia", "Algeria",
  "Morocco", "Sudan", "Turkey",
];

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

export const ResponseMapModal = ({
  onClose, onFlyTo,
  earthquakes, wildfires, conflicts, nuclearStations, nuclearFacilities,
  airQuality, aisVessels, newsMarkers, telegramMarkers,
  airspaceAlerts, vessels, geoAlerts, rockets, flightCount,
  layers, onToggleLayer,
}: ResponseMapProps) => {
  const [activeTab, setActiveTab] = useState<"layers" | "events" | "aircraft" | "alerts">("events");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const dateCutoff = useMemo(() => {
    const hours = dateFilter === "1h" ? 1 : dateFilter === "6h" ? 6 : dateFilter === "24h" ? 24 : 168;
    return Date.now() - hours * 3_600_000;
  }, [dateFilter]);

  const filteredQuakes = useMemo(() =>
    earthquakes.data.filter(q => {
      if (q.time < dateCutoff) return false;
      if (searchQuery && !q.place.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }), [earthquakes.data, dateCutoff, searchQuery]);

  const filteredFires = useMemo(() =>
    wildfires.data.filter(f => {
      if (searchQuery && !(f.region || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }), [wildfires.data, searchQuery]);

  const filteredConflicts = useMemo(() =>
    conflicts.data.filter(c => {
      if (searchQuery && !c.location.toLowerCase().includes(searchQuery.toLowerCase()) && !c.notes.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedCountry !== "all" && !c.country.toLowerCase().includes(selectedCountry.toLowerCase())) return false;
      return true;
    }).slice(0, 50), [conflicts.data, searchQuery, selectedCountry]);

  const filteredNews = useMemo(() =>
    newsMarkers.filter(u => {
      if (searchQuery && !u.headline.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedCountry !== "all" && !(u.region || "").toLowerCase().includes(selectedCountry.toLowerCase())) return false;
      return true;
    }).slice(0, 50), [newsMarkers, searchQuery, selectedCountry]);

  const filteredTelegram = useMemo(() =>
    telegramMarkers.filter(t => {
      if (searchQuery && !t.headline.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }), [telegramMarkers, searchQuery]);

  // Unified event feed from ALL sources
  const eventFeed = useMemo(() => {
    const events: Array<{
      id: string; type: string; title: string; subtitle: string;
      severity: string; lat: number; lng: number; time: string | number;
      details?: string; url?: string; source: string;
    }> = [];

    if (layers.earthquakes) {
      filteredQuakes.forEach(q => events.push({
        id: q.id, type: "earthquake",
        title: `M${q.magnitude.toFixed(1)} — ${q.place}`,
        subtitle: `Depth: ${q.depth}km${q.tsunami ? " ⚠ TSUNAMI" : ""}`,
        severity: q.magnitude >= 6 ? "critical" : q.magnitude >= 4.5 ? "high" : q.magnitude >= 3 ? "medium" : "low",
        lat: q.lat, lng: q.lng, time: q.time,
        details: `Type: ${q.type} | Felt: ${q.felt ?? "N/A"} | Significance: ${q.significance}`,
        url: q.url, source: "USGS",
      }));
    }

    if (layers.wildfires) {
      filteredFires.forEach(f => events.push({
        id: f.id, type: "fire",
        title: `Thermal Anomaly — ${f.region || "Unknown"}`,
        subtitle: `Brightness: ${f.brightness} | FRP: ${f.frp} | Conf: ${f.confidence}`,
        severity: f.brightness > 400 ? "critical" : f.brightness > 350 ? "high" : "medium",
        lat: f.lat, lng: f.lng, time: `${f.date}T${f.time}`, source: "NASA FIRMS",
      }));
    }

    if (layers.conflicts) {
      filteredConflicts.forEach(c => events.push({
        id: c.id, type: "conflict",
        title: `${c.event_type} — ${c.location}`,
        subtitle: `${c.country} — ${c.source}`,
        severity: c.severity || "high",
        lat: c.lat, lng: c.lng, time: c.event_date || new Date().toISOString(),
        details: c.notes, source: "GDELT",
      }));
    }

    filteredNews.forEach(n => events.push({
      id: n.id, type: "news",
      title: n.headline, subtitle: n.region || "Global",
      severity: n.severity || "medium",
      lat: n.lat || 0, lng: n.lng || 0,
      time: n.timestamp || new Date().toISOString(),
      details: n.body, source: n.source,
    }));

    filteredTelegram.forEach(t => events.push({
      id: t.id, type: "telegram",
      title: t.headline, subtitle: t.summary,
      severity: t.severity, lat: t.lat, lng: t.lng,
      time: t.timestamp, source: "WarsLeaks",
    }));

    // Geo alerts
    geoAlerts.forEach(g => events.push({
      id: g.id, type: "geo_alert",
      title: g.title, subtitle: `${g.region} — ${g.type}`,
      severity: g.severity, lat: g.lat, lng: g.lng,
      time: g.timestamp, details: g.summary, source: g.source,
    }));

    events.sort((a, b) => {
      const ta = typeof a.time === "number" ? a.time : new Date(a.time).getTime();
      const tb = typeof b.time === "number" ? b.time : new Date(b.time).getTime();
      return tb - ta;
    });
    return events.slice(0, 300);
  }, [filteredQuakes, filteredFires, filteredConflicts, filteredNews, filteredTelegram, geoAlerts, layers]);

  const alertSummary = useMemo(() => ({
    total: eventFeed.length,
    critical: eventFeed.filter(e => e.severity === "critical").length,
    high: eventFeed.filter(e => e.severity === "high").length,
    medium: eventFeed.filter(e => e.severity === "medium").length,
    low: eventFeed.filter(e => e.severity === "low").length,
    earthquakes: filteredQuakes.length,
    fires: filteredFires.length,
    conflicts: filteredConflicts.length,
    news: filteredNews.length,
    telegram: filteredTelegram.length,
    geoAlerts: geoAlerts.length,
    airspace: airspaceAlerts.filter(a => a.active).length,
    vessels: vessels.length,
    aisVessels: aisVessels.data.length,
    flights: flightCount,
    rockets: rockets.length,
    nuclear: nuclearStations.length + nuclearFacilities.length,
    airQuality: airQuality.data.length,
  }), [eventFeed, filteredQuakes, filteredFires, filteredConflicts, filteredNews, filteredTelegram, geoAlerts, airspaceAlerts, vessels, aisVessels, flightCount, rockets, nuclearStations, nuclearFacilities, airQuality]);

  const layerConfig: Array<{ key: keyof LayerState; label: string; icon: any; color: string; count: number; loading: boolean; disclaimer?: string }> = [
    { key: "flights", label: "Civilian Aircraft (OpenSky)", icon: Navigation, color: "text-sky-400", count: flightCount, loading: false, disclaimer: "Public aviation data may be delayed, incomplete, or inaccurate." },
    { key: "airspace", label: "Airspace Alerts (NOTAMs)", icon: Plane, color: "text-primary", count: alertSummary.airspace, loading: false },
    { key: "maritime", label: "Maritime Vessels", icon: Ship, color: "text-primary", count: vessels.length, loading: false },
    { key: "aisVessels", label: "AIS Ship Tracking", icon: Anchor, color: "text-primary", count: aisVessels.data.length, loading: aisVessels.loading },
    { key: "earthquakes", label: "Earthquakes & Geohazards (USGS)", icon: Mountain, color: "text-amber-400", count: earthquakes.data.length, loading: earthquakes.loading },
    { key: "wildfires", label: "Thermal / Fire Anomalies (NASA FIRMS)", icon: Flame, color: "text-orange-400", count: wildfires.data.length, loading: wildfires.loading },
    { key: "conflicts", label: "Conflict Events (GDELT)", icon: Crosshair, color: "text-red-400", count: conflicts.data.length, loading: conflicts.loading },
    { key: "nuclear", label: "Nuclear / Radiation Monitors", icon: Radiation, color: "text-amber-400", count: alertSummary.nuclear, loading: false },
    { key: "airQuality", label: "Air Quality (OpenAQ)", icon: Wind, color: "text-emerald-400", count: airQuality.data.length, loading: airQuality.loading },
    { key: "alerts", label: "Geo Alerts", icon: AlertTriangle, color: "text-warning", count: geoAlerts.length, loading: false },
    { key: "rockets", label: "Confirmed Launches", icon: Rocket, color: "text-red-400", count: rockets.length, loading: false },
    { key: "weather", label: "Weather Overlay", icon: Cloud, color: "text-primary", count: 0, loading: false },
    { key: "traffic", label: "Traffic", icon: Car, color: "text-accent", count: 0, loading: false },
    { key: "heatmap", label: "Density Heatmap", icon: Radio, color: "text-red-400", count: 0, loading: false },
  ];

  const refreshAll = useCallback(() => {
    earthquakes.refresh();
    wildfires.refresh();
  }, [earthquakes, wildfires]);

  const eventIcon = (type: string) => {
    const icons: Record<string, string> = {
      earthquake: "🌍", fire: "🔥", conflict: "⚔️", news: "📰",
      telegram: "📡", geo_alert: "⚠️",
    };
    return icons[type] || "📌";
  };

  const tabs = [
    { id: "layers" as const, label: "Layers", icon: Filter, badge: layerConfig.filter(l => layers[l.key]).length },
    { id: "events" as const, label: "Events", icon: AlertTriangle, badge: eventFeed.length },
    { id: "aircraft" as const, label: "Aircraft", icon: Plane, badge: flightCount },
    { id: "alerts" as const, label: "Summary", icon: Shield, badge: alertSummary.critical },
  ];

  return (
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
        className="relative w-[95vw] max-w-[960px] h-[88vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ boxShadow: "0 0 60px hsl(var(--primary) / 0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">Response Map — Live Crisis Awareness</h2>
            <span className="text-[9px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{alertSummary.total} EVENTS</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshAll} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Refresh data">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-destructive/20 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-secondary/20 flex-wrap">
          <div className="relative flex-1 min-w-[140px] max-w-[240px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..." className="w-full h-7 pl-7 pr-2 text-xs font-mono bg-background border border-border rounded text-foreground placeholder:text-muted-foreground" />
          </div>
          <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}
            className="h-7 px-2 text-[10px] font-mono bg-background border border-border rounded text-foreground">
            <option value="all">All Countries</option>
            {ME_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-0.5 bg-background border border-border rounded p-0.5">
            {(["1h", "6h", "24h", "7d"] as const).map(d => (
              <button key={d} onClick={() => setDateFilter(d)}
                className={`px-2 py-0.5 text-[9px] font-mono rounded transition-colors ${dateFilter === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors border-b-2 ${
                  activeTab === tab.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="h-3 w-3" />
                {tab.label}
                {tab.badge > 0 && <span className="text-[8px] bg-primary/20 text-primary px-1.5 rounded-full">{tab.badge}</span>}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-3">
            {/* LAYERS TAB — syncs with actual map layers */}
            {activeTab === "layers" && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-mono text-muted-foreground mb-2">Toggle layers on the live 2D map. Changes apply in real-time.</div>
                {layerConfig.map(layer => {
                  const Icon = layer.icon;
                  const enabled = layers[layer.key];
                  return (
                    <div key={layer.key} className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${enabled ? "border-primary/30 bg-primary/5" : "border-border/30 bg-background/50"}`}>
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => onToggleLayer(layer.key)}
                          className={`w-8 h-4 rounded-full transition-colors relative ${enabled ? "bg-primary" : "bg-muted"}`}>
                          <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform" style={{ left: enabled ? "16px" : "2px" }} />
                        </button>
                        <Icon className={`h-3.5 w-3.5 ${enabled ? layer.color : "text-muted-foreground"}`} />
                        <div>
                          <div className="text-[11px] font-mono font-semibold text-foreground">{layer.label}</div>
                          {layer.disclaimer && <div className="text-[8px] font-mono text-muted-foreground/60 mt-0.5">⚠ {layer.disclaimer}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {layer.loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                        <span className={`text-xs font-mono font-bold ${enabled ? layer.color : "text-muted-foreground"}`}>{layer.count}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="mt-3 text-[9px] font-mono text-muted-foreground/60 space-y-0.5 p-2 rounded border border-border/20">
                  <div className="font-bold text-muted-foreground mb-1">DATA SOURCES</div>
                  <div>✈ Aircraft — OpenSky Network — CC BY-NC 4.0</div>
                  <div>🔥 Thermal — NASA FIRMS (MODIS/VIIRS) — Public Domain</div>
                  <div>🌍 Geohazards — USGS Earthquake Hazards — Public Domain</div>
                  <div>⚔️ Conflicts — GDELT Project — Open Access</div>
                  <div>☢ Nuclear — Safecast / IAEA — Open Data</div>
                  <div>💨 Air Quality — OpenAQ — CC BY 4.0</div>
                  <div>🚢 AIS — Public AIS feeds</div>
                  <div>📡 Intel — WarsLeaks Telegram (OSINT)</div>
                </div>
              </div>
            )}

            {/* EVENTS TAB — unified live feed */}
            {activeTab === "events" && (
              <div className="space-y-1">
                {eventFeed.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground font-mono text-xs">No events match current filters</div>
                ) : eventFeed.map(event => (
                  <div key={event.id} className="group">
                    <button onClick={() => {
                      setExpandedEvent(expandedEvent === event.id ? null : event.id);
                      if (event.lat && event.lng) onFlyTo(event.lat, event.lng, 8);
                    }} className="w-full text-left flex items-start gap-2 p-2 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all">
                      <span className="text-sm mt-0.5">{eventIcon(event.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-mono font-bold uppercase ${severityColor(event.severity)}`}>● {event.severity}</span>
                          <span className="text-[8px] font-mono text-muted-foreground">{timeAgo(event.time)}</span>
                          <span className="text-[7px] font-mono text-muted-foreground/50 bg-secondary/50 px-1 rounded">{event.source}</span>
                        </div>
                        <div className="text-xs font-mono font-semibold text-foreground truncate">{event.title}</div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">{event.subtitle}</div>
                      </div>
                      {expandedEvent === event.id ? <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    </button>
                    <AnimatePresence>
                      {expandedEvent === event.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="ml-7 p-2 text-[10px] font-mono text-muted-foreground space-y-1 border-l-2 border-primary/20">
                            {event.details && <div>{event.details}</div>}
                            <div>📍 {event.lat.toFixed(4)}, {event.lng.toFixed(4)}</div>
                            {event.url && <a href={event.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3 w-3" /> View source</a>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}

            {/* AIRCRAFT TAB */}
            {activeTab === "aircraft" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-sky-500/20 bg-sky-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-mono font-bold text-sky-400 uppercase">Civilian Aircraft — Live</span>
                    <span className="text-[9px] font-mono bg-sky-500/20 text-sky-400 px-2 rounded-full">{flightCount} tracked</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    Real-time ADS-B data from the OpenSky Network. Shows heading, altitude, speed, callsign, and origin for publicly broadcasting aircraft.
                  </div>
                  <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <div className="text-[9px] font-mono text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Public aviation data may be delayed, incomplete, or inaccurate. This module does not label or classify aircraft as military.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded border border-border/30 bg-background/50 text-center">
                    <div className="text-lg font-mono font-bold text-primary">{flightCount}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">Aircraft</div>
                  </div>
                  <div className="p-2 rounded border border-border/30 bg-background/50 text-center">
                    <div className="text-lg font-mono font-bold text-primary">{alertSummary.airspace}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">NOTAMs</div>
                  </div>
                  <div className="p-2 rounded border border-border/30 bg-background/50 text-center">
                    <div className="text-lg font-mono font-bold text-primary">{vessels.length + aisVessels.data.length}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">Vessels</div>
                  </div>
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/60 p-2 rounded border border-border/20">
                  Source: OpenSky Network (opensky-network.org) — CC BY-NC 4.0
                </div>
              </div>
            )}

            {/* ALERTS SUMMARY TAB */}
            {activeTab === "alerts" && (
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">Live Situation Summary — {dateFilter}</div>

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

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Earthquakes", count: alertSummary.earthquakes, icon: "🌍" },
                    { label: "Fire / Thermal", count: alertSummary.fires, icon: "🔥" },
                    { label: "Conflict Events", count: alertSummary.conflicts, icon: "⚔️" },
                    { label: "News Reports", count: alertSummary.news, icon: "📰" },
                    { label: "WarsLeaks Intel", count: alertSummary.telegram, icon: "📡" },
                    { label: "Geo Alerts", count: alertSummary.geoAlerts, icon: "⚠️" },
                    { label: "Aircraft Tracked", count: alertSummary.flights, icon: "✈️" },
                    { label: "Airspace NOTAMs", count: alertSummary.airspace, icon: "🛫" },
                    { label: "Maritime Vessels", count: alertSummary.vessels, icon: "🚢" },
                    { label: "AIS Ships", count: alertSummary.aisVessels, icon: "⚓" },
                    { label: "Nuclear Monitors", count: alertSummary.nuclear, icon: "☢️" },
                    { label: "Air Quality", count: alertSummary.airQuality, icon: "💨" },
                    { label: "Rockets / Launches", count: alertSummary.rockets, icon: "🚀" },
                  ].map(c => (
                    <div key={c.label} className="flex items-center justify-between p-1.5 rounded border border-border/30 bg-background/50">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{c.icon}</span>
                        <span className="text-[10px] font-mono text-foreground">{c.label}</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-primary">{c.count}</span>
                    </div>
                  ))}
                </div>

                {alertSummary.critical > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] font-mono uppercase text-red-400 tracking-wider mb-1">⚠ Critical Events</div>
                    {eventFeed.filter(e => e.severity === "critical").slice(0, 5).map(e => (
                      <button key={e.id} onClick={() => onFlyTo(e.lat, e.lng, 8)}
                        className="w-full text-left flex items-center gap-2 p-2 rounded border border-red-500/20 bg-red-500/5 mb-1 hover:bg-red-500/10 transition-colors">
                        <span>{eventIcon(e.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono font-semibold text-foreground truncate">{e.title}</div>
                          <div className="text-[9px] font-mono text-muted-foreground">{timeAgo(e.time)} — {e.source}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 p-2 rounded border border-border/20 bg-secondary/10">
                  <div className="text-[8px] font-mono text-muted-foreground/60 leading-relaxed space-y-0.5">
                    <div>• Open, licensed, or officially permitted data sources only</div>
                    <div>• No missile detection, weapon tracking, or military target analysis</div>
                    <div>• Civilian awareness, emergency response, and research only</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-4 py-1.5 border-t border-border/50 bg-background/60 flex items-center justify-between">
          <div className="text-[8px] font-mono text-muted-foreground/50">CIVILIAN AWARENESS ONLY — NOT FOR OPERATIONAL USE</div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[8px] font-mono text-muted-foreground/50">{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
