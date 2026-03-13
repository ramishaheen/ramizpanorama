import { useState } from "react";
import { Satellite, Camera, Radio, Globe, Radar, Wifi, WifiOff, RefreshCw, Zap } from "lucide-react";
import { useSensorFeeds, type SensorFeed } from "@/hooks/useSensorFeeds";

const FEED_ICONS: Record<string, React.ReactNode> = {
  satellite: <Satellite className="h-3 w-3" />,
  drone: <Globe className="h-3 w-3" />,
  cctv: <Camera className="h-3 w-3" />,
  sigint: <Radio className="h-3 w-3" />,
  osint: <Globe className="h-3 w-3" />,
  ground: <Radar className="h-3 w-3" />,
  iot: <Wifi className="h-3 w-3" />,
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
    satellite: "SPACE", drone: "AERIAL", cctv: "CCTV", sigint: "SIGINT",
    osint: "OSINT", ground: "GROUND", iot: "IoT",
  };

  return (
    <div className="flex flex-col h-full">
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
            <span className="text-[8px] font-mono text-primary">{feeds.length}</span>
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div className="px-2 py-1.5 border-b border-[hsl(190,60%,10%)] flex flex-wrap gap-1">
        {catOrder.filter(c => cats[c]?.length > 0).map(cat => {
          const active = cats[cat].filter(f => f.status === "active").length;
          const total = cats[cat].length;
          const allOk = active === total;
          return (
            <button key={cat} onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${expandedCat === cat ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: allOk ? "#22c55e" : "#eab308" }} />
              {catLabels[cat]} {active}/{total}
            </button>
          );
        })}
      </div>

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

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto">
        {catOrder.map(cat => {
          const catFeeds = cats[cat] || [];
          if (catFeeds.length === 0) return null;
          const isExpanded = expandedCat === cat || expandedCat === null;
          return (
            <div key={cat}>
              <button onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                className="w-full px-3 py-1 flex items-center gap-2 bg-[hsl(220,18%,8%)] border-b border-[hsl(220,15%,12%)] hover:bg-[hsl(220,18%,10%)] transition-colors">
                <span style={{ color: FEED_COLORS[cat] }}>{FEED_ICONS[cat]}</span>
                <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: FEED_COLORS[cat] }}>{catLabels[cat]}</span>
                <span className="ml-auto text-[8px] font-mono text-muted-foreground">{catFeeds.length}</span>
              </button>
              {isExpanded && catFeeds.map((feed: SensorFeed) => (
                <button key={feed.id} onClick={() => onLocate?.(feed.lat, feed.lng)}
                  className="w-full text-left px-3 py-1.5 border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(190,20%,10%)] transition-colors">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[feed.status] }} />
                    <span className="text-[9px] font-mono text-foreground truncate flex-1">{feed.source_name}</span>
                    <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ backgroundColor: `${STATUS_COLORS[feed.status]}20`, color: STATUS_COLORS[feed.status] }}>{feed.status.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-3">
                    <span className="text-[7px] font-mono text-muted-foreground">{feed.feed_type}</span>
                    <span className="text-[7px] font-mono text-muted-foreground">HP:{feed.health_score}%</span>
                    <span className="text-[7px] font-mono text-muted-foreground">{feed.data_rate_hz}Hz</span>
                    <span className="text-[7px] font-mono text-muted-foreground">{feed.coverage_radius_km}km</span>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
