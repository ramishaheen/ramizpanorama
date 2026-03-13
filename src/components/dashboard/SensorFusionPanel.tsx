import { useState, useMemo } from "react";
import { Satellite, Camera, Radio, Globe, Radar, Wifi, WifiOff, RefreshCw, Zap, Activity, Cpu, ChevronDown, ChevronRight, AlertTriangle, Signal } from "lucide-react";
import { useSensorFeeds, type SensorFeed } from "@/hooks/useSensorFeeds";

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

interface SensorFusionPanelProps {
  onToggleCoverage?: () => void;
  coverageEnabled?: boolean;
  onLocate?: (lat: number, lng: number) => void;
}

export const SensorFusionPanel = ({ onToggleCoverage, coverageEnabled, onLocate }: SensorFusionPanelProps) => {
  const { feeds, summary, loading, fetchFeeds, feedsByCategory } = useSensorFeeds();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const cats = feedsByCategory();

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

  // Aggregate metrics
  const totalFeeds = feeds.length;
  const activeCount = feeds.filter(f => f.status === "active").length;
  const degradedCount = feeds.filter(f => f.status === "degraded").length;
  const offlineCount = feeds.filter(f => f.status === "offline" || f.status === "error").length;
  const avgHealth = totalFeeds > 0 ? Math.round(feeds.reduce((s, f) => s + f.health_score, 0) / totalFeeds) : 0;
  const totalDataRate = feeds.reduce((s, f) => s + f.data_rate_hz, 0);

  const healthColor = avgHealth >= 85 ? "#22c55e" : avgHealth >= 60 ? "#eab308" : "#ef4444";

  const formatDataRate = (hz: number) => {
    if (hz >= 1) return `${hz.toFixed(0)} Hz`;
    if (hz >= 0.01) return `${(hz * 60).toFixed(1)}/min`;
    return `${(hz * 3600).toFixed(1)}/hr`;
  };

  const lastUpdate = useMemo(() => {
    const latest = feeds.reduce((max, f) => {
      const t = f.last_data_at ? new Date(f.last_data_at).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    return latest > 0 ? new Date(latest).toISOString().slice(11, 19) + " UTC" : "—";
  }, [feeds]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radar className="h-3 w-3 text-primary" />
            <span className="text-[8px] font-bold tracking-[0.15em] text-foreground uppercase font-mono">SENSOR FUSION</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchFeeds} className="p-1 rounded hover:bg-primary/10 transition-colors" title="Refresh">
              <RefreshCw className={`h-3 w-3 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
            <span className="text-[8px] font-mono text-primary">{totalFeeds}</span>
          </div>
        </div>
      </div>

      {/* Aggregate health bar */}
      <div className="px-3 py-2 border-b border-[hsl(190,60%,10%)] bg-[hsl(220,18%,6%)]">
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
        <div className="h-1.5 rounded-full bg-[hsl(220,15%,15%)] overflow-hidden flex">
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
      <div className="px-2 py-1.5 border-b border-[hsl(190,60%,10%)] flex flex-wrap gap-1">
        {catOrder.map(cat => {
          const catFeeds = cats[cat] || [];
          if (catFeeds.length === 0) return null;
          const active = catFeeds.filter(f => f.status === "active").length;
          const total = catFeeds.length;
          const allOk = active === total;
          const hasDegraded = catFeeds.some(f => f.status === "degraded");
          return (
            <button key={cat} onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono border transition-colors ${expandedCat === cat ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: allOk ? "#22c55e" : hasDegraded ? "#eab308" : "#ef4444" }} />
              <span style={{ color: expandedCat === cat ? undefined : FEED_COLORS[cat] }}>{FEED_ICONS[cat]}</span>
              {active}/{total}
            </button>
          );
        })}
      </div>

      {/* Coverage overlay toggle */}
      {onToggleCoverage && (
        <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
          <button onClick={onToggleCoverage}
            className={`w-full flex items-center justify-between px-2 py-1 rounded text-[9px] font-mono border transition-colors ${coverageEnabled ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground"}`}>
            <span>COVERAGE OVERLAY</span>
            <div className="w-8 h-4 rounded-full transition-colors relative" style={{ backgroundColor: coverageEnabled ? "hsl(190,80%,50%)" : "hsl(220,15%,20%)" }}>
              <div className={`w-3 h-3 rounded-full bg-foreground transition-transform absolute top-0.5 ${coverageEnabled ? "left-[14px]" : "left-0.5"}`} />
            </div>
          </button>
        </div>
      )}

      {/* Feed list by category */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {catOrder.map(cat => {
          const catFeeds = cats[cat] || [];
          if (catFeeds.length === 0) return null;
          const isExpanded = expandedCat === cat;
          const catActive = catFeeds.filter(f => f.status === "active").length;
          const catAvgHealth = Math.round(catFeeds.reduce((s, f) => s + f.health_score, 0) / catFeeds.length);

          return (
            <div key={cat}>
              <button onClick={() => setExpandedCat(isExpanded ? null : cat)}
                className="w-full px-3 py-1.5 flex items-center gap-2 bg-[hsl(220,18%,8%)] border-b border-[hsl(220,15%,12%)] hover:bg-[hsl(220,18%,10%)] transition-colors">
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
                return (
                  <button key={feed.id} onClick={() => onLocate?.(feed.lat, feed.lng)}
                    className="w-full text-left px-3 py-1.5 border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(190,20%,10%)] transition-colors border-l-2"
                    style={{ borderLeftColor: statusCol }}>
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
                    {/* Mini health bar */}
                    <div className="mt-1 pl-3">
                      <div className="h-0.5 rounded-full bg-[hsl(220,15%,15%)] overflow-hidden w-full">
                        <div className="h-full rounded-full transition-all" style={{ width: `${healthPct}%`, backgroundColor: healthCol }} />
                      </div>
                    </div>
                    {feed.last_data_at && (
                      <div className="text-[6px] font-mono text-muted-foreground/60 mt-0.5 pl-3">
                        Last data: {new Date(feed.last_data_at).toISOString().slice(11, 19)} UTC
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-[hsl(190,60%,12%)] bg-[hsl(220,20%,5%)]">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-mono text-muted-foreground">{catOrder.filter(c => (cats[c]?.length || 0) > 0).length} MODALITIES • {totalFeeds} FEEDS</span>
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
