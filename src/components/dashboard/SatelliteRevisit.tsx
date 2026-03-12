import { useState, useMemo } from "react";
import { Clock, MapPin, Satellite, X, Search } from "lucide-react";

interface SatelliteData {
  name: string;
  lat: number;
  lng: number;
  alt: number;
  category: string;
  inclination?: number;
  meanMotion?: number;
  raan?: number;
  meanAnomaly?: number;
  eccentricity?: number;
  epochYear?: number;
  epochDay?: number;
}

interface RevisitPass {
  satName: string;
  category: string;
  minutesFromNow: number;
  elevation: number;
  duration: number;
}

interface SatelliteRevisitProps {
  satellites: SatelliteData[];
  onClose: () => void;
}

function computeRevisitPasses(
  sat: SatelliteData,
  groundLat: number,
  groundLng: number,
  hoursAhead: number = 24
): RevisitPass[] {
  if (!sat.inclination || !sat.meanMotion || sat.meanMotion < 1) return [];
  
  const passes: RevisitPass[] = [];
  const periodMinutes = 1440 / sat.meanMotion;
  const maxMinutes = hoursAhead * 60;
  const incRad = (sat.inclination * Math.PI) / 180;
  
  // Only satellites whose inclination covers the ground point latitude
  if (Math.abs(groundLat) > sat.inclination + 2) return [];
  
  // Simple pass prediction: check every half-period
  for (let t = 0; t < maxMinutes; t += periodMinutes * 0.1) {
    // Approximate sub-satellite point at time t
    const revFraction = t / periodMinutes;
    const ma = ((sat.meanAnomaly || 0) + revFraction * 360) % 360;
    const argLat = (ma * Math.PI) / 180;
    const subLat = Math.asin(Math.sin(incRad) * Math.sin(argLat)) * (180 / Math.PI);
    
    const now = new Date();
    const greenwichOffset = (now.getUTCHours() + t / 60) * 15 + now.getUTCMinutes() * 0.25;
    const ascNode = (sat.raan || 0) - greenwichOffset;
    const subLng = (((ascNode + Math.atan2(Math.cos(incRad) * Math.sin(argLat), Math.cos(argLat)) * (180 / Math.PI)) % 360) + 540) % 360 - 180;
    
    const dLat = Math.abs(subLat - groundLat);
    const dLng = Math.abs(((subLng - groundLng + 540) % 360) - 180);
    const cosLat = Math.cos(groundLat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + (dLng * cosLat) * (dLng * cosLat));
    
    // Within ~10° ground swath
    const swathDeg = sat.alt < 600 ? 8 : sat.alt < 1000 ? 12 : 15;
    if (dist < swathDeg) {
      const elevation = Math.max(5, 90 - dist * 10);
      // Check we haven't already recorded a pass close to this time
      if (!passes.some(p => Math.abs(p.minutesFromNow - t) < periodMinutes * 0.3)) {
        passes.push({
          satName: sat.name,
          category: sat.category,
          minutesFromNow: Math.round(t),
          elevation: Math.round(elevation),
          duration: Math.round(Math.max(2, swathDeg * 0.8)),
        });
      }
    }
    if (passes.length >= 10) break;
  }
  return passes;
}

const CATEGORY_COLORS: Record<string, string> = {
  Military: "#ef4444",
  ISR: "#ff6b00",
  "Early Warning": "#ff3366",
  "Earth Observation": "#ffb800",
  "SAR Imaging": "#f97316",
  Weather: "#a855f7",
  Navigation: "#22c55e",
  Communication: "#ffd54f",
  "Space Station": "#f0f0f0",
};

export const SatelliteRevisit = ({ satellites, onClose }: SatelliteRevisitProps) => {
  const [groundLat, setGroundLat] = useState(32.0);
  const [groundLng, setGroundLng] = useState(44.0);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const passes = useMemo(() => {
    const observationSats = satellites.filter(s =>
      ["Earth Observation", "SAR Imaging", "ISR", "Military", "Weather"].includes(s.category)
    );
    const allPasses: RevisitPass[] = [];
    const satsToCheck = filterCategory === "all" ? observationSats : observationSats.filter(s => s.category === filterCategory);
    satsToCheck.forEach(sat => {
      allPasses.push(...computeRevisitPasses(sat, groundLat, groundLng));
    });
    return allPasses.sort((a, b) => a.minutesFromNow - b.minutesFromNow).slice(0, 20);
  }, [satellites, groundLat, groundLng, filterCategory]);

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="bg-black/90 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl w-80 max-h-[70vh] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">Revisit Calculator</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10">
          <X className="h-3 w-3 text-white/70" />
        </button>
      </div>

      {/* Ground point input */}
      <div className="px-3 py-2 border-b border-white/10 space-y-1.5">
        <div className="text-[8px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" /> Ground Target
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[7px] font-mono text-white/30">LAT</label>
            <input type="number" step="0.1" value={groundLat} onChange={e => setGroundLat(parseFloat(e.target.value) || 0)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-white outline-none" />
          </div>
          <div className="flex-1">
            <label className="text-[7px] font-mono text-white/30">LNG</label>
            <input type="number" step="0.1" value={groundLng} onChange={e => setGroundLng(parseFloat(e.target.value) || 0)}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-white outline-none" />
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { label: "All", val: "all" },
            { label: "EO", val: "Earth Observation" },
            { label: "SAR", val: "SAR Imaging" },
            { label: "ISR", val: "ISR" },
            { label: "MIL", val: "Military" },
          ].map(f => (
            <button key={f.val} onClick={() => setFilterCategory(f.val)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${filterCategory === f.val ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400" : "border-white/10 text-white/40 hover:text-white/60"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Passes list */}
      <div className="flex-1 overflow-y-auto">
        {passes.length === 0 && (
          <div className="px-3 py-6 text-center text-[9px] font-mono text-white/30">
            No passes predicted for this location in next 24h
          </div>
        )}
        {passes.map((pass, i) => {
          const color = CATEGORY_COLORS[pass.category] || "#888";
          return (
            <div key={`${pass.satName}-${pass.minutesFromNow}-${i}`}
              className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono text-white/80 truncate">{pass.satName}</div>
                <div className="text-[7px] font-mono text-white/30">{pass.category}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] font-mono font-bold" style={{ color }}>
                  {pass.minutesFromNow === 0 ? "NOW" : `+${formatTime(pass.minutesFromNow)}`}
                </div>
                <div className="text-[7px] font-mono text-white/30">{pass.elevation}° el</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-white/10 text-[7px] font-mono text-white/20 text-center">
        Simplified prediction · {satellites.filter(s => ["Earth Observation", "SAR Imaging", "ISR", "Military", "Weather"].includes(s.category)).length} observation satellites tracked
      </div>
    </div>
  );
};
