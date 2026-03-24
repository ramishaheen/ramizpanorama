import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { TimelineEvent } from "@/data/mockData";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

interface TimelineSliderProps {
  events: TimelineEvent[];
  onTimeChange?: (time: Date) => void;
}

const severityDot: Record<string, string> = {
  low: "bg-success",
  medium: "bg-primary",
  high: "bg-warning",
  critical: "bg-critical",
};

const typeBorder: Record<string, string> = {
  airspace: "border-primary/40",
  maritime: "border-primary/40",
  alert: "border-warning/40",
  diplomatic: "border-muted-foreground/40",
};

const SPEEDS = [1, 2, 5] as const;
const SPEED_INTERVALS: Record<number, number> = { 1: 1500, 2: 750, 5: 300 };

export const TimelineSlider = ({ events, onTimeChange }: TimelineSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(events.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const { t, isArabic } = useLanguage();
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playRef.current) {
      clearInterval(playRef.current);
      playRef.current = null;
    }
    if (isPlaying && events.length > 0) {
      playRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= events.length) {
            setIsPlaying(false);
            return prev;
          }
          onTimeChange?.(new Date(events[next].timestamp));
          return next;
        });
      }, SPEED_INTERVALS[speed] || 1500);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [isPlaying, events, onTimeChange, speed]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setCurrentIndex(idx);
    onTimeChange?.(new Date(events[idx].timestamp));
  };

  const locale = isArabic ? 'ar-SA' : 'en-US';

  return (
    <div className="maven-glass border-l-2 border-l-primary/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <div className="h-3 w-0.5 bg-primary rounded-full" />
          {t(tr["section.timeline"].en, tr["section.timeline"].ar)}
          <span className="text-[7px] font-mono text-primary/50 ml-1">TIME REWIND</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            className="p-1 hover:bg-primary/8 transition-all duration-150 text-muted-foreground hover:text-primary"
          >
            <SkipBack className="h-3 w-3" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-1.5 transition-all duration-150 ${isPlaying ? 'bg-primary/15 text-primary glow-primary' : 'hover:bg-primary/8 text-primary'}`}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setCurrentIndex(Math.min(events.length - 1, currentIndex + 1))}
            className="p-1 hover:bg-primary/8 transition-all duration-150 text-muted-foreground hover:text-primary"
          >
            <SkipForward className="h-3 w-3" />
          </button>
          {/* Speed controls */}
          <div className="flex items-center gap-0.5 ml-1 border-l border-border/20 pl-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 text-[8px] font-mono font-bold transition-all duration-150 ${
                  speed === s
                    ? "bg-primary/15 text-primary border border-primary/30 glow-primary"
                    : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary/30 border border-transparent"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline scrubber with glow track */}
      <div className="relative py-1">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-border/30" />
        <div className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" style={{ width: `${(currentIndex / Math.max(1, events.length - 1)) * 100}%` }} />
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="relative w-full h-1 bg-transparent appearance-none cursor-pointer accent-primary z-10"
        />
      </div>

      <div className="flex items-center justify-between mt-1 mb-3">
        <span className="text-[8px] font-mono text-muted-foreground/40 tabular-nums">
          {new Date(events[0]?.timestamp).toLocaleTimeString(locale, { hour12: false })}
        </span>
        <span className="text-[10px] font-mono text-primary font-bold tabular-nums px-2 py-0.5 bg-primary/8 border border-primary/20">
          {events[currentIndex] && new Date(events[currentIndex].timestamp).toLocaleTimeString(locale, { hour12: false })} UTC
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/40 tabular-nums">
          {new Date(events[events.length - 1]?.timestamp).toLocaleTimeString(locale, { hour12: false })}
        </span>
      </div>

      <div className="space-y-1">
        {events.slice(Math.max(0, currentIndex - 2), currentIndex + 1).reverse().map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: i === 0 ? 1 : 0.5, y: 0 }}
            className={`flex items-center gap-2 px-2 py-1 rounded border ${typeBorder[event.type]} bg-secondary/30`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${severityDot[event.severity]} ${i === 0 ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-mono text-muted-foreground w-12">
              {new Date(event.timestamp).toLocaleTimeString(locale, { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={`text-[10px] ${i === 0 ? 'text-foreground' : 'text-muted-foreground'} truncate`}>
              {event.title}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
