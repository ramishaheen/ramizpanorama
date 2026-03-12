import { useEffect, useState } from "react";

interface HolographicOverlayProps {
  alertCount?: number;
}

export const HolographicOverlay = ({ alertCount = 0 }: HolographicOverlayProps) => {
  const [radarAngle, setRadarAngle] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setRadarAngle((a) => (a + 1.2) % 360);
      setTime(new Date());
    }, 50);
    return () => clearInterval(id);
  }, []);

  const ts = time.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  return (
    <div className="pointer-events-none absolute inset-0 z-[500] overflow-hidden rounded-lg">
      {/* Subtle scanlines */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(var(--primary)) 3px, hsl(var(--primary)) 4px)`,
        }}
      />

      {/* Moving scan beam */}
      <div className="absolute left-0 right-0 h-[1px] opacity-[0.08]"
        style={{
          top: `${(radarAngle * 2.5) % 100}%`,
          background: `linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 30%, hsl(var(--primary) / 0.8) 50%, hsl(var(--primary)) 70%, transparent 100%)`,
          filter: "blur(1px)",
        }}
      />

      {/* Corner HUD brackets — refined */}
      {[
        { pos: "top-1.5 left-1.5", d: "M1 10V1H10" },
        { pos: "top-1.5 right-1.5", d: "M23 10V1H14" },
        { pos: "bottom-1.5 left-1.5", d: "M1 14V23H10" },
        { pos: "bottom-1.5 right-1.5", d: "M23 14V23H14" },
      ].map(({ pos, d }) => (
        <div key={pos} className={`absolute ${pos}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d={d} stroke="hsl(var(--primary))" strokeWidth="0.75" strokeOpacity="0.25" />
          </svg>
        </div>
      ))}

      {/* HUD top-bar data readout */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-1 rounded-lg border border-border/30 bg-card/40 backdrop-blur-md">
        <span className="text-[8px] font-mono text-primary/40 tracking-widest">{ts}</span>
        <div className="w-px h-3 bg-border/30" />
        <span className="text-[8px] font-mono text-primary/30 tracking-wider">INTEL OVERLAY v4.2</span>
        <div className="w-px h-3 bg-border/30" />
        <span className="text-[8px] font-mono text-destructive/50 tracking-wider font-semibold">
          ALERTS: {alertCount}
        </span>
      </div>

      {/* Mini radar (bottom-right) */}
      <div className="absolute top-14 left-3 w-14 h-14 opacity-50">
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.4" strokeOpacity="0.12" />
          <circle cx="40" cy="40" r="24" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.4" strokeOpacity="0.08" />
          <circle cx="40" cy="40" r="12" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.4" strokeOpacity="0.06" />
          <line x1="40" y1="4" x2="40" y2="76" stroke="hsl(var(--primary))" strokeWidth="0.3" strokeOpacity="0.06" />
          <line x1="4" y1="40" x2="76" y2="40" stroke="hsl(var(--primary))" strokeWidth="0.3" strokeOpacity="0.06" />
          <line
            x1="40" y1="40"
            x2={40 + 34 * Math.cos((radarAngle * Math.PI) / 180)}
            y2={40 + 34 * Math.sin((radarAngle * Math.PI) / 180)}
            stroke="hsl(var(--primary))"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />
          <path
            d={`M 40 40 L ${40 + 34 * Math.cos((radarAngle * Math.PI) / 180)} ${40 + 34 * Math.sin((radarAngle * Math.PI) / 180)} A 34 34 0 0 0 ${40 + 34 * Math.cos(((radarAngle - 35) * Math.PI) / 180)} ${40 + 34 * Math.sin(((radarAngle - 35) * Math.PI) / 180)} Z`}
            fill="hsl(var(--primary))"
            fillOpacity="0.04"
          />
          <circle cx="40" cy="40" r="1.5" fill="hsl(var(--primary))" fillOpacity="0.4" />
        </svg>
      </div>

      {/* Subtle edge vignette */}
      <div className="absolute inset-0 rounded-lg"
        style={{
          boxShadow: "inset 0 0 80px 30px hsl(var(--background) / 0.4)",
        }}
      />
    </div>
  );
};
