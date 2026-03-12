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

export const TimelineSlider = ({ events, onTimeChange }: TimelineSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(events.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const { t, isArabic } = useLanguage();
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-play logic
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
      }, 1500);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [isPlaying, events, onTimeChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setCurrentIndex(idx);
    onTimeChange?.(new Date(events[idx].timestamp));
  };

  const locale = isArabic ? 'ar-SA' : 'en-US';

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t(tr["section.timeline"].en, tr["section.timeline"].ar)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <SkipBack className="h-3 w-3" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded hover:bg-secondary transition-colors text-primary"
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setCurrentIndex(Math.min(events.length - 1, currentIndex + 1))}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-3 w-3" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={events.length - 1}
        value={currentIndex}
        onChange={handleSliderChange}
        className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
      />

      <div className="flex items-center justify-between mt-1 mb-3">
        <span className="text-[9px] font-mono text-muted-foreground">
          {new Date(events[0]?.timestamp).toLocaleTimeString(locale, { hour12: false })}
        </span>
        <span className="text-[10px] font-mono text-primary font-semibold">
          {events[currentIndex] && new Date(events[currentIndex].timestamp).toLocaleTimeString(locale, { hour12: false })} UTC
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">
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
