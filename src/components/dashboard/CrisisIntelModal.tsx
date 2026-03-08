import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X, Brain, AlertTriangle, Shield, ChevronRight, ChevronLeft,
  Play, Pause, SkipBack, SkipForward, RefreshCw, Eye, EyeOff,
  MapPin, TrendingUp, TrendingDown, Minus, Clock, Users, Car,
  Construction, Zap, Radio, Filter
} from "lucide-react";
import { useCrisisIntel, type CrisisEvent, type CrisisSnapshot } from "@/hooks/useCrisisIntel";

interface CrisisIntelModalProps {
  onClose: () => void;
}

const CITIES = [
  "Baghdad", "Tehran", "Beirut", "Damascus", "Amman",
  "Riyadh", "Dubai", "Cairo", "Sanaa", "Gaza", "Khartoum", "Tripoli",
];

const EVENT_COLORS: Record<string, string> = {
  evacuation: "#3b82f6",
  protest: "#f97316",
  road_closure: "#ef4444",
  abnormal_activity: "#f59e0b",
  incident: "#dc2626",
  disruption: "#8b5cf6",
  rumor: "#6b7280",
};

const EVENT_ICONS: Record<string, typeof AlertTriangle> = {
  evacuation: Car,
  protest: Users,
  road_closure: Construction,
  abnormal_activity: Zap,
  incident: AlertTriangle,
  disruption: Radio,
  rumor: Eye,
};

const EVENT_LABELS: Record<string, string> = {
  evacuation: "Evacuation",
  protest: "Protest / Crowd",
  road_closure: "Road Closure",
  abnormal_activity: "Abnormal Activity",
  incident: "Incident",
  disruption: "Disruption",
  rumor: "Rumor / Unverified",
};

type LayerKey = "evacuation" | "protest" | "road_closure" | "abnormal_activity" | "incident" | "disruption" | "rumor";

const ALL_LAYERS: LayerKey[] = ["evacuation", "protest", "road_closure", "abnormal_activity", "incident", "disruption", "rumor"];

export const CrisisIntelModal = ({ onClose }: CrisisIntelModalProps) => {
  const [city, setCity] = useState("Baghdad");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(20);
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(new Set(ALL_LAYERS));
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  const [timelineIndex, setTimelineIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const { data, loading, error, history, refresh } = useCrisisIntel(city);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overlayLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const playIntervalRef = useRef<ReturnType<typeof setInterval>>();

  // Which events to show
  const displayEvents = useMemo(() => {
    const source = timelineIndex >= 0 && history[timelineIndex]
      ? history[timelineIndex].events
      : data?.events || [];
    return source.filter(
      (e) => activeLayers.has(e.type as LayerKey) && e.confidence >= confidenceThreshold
    );
  }, [data, history, timelineIndex, activeLayers, confidenceThreshold]);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [33.31, 44.37],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    overlayLayerRef.current.addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to city
  useEffect(() => {
    if (!mapRef.current || !data?.city_coords) return;
    mapRef.current.flyTo([data.city_coords.lat, data.city_coords.lng], data.city_coords.zoom, { duration: 1.2 });
  }, [data?.city_coords]);

  // Render overlays
  useEffect(() => {
    const group = overlayLayerRef.current;
    group.clearLayers();

    displayEvents.forEach((event) => {
      const color = EVENT_COLORS[event.type] || "#888";
      const opacity = 0.2 + (event.confidence / 100) * 0.6;

      if (event.polygon && event.polygon.length >= 3) {
        const poly = L.polygon(event.polygon as [number, number][], {
          color,
          fillColor: color,
          fillOpacity: opacity * 0.5,
          weight: event.verified ? 2 : 1,
          dashArray: event.verified ? undefined : "6 4",
        }).addTo(group);
        poly.on("click", () => setSelectedEvent(event));
        poly.bindTooltip(event.headline, { className: "crisis-tooltip" });
      } else if (event.type === "road_closure" && event.affected_roads?.length) {
        // Show as circle with dashed border
        const circle = L.circle([event.lat, event.lng], {
          radius: (event.radius_km || 0.5) * 1000,
          color,
          fillColor: color,
          fillOpacity: opacity * 0.3,
          weight: 3,
          dashArray: "8 6",
        }).addTo(group);
        circle.on("click", () => setSelectedEvent(event));
        circle.bindTooltip(event.headline, { className: "crisis-tooltip" });
      } else if (event.type === "evacuation") {
        // Outward arrows as lines from center
        const r = (event.radius_km || 1) * 0.01;
        const dirs = [
          [event.lat + r, event.lng],
          [event.lat - r, event.lng],
          [event.lat, event.lng + r],
          [event.lat, event.lng - r],
        ];
        dirs.forEach((end) => {
          L.polyline([[event.lat, event.lng], end as [number, number]], {
            color,
            weight: 3,
            opacity,
            dashArray: "4 8",
          }).addTo(group).bindTooltip(event.headline);
        });
        // Arrow center marker
        L.circleMarker([event.lat, event.lng], {
          radius: 6,
          color,
          fillColor: color,
          fillOpacity: opacity,
          weight: 2,
        }).addTo(group).on("click", () => setSelectedEvent(event));
      } else {
        // Default: circle zone
        const circle = L.circle([event.lat, event.lng], {
          radius: (event.radius_km || 0.5) * 1000,
          color,
          fillColor: color,
          fillOpacity: opacity * 0.4,
          weight: event.verified ? 2 : 1,
          dashArray: event.verified ? undefined : "5 5",
        }).addTo(group);
        circle.on("click", () => setSelectedEvent(event));

        // Pulse for incidents and abnormal
        if (event.type === "incident" || event.type === "abnormal_activity") {
          const pulseIcon = L.divIcon({
            className: "",
            html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};opacity:${opacity};animation:crisis-pulse 2s infinite;box-shadow:0 0 12px ${color}"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          L.marker([event.lat, event.lng], { icon: pulseIcon })
            .addTo(group)
            .on("click", () => setSelectedEvent(event))
            .bindTooltip(event.headline);
        } else {
          circle.bindTooltip(event.headline, { className: "crisis-tooltip" });
        }
      }

      // Unverified label
      if (!event.verified && event.type !== "rumor") {
        const labelIcon = L.divIcon({
          className: "",
          html: `<span style="font-size:8px;font-family:monospace;color:#f59e0b;background:rgba(0,0,0,0.7);padding:1px 3px;border-radius:2px;white-space:nowrap">UNVERIFIED</span>`,
          iconSize: [60, 12],
          iconAnchor: [30, -10],
        });
        L.marker([event.lat, event.lng], { icon: labelIcon, interactive: false }).addTo(group);
      }
    });
  }, [displayEvents]);

  // Timeline playback
  useEffect(() => {
    if (isPlaying && history.length > 0) {
      playIntervalRef.current = setInterval(() => {
        setTimelineIndex((prev) => {
          const next = prev + 1;
          if (next >= history.length) {
            setIsPlaying(false);
            return history.length - 1;
          }
          return next;
        });
      }, 2000);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, history.length]);

  const toggleLayer = (key: LayerKey) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const flyToEvent = useCallback((event: CrisisEvent) => {
    setSelectedEvent(event);
    mapRef.current?.flyTo([event.lat, event.lng], 15, { duration: 0.8 });
  }, []);

  const threatColor = {
    low: "text-emerald-400",
    moderate: "text-amber-400",
    elevated: "text-orange-400",
    high: "text-red-400",
    critical: "text-red-500",
  }[data?.threat_level || "moderate"] || "text-amber-400";

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ zIndex: 2147483647 }}
      className="fixed inset-0 isolate bg-background/95 backdrop-blur-sm flex flex-col pointer-events-auto"
    >
      {/* Pulse animation */}
      <style>{`
        @keyframes crisis-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.8); opacity: 0.2; }
        }
        .crisis-tooltip { font-family: monospace !important; font-size: 10px !important; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-bold tracking-wide text-foreground">CRISIS INTELLIGENCE</h2>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="bg-secondary border border-border rounded px-2 py-0.5 text-xs font-mono text-foreground"
          >
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {data?.threat_level && (
            <span className={`text-[10px] font-mono font-bold uppercase ${threatColor}`}>
              ● {data.threat_level}
            </span>
          )}
          {loading && <RefreshCw className="h-3 w-3 text-primary animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setSidePanelOpen(!sidePanelOpen)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            {sidePanelOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Layer toggle bar */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border bg-card/50 overflow-x-auto">
        {ALL_LAYERS.map((key) => {
          const Icon = EVENT_ICONS[key] || AlertTriangle;
          const active = activeLayers.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono uppercase border transition-all ${
                active
                  ? "border-border bg-secondary/80 text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground/50"
              }`}
              style={active ? { borderColor: EVENT_COLORS[key] + "60" } : {}}
            >
              <Icon className="h-3 w-3" style={{ color: active ? EVENT_COLORS[key] : undefined }} />
              {EVENT_LABELS[key]}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-[9px] font-mono text-muted-foreground">Confidence ≥{confidenceThreshold}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
            className="w-20 h-1 accent-primary"
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Event count badge */}
          <div className="absolute top-3 left-3 bg-card/90 backdrop-blur border border-border rounded px-2 py-1 z-[1000]">
            <span className="text-[10px] font-mono text-muted-foreground">
              {displayEvents.length} events • {displayEvents.filter(e => e.verified).length} verified
            </span>
          </div>

          {/* Legend */}
          <div className="absolute bottom-16 left-3 bg-card/90 backdrop-blur border border-border rounded p-2 z-[1000] space-y-0.5">
            {ALL_LAYERS.filter(k => activeLayers.has(k)).map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_COLORS[key] }} />
                <span className="text-[8px] font-mono text-muted-foreground">{EVENT_LABELS[key]}</span>
              </div>
            ))}
          </div>

          {/* Timeline slider */}
          <div className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur border-t border-border p-2 z-[1000]">
            <div className="flex items-center gap-2">
              <button onClick={() => { setTimelineIndex(0); }} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                <SkipBack className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (history.length === 0) return;
                  setIsPlaying(!isPlaying);
                  if (timelineIndex < 0) setTimelineIndex(0);
                }}
                className="p-1 rounded hover:bg-secondary text-primary"
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>
              <button onClick={() => setTimelineIndex(Math.min(history.length - 1, timelineIndex + 1))} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                <SkipForward className="h-3 w-3" />
              </button>
              <input
                type="range"
                min={-1}
                max={history.length - 1}
                value={timelineIndex}
                onChange={(e) => setTimelineIndex(parseInt(e.target.value))}
                className="flex-1 h-1 accent-primary"
              />
              <span className="text-[9px] font-mono text-muted-foreground w-16 text-right">
                {timelineIndex >= 0 && history[timelineIndex]
                  ? new Date(history[timelineIndex].timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
                  : "LIVE"
                }
              </span>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          {sidePanelOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-border bg-card/80 backdrop-blur overflow-y-auto"
            >
              <div className="p-3 space-y-3">
                {/* City Summary */}
                {data?.city_summary && (
                  <div className="bg-secondary/50 rounded p-2 border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-mono font-bold text-foreground uppercase">SITUATION SUMMARY</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{data.city_summary}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[9px] font-mono font-bold uppercase ${threatColor}`}>
                        THREAT: {data.threat_level}
                      </span>
                      <span className="text-[8px] font-mono text-muted-foreground">
                        {data.timestamp ? new Date(data.timestamp).toLocaleTimeString("en-US", { hour12: false }) : ""}
                      </span>
                    </div>
                  </div>
                )}

                {/* Alerts */}
                <div>
                  <h3 className="text-[10px] font-mono font-bold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    ACTIVE ALERTS ({displayEvents.length})
                  </h3>
                  <div className="space-y-1.5">
                    {displayEvents.sort((a, b) => b.confidence - a.confidence).map((event) => {
                      const Icon = EVENT_ICONS[event.type] || AlertTriangle;
                      const color = EVENT_COLORS[event.type];
                      const TrendIcon = event.trend === "rising" ? TrendingUp : event.trend === "declining" ? TrendingDown : Minus;
                      const isSelected = selectedEvent?.id === event.id;

                      return (
                        <button
                          key={event.id}
                          onClick={() => flyToEvent(event)}
                          className={`w-full text-left p-2 rounded border transition-all ${
                            isSelected
                              ? "border-primary/50 bg-primary/10"
                              : "border-border/50 bg-secondary/30 hover:bg-secondary/60"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-mono font-semibold text-foreground truncate">
                                  {event.headline}
                                </span>
                                {!event.verified && (
                                  <span className="text-[7px] font-mono text-amber-400 bg-amber-400/10 px-1 rounded shrink-0">
                                    UNVERIFIED
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{event.summary}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className="text-[8px] font-mono px-1 rounded"
                                  style={{
                                    color,
                                    backgroundColor: color + "15",
                                  }}
                                >
                                  {event.confidence}% {event.confidence_label}
                                </span>
                                <span className="text-[8px] font-mono text-muted-foreground flex items-center gap-0.5">
                                  <Radio className="h-2 w-2" /> {event.source_count} src
                                </span>
                                <TrendIcon className="h-2.5 w-2.5 text-muted-foreground" />
                                <span className="text-[8px] font-mono text-muted-foreground">{event.district}</span>
                              </div>
                              {event.affected_roads?.length > 0 && (
                                <div className="text-[8px] text-muted-foreground/70 mt-0.5 truncate">
                                  Roads: {event.affected_roads.join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {displayEvents.length === 0 && !loading && (
                      <div className="text-center py-6 text-[10px] text-muted-foreground">
                        No events match current filters
                      </div>
                    )}
                    {loading && displayEvents.length === 0 && (
                      <div className="text-center py-6 text-[10px] text-muted-foreground animate-pulse">
                        Analyzing intelligence for {city}...
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Event Detail */}
                <AnimatePresence>
                  {selectedEvent && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-secondary/50 rounded p-2 border border-border overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold text-foreground uppercase">EVENT DETAIL</span>
                        <button onClick={() => setSelectedEvent(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-1 text-[9px] font-mono text-muted-foreground">
                        <div><strong className="text-foreground">Type:</strong> {EVENT_LABELS[selectedEvent.type]}</div>
                        <div><strong className="text-foreground">Confidence:</strong> {selectedEvent.confidence}% ({selectedEvent.confidence_label})</div>
                        <div><strong className="text-foreground">District:</strong> {selectedEvent.district}</div>
                        <div><strong className="text-foreground">Coords:</strong> {selectedEvent.lat.toFixed(4)}, {selectedEvent.lng.toFixed(4)}</div>
                        <div><strong className="text-foreground">Radius:</strong> {selectedEvent.radius_km} km</div>
                        <div><strong className="text-foreground">Verified:</strong> {selectedEvent.verified ? "Yes" : "No"}</div>
                        <div><strong className="text-foreground">Trend:</strong> {selectedEvent.trend}</div>
                        {selectedEvent.evacuation_direction && (
                          <div><strong className="text-foreground">Direction:</strong> {selectedEvent.evacuation_direction}</div>
                        )}
                        <div className="mt-1.5">
                          <strong className="text-foreground">Sources ({selectedEvent.source_count}):</strong>
                          <div className="mt-0.5 space-y-0.5">
                            {selectedEvent.sources?.map((s, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  s.reliability === "high" ? "bg-emerald-400" : s.reliability === "medium" ? "bg-amber-400" : "bg-red-400"
                                }`} />
                                {s.name} ({s.reliability})
                              </div>
                            ))}
                          </div>
                        </div>
                        {selectedEvent.affected_roads?.length > 0 && (
                          <div className="mt-1">
                            <strong className="text-foreground">Affected Roads:</strong>
                            <ul className="ml-2 mt-0.5">
                              {selectedEvent.affected_roads.map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Disclaimer */}
                <div className="bg-amber-400/5 border border-amber-400/20 rounded p-2">
                  <p className="text-[8px] font-mono text-amber-400/80 leading-relaxed">
                    ⚠ DISCLAIMER: Events are AI-analyzed from public OSINT sources. Confidence scores reflect source corroboration, not certainty. Unverified events may be inaccurate. Do not use as sole basis for decisions.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground text-[10px] font-mono px-3 py-1 rounded z-[9999999]">
          {error}
        </div>
      )}
    </motion.div>
  );

  return createPortal(content, document.body);
};
