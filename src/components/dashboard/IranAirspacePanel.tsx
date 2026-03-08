import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  X, Plane, Shield, AlertTriangle, RefreshCw, Radar,
  ArrowUpRight, ArrowDownRight, Minus, Eye, EyeOff,
  ChevronDown, ChevronUp, Filter, Volume2, VolumeX
} from "lucide-react";

interface Aircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
  heading: number;
  vertical_rate: number;
  is_military: boolean;
  registration?: string;
  type?: string;
  source?: string;
}

// Iran approximate airspace boundaries (FIR Tehran)
const IRAN_BOUNDS = {
  latMin: 25.0,
  latMax: 40.0,
  lngMin: 44.0,
  lngMax: 63.5,
};

// Key Iranian airports/bases for proximity detection
const IRAN_AIRPORTS = [
  { name: "IKA — Imam Khomeini Intl", lat: 35.42, lng: 51.15, icao: "OIIE" },
  { name: "THR — Mehrabad Intl", lat: 35.69, lng: 51.31, icao: "OIII" },
  { name: "MHD — Mashhad Intl", lat: 36.24, lng: 59.64, icao: "OIMM" },
  { name: "IFN — Isfahan Intl", lat: 32.75, lng: 51.86, icao: "OIFM" },
  { name: "SYZ — Shiraz Intl", lat: 29.54, lng: 52.59, icao: "OISS" },
  { name: "TBZ — Tabriz Intl", lat: 38.13, lng: 46.24, icao: "OITT" },
  { name: "AWZ — Ahwaz Intl", lat: 31.34, lng: 48.76, icao: "OIAW" },
  { name: "BND — Bandar Abbas Intl", lat: 27.22, lng: 56.38, icao: "OIKB" },
  { name: "KER — Kerman", lat: 30.27, lng: 56.95, icao: "OIKK" },
  { name: "BUZ — Bushehr", lat: 28.94, lng: 50.83, icao: "OIBB" },
];

// Known military bases
const IRAN_MILITARY_BASES = [
  { name: "Natanz Nuclear Facility", lat: 33.72, lng: 51.73 },
  { name: "Isfahan Air Base", lat: 32.62, lng: 51.70 },
  { name: "Bandar Abbas Naval", lat: 27.15, lng: 56.23 },
  { name: "Dezful Missile Base", lat: 32.38, lng: 48.42 },
  { name: "Chabahar Air Base", lat: 25.44, lng: 60.38 },
  { name: "Tabriz Air Base", lat: 38.13, lng: 46.24 },
  { name: "Bushehr Nuclear Plant", lat: 28.83, lng: 50.89 },
  { name: "Khatami Air Base (Isfahan)", lat: 32.57, lng: 51.69 },
];

function isInIranAirspace(lat: number, lng: number): boolean {
  return lat >= IRAN_BOUNDS.latMin && lat <= IRAN_BOUNDS.latMax &&
         lng >= IRAN_BOUNDS.lngMin && lng <= IRAN_BOUNDS.lngMax;
}

function getDirection(heading: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(heading / 22.5) % 16];
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearestAirport(lat: number, lng: number): { name: string; dist: number } | null {
  let best: { name: string; dist: number } | null = null;
  for (const ap of IRAN_AIRPORTS) {
    const d = distKm(lat, lng, ap.lat, ap.lng);
    if (!best || d < best.dist) best = { name: ap.name, dist: d };
  }
  return best;
}

function getNearestMilBase(lat: number, lng: number): { name: string; dist: number } | null {
  let best: { name: string; dist: number } | null = null;
  for (const base of IRAN_MILITARY_BASES) {
    const d = distKm(lat, lng, base.lat, base.lng);
    if (!best || d < best.dist) best = { name: base.name, dist: d };
  }
  return best;
}

type SortKey = "callsign" | "altitude" | "speed" | "type";
type FilterMode = "all" | "military" | "civilian" | "entering" | "leaving";

interface IranAirspacePanelProps {
  onClose: () => void;
  onTrackAircraft?: (icao24: string) => void;
  onFlyTo?: (lat: number, lng: number) => void;
}

export const IranAirspacePanel = ({ onClose, onTrackAircraft, onFlyTo }: IranAirspacePanelProps) => {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortKey, setSortKey] = useState<SortKey>("altitude");
  const [sortAsc, setSortAsc] = useState(false);
  const [showMilOnly, setShowMilOnly] = useState(false);
  const [selectedAc, setSelectedAc] = useState<Aircraft | null>(null);
  const [expanded, setExpanded] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const prevAircraftRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  const fetchIranAirspace = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("live-flights", {
        body: {
          lamin: IRAN_BOUNDS.latMin,
          lamax: IRAN_BOUNDS.latMax,
          lomin: IRAN_BOUNDS.lngMin,
          lomax: IRAN_BOUNDS.lngMax,
        },
      });
      if (!error && data?.aircraft) {
        // Track previous positions for enter/leave detection
        const prevMap = prevAircraftRef.current;
        const newMap = new Map<string, { lat: number; lng: number }>();
        data.aircraft.forEach((ac: Aircraft) => {
          newMap.set(ac.icao24, { lat: ac.lat, lng: ac.lng });
        });
        prevAircraftRef.current = newMap;

        setAircraft(data.aircraft);
        if (data.source) setSource(data.source);
      }
    } catch (e) {
      console.error("Iran airspace fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIranAirspace();
    intervalRef.current = setInterval(fetchIranAirspace, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Determine if aircraft is entering or leaving Iran
  const getFlowDirection = (ac: Aircraft): "entering" | "leaving" | "transit" => {
    // Check heading relative to Iran center (33°N, 53°E)
    const toCenterBearing = Math.atan2(53 - ac.lng, 33 - ac.lat) * 180 / Math.PI;
    const headingDiff = Math.abs(((ac.heading - toCenterBearing + 180) % 360) - 180);
    // Near border?
    const nearBorder =
      ac.lat < IRAN_BOUNDS.latMin + 1.5 || ac.lat > IRAN_BOUNDS.latMax - 1.5 ||
      ac.lng < IRAN_BOUNDS.lngMin + 1.5 || ac.lng > IRAN_BOUNDS.lngMax - 1.5;
    if (!nearBorder) return "transit";
    return headingDiff < 90 ? "entering" : "leaving";
  };

  const enrichedAircraft = useMemo(() => {
    return aircraft.map(ac => ({
      ...ac,
      flow: getFlowDirection(ac),
      nearestAirport: getNearestAirport(ac.lat, ac.lng),
      nearestBase: getNearestMilBase(ac.lat, ac.lng),
    }));
  }, [aircraft]);

  const filtered = useMemo(() => {
    let list = enrichedAircraft;
    if (filter === "military") list = list.filter(a => a.is_military);
    if (filter === "civilian") list = list.filter(a => !a.is_military);
    if (filter === "entering") list = list.filter(a => a.flow === "entering");
    if (filter === "leaving") list = list.filter(a => a.flow === "leaving");

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "callsign": cmp = (a.callsign || "").localeCompare(b.callsign || ""); break;
        case "altitude": cmp = a.altitude - b.altitude; break;
        case "speed": cmp = a.velocity - b.velocity; break;
        case "type": cmp = (a.is_military ? 0 : 1) - (b.is_military ? 0 : 1); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [enrichedAircraft, filter, sortKey, sortAsc]);

  const milCount = aircraft.filter(a => a.is_military).length;
  const civCount = aircraft.length - milCount;
  const enteringCount = enrichedAircraft.filter(a => a.flow === "entering").length;
  const leavingCount = enrichedAircraft.filter(a => a.flow === "leaving").length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      className="absolute top-14 right-[180px] z-[1100] w-[380px] max-h-[calc(100vh-120px)] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-destructive/5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radar className="h-4 w-4 text-destructive" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full animate-ping" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold font-mono text-foreground tracking-wider">IRAN AIRSPACE MONITOR</h3>
            <p className="text-[8px] font-mono text-muted-foreground">FIR Tehran • Live ADS-B Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {loading && <RefreshCw className="h-3 w-3 text-primary animate-spin" />}
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-px bg-border/50">
        <div className="bg-card px-2 py-1.5 text-center">
          <div className="text-[14px] font-bold font-mono text-foreground">{aircraft.length}</div>
          <div className="text-[7px] font-mono text-muted-foreground uppercase">Total</div>
        </div>
        <div className="bg-card px-2 py-1.5 text-center">
          <div className="text-[14px] font-bold font-mono text-destructive">{milCount}</div>
          <div className="text-[7px] font-mono text-muted-foreground uppercase">Military</div>
        </div>
        <div className="bg-card px-2 py-1.5 text-center">
          <div className="text-[14px] font-bold font-mono text-emerald-400">{enteringCount}</div>
          <div className="text-[7px] font-mono text-muted-foreground uppercase">Entering</div>
        </div>
        <div className="bg-card px-2 py-1.5 text-center">
          <div className="text-[14px] font-bold font-mono text-amber-400">{leavingCount}</div>
          <div className="text-[7px] font-mono text-muted-foreground uppercase">Leaving</div>
        </div>
      </div>

      {expanded && (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border overflow-x-auto">
            {(["all", "military", "civilian", "entering", "leaving"] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase transition-all ${
                  filter === f
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "text-muted-foreground hover:bg-secondary border border-transparent"
                }`}
              >
                {f}
              </button>
            ))}
            <div className="ml-auto text-[8px] font-mono text-muted-foreground">
              {source && `📡 ${source}`}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_60px_60px_50px] gap-1 px-2 py-1 border-b border-border/50 text-[8px] font-mono text-muted-foreground uppercase">
            <button onClick={() => handleSort("callsign")} className="text-left hover:text-foreground flex items-center gap-0.5">
              Callsign {sortKey === "callsign" && (sortAsc ? "↑" : "↓")}
            </button>
            <button onClick={() => handleSort("altitude")} className="text-right hover:text-foreground flex items-center justify-end gap-0.5">
              Alt {sortKey === "altitude" && (sortAsc ? "↑" : "↓")}
            </button>
            <button onClick={() => handleSort("speed")} className="text-right hover:text-foreground flex items-center justify-end gap-0.5">
              Spd {sortKey === "speed" && (sortAsc ? "↑" : "↓")}
            </button>
            <div className="text-center">Flow</div>
          </div>

          {/* Aircraft list */}
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-[10px] font-mono">
                No aircraft matching filter
              </div>
            )}
            {filtered.map((ac) => {
              const altFt = Math.round(ac.altitude * 3.281);
              const speedKts = Math.round(ac.velocity * 1.944);
              const isMil = ac.is_military;
              const flowColor = ac.flow === "entering" ? "text-emerald-400" : ac.flow === "leaving" ? "text-amber-400" : "text-muted-foreground";
              const FlowIcon = ac.flow === "entering" ? ArrowDownRight : ac.flow === "leaving" ? ArrowUpRight : Minus;
              const isSelected = selectedAc?.icao24 === ac.icao24;
              const nearBase = ac.nearestBase && ac.nearestBase.dist < 50;

              return (
                <div key={ac.icao24}>
                  <button
                    onClick={() => setSelectedAc(isSelected ? null : ac)}
                    className={`w-full grid grid-cols-[1fr_60px_60px_50px] gap-1 px-2 py-1.5 text-left transition-all border-b border-border/20 ${
                      isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                    } ${nearBase && isMil ? "border-l-2 border-l-destructive" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Plane className={`h-3 w-3 flex-shrink-0 ${isMil ? "text-destructive" : "text-primary"}`} />
                      <div className="min-w-0">
                        <div className={`text-[10px] font-mono font-bold truncate ${isMil ? "text-destructive" : "text-foreground"}`}>
                          {ac.callsign || ac.icao24}
                        </div>
                        <div className="text-[8px] font-mono text-muted-foreground truncate">
                          {ac.origin_country} {ac.type && `• ${ac.type}`}
                        </div>
                      </div>
                      {isMil && (
                        <span className="text-[7px] px-1 py-px rounded bg-destructive/20 text-destructive font-mono font-bold flex-shrink-0">
                          MIL
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[10px] font-mono text-foreground">
                      {altFt > 0 ? `${(altFt / 1000).toFixed(1)}k` : "GND"}
                    </div>
                    <div className="text-right text-[10px] font-mono text-foreground">
                      {speedKts} kt
                    </div>
                    <div className={`flex items-center justify-center ${flowColor}`}>
                      <FlowIcon className="h-3 w-3" />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-secondary/30 border-b border-border/30 space-y-1.5">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-mono">
                            <div className="text-muted-foreground">ICAO: <span className="text-foreground">{ac.icao24}</span></div>
                            <div className="text-muted-foreground">HDG: <span className="text-foreground">{Math.round(ac.heading)}° {getDirection(ac.heading)}</span></div>
                            <div className="text-muted-foreground">ALT: <span className="text-foreground">{altFt.toLocaleString()} ft</span></div>
                            <div className="text-muted-foreground">V/S: <span className={ac.vertical_rate > 0.5 ? "text-emerald-400" : ac.vertical_rate < -0.5 ? "text-destructive" : "text-foreground"}>
                              {ac.vertical_rate > 0 ? "+" : ""}{ac.vertical_rate.toFixed(1)} m/s
                            </span></div>
                            <div className="text-muted-foreground">SPD: <span className="text-foreground">{speedKts} kts ({Math.round(ac.velocity * 3.6)} km/h)</span></div>
                            <div className="text-muted-foreground">POS: <span className="text-foreground">{ac.lat.toFixed(3)}°, {ac.lng.toFixed(3)}°</span></div>
                            {ac.registration && <div className="text-muted-foreground">REG: <span className="text-foreground">{ac.registration}</span></div>}
                            {ac.type && <div className="text-muted-foreground">TYPE: <span className="text-foreground">{ac.type}</span></div>}
                          </div>

                          {/* Proximity alerts */}
                          {ac.nearestAirport && ac.nearestAirport.dist < 80 && (
                            <div className="flex items-center gap-1.5 text-[8px] font-mono text-primary bg-primary/10 rounded px-2 py-1">
                              <Plane className="h-3 w-3" />
                              Near {ac.nearestAirport.name} ({ac.nearestAirport.dist.toFixed(0)} km)
                            </div>
                          )}
                          {nearBase && (
                            <div className="flex items-center gap-1.5 text-[8px] font-mono text-destructive bg-destructive/10 rounded px-2 py-1">
                              <Shield className="h-3 w-3" />
                              ⚠ Near {ac.nearestBase!.name} ({ac.nearestBase!.dist.toFixed(0)} km)
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-1.5 pt-1">
                            {onFlyTo && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onFlyTo(ac.lat, ac.lng); }}
                                className="text-[8px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                              >
                                FLY TO
                              </button>
                            )}
                            {onTrackAircraft && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onTrackAircraft(ac.icao24); }}
                                className="text-[8px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                              >
                                TRACK
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-2 py-1 border-t border-border bg-card/80 text-[8px] font-mono text-muted-foreground">
            <span>Refresh: 15s • {source || "Loading..."}</span>
            <button onClick={fetchIranAirspace} className="flex items-center gap-1 text-primary hover:text-primary/80">
              <RefreshCw className="h-2.5 w-2.5" /> Refresh
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
};
