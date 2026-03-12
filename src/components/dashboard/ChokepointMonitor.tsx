import { useState, useEffect } from "react";
import { Ship, AlertTriangle, Activity, Anchor, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);

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
    <div className="relative" style={{ width: 220 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 border border-border/60 bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_-4px_hsl(220_20%_5%/0.6)] hover:bg-secondary/50 transition-all cursor-pointer"
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 border border-primary/20">
          <Anchor className="h-3 w-3 text-primary" />
        </div>
        <span className="text-[10px] font-mono text-foreground/80 uppercase tracking-wider flex-1 text-left font-semibold">
          Chokepoints
        </span>
        <div className="flex items-center gap-1.5">
          <Activity className="h-2.5 w-2.5 text-primary animate-pulse" />
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-1 left-0 w-full overflow-hidden rounded-lg border border-border/60 bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_-4px_hsl(220_20%_5%/0.6)] max-h-[60vh] overflow-y-auto"
          >
            <div className="divide-y divide-border/30">
              {chokepointData.map((cp) => {
                const color = threatColors[cp.threatLevel];
                return (
                  <button
                    key={cp.id}
                    onClick={() => onFlyTo?.(cp.lat, cp.lng)}
                    className="w-full px-3 py-2.5 hover:bg-secondary/30 transition-all cursor-pointer text-left group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-foreground tracking-wide">
                          ⚓ {cp.shortName}
                        </span>
                      </div>
                      <span
                        className="text-[7px] font-mono font-bold px-2 py-0.5 rounded-full tracking-wider"
                        style={{
                          color,
                          background: `${color}12`,
                          border: `1px solid ${color}30`,
                          animation: cp.threatLevel === "critical" ? "pulse 1s ease-in-out infinite" : undefined,
                        }}
                      >
                        {threatLabels[cp.threatLevel]}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-secondary/40 rounded px-1.5 py-0.5">
                        <Ship className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] font-mono text-foreground font-semibold">{cp.total}</span>
                      </div>
                      {cp.militaryCount > 0 && (
                        <div className="flex items-center gap-1 bg-destructive/10 rounded px-1.5 py-0.5">
                          <AlertTriangle className="h-2.5 w-2.5 text-destructive" />
                          <span className="text-[9px] font-mono text-destructive font-semibold">
                            {cp.militaryCount} MIL
                          </span>
                        </div>
                      )}
                      {cp.tankerCount > 0 && (
                        <span className="text-[9px] font-mono text-warning/80 bg-warning/10 rounded px-1.5 py-0.5">
                          {cp.tankerCount}T
                        </span>
                      )}
                      {cp.cargoCount > 0 && (
                        <span className="text-[9px] font-mono text-primary/80 bg-primary/10 rounded px-1.5 py-0.5">
                          {cp.cargoCount}C
                        </span>
                      )}
                    </div>

                    <div className="text-[7px] font-mono text-muted-foreground/60 mt-1.5 leading-tight group-hover:text-muted-foreground/80 transition-colors">
                      {cp.criticalNote}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-3 py-1.5 border-t border-border/30 flex items-center justify-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              <span className="text-[7px] font-mono text-muted-foreground/50 tracking-wider">
                LIVE • {new Date().toLocaleTimeString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { CHOKEPOINTS };
