import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const LEGEND_ITEMS = [
  { emoji: "⚔️", label: "Military", color: "#ef4444", source: "AI Intel" },
  { emoji: "🏛️", label: "Diplomatic", color: "#00d4ff", source: "AI Intel" },
  { emoji: "💰", label: "Economic", color: "#ffb800", source: "AI Intel" },
  { emoji: "🩺", label: "Humanitarian", color: "#22c55e", source: "AI Intel" },
  { emoji: "📰", label: "General News", color: "#00d4ff", source: "AI Intel" },
  { emoji: "🚀", label: "Missile / Special", color: "#ff0040", source: "Special Alert" },
  { emoji: "💣", label: "Airstrike", color: "#a855f7", source: "WarsLeaks" },
  { emoji: "💥", label: "Explosion", color: "#a855f7", source: "WarsLeaks" },
  { emoji: "🛩️", label: "Drone", color: "#a855f7", source: "WarsLeaks" },
  { emoji: "⚓", label: "Naval", color: "#a855f7", source: "WarsLeaks" },
  { emoji: "✊", label: "Protest", color: "#eab308", source: "WarsLeaks" },
  { emoji: "📡", label: "WarsLeaks Intel", color: "#a855f7", source: "WarsLeaks" },
  { emoji: "🔥", label: "Wildfire", color: "#ff6b00", source: "NASA FIRMS" },
  { emoji: "🌍", label: "Earthquake", color: "#ffb800", source: "USGS" },
  { emoji: "▲", label: "Vessel", color: "#00d4ff", source: "Maritime" },
];

const SEVERITY_ITEMS = [
  { label: "Critical", color: "#ef4444" },
  { label: "High", color: "#ffb800" },
  { label: "Medium", color: "#00d4ff" },
  { label: "Low", color: "#22c55e" },
];

export const MapLegend = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute bottom-14 left-3 z-[1000]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border rounded-md px-2.5 py-1.5 shadow-lg hover:bg-card transition-colors"
      >
        <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">Legend</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-3 w-[220px] max-h-[350px] overflow-y-auto">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Marker Types
          </div>
          <div className="space-y-1">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-sm w-5 text-center">{item.emoji}</span>
                <span className="text-[10px] font-mono text-foreground flex-1">{item.label}</span>
                <span className="text-[8px] font-mono text-muted-foreground/60">{item.source}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-2 pt-2">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">
              Severity
            </div>
            <div className="flex gap-2">
              {SEVERITY_ITEMS.map((s) => (
                <div key={s.label} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }}
                  />
                  <span className="text-[8px] font-mono text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border mt-2 pt-2">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">
              Special Indicators
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-destructive animate-pulse" />
                <span className="text-[9px] font-mono text-muted-foreground">Threat radius zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border border-primary" style={{ boxShadow: "0 0 8px hsl(190 100% 50%)" }} />
                <span className="text-[9px] font-mono text-muted-foreground">Pulsing = active alert</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
