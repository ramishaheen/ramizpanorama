import { useState, useMemo } from "react";
import { Satellite, Camera, Radio, Globe, Radar, Wifi, WifiOff, RefreshCw, Zap, Activity, Cpu, ChevronDown, ChevronRight, AlertTriangle, Signal, X, Crosshair, Navigation } from "lucide-react";
import { useSensorFeeds, type SensorFeed } from "@/hooks/useSensorFeeds";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const FEED_ICONS: Record<string, React.ReactNode> = {
  satellite: <Satellite className="h-3 w-3" />,
  drone: <Globe className="h-3 w-3" />,
  cctv: <Camera className="h-3 w-3" />,
  sigint: <Radio className="h-3 w-3" />,
  osint: <Globe className="h-3 w-3" />,
  ground: <Radar className="h-3 w-3" />,
  iot: <Cpu className="h-3 w-3" />,
};

const FEED_COLORS: Record<string, string> = {
  satellite: "#00d4ff",
  drone: "#f97316",
  cctv: "#22c55e",
  sigint: "#a855f7",
  osint: "#eab308",
  ground: "#ef4444",
  iot: "#06b6d4",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  degraded: "#eab308",
  offline: "#ef4444",
  maintenance: "#6b7280",
  error: "#ef4444",
};

const PROTOCOL_LABELS: Record<string, string> = {
  api_rest: "REST",
  api_ws: "WS",
  hls_stream: "HLS",
  rtsp: "RTSP",
  mqtt: "MQTT",
  webhook: "HOOK",
  manual: "MAN",
};

export interface SensorContext {
  type: "event" | "target";
  title: string;
  event_type: string;
  severity: string;
  lat: number;
  lng: number;
  source: string;
  details?: string;
}

interface SensorFusionPanelProps {
  onToggleCoverage?: () => void;
  coverageEnabled?: boolean;
  onLocate?: (lat: number, lng: number) => void;
  activeContext?: SensorContext | null;
  onClearContext?: () => void;
  onNavigateToEvent?: (tab: "FEED" | "TARGETS", lat: number, lng: number) => void;
  onSelectFeed?: (feed: SensorFeed) => void;
  activeFeedId?: string | null;
}

export const SensorFusionPanel = ({ onToggleCoverage, coverageEnabled, onLocate, activeContext, onClearContext, onNavigateToEvent }: SensorFusionPanelProps) => {
  const { feeds, summary, loading, fetchFeeds, feedsByCategory } = useSensorFeeds();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(true);

  const handlePulse = async () => {
    setPulsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensor-ingest", {
        body: { action: "pulse" },
      });
      if (error) throw error;
      toast.success(`⚡ Pulsed ${data?.pulsed || 0} sensor feeds`);
      fetchFeeds();
    } catch {
      toast.error("Pulse failed");
    } finally {
      setPulsing(false);
    }
  };

  // Filter feeds by proximity when context is active
  const filteredFeeds = useMemo(() => {
    if (!activeContext || !nearbyOnly) return feeds;
    return feeds.filter(f => {
      const dist = haversineKm(f.lat, f.lng, activeContext.lat, activeContext.lng);
      return dist <= Math.max(f.coverage_radius_km, 50); // min 50km threshold
    });
  }, [feeds, activeContext, nearbyOnly]);

  const filteredFeedsByCategory = useMemo(() => {
    const cats: Record<string, SensorFeed[]> = {
      satellite: [], drone: [], cctv: [], sigint: [], osint: [], ground: [], iot: [],
    };
    filteredFeeds.forEach(f => {
      const prefix = f.feed_type.split("_")[0];
      if (cats[prefix]) cats[prefix].push(f);
      else cats.osint.push(f);
    });
    return cats;
  }, [filteredFeeds]);

  const catOrder = ["satellite", "drone", "cctv", "sigint", "osint", "ground", "iot"];
  const catLabels: Record<string, string> = {
    satellite: "SPACE / SAT", drone: "AERIAL / UAS", cctv: "CCTV / CAM", sigint: "SIGINT / EW",
    osint: "OSINT", ground: "GROUND / RADAR", iot: "IoT / SCADA",
  };

  const catDescriptions: Record<string, string> = {
    satellite: "EO, SAR, IR orbital assets",
    drone: "FMV, LiDAR aerial platforms",
    cctv: "Fixed surveillance cameras",
    sigint: "RF, COMINT, ELINT sensors",
    osint: "Social, news, ADS-B, AIS feeds",
    ground: "Radar, acoustic arrays",
    iot: "SCADA, buoy arrays, edge sensors",
  };

  const totalFeeds = filteredFeeds.length;
  const activeCount = filteredFeeds.filter(f => f.status === "active").length;
  const degradedCount = filteredFeeds.filter(f => f.status === "degraded").length;
  const offlineCount = filteredFeeds.filter(f => f.status === "offline" || f.status === "error").length;
  const avgHealth = totalFeeds > 0 ? Math.round(filteredFeeds.reduce((s, f) => s + f.health_score, 0) / totalFeeds) : 0;
  const totalDataRate = filteredFeeds.reduce((s, f) => s + f.data_rate_hz, 0);

  const healthColor = avgHealth >= 85 ? "#22c55e" : avgHealth >= 60 ? "#eab308" : "#ef4444";

  const formatDataRate = (hz: number) => {
    if (hz >= 1) return `${hz.toFixed(0)} Hz`;
    if (hz >= 0.01) return `${(hz * 60).toFixed(1)}/min`;
    return `${(hz * 3600).toFixed(1)}/hr`;
  };

  const lastUpdate = useMemo(() => {
    const latest = filteredFeeds.reduce((max, f) => {
      const t = f.last_data_at ? new Date(f.last_data_at).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    return latest > 0 ? new Date(latest).toISOString().slice(11, 19) + " UTC" : "—";
  }, [filteredFeeds]);

  const severityColor = activeContext?.severity === "critical" ? "hsl(var(--destructive))" : activeContext?.severity === "high" ? "#f97316" : "#eab308";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radar className="h-3 w-3 text-primary" />
            <span className="text-[8px] font-bold tracking-[0.15em] text-foreground uppercase font-mono">SENSOR FUSION</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handlePulse} disabled={pulsing} className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50" title="Pulse all active feeds">
              <Activity className={`h-2.5 w-2.5 ${pulsing ? "animate-pulse" : ""}`} />
              PULSE
            </button>
            <button onClick={fetchFeeds} className="p-1 rounded hover:bg-primary/10 transition-colors" title="Refresh">
              <RefreshCw className={`h-3 w-3 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
            <span className="text-[8px] font-mono text-primary">{totalFeeds}</span>
          </div>
        </div>
      </div>

      {/* Context Banner */}
      {activeContext && (
        <div className="px-2 py-1.5 border-b border-border/30 bg-accent/10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Crosshair className="h-3 w-3 animate-pulse" style={{ color: severityColor }} />
              <span className="text-[8px] font-mono font-bold text-foreground tracking-wider">
                {activeContext.type === "target" ? "🎯 TARGET" : "📡 EVENT"} CORRELATION
              </span>
            </div>
            <button onClick={onClearContext} className="p-0.5 rounded hover:bg-destructive/20 transition-colors" title="Clear filter">
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
          <div className="text-[9px] font-mono text-foreground truncate">{activeContext.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ backgroundColor: `${severityColor}20`, color: severityColor }}>
              {activeContext.severity?.toUpperCase()}
            </span>
            <span className="text-[7px] font-mono text-muted-foreground">{activeContext.event_type}</span>
            <span className="text-[7px] font-mono text-muted-foreground">{activeContext.lat.toFixed(2)}, {activeContext.lng.toFixed(2)}</span>
          </div>
          {/* Nearby toggle */}
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => setNearbyOnly(true)}
              className={`text-[7px] font-mono px-1.5 py-0.5 rounded border transition-colors ${nearbyOnly ? "border-primary/50 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground"}`}
            >NEARBY ONLY ({filteredFeeds.length})</button>
            <button
              onClick={() => setNearbyOnly(false)}
              className={`text-[7px] font-mono px-1.5 py-0.5 rounded border transition-colors ${!nearbyOnly ? "border-primary/50 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground"}`}
            >ALL SENSORS ({feeds.length})</button>
            {/* Navigate back button */}
            <button
              onClick={() => onNavigateToEvent?.(activeContext.type === "target" ? "TARGETS" : "FEED", activeContext.lat, activeContext.lng)}
              className="ml-auto flex items-center gap-0.5 text-[7px] font-mono px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
            >
              <Navigation className="h-2.5 w-2.5" />
              GO TO {activeContext.type === "target" ? "TGT" : "FEED"}
            </button>
          </div>
        </div>
      )}

      {/* Aggregate health bar */}
      <div className="px-3 py-2 border-b border-border/30 bg-background/50">
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div className="text-center">
            <div className="text-[10px] font-mono font-bold text-[#22c55e]">{activeCount}</div>
            <div className="text-[6px] font-mono text-muted-foreground tracking-wider">ACTIVE</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono font-bold text-[#eab308]">{degradedCount}</div>
            <div className="text-[6px] font-mono text-muted-foreground tracking-wider">DEGRADED</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono font-bold text-[#ef4444]">{offlineCount}</div>
            <div className="text-[6px] font-mono text-muted-foreground tracking-wider">OFFLINE</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-mono font-bold" style={{ color: healthColor }}>{avgHealth}%</div>
            <div className="text-[6px] font-mono text-muted-foreground tracking-wider">HEALTH</div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-[#22c55e] transition-all" style={{ width: `${(activeCount / Math.max(totalFeeds, 1)) * 100}%` }} />
          <div className="h-full bg-[#eab308] transition-all" style={{ width: `${(degradedCount / Math.max(totalFeeds, 1)) * 100}%` }} />
          <div className="h-full bg-[#ef4444] transition-all" style={{ width: `${(offlineCount / Math.max(totalFeeds, 1)) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[7px] font-mono text-muted-foreground">
            <Signal className="h-2.5 w-2.5 inline mr-0.5" />{formatDataRate(totalDataRate)} aggregate
          </span>
          <span className="text-[7px] font-mono text-muted-foreground">Last: {lastUpdate}</span>
        </div>
      </div>

      {/* Category summary chips */}
      <div className="px-2 py-1.5 border-b border-border/30 flex flex-wrap gap-1">
        {catOrder.map(cat => {
          const catFeeds = filteredFeedsByCategory[cat] || [];
          if (catFeeds.length === 0) return null;
          const active = catFeeds.filter(f => f.status === "active").length;
          const total = catFeeds.length;
          const allOk = active === total;
          const hasDegraded = catFeeds.some(f => f.status === "degraded");
          return (
            <button key={cat} onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono border transition-colors ${expandedCat === cat ? "border-primary/50 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:text-foreground"}`}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: allOk ? "#22c55e" : hasDegraded ? "#eab308" : "#ef4444" }} />
              <span style={{ color: expandedCat === cat ? undefined : FEED_COLORS[cat] }}>{FEED_ICONS[cat]}</span>
              {active}/{total}
            </button>
          );
        })}
      </div>

      {/* Coverage overlay toggle */}
      {onToggleCoverage && (
        <div className="px-3 py-1.5 border-b border-border/30">
          <button onClick={onToggleCoverage}
            className={`w-full flex items-center justify-between px-2 py-1 rounded text-[9px] font-mono border transition-colors ${coverageEnabled ? "border-primary/50 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground"}`}>
            <span>COVERAGE OVERLAY</span>
            <div className="w-8 h-4 rounded-full transition-colors relative" style={{ backgroundColor: coverageEnabled ? "hsl(var(--primary))" : "hsl(var(--muted))" }}>
              <div className={`w-3 h-3 rounded-full bg-foreground transition-transform absolute top-0.5 ${coverageEnabled ? "left-[14px]" : "left-0.5"}`} />
            </div>
          </button>
        </div>
      )}

      {/* Feed list by category */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {catOrder.map(cat => {
          const catFeeds = filteredFeedsByCategory[cat] || [];
          if (catFeeds.length === 0) return null;
          const isExpanded = expandedCat === cat;
          const catActive = catFeeds.filter(f => f.status === "active").length;
          const catAvgHealth = Math.round(catFeeds.reduce((s, f) => s + f.health_score, 0) / catFeeds.length);

          return (
            <div key={cat}>
              <button onClick={() => setExpandedCat(isExpanded ? null : cat)}
                className="w-full px-3 py-1.5 flex items-center gap-2 bg-background/80 border-b border-border/20 hover:bg-accent/10 transition-colors">
                {isExpanded ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
                <span style={{ color: FEED_COLORS[cat] }}>{FEED_ICONS[cat]}</span>
                <div className="flex-1 text-left">
                  <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: FEED_COLORS[cat] }}>{catLabels[cat]}</span>
                  <span className="text-[7px] font-mono text-muted-foreground ml-1.5">{catDescriptions[cat]}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-mono text-muted-foreground">HP:{catAvgHealth}%</span>
                  <span className="text-[8px] font-mono px-1 py-0.5 rounded" style={{
                    backgroundColor: `${catActive === catFeeds.length ? "#22c55e" : "#eab308"}15`,
                    color: catActive === catFeeds.length ? "#22c55e" : "#eab308",
                  }}>{catActive}/{catFeeds.length}</span>
                </div>
              </button>
              {isExpanded && catFeeds.map((feed: SensorFeed) => {
                const statusCol = STATUS_COLORS[feed.status] || "#6b7280";
                const healthPct = feed.health_score;
                const healthCol = healthPct >= 80 ? "#22c55e" : healthPct >= 50 ? "#eab308" : "#ef4444";
                const distToCtx = activeContext ? haversineKm(feed.lat, feed.lng, activeContext.lat, activeContext.lng) : null;
                return (
                  <div key={feed.id} className="border-b border-border/10 border-l-2" style={{ borderLeftColor: statusCol }}>
                    <button onClick={() => onLocate?.(feed.lat, feed.lng)}
                      className="w-full text-left px-3 py-1.5 hover:bg-accent/10 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: statusCol }} />
                        <span className="text-[9px] font-mono text-foreground truncate flex-1">{feed.source_name}</span>
                        <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ backgroundColor: `${statusCol}20`, color: statusCol }}>{feed.status.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 pl-3">
                        <span className="text-[7px] font-mono text-muted-foreground">{feed.feed_type}</span>
                        <span className="text-[7px] font-mono" style={{ color: healthCol }}>HP:{healthPct}%</span>
                        <span className="text-[7px] font-mono text-muted-foreground">{formatDataRate(feed.data_rate_hz)}</span>
                        <span className="text-[7px] font-mono text-muted-foreground">{feed.coverage_radius_km}km</span>
                        <span className="text-[7px] font-mono text-muted-foreground">{PROTOCOL_LABELS[feed.protocol] || feed.protocol}</span>
                      </div>
                      {/* Distance to context */}
                      {distToCtx !== null && (
                        <div className="text-[7px] font-mono text-primary mt-0.5 pl-3">
                          📍 {distToCtx.toFixed(1)} km from {activeContext!.type === "target" ? "target" : "event"}
                        </div>
                      )}
                      {/* Mini health bar */}
                      <div className="mt-1 pl-3">
                        <div className="h-0.5 rounded-full bg-muted overflow-hidden w-full">
                          <div className="h-full rounded-full transition-all" style={{ width: `${healthPct}%`, backgroundColor: healthCol }} />
                        </div>
                      </div>
                      {feed.last_data_at && (
                        <div className="text-[6px] font-mono text-muted-foreground/60 mt-0.5 pl-3">
                          Last data: {new Date(feed.last_data_at).toISOString().slice(11, 19)} UTC
                        </div>
                      )}
                    </button>
                    {/* Navigate to event/target button */}
                    {activeContext && onNavigateToEvent && (
                      <div className="px-3 pb-1.5">
                        <button
                          onClick={() => onNavigateToEvent(activeContext.type === "target" ? "TARGETS" : "FEED", activeContext.lat, activeContext.lng)}
                          className="flex items-center gap-1 text-[7px] font-mono px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Navigation className="h-2.5 w-2.5" />
                          {activeContext.type === "target" ? "🎯 GO TO TARGET" : "📡 GO TO FEED"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-border/30 bg-background/80">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-mono text-muted-foreground">
            {catOrder.filter(c => (filteredFeedsByCategory[c]?.length || 0) > 0).length} MODALITIES • {totalFeeds} FEEDS
            {activeContext && nearbyOnly && <span className="text-primary ml-1">• FILTERED</span>}
          </span>
          {degradedCount + offlineCount > 0 && (
            <span className="text-[7px] font-mono text-[#eab308] flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> {degradedCount + offlineCount} NEED ATTENTION
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
