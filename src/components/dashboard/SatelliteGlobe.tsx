import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, Satellite, Eye, EyeOff, Tag, Tags } from "lucide-react";

interface SatelliteData {
  name: string;
  lat: number;
  lng: number;
  alt: number;
  category: string;
  noradId?: string;
  inclination?: number;
  meanMotion?: number;
  eccentricity?: number;
  period?: number;
  epochYear?: number;
  epochDay?: number;
  launchYear?: string;
  intlDesignator?: string;
  velocity?: number;
}

interface SatelliteGlobeProps {
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Military": "#ef4444",
  "ISR": "#ff6b00",
  "Communication": "#00d4ff",
  "Navigation": "#22c55e",
  "Weather": "#a855f7",
  "Earth Observation": "#ffb800",
  "Unknown": "#888888",
};

function parseTLEFull(name: string, tle1: string, tle2: string): SatelliteData | null {
  try {
    const inclination = parseFloat(tle2.substring(8, 16).trim());
    const raan = parseFloat(tle2.substring(17, 25).trim());
    const eccentricity = parseFloat("0." + tle2.substring(26, 33).trim());
    const meanAnomaly = parseFloat(tle2.substring(43, 51).trim());
    const meanMotion = parseFloat(tle2.substring(52, 63).trim());
    const intlDesignator = tle1.substring(9, 17).trim();
    const epochYearRaw = parseInt(tle1.substring(18, 20).trim());
    const epochDay = parseFloat(tle1.substring(20, 32).trim());
    const epochYear = epochYearRaw > 56 ? 1900 + epochYearRaw : 2000 + epochYearRaw;
    const GM = 398600.4418;
    const T = 86400 / meanMotion;
    const a = Math.pow((GM * T * T) / (4 * Math.PI * Math.PI), 1 / 3);
    const alt = Math.max(a - 6371, 200);
    const period = T / 60;
    const velocity = Math.sqrt(GM / a);
    const now = new Date();
    const startOfYear = new Date(epochYear, 0, 1);
    const currentDayOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    const elapsedRevs = (currentDayOfYear - epochDay) * meanMotion;
    const currentAnomaly = ((meanAnomaly + elapsedRevs * 360) % 360 + 360) % 360;
    const lat = inclination * Math.sin((currentAnomaly * Math.PI) / 180);
    const greenwichOffset = ((now.getUTCHours() * 15) + (now.getUTCMinutes() * 0.25));
    const lng = ((raan + currentAnomaly - greenwichOffset) % 360 + 540) % 360 - 180;
    const noradId = tle1.substring(2, 7).trim();
    const launchYear = intlDesignator.substring(0, 2);
    return {
      name: name.trim(), lat: Math.max(-85, Math.min(85, lat)), lng,
      alt: Math.min(alt, 42000), category: categorizeSatellite(name), noradId,
      inclination, meanMotion, eccentricity, period, epochYear, epochDay,
      launchYear: launchYear ? (parseInt(launchYear) > 56 ? `19${launchYear}` : `20${launchYear}`) : undefined,
      intlDesignator, velocity,
    };
  } catch { return null; }
}

function categorizeSatellite(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("USA ") || n.includes("NOSS") || n.includes("LACROSSE") || n.includes("ONYX") || n.includes("MISTY")) return "Military";
  if (n.includes("KEYHOLE") || n.includes("KH-") || n.includes("CRYSTAL") || n.includes("ORION") || n.includes("MENTOR") || n.includes("TRUMPET")) return "ISR";
  if (n.includes("STARLINK") || n.includes("IRIDIUM") || n.includes("INTELSAT") || n.includes("SES") || n.includes("VIASAT") || n.includes("ONEWEB")) return "Communication";
  if (n.includes("GPS") || n.includes("NAVSTAR") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU")) return "Navigation";
  if (n.includes("NOAA") || n.includes("GOES") || n.includes("METEOSAT") || n.includes("HIMAWARI") || n.includes("DMSP")) return "Weather";
  if (n.includes("LANDSAT") || n.includes("SENTINEL") || n.includes("WORLDVIEW") || n.includes("PLEIADES") || n.includes("SPOT") || n.includes("TERRA") || n.includes("AQUA")) return "Earth Observation";
  return "Unknown";
}

function getOrbitType(alt: number, inclination?: number, eccentricity?: number): string {
  if (alt < 2000) return "LEO (Low Earth Orbit)";
  if (alt >= 2000 && alt < 35000) return "MEO (Medium Earth Orbit)";
  if (alt >= 35000 && alt <= 36500) return "GEO (Geostationary)";
  if ((eccentricity || 0) > 0.1) return "HEO (Highly Elliptical)";
  return "Other";
}

export const SatelliteGlobe = ({ onClose }: SatelliteGlobeProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const globeElRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<any>(null);
  const satsRef = useRef<SatelliteData[]>([]);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedSat, setSelectedSat] = useState<SatelliteData | null>(null);

  // Keep ref in sync
  useEffect(() => { satsRef.current = satellites; }, [satellites]);

  const fetchSatellites = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle").then(r => r.text()).catch(() => "");
      const allSats: SatelliteData[] = [];
      const seen = new Set<string>();
      const lines = resp.trim().split("\n").map(l => l.trim());
      for (let i = 0; i < lines.length - 2; i += 3) {
        const name = lines[i], tle1 = lines[i + 1], tle2 = lines[i + 2];
        if (!tle1?.startsWith("1 ") || !tle2?.startsWith("2 ")) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        const sat = parseTLEFull(name, tle1, tle2);
        if (sat) allSats.push(sat);
      }
      setSatellites(allSats.slice(0, 2500));
    } catch (err) {
      console.error("Failed to fetch satellites:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSatellites(); }, [fetchSatellites]);

  // Animate positions via ref — no state update, just update globe data directly
  useEffect(() => {
    if (satellites.length === 0) return;
    const interval = setInterval(() => {
      const globe = globeRef.current;
      if (!globe) return;
      const current = satsRef.current;
      const updated = current.map(s => {
        const dps = (s.meanMotion || 15) * 360 / 86400;
        const newLng = ((s.lng + dps * 2) + 540) % 360 - 180;
        const latOsc = Math.sin(Date.now() / 10000 + (s.noradId ? parseInt(s.noradId) : 0)) * (s.inclination || 30) * 0.01;
        return { ...s, lng: newLng, lat: Math.max(-85, Math.min(85, s.lat + latOsc)) };
      });
      satsRef.current = updated;
      // Update globe data without React re-render
      const catFilter = selectedCat;
      const filtered = catFilter ? updated.filter(s => s.category === catFilter) : updated;
      globe.pointsData(filtered);
    }, 3000);
    return () => clearInterval(interval);
  }, [satellites.length, selectedCat]);

  // Create globe ONCE, update data separately
  useEffect(() => {
    if (!wrapperRef.current || satellites.length === 0) return;

    // Create a dedicated DOM element for globe outside React's control
    if (!globeElRef.current) {
      globeElRef.current = document.createElement("div");
      globeElRef.current.style.cssText = "width:100%;height:100%;position:absolute;inset:0;";
      wrapperRef.current.appendChild(globeElRef.current);
    }

    let cancelled = false;

    const initGlobe = async () => {
      const mod = await import("globe.gl");
      const Globe = mod.default;
      if (cancelled || !globeElRef.current) return;

      // Destroy previous instance
      if (globeRef.current) {
        globeRef.current._destructor?.();
        globeElRef.current.innerHTML = "";
      }

      const el = globeElRef.current;
      const filtered = selectedCat ? satellites.filter(s => s.category === selectedCat) : satellites;

      const arcs = showOrbits
        ? filtered.slice(0, 600).map(s => ({
            startLat: s.lat, startLng: s.lng,
            endLat: s.lat + Math.sin((s.inclination || 45) * Math.PI / 180) * 30,
            endLng: ((s.lng + 50 + (s.meanMotion || 15) * 2) % 360) - 180,
            alt: Math.min(s.alt / 6371 / 3, 0.8),
            color: CATEGORY_COLORS[s.category] || "#888",
          }))
        : [];

      const globe = new Globe(el)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .width(el.clientWidth)
        .height(el.clientHeight)
        .atmosphereColor("hsl(190, 100%, 50%)")
        .atmosphereAltitude(0.18)
        .pointsData(filtered)
        .pointLat("lat")
        .pointLng("lng")
        .pointAltitude((d: SatelliteData) => Math.min(d.alt / 6371 / 2, 1.2))
        .pointRadius((d: SatelliteData) => d.category === "Military" || d.category === "ISR" ? 0.25 : 0.12)
        .pointColor((d: SatelliteData) => CATEGORY_COLORS[d.category] || "#888")
        .onPointClick((d: any) => {
          setSelectedSat(d as SatelliteData);
          globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.8 }, 1000);
        })
        .labelsData(showLabels ? filtered.filter((_, i) => i % (filtered.length > 500 ? 5 : 1) === 0) : [])
        .labelLat("lat")
        .labelLng("lng")
        .labelAltitude((d: SatelliteData) => Math.min(d.alt / 6371 / 2, 1.2) + 0.01)
        .labelText("name")
        .labelSize(0.4)
        .labelDotRadius(0.12)
        .labelColor((d: SatelliteData) => CATEGORY_COLORS[d.category] || "#888")
        .labelResolution(2)
        .onLabelClick((d: any) => {
          setSelectedSat(d as SatelliteData);
          globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.8 }, 1000);
        })
        .arcsData(arcs)
        .arcStartLat("startLat").arcStartLng("startLng")
        .arcEndLat("endLat").arcEndLng("endLng")
        .arcColor("color").arcAltitude("alt")
        .arcStroke(0.3).arcDashLength(0.5).arcDashGap(0.15).arcDashAnimateTime(3000);

      globe.pointOfView({ lat: 30, lng: 50, altitude: 2.5 }, 1000);
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.3;
      globeRef.current = globe;
    };

    initGlobe();

    return () => {
      cancelled = true;
    };
  }, [satellites.length > 0, showOrbits, selectedCat, showLabels]); // Only re-init on toggle changes, NOT on position updates

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (globeRef.current && globeElRef.current) {
        globeRef.current.width(globeElRef.current.clientWidth).height(globeElRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (globeElRef.current) {
        globeElRef.current.remove();
        globeElRef.current = null;
      }
      globeRef.current = null;
    };
  }, []);

  const categories = Object.entries(CATEGORY_COLORS);
  const counts = categories.map(([cat]) => ({
    cat, count: satellites.filter(s => s.category === cat).length,
  }));

  return (
    <div className="absolute inset-0 z-[2000] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/90 backdrop-blur border-b border-border z-10">
        <div className="flex items-center gap-2">
          <Satellite className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">3D Satellite Tracker</span>
          <span className="text-[9px] font-mono text-muted-foreground">{loading ? "LOADING…" : `${satellites.length} LIVE`}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowLabels(!showLabels)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showLabels ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
            {showLabels ? <Tag className="h-3 w-3" /> : <Tags className="h-3 w-3" />} Names
          </button>
          <button onClick={() => setShowOrbits(!showOrbits)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showOrbits ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
            {showOrbits ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} Orbits
          </button>
          <button onClick={fetchSatellites}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border border-border text-muted-foreground hover:bg-secondary transition-all">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-card/70 backdrop-blur border-b border-border/50 overflow-x-auto z-10">
        <button onClick={() => setSelectedCat(null)}
          className={`flex-shrink-0 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${!selectedCat ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
          ALL ({satellites.length})
        </button>
        {counts.filter(c => c.count > 0).map(({ cat, count }) => (
          <button key={cat} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
            className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${selectedCat === cat ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
            {cat} ({count})
          </button>
        ))}
      </div>

      {/* Globe wrapper — React doesn't manage children inside this div */}
      <div ref={wrapperRef} className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="text-center space-y-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Fetching satellite TLE data…</p>
            </div>
          </div>
        )}

        {/* Selected satellite detail panel */}
        {selectedSat && (
          <div className="absolute top-3 left-3 z-30 w-72 rounded-lg border backdrop-blur-md shadow-2xl animate-fade-in pointer-events-auto"
            style={{ borderColor: CATEGORY_COLORS[selectedSat.category] + "80", background: "rgba(0,0,0,0.88)", boxShadow: `0 0 30px ${CATEGORY_COLORS[selectedSat.category]}33` }}>
            <div className="flex items-center justify-between px-3 py-2 border-b rounded-t-lg"
              style={{ borderColor: CATEGORY_COLORS[selectedSat.category] + "40", background: CATEGORY_COLORS[selectedSat.category] + "15" }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">🛰</span>
                <span className="text-xs font-mono font-bold truncate" style={{ color: CATEGORY_COLORS[selectedSat.category] }}>{selectedSat.name}</span>
              </div>
              <button onClick={() => setSelectedSat(null)} className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            <div className="p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: CATEGORY_COLORS[selectedSat.category] }} />
                <span className="text-[10px] font-mono text-muted-foreground uppercase">{selectedSat.category} • ACTIVE</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <DataRow label="NORAD ID" value={selectedSat.noradId || "N/A"} />
                <DataRow label="INTL DES" value={selectedSat.intlDesignator || "N/A"} />
                <DataRow label="ALTITUDE" value={`${Math.round(selectedSat.alt)} km`} />
                <DataRow label="ORBIT" value={getOrbitType(selectedSat.alt, selectedSat.inclination, selectedSat.eccentricity)} />
                <DataRow label="INCLINATION" value={`${selectedSat.inclination?.toFixed(2) || "N/A"}°`} />
                <DataRow label="ECCENTRICITY" value={selectedSat.eccentricity?.toFixed(5) || "N/A"} />
                <DataRow label="PERIOD" value={selectedSat.period ? `${selectedSat.period.toFixed(1)} min` : "N/A"} />
                <DataRow label="VELOCITY" value={selectedSat.velocity ? `${selectedSat.velocity.toFixed(2)} km/s` : "N/A"} />
                <DataRow label="REV/DAY" value={selectedSat.meanMotion?.toFixed(4) || "N/A"} />
                <DataRow label="LAUNCH" value={selectedSat.launchYear || "N/A"} />
                <DataRow label="LATITUDE" value={`${selectedSat.lat.toFixed(3)}°`} />
                <DataRow label="LONGITUDE" value={`${selectedSat.lng.toFixed(3)}°`} />
              </div>
              <div className="border-t border-border/30 pt-1.5">
                <span className="text-[8px] font-mono text-muted-foreground/60">EPOCH: {selectedSat.epochYear} DAY {selectedSat.epochDay?.toFixed(4)} • TLE SOURCE: CELESTRAK</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-card/70 backdrop-blur border-t border-border/50 z-10">
        <span className="text-[8px] font-mono text-muted-foreground uppercase">Legend:</span>
        {categories.map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[8px] font-mono text-muted-foreground">{cat}</span>
          </div>
        ))}
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/50">CLICK SATELLITE FOR DETAILS</span>
      </div>
    </div>
  );
};

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[7px] font-mono text-muted-foreground/50 uppercase tracking-wider">{label}</span>
    <span className="text-[10px] font-mono text-foreground/90">{value}</span>
  </div>
);
