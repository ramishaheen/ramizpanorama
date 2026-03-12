import { useState, useMemo, useCallback, memo } from "react";
import { Plane, ChevronDown, ChevronUp, Radio, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FlightAircraft {
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
}

interface FlightEmulationPanelProps {
  flights: FlightAircraft[];
  trackedFlightId: string | null;
  onTrackFlight: (icao: string | null) => void;
  flightSource: string;
}

type FlightFilter = "ALL" | "CIV" | "MIL";

export const FlightEmulationPanel = memo(({ flights, trackedFlightId, onTrackFlight, flightSource }: FlightEmulationPanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<FlightFilter>("ALL");

  const { civCount, milCount, filtered } = useMemo(() => {
    const civ = flights.filter(f => !f.is_military);
    const mil = flights.filter(f => f.is_military);
    const list = filter === "CIV" ? civ : filter === "MIL" ? mil : flights;
    // Sort: tracked first, then military, then by altitude desc
    const sorted = [...list].sort((a, b) => {
      if (a.icao24 === trackedFlightId) return -1;
      if (b.icao24 === trackedFlightId) return 1;
      if (a.is_military !== b.is_military) return a.is_military ? -1 : 1;
      return b.altitude - a.altitude;
    });
    return { civCount: civ.length, milCount: mil.length, filtered: sorted.slice(0, 50) };
  }, [flights, filter, trackedFlightId]);

  const handleClick = useCallback((icao: string) => {
    onTrackFlight(trackedFlightId === icao ? null : icao);
  }, [trackedFlightId, onTrackFlight]);

  if (flights.length === 0) return null;

  return (
    <div className="w-full pointer-events-auto">
      <div className="overflow-hidden">
        {/* Stats row */}
        <div className="px-3 py-1.5 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[9px] font-mono text-cyan-400 font-bold tabular-nums">CIV {civCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[9px] font-mono text-red-500 font-bold tabular-nums">MIL {milCount}</span>
          </div>
          <div className="flex-1" />
          {flightSource && (
            <div className="flex items-center gap-1">
              <Radio className="h-2.5 w-2.5 text-green-500 animate-pulse" />
              <span className="text-[8px] font-mono text-muted-foreground uppercase">{flightSource}</span>
            </div>
          )}
        </div>

        {/* Filter chips */}
        <div className="px-3 py-1 border-t border-border/30 flex items-center gap-1">
          <Filter className="h-2.5 w-2.5 text-muted-foreground mr-1" />
          {(["ALL", "CIV", "MIL"] as FlightFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filter === f
                  ? f === "MIL"
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : f === "CIV"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "bg-primary/20 text-primary border border-primary/40"
                  : "bg-secondary/30 text-muted-foreground border border-transparent hover:bg-secondary/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Flight list */}
        <ScrollArea className="h-48 border-t border-border/30">
          <div className="divide-y divide-border/20">
            {filtered.map((f) => {
              const isTracked = f.icao24 === trackedFlightId;
              const isMil = f.is_military;
              return (
                <button
                  key={f.icao24}
                  onClick={() => handleClick(f.icao24)}
                  className={`w-full px-3 py-1.5 text-left hover:bg-secondary/30 transition-all cursor-pointer ${
                    isTracked ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isMil ? "bg-red-500" : "bg-cyan-400"
                    } ${isTracked ? "animate-pulse" : ""}`} />
                    <span className={`text-[9px] font-mono font-bold truncate flex-1 ${
                      isMil ? "text-red-400" : "text-foreground/80"
                    }`}>
                      {f.callsign?.trim() || f.icao24}
                    </span>
                    {isMil && (
                      <span className="text-[7px] font-mono font-bold text-red-500 bg-red-500/15 px-1 rounded">MIL</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 pl-3.5">
                    <span className="text-[8px] font-mono text-muted-foreground tabular-nums">
                      FL{Math.round(f.altitude * 3.281 / 100)}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground tabular-nums">
                      {Math.round(f.velocity * 1.944)}kts
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground tabular-nums">
                      {Math.round(f.heading)}°
                    </span>
                    {f.origin_country && (
                      <span className="text-[7px] font-mono text-muted-foreground/60 truncate">
                        {f.origin_country}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center">
                <span className="text-[9px] font-mono text-muted-foreground">
                  No {filter === "MIL" ? "military" : filter === "CIV" ? "civilian" : ""} flights tracked
                </span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});

FlightEmulationPanel.displayName = "FlightEmulationPanel";
