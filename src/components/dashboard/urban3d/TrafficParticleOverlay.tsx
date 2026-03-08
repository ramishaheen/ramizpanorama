import { useEffect, useRef, useCallback, useState } from "react";

/**
 * TrafficParticleOverlay
 * Fetches road segments from OpenStreetMap (Overpass API) when zoom >= 18,
 * then renders a canvas-based particle system on top of the Google Map
 * that simulates flowing traffic along those roads.
 */

interface Road {
  id: number;
  points: { lat: number; lng: number }[];
  highway: string;
}

interface Particle {
  roadIdx: number;
  progress: number; // 0-1 along road
  speed: number;    // progress/frame
  color: string;
  size: number;
  direction: 1 | -1;
}

const HIGHWAY_COLORS: Record<string, string> = {
  motorway:      "#ef4444",
  trunk:         "#f97316",
  primary:       "#eab308",
  secondary:     "#22c55e",
  tertiary:      "#06b6d4",
  residential:   "#8b5cf6",
  service:       "#6b7280",
  unclassified:  "#a855f7",
  living_street: "#14b8a6",
};

const HIGHWAY_DENSITY: Record<string, number> = {
  motorway: 8, trunk: 6, primary: 5, secondary: 4,
  tertiary: 3, residential: 2, service: 1,
  unclassified: 1, living_street: 1,
};

const HIGHWAY_SPEED: Record<string, number> = {
  motorway: 0.008, trunk: 0.006, primary: 0.005, secondary: 0.004,
  tertiary: 0.003, residential: 0.002, service: 0.0015,
  unclassified: 0.002, living_street: 0.001,
};

function latLngToPixel(
  lat: number, lng: number,
  map: any, overlay: any
): { x: number; y: number } | null {
  const google = (window as any).google;
  if (!google || !overlay?.getProjection?.()) return null;
  const projection = overlay.getProjection();
  const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
  return point ? { x: point.x, y: point.y } : null;
}

interface Props {
  mapRef: React.MutableRefObject<any>;
  enabled: boolean;
  zoom: number;
  lat: number;
  lng: number;
  opacity?: number;
}

const MIN_ZOOM = 16;

export const TrafficParticleOverlay = ({ mapRef, enabled, zoom, lat, lng, opacity = 0.85 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<any>(null);
  const roadsRef = useRef<Road[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastFetchRef = useRef<string>("");
  const [roadCount, setRoadCount] = useState(0);
  const [particleCount, setParticleCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch roads from Overpass API
  const fetchRoads = useCallback(async (centerLat: number, centerLng: number) => {
    // Create a ~400m bounding box at high zoom, wider at lower zoom
    const delta = zoom >= 20 ? 0.003 : zoom >= 18 ? 0.005 : 0.01;
    const bbox = `${centerLat - delta},${centerLng - delta},${centerLat + delta},${centerLng + delta}`;

    const key = bbox;
    if (key === lastFetchRef.current) return;
    lastFetchRef.current = key;

    setLoading(true);
    try {
      const query = `[out:json][timeout:10];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"](${bbox});out geom;`;
      const resp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
      const data = await resp.json();

      const roads: Road[] = (data.elements || [])
        .filter((el: any) => el.type === "way" && el.geometry?.length >= 2)
        .map((el: any) => ({
          id: el.id,
          highway: el.tags?.highway || "unclassified",
          points: el.geometry.map((g: any) => ({ lat: g.lat, lng: g.lon })),
        }));

      roadsRef.current = roads;
      setRoadCount(roads.length);

      // Spawn particles
      const particles: Particle[] = [];
      roads.forEach((road, ri) => {
        const density = HIGHWAY_DENSITY[road.highway] || 2;
        const speed = HIGHWAY_SPEED[road.highway] || 0.003;
        const color = HIGHWAY_COLORS[road.highway] || "#8b5cf6";
        for (let i = 0; i < density; i++) {
          particles.push({
            roadIdx: ri,
            progress: Math.random(),
            speed: speed * (0.7 + Math.random() * 0.6),
            color,
            size: road.highway === "motorway" ? 4 : road.highway === "residential" ? 2 : 3,
            direction: Math.random() > 0.5 ? 1 : -1,
          });
        }
      });
      particlesRef.current = particles;
      setParticleCount(particles.length);
    } catch (e) {
      console.error("[TrafficParticles] Overpass fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [zoom]);

  // Setup Google Maps OverlayView for canvas projection
  useEffect(() => {
    if (!enabled || zoom < MIN_ZOOM) return;
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google) return;

    // Create a canvas overlay
    class ParticleOverlay extends google.maps.OverlayView {
      canvas: HTMLCanvasElement | null = null;
      onAdd() {
        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "5";
        this.canvas = canvas;
        canvasRef.current = canvas;
        const panes = this.getPanes();
        panes?.overlayLayer?.appendChild(canvas);
      }
      draw() {
        // Resize canvas to map container
        const div = map.getDiv();
        if (this.canvas && div) {
          const dpr = window.devicePixelRatio || 1;
          this.canvas.width = div.offsetWidth * dpr;
          this.canvas.height = div.offsetHeight * dpr;
          this.canvas.style.width = div.offsetWidth + "px";
          this.canvas.style.height = div.offsetHeight + "px";
        }
      }
      onRemove() {
        this.canvas?.remove();
        this.canvas = null;
        canvasRef.current = null;
      }
    }

    const overlay = new ParticleOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [enabled, zoom >= MIN_ZOOM, mapRef.current]);

  // Fetch roads when position changes
  useEffect(() => {
    if (!enabled || zoom < MIN_ZOOM) return;
    fetchRoads(lat, lng);
  }, [enabled, lat, lng, zoom, fetchRoads]);

  // Animation loop
  useEffect(() => {
    if (!enabled || zoom < MIN_ZOOM) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const animate = () => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      const roads = roadsRef.current;
      const particles = particlesRef.current;

      if (!canvas || !overlay || roads.length === 0) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = opacity;

      // Draw road outlines faintly
      roads.forEach((road) => {
        const color = HIGHWAY_COLORS[road.highway] || "#8b5cf6";
        ctx.beginPath();
        let started = false;
        road.points.forEach((p) => {
          const px = latLngToPixel(p.lat, p.lng, mapRef.current, overlay);
          if (!px) return;
          if (!started) { ctx.moveTo(px.x * dpr, px.y * dpr); started = true; }
          else ctx.lineTo(px.x * dpr, px.y * dpr);
        });
        ctx.strokeStyle = color + "30";
        ctx.lineWidth = (road.highway === "motorway" ? 3 : 1.5) * dpr;
        ctx.stroke();
      });

      // Update and draw particles
      particles.forEach((p) => {
        p.progress += p.speed * p.direction;
        if (p.progress > 1) { p.progress = 0; }
        if (p.progress < 0) { p.progress = 1; }

        const road = roads[p.roadIdx];
        if (!road || road.points.length < 2) return;

        // Find position along road
        const totalSegments = road.points.length - 1;
        const segFloat = p.progress * totalSegments;
        const segIdx = Math.min(Math.floor(segFloat), totalSegments - 1);
        const segProgress = segFloat - segIdx;

        const p1 = road.points[segIdx];
        const p2 = road.points[segIdx + 1];
        const interpLat = p1.lat + (p2.lat - p1.lat) * segProgress;
        const interpLng = p1.lng + (p2.lng - p1.lng) * segProgress;

        const px = latLngToPixel(interpLat, interpLng, mapRef.current, overlay);
        if (!px) return;

        // Draw glowing particle
        const x = px.x * dpr;
        const y = px.y * dpr;
        const s = p.size * dpr;

        // Glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
        gradient.addColorStop(0, p.color + "80");
        gradient.addColorStop(1, p.color + "00");
        ctx.fillStyle = gradient;
        ctx.arc(x, y, s * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [enabled, zoom, opacity]);

  // Cleanup on disable
  useEffect(() => {
    if (!enabled) {
      roadsRef.current = [];
      particlesRef.current = [];
      setRoadCount(0);
      setParticleCount(0);
      lastFetchRef.current = "";
    }
  }, [enabled]);

  if (!enabled || zoom < MIN_ZOOM) return null;

  return (
    <>
      {/* HUD badge */}
      <div className="absolute top-14 right-14 z-[15] pointer-events-none">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/80 backdrop-blur border border-purple-500/40"
          style={{ boxShadow: "0 0 12px rgba(139,92,246,0.2)" }}>
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-yellow-400 animate-pulse" : "bg-purple-400 animate-pulse"}`} />
          <span className="text-[8px] font-mono text-purple-400 font-bold uppercase">
            {loading ? "LOADING ROADS…" : "TRAFFIC SIM"}
          </span>
          {!loading && (
            <span className="text-[7px] font-mono text-muted-foreground">
              {roadCount} roads • {particleCount} vehicles
            </span>
          )}
        </div>
      </div>
    </>
  );
};
