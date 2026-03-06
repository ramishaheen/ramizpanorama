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
      {/* Scanlines */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(190 100% 50%) 2px, hsl(190 100% 50%) 3px)`,
        }}
      />

      {/* Hex grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(190 100% 50%) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Moving scan beam */}
      <div className="absolute left-0 right-0 h-[2px] opacity-[0.12]"
        style={{
          top: `${(radarAngle * 2.5) % 100}%`,
          background: `linear-gradient(90deg, transparent 0%, hsl(190 100% 50%) 30%, hsl(190 100% 70%) 50%, hsl(190 100% 50%) 70%, transparent 100%)`,
          filter: "blur(1px)",
        }}
      />

      {/* Corner HUD brackets */}
      {/* Top-Left */}
      <div className="absolute top-1 left-1">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M1 12V2H12" stroke="hsl(190 100% 50%)" strokeWidth="1" strokeOpacity="0.5" />
        </svg>
      </div>
      {/* Top-Right */}
      <div className="absolute top-1 right-1">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M31 12V2H20" stroke="hsl(190 100% 50%)" strokeWidth="1" strokeOpacity="0.5" />
        </svg>
      </div>
      {/* Bottom-Left */}
      <div className="absolute bottom-1 left-1">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M1 20V30H12" stroke="hsl(190 100% 50%)" strokeWidth="1" strokeOpacity="0.5" />
        </svg>
      </div>
      {/* Bottom-Right */}
      <div className="absolute bottom-1 right-1">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M31 20V30H20" stroke="hsl(190 100% 50%)" strokeWidth="1" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* HUD top-bar data readout */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-0.5 rounded border border-primary/20 bg-background/30 backdrop-blur-sm">
        <span className="text-[9px] font-mono text-primary/60 tracking-widest">{ts}</span>
        <span className="text-[9px] font-mono text-primary/40">|</span>
        <span className="text-[9px] font-mono text-primary/60 tracking-wider">INTEL OVERLAY v4.2</span>
        <span className="text-[9px] font-mono text-primary/40">|</span>
        <span className="text-[9px] font-mono text-destructive/70 tracking-wider">
          ALERTS: {alertCount}
        </span>
      </div>

      {/* Radar sweep (bottom-right) */}
      <div className="absolute bottom-8 right-8 w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full">
          {/* Concentric rings */}
          <circle cx="40" cy="40" r="38" fill="none" stroke="hsl(190 100% 50%)" strokeWidth="0.5" strokeOpacity="0.15" />
          <circle cx="40" cy="40" r="26" fill="none" stroke="hsl(190 100% 50%)" strokeWidth="0.5" strokeOpacity="0.1" />
          <circle cx="40" cy="40" r="14" fill="none" stroke="hsl(190 100% 50%)" strokeWidth="0.5" strokeOpacity="0.08" />
          {/* Cross hairs */}
          <line x1="40" y1="2" x2="40" y2="78" stroke="hsl(190 100% 50%)" strokeWidth="0.3" strokeOpacity="0.1" />
          <line x1="2" y1="40" x2="78" y2="40" stroke="hsl(190 100% 50%)" strokeWidth="0.3" strokeOpacity="0.1" />
          {/* Sweep */}
          <line
            x1="40" y1="40"
            x2={40 + 36 * Math.cos((radarAngle * Math.PI) / 180)}
            y2={40 + 36 * Math.sin((radarAngle * Math.PI) / 180)}
            stroke="hsl(190 100% 50%)"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          {/* Sweep trail (conic gradient approximation) */}
          <path
            d={`M 40 40 L ${40 + 36 * Math.cos((radarAngle * Math.PI) / 180)} ${40 + 36 * Math.sin((radarAngle * Math.PI) / 180)} A 36 36 0 0 0 ${40 + 36 * Math.cos(((radarAngle - 40) * Math.PI) / 180)} ${40 + 36 * Math.sin(((radarAngle - 40) * Math.PI) / 180)} Z`}
            fill="hsl(190 100% 50%)"
            fillOpacity="0.06"
          />
          {/* Center dot */}
          <circle cx="40" cy="40" r="2" fill="hsl(190 100% 50%)" fillOpacity="0.5" />
        </svg>
      </div>

      {/* Edge vignette for depth */}
      <div className="absolute inset-0 rounded-lg"
        style={{
          boxShadow: "inset 0 0 60px 20px hsl(220 20% 5% / 0.5)",
        }}
      />
    </div>
  );
};
