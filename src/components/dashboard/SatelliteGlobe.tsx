import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, Satellite, Eye, EyeOff, Search, Tag, Tags } from "lucide-react";

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
  "Communication": "#ffd54f",
  "Navigation": "#22c55e",
  "Weather": "#a855f7",
  "Earth Observation": "#ffb800",
  "Unknown": "#d4a843",
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

function getOrbitType(alt: number, _inc?: number, ecc?: number): string {
  if (alt < 2000) return "LEO";
  if (alt >= 2000 && alt < 35000) return "MEO";
  if (alt >= 35000 && alt <= 36500) return "GEO";
  if ((ecc || 0) > 0.1) return "HEO";
  return "Other";
}

const CITY_PRESETS = [
  { name: "Austin", lat: 30.27, lng: -97.74 },
  { name: "San Francisco", lat: 37.77, lng: -122.42 },
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "Tokyo", lat: 35.68, lng: 139.69 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Paris", lat: 48.86, lng: 2.35 },
  { name: "Dubai", lat: 25.20, lng: 55.27 },
  { name: "Washington DC", lat: 38.91, lng: -77.04 },
];

export const SatelliteGlobe = ({ onClose }: SatelliteGlobeProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const globeElRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<any>(null);
  const satsRef = useRef<SatelliteData[]>([]);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrbits, setShowOrbits] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedSat, setSelectedSat] = useState<SatelliteData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SatelliteData[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeCity, setActiveCity] = useState<string | null>(null);

  useEffect(() => { satsRef.current = satellites; }, [satellites]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const q = query.toUpperCase().trim();
    const results = satsRef.current.filter(s =>
      s.name.toUpperCase().includes(q) || (s.noradId && s.noradId.includes(q))
    ).slice(0, 20);
    setSearchResults(results);
  }, []);

  const flyToSatellite = useCallback((sat: SatelliteData) => {
    setSelectedSat(sat);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: sat.lat, lng: sat.lng, altitude: 1.8 }, 1000);
    }
  }, []);

  const flyToCity = useCallback((city: typeof CITY_PRESETS[0]) => {
    setActiveCity(city.name);
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: city.lat, lng: city.lng, altitude: 2.0 }, 1500);
    }
  }, []);

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
      setSatellites(allSats.slice(0, 3000));
    } catch (err) {
      console.error("Failed to fetch satellites:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSatellites(); }, [fetchSatellites]);

  // Animate positions via ref
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
      const catFilter = selectedCat;
      const filtered = catFilter ? updated.filter(s => s.category === catFilter) : updated;
      globe.pointsData(filtered);
    }, 3000);
    return () => clearInterval(interval);
  }, [satellites.length, selectedCat]);

  // Init globe
  useEffect(() => {
    if (!wrapperRef.current || satellites.length === 0) return;

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

      if (globeRef.current) {
        globeElRef.current.innerHTML = "";
      }

      const el = globeElRef.current;
      const filtered = selectedCat ? satellites.filter(s => s.category === selectedCat) : satellites;

      // Create sparse orbital ring arcs (red accent like reference)
      const orbitalRings = showOrbits ? filtered.slice(0, 300).map(s => ({
        startLat: s.lat,
        startLng: s.lng,
        endLat: s.lat + Math.sin((s.inclination || 45) * Math.PI / 180) * 40,
        endLng: ((s.lng + 80) % 360) - 180,
        alt: Math.min(s.alt / 6371 / 3, 0.6),
        color: s.category === "Military" || s.category === "ISR" ? "rgba(239,68,68,0.4)" : "rgba(255,213,79,0.15)",
      })) : [];

      const globe = new Globe(el)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .width(el.clientWidth)
        .height(el.clientHeight)
        .atmosphereColor("#1a6b8a")
        .atmosphereAltitude(0.25)
        // Custom globe material for darker/moodier look
        .onGlobeReady(() => {
          const scene = globe.scene();
          // Add subtle ambient glow ring around Earth
          if (scene) {
            try {
              const THREE = (window as any).THREE || (globe as any).__three__;
              // The globe material is auto-set, we just ensure atmosphere is visible
            } catch {}
          }
        })
        // Dense satellite point cloud — small dots like the reference
        .pointsData(filtered)
        .pointLat("lat")
        .pointLng("lng")
        .pointAltitude((d: SatelliteData) => {
          // Distribute across shell: LEO tight, others further out
          const baseAlt = d.alt / 6371;
          return Math.min(baseAlt * 0.35 + 0.02, 0.8);
        })
        .pointRadius((d: SatelliteData) => {
          // Tiny dots — military/ISR slightly larger
          if (d.category === "Military" || d.category === "ISR") return 0.08;
          return 0.04;
        })
        .pointColor((d: SatelliteData) => {
          // Reference shows golden/amber cloud with red accents
          if (d.category === "Military") return "#ef4444";
          if (d.category === "ISR") return "#ff6b00";
          if (d.category === "Navigation") return "#22c55e";
          // Most satellites = warm amber/gold like reference
          return "#d4a843";
        })
        .pointsMerge(true) // Critical: merge points into single geometry for performance + dense cloud look
        .onPointClick((d: any) => {
          setSelectedSat(d as SatelliteData);
          globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 1000);
        })
        // Labels (sparse, only when toggled)
        .labelsData(showLabels ? filtered.filter((_, i) => i % 10 === 0).slice(0, 200) : [])
        .labelLat("lat")
        .labelLng("lng")
        .labelAltitude((d: SatelliteData) => Math.min(d.alt / 6371 * 0.35 + 0.03, 0.82))
        .labelText("name")
        .labelSize(0.3)
        .labelDotRadius(0.06)
        .labelColor(() => "rgba(255,213,79,0.7)")
        .labelResolution(1)
        .onLabelClick((d: any) => {
          setSelectedSat(d as SatelliteData);
          globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 1000);
        })
        // Orbital arcs
        .arcsData(orbitalRings)
        .arcStartLat("startLat").arcStartLng("startLng")
        .arcEndLat("endLat").arcEndLng("endLng")
        .arcColor("color").arcAltitude("alt")
        .arcStroke(0.2).arcDashLength(0.6).arcDashGap(0.3).arcDashAnimateTime(5000);

      globe.pointOfView({ lat: 25, lng: 55, altitude: 2.8 }, 1500);
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.4;
      globe.controls().enableDamping = true;

      globeRef.current = globe;
    };

    initGlobe();
    return () => { cancelled = true; };
  }, [satellites.length > 0, showOrbits, selectedCat, showLabels]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      if (globeRef.current && globeElRef.current) {
        globeRef.current.width(globeElRef.current.clientWidth).height(globeElRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (globeElRef.current) { globeElRef.current.remove(); globeElRef.current = null; }
      globeRef.current = null;
    };
  }, []);

  const categories = Object.entries(CATEGORY_COLORS);
  const counts = categories.map(([cat]) => ({
    cat, count: satellites.filter(s => s.category === cat).length,
  }));

  const now = new Date();
  const timestamp = `REC ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')}Z`;

  return (
    <div className="absolute inset-0 z-[2000] bg-[#050a12] flex flex-col overflow-hidden">
      {/* Scanline overlay for CRT effect */}
      <div className="absolute inset-0 z-[2001] pointer-events-none opacity-[0.03]"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)" }} />

      {/* Top-left HUD */}
      <div className="absolute top-3 left-3 z-[2002] pointer-events-none space-y-1">
        <div className="font-mono text-[11px] font-bold tracking-[0.2em] text-primary/90" style={{ textShadow: "0 0 10px hsl(190 100% 50% / 0.5)" }}>
          WORLDVIEW
        </div>
        <div className="text-[8px] font-mono text-muted-foreground/60 tracking-wider">NO DATA LEFT BEHIND</div>
        <div className="mt-2 space-y-0.5 text-[8px] font-mono text-primary/60">
          <div>TOP SECRET // SI-TK // NOFORN</div>
          <div>OPS-{Math.floor(Math.random() * 9000 + 1000)}</div>
        </div>
      </div>

      {/* Top-right timestamp + recording indicator */}
      <div className="absolute top-3 right-3 z-[2002] pointer-events-none text-right space-y-0.5">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-mono text-red-400">{timestamp}</span>
        </div>
        <div className="text-[8px] font-mono text-muted-foreground/50">
          ORB: {satellites.length} PASS: {satellites.filter(s => s.alt < 2000).length}
        </div>
      </div>

      {/* Left sidebar controls */}
      <div className="absolute top-16 left-3 z-[2002] space-y-1.5 pointer-events-auto">
        {[
          { label: "Satellites", count: satellites.length, active: true },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 text-[9px] font-mono">
            <span className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-amber-400' : 'bg-muted-foreground/30'}`} />
            <span className={item.active ? 'text-amber-400' : 'text-muted-foreground/50'}>{item.count} {item.label}</span>
          </div>
        ))}
        <div className="mt-3 space-y-1">
          {categories.map(([cat, color]) => {
            const count = satellites.filter(s => s.category === cat).length;
            if (count === 0) return null;
            return (
              <button key={cat} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                className={`flex items-center gap-1.5 text-[8px] font-mono transition-all ${selectedCat === cat ? 'opacity-100' : selectedCat ? 'opacity-30' : 'opacity-70'} hover:opacity-100`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span style={{ color }}>{cat}</span>
                <span className="text-muted-foreground/40">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right sidebar - render controls */}
      <div className="absolute top-16 right-3 z-[2002] space-y-1.5 pointer-events-auto w-28">
        <button onClick={() => setShowLabels(!showLabels)}
          className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[8px] font-mono uppercase border transition-all ${showLabels ? "border-primary/50 bg-primary/15 text-primary" : "border-border/30 text-muted-foreground/50 hover:border-border"}`}>
          {showLabels ? <Tag className="h-2.5 w-2.5" /> : <Tags className="h-2.5 w-2.5" />} Labels
        </button>
        <button onClick={() => setShowOrbits(!showOrbits)}
          className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[8px] font-mono uppercase border transition-all ${showOrbits ? "border-primary/50 bg-primary/15 text-primary" : "border-border/30 text-muted-foreground/50 hover:border-border"}`}>
          {showOrbits ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />} Orbits
        </button>
        <button onClick={() => setShowSearch(!showSearch)}
          className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[8px] font-mono uppercase border transition-all ${showSearch ? "border-primary/50 bg-primary/15 text-primary" : "border-border/30 text-muted-foreground/50 hover:border-border"}`}>
          <Search className="h-2.5 w-2.5" /> Search
        </button>
        <button onClick={fetchSatellites}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[8px] font-mono uppercase border border-border/30 text-muted-foreground/50 hover:border-border transition-all">
          <RefreshCw className={`h-2.5 w-2.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        <button onClick={onClose}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[8px] font-mono uppercase border border-red-500/30 text-red-400/70 hover:bg-red-500/10 transition-all">
          <X className="h-2.5 w-2.5" /> Close
        </button>
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[2003] w-80 pointer-events-auto">
          <div className="rounded-lg border border-primary/30 bg-black/90 backdrop-blur-md p-2 space-y-1.5"
            style={{ boxShadow: "0 0 30px hsl(190 100% 50% / 0.1)" }}>
            <div className="flex items-center gap-2">
              <Search className="h-3 w-3 text-primary/60 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                placeholder="Search satellite name or NORAD ID…"
                className="flex-1 bg-transparent text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 outline-none" autoFocus />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}><X className="h-3 w-3 text-muted-foreground" /></button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border-t border-border/20 pt-1">
                {searchResults.map((sat, i) => (
                  <button key={sat.noradId || i} onClick={() => flyToSatellite(sat)}
                    className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-primary/10 rounded transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[sat.category] }} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-mono font-bold text-foreground/90 block truncate">{sat.name}</span>
                      <span className="text-[7px] font-mono text-muted-foreground/50">{sat.noradId} • {sat.category} • {Math.round(sat.alt)}km</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Globe container */}
      <div ref={wrapperRef} className="absolute inset-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-[2002] pointer-events-none">
            <div className="text-center space-y-2">
              <div className="h-8 w-8 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest">Acquiring TLE data…</p>
            </div>
          </div>
        )}

        {/* Selected satellite detail panel */}
        {selectedSat && (
          <div className="absolute top-16 left-36 z-[2003] w-64 rounded border backdrop-blur-md pointer-events-auto animate-fade-in"
            style={{ borderColor: CATEGORY_COLORS[selectedSat.category] + "60", background: "rgba(5,10,18,0.92)", boxShadow: `0 0 20px ${CATEGORY_COLORS[selectedSat.category]}22` }}>
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b"
              style={{ borderColor: CATEGORY_COLORS[selectedSat.category] + "30", background: CATEGORY_COLORS[selectedSat.category] + "08" }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Satellite className="h-3 w-3 flex-shrink-0" style={{ color: CATEGORY_COLORS[selectedSat.category] }} />
                <span className="text-[10px] font-mono font-bold truncate" style={{ color: CATEGORY_COLORS[selectedSat.category] }}>{selectedSat.name}</span>
              </div>
              <button onClick={() => setSelectedSat(null)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10">
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: CATEGORY_COLORS[selectedSat.category] }} />
                <span className="text-[8px] font-mono text-muted-foreground/70 uppercase">{selectedSat.category} • {getOrbitType(selectedSat.alt, selectedSat.inclination, selectedSat.eccentricity)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <DataRow label="NORAD" value={selectedSat.noradId || "N/A"} />
                <DataRow label="INTL" value={selectedSat.intlDesignator || "N/A"} />
                <DataRow label="ALT" value={`${Math.round(selectedSat.alt)} km`} />
                <DataRow label="VEL" value={selectedSat.velocity ? `${selectedSat.velocity.toFixed(1)} km/s` : "N/A"} />
                <DataRow label="INC" value={`${selectedSat.inclination?.toFixed(2) || "N/A"}°`} />
                <DataRow label="ECC" value={selectedSat.eccentricity?.toFixed(5) || "N/A"} />
                <DataRow label="PERIOD" value={selectedSat.period ? `${selectedSat.period.toFixed(0)} min` : "N/A"} />
                <DataRow label="REV/DAY" value={selectedSat.meanMotion?.toFixed(2) || "N/A"} />
                <DataRow label="LAT" value={`${selectedSat.lat.toFixed(3)}°`} />
                <DataRow label="LNG" value={`${selectedSat.lng.toFixed(3)}°`} />
              </div>
              <div className="text-[7px] font-mono text-muted-foreground/30 pt-1 border-t border-border/20">
                EPOCH: {selectedSat.epochYear} DAY {selectedSat.epochDay?.toFixed(2)} • CELESTRAK
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom city presets bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[2002] pointer-events-auto">
        <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur border border-border/30 rounded-md px-1 py-0.5">
          {CITY_PRESETS.map(city => (
            <button key={city.name} onClick={() => flyToCity(city)}
              className={`px-2.5 py-1 rounded text-[8px] font-mono transition-all ${
                activeCity === city.name
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5 border border-transparent"
              }`}>
              {city.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-left stats */}
      <div className="absolute bottom-3 left-3 z-[2002] pointer-events-none text-[7px] font-mono text-muted-foreground/30 space-y-0.5">
        <div>GSD: {(12355.15 + Math.random() * 100).toFixed(2)}M NADIR: {(Math.random() * 5).toFixed(1)}</div>
        <div>ALT: {(32488411 + Math.random() * 10000).toFixed(0)}M SUN: -{(31 + Math.random() * 5).toFixed(1)}° EL</div>
      </div>
    </div>
  );
};

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[6px] font-mono text-muted-foreground/40 uppercase tracking-wider">{label}</span>
    <span className="text-[9px] font-mono text-foreground/80">{value}</span>
  </div>
);
