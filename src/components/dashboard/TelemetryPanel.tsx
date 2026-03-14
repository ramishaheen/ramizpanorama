import { useState, useEffect } from "react";
import { Compass, Navigation, Radio, Eye, ChevronDown, ChevronUp } from "lucide-react";

interface TelemetryPanelProps {
  lat: number;
  lng: number;
  heading: number;
  tilt: number;
  zoom: number;
}

function toMGRS(lat: number, lng: number): string {
  const zoneNum = Math.floor((lng + 180) / 6) + 1;
  const letters = "CDEFGHJKLMNPQRSTUVWX";
  const latBand = letters[Math.floor((lat + 80) / 8)] || "X";
  const easting = Math.round(((lng - (zoneNum * 6 - 183)) + 0.5) * 100000) % 100000;
  const northing = Math.round((lat * 110540) % 100000);
  return `${zoneNum}${latBand} ${String(easting).padStart(5, "0").slice(0, 3)} ${String(Math.abs(northing)).padStart(5, "0").slice(0, 3)}`;
}

export const TelemetryPanel = ({ lat, lng, heading, tilt, zoom }: TelemetryPanelProps) => {
  const [expanded, setExpanded] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const altMSL = Math.round(50 + Math.abs(lat * 3) + Math.sin(tick * 0.1) * 2);
  const pitch = Math.round(tilt - 90 + Math.sin(tick * 0.15) * 0.3);
  const roll = Math.round(Math.sin(tick * 0.08) * 1.2 * 10) / 10;
  const azimuth = (heading + 12 + Math.round(Math.sin(tick * 0.2) * 2)) % 360;
  const spiElev = Math.round(altMSL * 0.8);

  const TelRow = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[7px] font-mono text-muted-foreground tracking-wider">{label}</span>
      <span className="text-[8px] font-mono text-foreground font-bold">{value}{unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}</span>
    </div>
  );

  return (
    <div className="bg-[hsl(220,15%,7%)] border border-border/20 rounded-lg overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 border-b border-border/15 hover:bg-primary/5 transition-colors">
        <Navigation className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-mono font-bold text-primary tracking-wider">TELEMETRY</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 py-2 space-y-3">
          {/* Platform section */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Compass className="h-2.5 w-2.5 text-[#06b6d4]" />
              <span className="text-[7px] font-mono font-bold text-[#06b6d4] tracking-[0.15em]">PLATFORM</span>
            </div>
            <div className="space-y-0">
              <TelRow label="ALT (MSL)" value={altMSL} unit="m" />
              <TelRow label="HEADING" value={`${heading}°`} />
              <TelRow label="PITCH" value={`${pitch}°`} />
              <TelRow label="ROLL" value={`${roll}°`} />
              <TelRow label="MGRS" value={toMGRS(lat, lng)} />
            </div>
          </div>

          {/* Sensor section */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Radio className="h-2.5 w-2.5 text-[#f97316]" />
              <span className="text-[7px] font-mono font-bold text-[#f97316] tracking-[0.15em]">SENSOR</span>
            </div>
            <div className="space-y-0">
              <TelRow label="TYPE" value="FLIR SS380-HD" />
              <TelRow label="REL. AZIMUTH" value={`${azimuth}°`} />
              <TelRow label="REL. ELEV" value={`-${Math.round(tilt * 0.6)}°`} />
              <TelRow label="SPI LOCATION" value={toMGRS(lat + 0.001, lng + 0.001)} />
              <TelRow label="SPI ELEV" value={spiElev} unit="m" />
            </div>
          </div>

          {/* Compass rose */}
          <div className="flex justify-center py-1">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border border-border/30" />
              <div className="absolute inset-1 rounded-full border border-border/15" />
              {["N", "E", "S", "W"].map((d, i) => {
                const angle = i * 90;
                const rad = (angle * Math.PI) / 180;
                const r = 22;
                return (
                  <span key={d} className="absolute text-[6px] font-mono font-bold" style={{
                    left: `${28 + Math.sin(rad) * r}px`,
                    top: `${28 - Math.cos(rad) * r}px`,
                    transform: "translate(-50%, -50%)",
                    color: d === "N" ? "#ef4444" : "hsl(var(--muted-foreground))",
                  }}>{d}</span>
                );
              })}
              <div className="absolute top-1/2 left-1/2 w-0.5 h-5 -translate-x-1/2 -translate-y-full bg-[#ef4444] origin-bottom" style={{ transform: `translate(-50%, 0) rotate(${heading}deg)`, transformOrigin: "bottom center", top: "50%", marginTop: "-20px" }} />
              <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-primary -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* AI Detections counter */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="h-2.5 w-2.5 text-[#a855f7]" />
              <span className="text-[7px] font-mono font-bold text-[#a855f7] tracking-[0.15em]">AI DETECTIONS</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-[hsl(220,15%,10%)] rounded px-2 py-1.5 text-center">
                <div className="text-[10px] font-mono font-bold text-foreground">{3 + (tick % 2)}</div>
                <div className="text-[6px] font-mono text-muted-foreground">PERSON</div>
              </div>
              <div className="flex-1 bg-[hsl(220,15%,10%)] rounded px-2 py-1.5 text-center">
                <div className="text-[10px] font-mono font-bold text-foreground">{2 + Math.floor(tick / 5) % 3}</div>
                <div className="text-[6px] font-mono text-muted-foreground">VEHICLE</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
