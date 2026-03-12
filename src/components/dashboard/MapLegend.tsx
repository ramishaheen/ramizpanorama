import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LEGEND_ITEMS = [
  { emoji: "⚔️", label: "Military", color: "hsl(var(--critical))", source: "AI Intel" },
  { emoji: "🏛️", label: "Diplomatic", color: "hsl(var(--primary))", source: "AI Intel" },
  { emoji: "💰", label: "Economic", color: "hsl(var(--warning))", source: "AI Intel" },
  { emoji: "🩺", label: "Humanitarian", color: "hsl(var(--success))", source: "AI Intel" },
  { emoji: "📰", label: "General News", color: "hsl(var(--primary))", source: "AI Intel" },
  { emoji: "🚀", label: "Missile / Special", color: "#ff0040", source: "Special Alert" },
  { emoji: "💣", label: "Airstrike", color: "hsl(var(--accent-foreground))", source: "WarsLeaks" },
  { emoji: "💥", label: "Explosion", color: "hsl(var(--accent-foreground))", source: "WarsLeaks" },
  { emoji: "🛩️", label: "Drone", color: "hsl(var(--accent-foreground))", source: "WarsLeaks" },
  { emoji: "⚓", label: "Naval", color: "hsl(var(--accent-foreground))", source: "WarsLeaks" },
  { emoji: "✊", label: "Protest", color: "hsl(var(--warning))", source: "WarsLeaks" },
  { emoji: "📡", label: "WarsLeaks Intel", color: "hsl(var(--accent-foreground))", source: "WarsLeaks" },
  { emoji: "🔥", label: "Wildfire", color: "#ff6b00", source: "NASA FIRMS" },
  { emoji: "🌍", label: "Earthquake", color: "hsl(var(--warning))", source: "USGS" },
  { emoji: "▲", label: "Vessel", color: "hsl(var(--primary))", source: "Maritime" },
];

const SEVERITY_ITEMS = [
  { label: "Critical", color: "hsl(var(--critical))" },
  { label: "High", color: "hsl(var(--warning))" },
  { label: "Medium", color: "hsl(var(--primary))" },
  { label: "Low", color: "hsl(var(--success))" },
];

export const MapLegend = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute bottom-28 left-3 z-[1000]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 border border-border/60 bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_-4px_hsl(220_20%_5%/0.6)] hover:bg-secondary/50 transition-all cursor-pointer"
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 border border-primary/20">
          <Layers className="h-3 w-3 text-primary" />
        </div>
        <span className="text-[10px] font-mono font-semibold text-foreground/80 uppercase tracking-wider">Legend</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-1 rounded-lg border border-border/60 bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_-4px_hsl(220_20%_5%/0.6)] w-[230px]"
          >
            <div className="p-3">
              <div className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-[0.15em] mb-2 font-semibold">
                Marker Types
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {LEGEND_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className="text-[10px] w-4 text-center leading-none">{item.emoji}</span>
                    <span className="text-[9px] font-mono text-foreground/70 truncate">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/30 mt-2.5 pt-2.5">
                <div className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-[0.15em] mb-2 font-semibold">
                  Severity
                </div>
                <div className="flex gap-3">
                  {SEVERITY_ITEMS.map((s) => (
                    <div key={s.label} className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                      />
                      <span className="text-[8px] font-mono text-muted-foreground/70">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/30 mt-2.5 pt-2.5">
                <div className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-[0.15em] mb-2 font-semibold">
                  Indicators
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-destructive/60 animate-pulse" />
                    <span className="text-[8px] font-mono text-muted-foreground/70">Threat radius zone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border border-primary/50" style={{ boxShadow: "0 0 6px hsl(var(--primary) / 0.4)" }} />
                    <span className="text-[8px] font-mono text-muted-foreground/70">Active alert pulse</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
