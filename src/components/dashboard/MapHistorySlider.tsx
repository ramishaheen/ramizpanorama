import { useState, useEffect, useRef } from "react";
import { Play, Pause, Clock, SkipBack, SkipForward } from "lucide-react";

interface MapHistorySliderProps {
  onTimeFilter: (cutoffMs: number | null) => void;
}

export const MapHistorySlider = ({ onTimeFilter }: MapHistorySliderProps) => {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState(100); // 0=24h ago, 100=now
  const [playing, setPlaying] = useState(false);
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
      }, 200);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-card/95 backdrop-blur-xl shadow-lg min-w-[260px]"
      style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.1)" }}>
      <button onClick={() => { setExpanded(false); setValue(100); setPlaying(false); onTimeFilter(null); }}
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
      <span className={`text-[9px] font-mono font-bold w-12 text-right ${value >= 99.5 ? "text-success" : "text-primary"}`}>
        {timeLabel}
      </span>
    </div>
  );
};
