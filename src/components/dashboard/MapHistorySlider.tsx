import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, Clock, SkipBack, SkipForward, ChevronUp, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface HistoryEvent {
  id: string;
  label: string;
  type: "earthquake" | "wildfire" | "conflict" | "news" | "telegram" | "fusion" | "alert";
  severity: "low" | "medium" | "high" | "critical" | "info";
  lat: number;
  lng: number;
  time: number; // ms epoch
}

interface MapHistorySliderProps {
  onTimeFilter: (cutoffMs: number | null) => void;
  events?: HistoryEvent[];
  onFlyTo?: (lat: number, lng: number) => void;
}

const typeEmoji: Record<string, string> = {
  earthquake: "🌍",
  wildfire: "🔥",
  conflict: "⚔️",
  news: "📰",
  telegram: "📡",
  fusion: "🧬",
  alert: "⚠️",
};

const severityColor: Record<string, string> = {
  info: "bg-muted-foreground",
  low: "bg-green-500",
  medium: "bg-primary",
  high: "bg-warning",
  critical: "bg-destructive",
};

const PLAYBACK_SPEEDS = [1, 2, 5] as const;
const SPEED_MS: Record<number, number> = { 1: 200, 2: 100, 5: 40 };

export const MapHistorySlider = ({ onTimeFilter, events = [], onFlyTo }: MapHistorySliderProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [value, setValue] = useState(100); // 0=24h ago, 100=now
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hoursAgo = ((100 - value) / 100) * 24;
  const cutoffMs = value >= 99.5 ? null : Date.now() - hoursAgo * 3600000;

  useEffect(() => {
    onTimeFilter(cutoffMs);
  }, [value]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setValue(prev => {
          if (prev >= 100) { setPlaying(false); return 100; }
          return Math.min(100, prev + 0.5);
        });
      }, SPEED_MS[playSpeed] || 200);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, playSpeed]);

  // Auto-show feed when playback starts
  useEffect(() => {
    if (playing) setShowFeed(true);
  }, [playing]);

  // Filter events by current time window
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const windowStart = cutoffMs ?? now - 24 * 3600000;
    return events
      .filter(e => e.time >= windowStart && e.time <= now)
      .sort((a, b) => b.time - a.time)
      .slice(0, 50);
  }, [events, cutoffMs]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card/90 backdrop-blur-xl shadow-lg hover:bg-secondary/50 transition-all"
        title="Historical Playback"
      >
        <Clock className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-mono text-foreground/80 uppercase tracking-wider font-semibold">History</span>
      </button>
    );
  }

  const timeLabel = value >= 99.5 ? "LIVE" : `T-${hoursAgo.toFixed(1)}h`;

  return (
    <div className="relative">
      {/* Event feed — opens upward */}
      {showFeed && filteredEvents.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-[280px] max-h-[50vh] rounded-lg bg-card/95 backdrop-blur-xl border border-border/60 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
            <span className="text-[9px] font-mono text-foreground/70 uppercase tracking-wider font-semibold">
              Event Log
            </span>
            <span className="text-[8px] font-mono text-primary tabular-nums font-bold">
              {filteredEvents.length} events
            </span>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="divide-y divide-border/20">
              {filteredEvents.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => onFlyTo?.(evt.lat, evt.lng)}
                  className="w-full px-3 py-1.5 text-left hover:bg-secondary/30 transition-all cursor-pointer flex items-start gap-2"
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${severityColor[evt.severity] || severityColor.low}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px]">{typeEmoji[evt.type] || "📌"}</span>
                      <span className="text-[9px] font-mono text-foreground/80 font-semibold truncate flex-1">
                        {evt.label}
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-muted-foreground tabular-nums">
                      {new Date(evt.time).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })} UTC
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-card/95 backdrop-blur-xl shadow-lg min-w-[280px]"
        style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.1)" }}>
        <button onClick={() => { setExpanded(false); setValue(100); setPlaying(false); setShowFeed(false); onTimeFilter(null); }}
          className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
          <Clock className="h-3 w-3" />
        </button>
        <button onClick={() => setValue(Math.max(0, value - 4.2))}
          className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
          <SkipBack className="h-3 w-3" />
        </button>
        <button onClick={() => setPlaying(!playing)}
          className="p-0.5 rounded hover:bg-secondary/50 text-primary">
          {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
        <button onClick={() => setValue(Math.min(100, value + 4.2))}
          className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
          <SkipForward className="h-3 w-3" />
        </button>
        <input
          type="range" min={0} max={100} step={0.5} value={value}
          onChange={e => { setValue(parseFloat(e.target.value)); setPlaying(false); }}
          className="flex-1 h-1 appearance-none bg-secondary rounded-full cursor-pointer accent-primary
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:shadow-[0_0_6px_hsl(190_100%_50%/0.4)]"
        />
        <span className={`text-[9px] font-mono font-bold w-12 text-right ${value >= 99.5 ? "text-green-500" : "text-primary"}`}>
          {timeLabel}
        </span>
        <button
          onClick={() => setShowFeed(!showFeed)}
          className={`p-0.5 rounded transition-all ${showFeed ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
          title="Toggle event log"
        >
          {showFeed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
};
