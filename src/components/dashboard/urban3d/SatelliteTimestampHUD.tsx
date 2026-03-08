import { Satellite, Clock, RefreshCw } from "lucide-react";

interface NrtLayerStatus {
  name: string;
  enabled: boolean;
  date: string;
  maxZoom: number;
  color: string;
}

interface SatelliteTimestampHUDProps {
  layers: NrtLayerStatus[];
  lastRefresh: Date;
}

export const SatelliteTimestampHUD = ({ layers, lastRefresh }: SatelliteTimestampHUDProps) => {
  const activeLayers = layers.filter(l => l.enabled);
  if (activeLayers.length === 0) return null;

  return (
    <div className="absolute bottom-16 left-3 z-[14] pointer-events-auto">
      <div className="bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-lg p-2 w-56" style={{ boxShadow: "0 0 20px rgba(0,220,255,0.1)" }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Satellite className="h-3 w-3 text-cyan-400" />
          <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-wider">NRT Imagery Active</span>
        </div>
        <div className="space-y-1">
          {activeLayers.map(layer => (
            <div key={layer.name} className="flex items-center gap-2 px-1.5 py-0.5 rounded bg-white/3">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: layer.color }} />
              <span className="text-[8px] font-mono text-foreground/80 flex-1 truncate">{layer.name}</span>
              <span className="text-[7px] font-mono text-muted-foreground/60">{layer.date}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1.5 pt-1 border-t border-border/20">
          <Clock className="h-2 w-2 text-muted-foreground/50" />
          <span className="text-[6px] font-mono text-muted-foreground/40">
            NASA GIBS • NRT ~3-6hr delay • Captures from {activeLayers[0]?.date}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <RefreshCw className="h-2 w-2 text-muted-foreground/40" />
          <span className="text-[6px] font-mono text-muted-foreground/30">
            Daily refresh • Max zoom: Level {Math.max(...activeLayers.map(l => l.maxZoom))}
          </span>
        </div>
      </div>
    </div>
  );
};
