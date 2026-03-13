import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Layers, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LayerState } from "./LayerControls";

type LegendLayerKey = keyof LayerState;

interface LegendItem {
  emoji: string;
  label: string;
  color: string;
  source: string;
  layerKey: LegendLayerKey;
}

const LEGEND_ITEMS: LegendItem[] = [
  { emoji: "⚔️", label: "Military", color: "hsl(var(--critical))", source: "AI Intel", layerKey: "news" },
  { emoji: "🏛️", label: "Diplomatic", color: "hsl(var(--primary))", source: "AI Intel", layerKey: "news" },
  { emoji: "💰", label: "Economic", color: "hsl(var(--warning))", source: "AI Intel", layerKey: "news" },
  { emoji: "🩺", label: "Humanitarian", color: "hsl(var(--success))", source: "AI Intel", layerKey: "news" },
  { emoji: "📰", label: "General News", color: "hsl(var(--primary))", source: "AI Intel", layerKey: "news" },
  { emoji: "🚀", label: "Missile / Special", color: "#ff0040", source: "Special Alert", layerKey: "rockets" },
  { emoji: "💣", label: "Airstrike", color: "hsl(var(--accent-foreground))", source: "WarsLeaks", layerKey: "telegram" },
  { emoji: "💥", label: "Explosion", color: "hsl(var(--accent-foreground))", source: "WarsLeaks", layerKey: "telegram" },
  { emoji: "🛩️", label: "Drone", color: "hsl(var(--accent-foreground))", source: "WarsLeaks", layerKey: "telegram" },
  { emoji: "⚓", label: "Naval", color: "hsl(var(--accent-foreground))", source: "WarsLeaks", layerKey: "telegram" },
  { emoji: "✊", label: "Protest", color: "hsl(var(--warning))", source: "WarsLeaks", layerKey: "telegram" },
  { emoji: "📡", label: "WarsLeaks Intel", color: "hsl(var(--accent-foreground))", source: "WarsLeaks", layerKey: "telegram" },
  { emoji: "🔥", label: "Wildfire", color: "#ff6b00", source: "NASA FIRMS", layerKey: "wildfires" },
  { emoji: "🌍", label: "Earthquake", color: "hsl(var(--warning))", source: "USGS", layerKey: "earthquakes" },
  { emoji: "▲", label: "Vessel", color: "hsl(var(--primary))", source: "Maritime", layerKey: "aisVessels" },
];

const SEVERITY_ITEMS = [
  { label: "Critical", color: "hsl(var(--critical))" },
  { label: "High", color: "hsl(var(--warning))" },
  { label: "Medium", color: "hsl(var(--primary))" },
  { label: "Low", color: "hsl(var(--success))" },
];

interface MapLegendProps {
  layers?: LayerState;
  onToggleLayer?: (key: keyof LayerState) => void;
}

export const MapLegend = ({ layers, onToggleLayer }: MapLegendProps) => {
  const [expanded, setExpanded] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  const isActive = (key: LegendLayerKey) => layers ? layers[key] : true;

  const handleClick = (item: LegendItem) => {
    if (onToggleLayer) {
      onToggleLayer(item.layerKey);
    }
  };

  useEffect(() => {
    if (expanded && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    }
  }, [expanded]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card/90 backdrop-blur-xl shadow-lg hover:bg-secondary/50 transition-all cursor-pointer"
      >
        <Layers className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-mono font-semibold text-foreground/80 uppercase tracking-wider">Legend</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && pos && createPortal(
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-[0_4px_24px_-4px_hsl(220_20%_5%/0.6)] w-[320px]"
            style={{ left: pos.left, bottom: pos.bottom, zIndex: 99999 }}
          >
            <ScrollArea className="max-h-[50vh]">
              <div className="p-3">
                <div className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-[0.15em] mb-2 font-semibold">
                  Marker Types — click to toggle
                </div>
                <div className="flex flex-col gap-0.5">
                  {LEGEND_ITEMS.map((item) => {
                    const active = isActive(item.layerKey);
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleClick(item)}
                        className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-all cursor-pointer ${
                          active
                            ? "bg-primary/10 border-l-2 border-l-primary"
                            : "opacity-30 border-l-2 border-l-transparent hover:opacity-50"
                        } hover:bg-secondary/40`}
                      >
                        <span className={`text-sm w-5 text-center leading-none ${active ? "" : "grayscale"}`}>{item.emoji}</span>
                        <span className={`text-[10px] font-mono truncate flex-1 text-left ${
                          active ? "text-foreground/80" : "text-muted-foreground/50 line-through"
                        }`}>{item.label}</span>
                        <span className="text-[8px] font-mono text-muted-foreground/40 mr-1">{item.source}</span>
                        {active ? (
                          <Eye className="h-3 w-3 text-primary/70 flex-shrink-0" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
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
            </ScrollArea>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
};