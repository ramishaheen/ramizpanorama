import { useState, useEffect } from "react";
import { Ship, AlertTriangle, Activity, Anchor } from "lucide-react";
import type { MaritimeVessel } from "@/data/mockData";

interface Chokepoint {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  radiusKm: number;
  bearing: string;
  criticalNote: string;
}

const CHOKEPOINTS: Chokepoint[] = [
  {
    id: "hormuz",
    name: "Strait of Hormuz",
    shortName: "HORMUZ",
    lat: 26.56,
    lng: 56.25,
    radiusKm: 80,
    bearing: "NE-SW",
    criticalNote: "~21M bbl/day oil transit",
  },
  {
    id: "bab-el-mandeb",
    name: "Bab el-Mandeb",
    shortName: "BAB EL-MANDEB",
    lat: 12.58,
    lng: 43.33,
    radiusKm: 60,
    bearing: "N-S",
    criticalNote: "Red Sea chokepoint — Houthi threat zone",
  },
  {
    id: "suez",
    name: "Suez Canal",
    shortName: "SUEZ",
    lat: 30.46,
    lng: 32.35,
    radiusKm: 50,
    bearing: "N-S",
    criticalNote: "~12% global trade transit",
  },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type ThreatLevel = "normal" | "elevated" | "high" | "critical";

function getThreatLevel(cp: Chokepoint, vesselCount: number, militaryCount: number): ThreatLevel {
  if (cp.id === "bab-el-mandeb") {
    if (militaryCount >= 3) return "critical";
    if (militaryCount >= 1) return "high";
    return vesselCount > 0 ? "elevated" : "normal";
  }
  if (cp.id === "hormuz") {
    if (militaryCount >= 2) return "high";
    if (vesselCount >= 5) return "elevated";
    return "normal";
  }
  if (militaryCount >= 2) return "elevated";
  return "normal";
}

const threatColors: Record<ThreatLevel, string> = {
  normal: "hsl(var(--primary))",
  elevated: "hsl(var(--warning))",
  high: "#ff6b00",
  critical: "hsl(var(--critical))",
};

const threatLabels: Record<ThreatLevel, string> = {
  normal: "NORMAL",
  elevated: "ELEVATED",
  high: "HIGH",
  critical: "CRITICAL",
};

interface ChokepointMonitorProps {
  vessels: MaritimeVessel[];
  onFlyTo?: (lat: number, lng: number) => void;
}

export const ChokepointMonitor = ({ vessels, onFlyTo }: ChokepointMonitorProps) => {
  const [expanded, setExpanded] = useState(true);
  const [tick, setTick] = useState(0);

  // Pulse every 10s to simulate live updates
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);

  const chokepointData = CHOKEPOINTS.map((cp) => {
    const nearby = vessels.filter(
      (v) => haversineKm(cp.lat, cp.lng, v.lat, v.lng) <= cp.radiusKm
    );
    const militaryCount = nearby.filter((v) => v.type === "MILITARY").length;
    const tankerCount = nearby.filter((v) => v.type === "TANKER").length;
    const cargoCount = nearby.filter((v) => v.type === "CARGO").length;
    const threatLevel = getThreatLevel(cp, nearby.length, militaryCount);

    return { ...cp, nearby, militaryCount, tankerCount, cargoCount, total: nearby.length, threatLevel };
  });

  return (
    <div className="absolute bottom-28 right-3 z-[1000] w-[220px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 bg-card/95 backdrop-blur border border-border rounded-t-md px-2.5 py-1.5 shadow-lg hover:bg-secondary/60 transition-all cursor-pointer"
      >
        <Anchor className="h-3.5 w-3.5 text-primary" />
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider flex-1 text-left">
          CHOKEPOINT MONITOR
        </span>
        <Activity className="h-3 w-3 text-primary animate-pulse" />
      </button>

      {expanded && (
        <div className="bg-card/95 backdrop-blur border border-t-0 border-border rounded-b-md shadow-lg">
          {chokepointData.map((cp) => {
            const color = threatColors[cp.threatLevel];
            return (
              <button
                key={cp.id}
                onClick={() => onFlyTo?.(cp.lat, cp.lng)}
                className="w-full px-2.5 py-2 border-b border-border/50 last:border-b-0 hover:bg-secondary/40 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold text-foreground">
                    {cp.shortName}
                  </span>
                  <span
                    className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color,
                      background: `${color}15`,
                      border: `1px solid ${color}40`,
                      animation: cp.threatLevel === "critical" ? "pulse 1s ease-in-out infinite" : undefined,
                    }}
                  >
                    {threatLabels[cp.threatLevel]}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center gap-1">
                    <Ship className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[9px] font-mono text-foreground">{cp.total}</span>
                  </div>
                  {cp.militaryCount > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" style={{ color: "hsl(var(--critical))" }} />
                      <span className="text-[9px] font-mono" style={{ color: "hsl(var(--critical))" }}>
                        {cp.militaryCount} MIL
                      </span>
                    </div>
                  )}
                  {cp.tankerCount > 0 && (
                    <span className="text-[9px] font-mono" style={{ color: "hsl(var(--warning))" }}>
                      {cp.tankerCount}T
                    </span>
                  )}
                  {cp.cargoCount > 0 && (
                    <span className="text-[9px] font-mono text-primary">
                      {cp.cargoCount}C
                    </span>
                  )}
                </div>

                <div className="text-[7px] font-mono text-muted-foreground leading-tight">
                  {cp.criticalNote}
                </div>
              </button>
            );
          })}

          <div className="px-2.5 py-1 text-center">
            <span className="text-[7px] font-mono text-muted-foreground">
              LIVE • {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export { CHOKEPOINTS };
