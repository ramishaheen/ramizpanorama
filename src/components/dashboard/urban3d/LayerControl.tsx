import React from "react";

export const FlightStat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="flight-stat rounded px-2 py-1">
    <span className="text-[6px] font-mono text-muted-foreground/50 uppercase tracking-wider block">{label}</span>
    <span className="text-[9px] font-mono font-medium block" style={color ? { color } : undefined}>{value}</span>
  </div>
);

export const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[6px] font-mono text-muted-foreground/40 uppercase tracking-wider">{label}</span>
    <span className="text-[9px] font-mono text-foreground/80">{value}</span>
  </div>
);

export const LayerControl = ({ icon, label, color, active, onToggle, count, opacity, onOpacity, source }: {
  icon: React.ReactNode; label: string; color: string; active: boolean; onToggle: () => void;
  count?: number; opacity: number; onOpacity: (v: number) => void; source?: string;
}) => (
  <div className={`rounded-lg border transition-all duration-200 ${active ? "border-white/15 bg-white/5" : "border-transparent"}`}>
    <div className="flex items-center gap-2 px-2 py-1.5">
      <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0">
        <span style={{ color: active ? color : "#6b7280" }}>{icon}</span>
        <span className={`text-[10px] font-mono uppercase truncate ${active ? "text-foreground/90 font-bold" : "text-muted-foreground/60"}`}>{label}</span>
      </button>
      {count !== undefined && count > 0 && (
        <span className="text-[8px] font-mono font-bold px-1.5 rounded-full" style={{ background: `${color}20`, color }}>{count}</span>
      )}
      <button onClick={onToggle} className={`w-7 h-4 rounded-full relative transition-all duration-200 ${active ? "bg-white/20" : "bg-white/5"}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${active ? "left-3.5" : "left-0.5"}`} style={{ background: active ? color : "#4b5563" }} />
      </button>
    </div>
    {active && onOpacity !== (() => {}) && (
      <div className="px-2 pb-1.5 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono text-muted-foreground/50 w-10">Opacity</span>
          <input type="range" min="0" max="1" step="0.05" value={opacity}
            onChange={(e) => onOpacity(parseFloat(e.target.value))}
            className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
            style={{ background: `linear-gradient(to right, ${color} ${opacity * 100}%, #333 ${opacity * 100}%)`, accentColor: color }} />
          <span className="text-[7px] font-mono text-muted-foreground/60 w-6 text-right">{Math.round(opacity * 100)}%</span>
        </div>
        {source && <span className="text-[7px] font-mono text-muted-foreground/40 block">SRC: {source}</span>}
      </div>
    )}
  </div>
);
