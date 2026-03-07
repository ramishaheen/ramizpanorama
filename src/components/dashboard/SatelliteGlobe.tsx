import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, Satellite, Eye, EyeOff } from "lucide-react";

interface SatelliteData {
  name: string;
  lat: number;
  lng: number;
  alt: number; // km
  category: string;
  noradId?: string;
}

interface OrbitPath {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  alt: number;
  color: string;
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

// Parse TLE to approximate lat/lng/alt
function parseTLEToPosition(tle1: string, tle2: string): { lat: number; lng: number; alt: number } | null {
  try {
    const inclination = parseFloat(tle2.substring(8, 16).trim());
    const raan = parseFloat(tle2.substring(17, 25).trim());
    const meanAnomaly = parseFloat(tle2.substring(43, 51).trim());
    const meanMotion = parseFloat(tle2.substring(52, 63).trim());

    // Approximate altitude from mean motion (rev/day)
    const GM = 398600.4418; // km³/s²
    const T = 86400 / meanMotion; // period in seconds
    const a = Math.pow((GM * T * T) / (4 * Math.PI * Math.PI), 1 / 3); // semi-major axis km
    const alt = Math.max(a - 6371, 200); // altitude above Earth

    // Approximate subsatellite point from mean anomaly + RAAN
    const lat = inclination * Math.sin((meanAnomaly * Math.PI) / 180) * (0.6 + Math.random() * 0.4);
    const lng = ((raan + meanAnomaly) % 360) - 180;

    return { lat: Math.max(-85, Math.min(85, lat)), lng, alt: Math.min(alt, 36000) };
  } catch {
    return null;
  }
}

function categorizeSatellite(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("USA ") || n.includes("NOSS") || n.includes("LACROSSE") || n.includes("ONYX") || n.includes("MISTY")) return "Military";
  if (n.includes("KEYHOLE") || n.includes("KH-") || n.includes("CRYSTAL") || n.includes("ORION") || n.includes("MENTOR") || n.includes("TRUMPET")) return "ISR";
  if (n.includes("STARLINK") || n.includes("IRIDIUM") || n.includes("INTELSAT") || n.includes("SES") || n.includes("VIASAT")) return "Communication";
  if (n.includes("GPS") || n.includes("NAVSTAR") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU")) return "Navigation";
  if (n.includes("NOAA") || n.includes("GOES") || n.includes("METEOSAT") || n.includes("HIMAWARI")) return "Weather";
  if (n.includes("LANDSAT") || n.includes("SENTINEL") || n.includes("WORLDVIEW") || n.includes("PLEIADES") || n.includes("SPOT")) return "Earth Observation";
  return "Unknown";
}

export const SatelliteGlobe = ({ onClose }: SatelliteGlobeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [hoveredSat, setHoveredSat] = useState<SatelliteData | null>(null);

  const fetchSatellites = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch multiple TLE catalogs from CelesTrak
      const urls = [
        "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
      ];

      const responses = await Promise.all(
        urls.map((url) =>
          fetch(url)
            .then((r) => r.text())
            .catch(() => "")
        )
      );

      const allSats: SatelliteData[] = [];
      const seen = new Set<string>();

      responses.forEach((text) => {
        const lines = text.trim().split("\n").map((l) => l.trim());
        for (let i = 0; i < lines.length - 2; i += 3) {
          const name = lines[i];
          const tle1 = lines[i + 1];
          const tle2 = lines[i + 2];

          if (!tle1?.startsWith("1 ") || !tle2?.startsWith("2 ")) continue;
          if (seen.has(name)) continue;
          seen.add(name);

          const pos = parseTLEToPosition(tle1, tle2);
          if (!pos) continue;

          const noradId = tle1.substring(2, 7).trim();
          allSats.push({
            name,
            ...pos,
            category: categorizeSatellite(name),
            noradId,
          });
        }
      });

      // Limit to ~2000 for performance
      const limited = allSats.slice(0, 2000);
      setSatellites(limited);
    } catch (err) {
      console.error("Failed to fetch satellites:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSatellites();
  }, [fetchSatellites]);

  // Initialize Globe.gl
  useEffect(() => {
    if (!containerRef.current || satellites.length === 0) return;

    let Globe: any;
    const initGlobe = async () => {
      const mod = await import("globe.gl");
      Globe = mod.default;

      if (globeRef.current) {
        // Clean up previous
        containerRef.current?.querySelector("canvas")?.remove();
      }

      const filtered = selectedCat
        ? satellites.filter((s) => s.category === selectedCat)
        : satellites;

      // Generate orbit arcs
      const arcs: OrbitPath[] = showOrbits
        ? filtered.slice(0, 500).map((s) => ({
            startLat: s.lat,
            startLng: s.lng,
            endLat: s.lat + (Math.random() - 0.5) * 40,
            endLng: ((s.lng + 60 + Math.random() * 30) % 360) - 180,
            alt: s.alt / 6371 / 4,
            color: CATEGORY_COLORS[s.category] || "#888",
          }))
        : [];

      const globe = Globe()(containerRef.current!)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .width(containerRef.current!.clientWidth)
        .height(containerRef.current!.clientHeight)
        .atmosphereColor("hsl(190, 100%, 50%)")
        .atmosphereAltitude(0.15)
        // Satellite points
        .pointsData(filtered)
        .pointLat("lat")
        .pointLng("lng")
        .pointAltitude((d: SatelliteData) => d.alt / 6371 / 2)
        .pointRadius(0.15)
        .pointColor((d: SatelliteData) => CATEGORY_COLORS[d.category] || "#888")
        .pointLabel((d: SatelliteData) => `
          <div style="background:rgba(0,0,0,0.85);border:1px solid ${CATEGORY_COLORS[d.category]};padding:6px 10px;border-radius:4px;font-family:monospace;font-size:10px;color:#fff;max-width:200px;">
            <div style="color:${CATEGORY_COLORS[d.category]};font-weight:700;margin-bottom:2px;">🛰 ${d.name}</div>
            <div>Category: ${d.category}</div>
            <div>Alt: ${Math.round(d.alt)} km</div>
            ${d.noradId ? `<div style="opacity:0.6;">NORAD: ${d.noradId}</div>` : ""}
          </div>
        `)
        // Orbit arcs
        .arcsData(arcs)
        .arcStartLat("startLat")
        .arcStartLng("startLng")
        .arcEndLat("endLat")
        .arcEndLng("endLng")
        .arcColor("color")
        .arcAltitude("alt")
        .arcStroke(0.3)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(4000);

      // Set camera to Middle East view
      globe.pointOfView({ lat: 30, lng: 50, altitude: 2.5 }, 1000);

      // Auto-rotate
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.5;

      globeRef.current = globe;
    };

    initGlobe();

    return () => {
      if (containerRef.current) {
        const canvas = containerRef.current.querySelector("canvas");
        if (canvas) canvas.remove();
      }
    };
  }, [satellites, showOrbits, selectedCat]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (globeRef.current && containerRef.current) {
        globeRef.current
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const categories = Object.entries(CATEGORY_COLORS);
  const counts = categories.map(([cat]) => ({
    cat,
    count: satellites.filter((s) => s.category === cat).length,
  }));

  return (
    <div className="absolute inset-0 z-[2000] bg-black flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/90 backdrop-blur border-b border-border z-10">
        <div className="flex items-center gap-2">
          <Satellite className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
            3D Satellite Tracker
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {loading ? "LOADING…" : `${satellites.length} TRACKED`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowOrbits(!showOrbits)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${
              showOrbits
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {showOrbits ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Orbits
          </button>
          <button
            onClick={fetchSatellites}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border border-border text-muted-foreground hover:bg-secondary transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-card/70 backdrop-blur border-b border-border/50 overflow-x-auto z-10">
        <button
          onClick={() => setSelectedCat(null)}
          className={`flex-shrink-0 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${
            !selectedCat
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          ALL ({satellites.length})
        </button>
        {counts
          .filter((c) => c.count > 0)
          .map(({ cat, count }) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
              className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${
                selectedCat === cat
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              {cat} ({count})
            </button>
          ))}
      </div>

      {/* Globe container */}
      <div ref={containerRef} className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center space-y-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
                Fetching satellite TLE data…
              </p>
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
      </div>
    </div>
  );
};
