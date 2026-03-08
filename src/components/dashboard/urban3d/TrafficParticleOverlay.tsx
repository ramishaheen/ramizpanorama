import { useEffect, useRef, useCallback, useState, useMemo } from "react";

/**
 * TrafficParticleOverlay
 * Fetches road segments from OpenStreetMap (Overpass API) when zoom >= 16,
 * then renders a canvas-based particle system with distinct vehicle types
 * (cars, trucks, buses) and time-of-day density variation.
 */

interface Road {
  id: number;
  points: { lat: number; lng: number }[];
  highway: string;
}

type VehicleType = "car" | "truck" | "bus";

interface Particle {
  roadIdx: number;
  progress: number;
  speed: number;
  color: string;
  size: number;
  direction: 1 | -1;
  vehicleType: VehicleType;
  angle: number;
}

const HIGHWAY_COLORS: Record<string, string> = {
  motorway: "#ef4444", trunk: "#f97316", primary: "#eab308",
  secondary: "#22c55e", tertiary: "#06b6d4", residential: "#8b5cf6",
  service: "#6b7280", unclassified: "#a855f7", living_street: "#14b8a6",
};

// Particles per ~100m of road (scaled by road length)
const HIGHWAY_DENSITY_PER_100M: Record<string, number> = {
  motorway: 6, trunk: 5, primary: 4, secondary: 4,
  tertiary: 3, residential: 2.5, service: 2,
  unclassified: 2, living_street: 1.5,
};

// Minimum particles per road regardless of length
const HIGHWAY_MIN_PARTICLES: Record<string, number> = {
  motorway: 8, trunk: 6, primary: 5, secondary: 4,
  tertiary: 3, residential: 2, service: 2,
  unclassified: 2, living_street: 1,
};

const HIGHWAY_SPEED: Record<string, number> = {
  motorway: 0.006, trunk: 0.005, primary: 0.004, secondary: 0.003,
  tertiary: 0.0025, residential: 0.002, service: 0.0015,
  unclassified: 0.002, living_street: 0.001,
};

const VEHICLE_CONFIG: Record<VehicleType, { speedMult: number; sizeBase: number; weight: number; color?: string }> = {
  car:   { speedMult: 1.0, sizeBase: 2.5, weight: 0.70 },
  truck: { speedMult: 0.65, sizeBase: 4.0, weight: 0.15, color: "#f59e0b" },
  bus:   { speedMult: 0.55, sizeBase: 5.0, weight: 0.15, color: "#3b82f6" },
};

const ROAD_VEHICLES: Record<string, VehicleType[]> = {
  motorway: ["car", "truck", "bus"], trunk: ["car", "truck", "bus"],
  primary: ["car", "truck", "bus"], secondary: ["car", "truck", "bus"],
  tertiary: ["car", "truck"], residential: ["car"],
  service: ["car"], unclassified: ["car"], living_street: ["car"],
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

function getTimeDensityFactor(): { factor: number; period: string } {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 9) return { factor: 1.0, period: "RUSH HOUR" };
  if (hour >= 16 && hour < 19) return { factor: 0.95, period: "RUSH HOUR" };
  if (hour >= 9 && hour < 16) return { factor: 0.65, period: "MIDDAY" };
  if (hour >= 19 && hour < 23) return { factor: 0.4, period: "EVENING" };
  return { factor: 0.15, period: "NIGHT" };
}

function pickVehicleType(highway: string): VehicleType {
  const allowed = ROAD_VEHICLES[highway] || ["car"];
  const totalWeight = allowed.reduce((s, v) => s + VEHICLE_CONFIG[v].weight, 0);
  let r = Math.random() * totalWeight;
  for (const v of allowed) {
    r -= VEHICLE_CONFIG[v].weight;
    if (r <= 0) return v;
  }
  return "car";
}

function latLngToPixel(
  lat: number, lng: number, _map: any, overlay: any
): { x: number; y: number } | null {
  const google = (window as any).google;
  if (!google || !overlay?.getProjection?.()) return null;
  const projection = overlay.getProjection();
  const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
  return point ? { x: point.x, y: point.y } : null;
}

// ── Polyfill-safe rounded rect ──────────────────────────────────

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Shape renderers ──────────────────────────────────────────────

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // body
  ctx.beginPath();
  roundedRect(ctx, -s * 1.2, -s * 0.7, s * 2.4, s * 1.4, s * 0.4);
  ctx.fillStyle = color;
  ctx.fill();
  // windshield
  ctx.beginPath();
  roundedRect(ctx, s * 0.3, -s * 0.45, s * 0.7, s * 0.9, s * 0.15);
  ctx.fillStyle = "#ffffff50";
  ctx.fill();
  // headlights
  ctx.beginPath();
  ctx.arc(s * 1.15, -s * 0.35, s * 0.18, 0, Math.PI * 2);
  ctx.arc(s * 1.15, s * 0.35, s * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#fef08a";
  ctx.fill();
  // tail lights
  ctx.beginPath();
  ctx.arc(-s * 1.1, -s * 0.35, s * 0.15, 0, Math.PI * 2);
  ctx.arc(-s * 1.1, s * 0.35, s * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = "#ef444490";
  ctx.fill();
  ctx.restore();
}

function drawTruck(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // cargo
  ctx.beginPath();
  ctx.rect(-s * 1.8, -s * 0.85, s * 2.6, s * 1.7);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#00000030";
  ctx.lineWidth = s * 0.1;
  ctx.stroke();
  // cab
  ctx.beginPath();
  roundedRect(ctx, s * 0.8, -s * 0.7, s * 1.0, s * 1.4, s * 0.2);
  ctx.fillStyle = "#d97706";
  ctx.fill();
  // headlights
  ctx.beginPath();
  ctx.arc(s * 1.75, -s * 0.4, s * 0.2, 0, Math.PI * 2);
  ctx.arc(s * 1.75, s * 0.4, s * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#fef08a";
  ctx.fill();
  // tail lights
  ctx.beginPath();
  ctx.arc(-s * 1.7, -s * 0.5, s * 0.18, 0, Math.PI * 2);
  ctx.arc(-s * 1.7, s * 0.5, s * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#ef444490";
  ctx.fill();
  ctx.restore();
}

function drawBus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // body
  ctx.beginPath();
  roundedRect(ctx, -s * 2.2, -s * 0.8, s * 4.4, s * 1.6, s * 0.3);
  ctx.fillStyle = color;
  ctx.fill();
  // windows
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.rect(-s * 1.6 + i * s * 0.9, -s * 0.55, s * 0.6, s * 0.5);
    ctx.fillStyle = "#93c5fd60";
    ctx.fill();
  }
  // headlights
  ctx.beginPath();
  ctx.arc(s * 2.1, -s * 0.4, s * 0.2, 0, Math.PI * 2);
  ctx.arc(s * 2.1, s * 0.4, s * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "#fef08a";
  ctx.fill();
  // tail lights
  ctx.beginPath();
  ctx.arc(-s * 2.1, -s * 0.4, s * 0.18, 0, Math.PI * 2);
  ctx.arc(-s * 2.1, s * 0.4, s * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#ef444490";
  ctx.fill();
  ctx.restore();
}

const SHAPE_RENDERERS: Record<VehicleType, typeof drawCar> = { car: drawCar, truck: drawTruck, bus: drawBus };

interface Props {
  mapRef: React.MutableRefObject<any>;
  enabled: boolean;
  zoom: number;
  lat: number;
  lng: number;
  opacity?: number;
}

const MIN_ZOOM = 16;

// ── Component ────────────────────────────────────────────────────

export const TrafficParticleOverlay = ({ mapRef, enabled, zoom, lat, lng, opacity = 0.85 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<any>(null);
  const roadsRef = useRef<Road[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastFetchRef = useRef<string>("");
  const endpointIdx = useRef(0);
  const [roadCount, setRoadCount] = useState(0);
  const [particleCount, setParticleCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const timeFactor = useMemo(() => getTimeDensityFactor(), []);
  const [timeInfo, setTimeInfo] = useState(timeFactor);
  useEffect(() => {
    const iv = setInterval(() => setTimeInfo(getTimeDensityFactor()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const fetchRoads = useCallback(async (centerLat: number, centerLng: number) => {
    const delta = zoom >= 20 ? 0.003 : zoom >= 18 ? 0.005 : 0.01;
    const bbox = `${centerLat - delta},${centerLng - delta},${centerLat + delta},${centerLng + delta}`;

    if (bbox === lastFetchRef.current) return;
    lastFetchRef.current = bbox;

    setLoading(true);
    const query = `[out:json][timeout:15];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"](${bbox});out geom;`;
    const body = `data=${encodeURIComponent(query)}`;

    let data: any = null;

    // Try multiple Overpass endpoints with retry
    for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
      const url = OVERPASS_ENDPOINTS[(endpointIdx.current + attempt) % OVERPASS_ENDPOINTS.length];
      try {
        const resp = await fetch(url, {
          method: "POST", body,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (resp.status === 429 || resp.status === 504) {
          console.warn(`[TrafficParticles] ${url} returned ${resp.status}, trying next…`);
          continue;
        }
        if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
        data = await resp.json();
        endpointIdx.current = (endpointIdx.current + attempt) % OVERPASS_ENDPOINTS.length;
        break;
      } catch (e) {
        console.warn(`[TrafficParticles] endpoint ${url} failed:`, e);
      }
    }

    if (!data) {
      console.error("[TrafficParticles] All Overpass endpoints failed");
      setLoading(false);
      lastFetchRef.current = ""; // allow retry
      return;
    }

    try {
      const roads: Road[] = (data.elements || [])
        .filter((el: any) => el.type === "way" && el.geometry?.length >= 2)
        .map((el: any) => ({
          id: el.id,
          highway: el.tags?.highway || "unclassified",
          points: el.geometry.map((g: any) => ({ lat: g.lat, lng: g.lon })),
        }));

      roadsRef.current = roads;
      setRoadCount(roads.length);

      const { factor } = getTimeDensityFactor();
      const particles: Particle[] = [];
      roads.forEach((road, ri) => {
        const baseDensity = HIGHWAY_BASE_DENSITY[road.highway] || 2;
        const density = Math.max(1, Math.round(baseDensity * factor));
        const baseSpeed = HIGHWAY_SPEED[road.highway] || 0.003;
        const roadColor = HIGHWAY_COLORS[road.highway] || "#8b5cf6";

        for (let i = 0; i < density; i++) {
          const vType = pickVehicleType(road.highway);
          const vConf = VEHICLE_CONFIG[vType];
          particles.push({
            roadIdx: ri,
            progress: Math.random(),
            speed: baseSpeed * vConf.speedMult * (0.7 + Math.random() * 0.6),
            color: vConf.color || roadColor,
            size: vConf.sizeBase,
            direction: Math.random() > 0.5 ? 1 : -1,
            vehicleType: vType,
            angle: 0,
          });
        }
      });
      particlesRef.current = particles;
      setParticleCount(particles.length);
    } catch (e) {
      console.error("[TrafficParticles] Parse error:", e);
    } finally {
      setLoading(false);
    }
  }, [zoom]);

  // Setup Google Maps OverlayView
  useEffect(() => {
    if (!enabled || zoom < MIN_ZOOM) return;
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google) return;

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

    return () => { overlay.setMap(null); overlayRef.current = null; };
  }, [enabled, zoom >= MIN_ZOOM, mapRef.current]);

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
      if (!ctx) { animFrameRef.current = requestAnimationFrame(animate); return; }

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = opacity;

      // Draw road outlines
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
        ctx.strokeStyle = color + "25";
        ctx.lineWidth = (road.highway === "motorway" ? 4 : 2) * dpr;
        ctx.stroke();
      });

      // Update and draw particles
      particles.forEach((p) => {
        p.progress += p.speed * p.direction;
        if (p.progress > 1) p.progress = 0;
        if (p.progress < 0) p.progress = 1;

        const road = roads[p.roadIdx];
        if (!road || road.points.length < 2) return;

        const totalSegments = road.points.length - 1;
        const segFloat = p.progress * totalSegments;
        const segIdx = Math.min(Math.floor(segFloat), totalSegments - 1);
        const segProgress = segFloat - segIdx;

        const p1 = road.points[segIdx];
        const p2 = road.points[segIdx + 1];
        const interpLat = p1.lat + (p2.lat - p1.lat) * segProgress;
        const interpLng = p1.lng + (p2.lng - p1.lng) * segProgress;

        // Compute heading angle from segment direction
        const px1 = latLngToPixel(p1.lat, p1.lng, mapRef.current, overlay);
        const px2 = latLngToPixel(p2.lat, p2.lng, mapRef.current, overlay);
        if (px1 && px2) {
          const dx = px2.x - px1.x;
          const dy = px2.y - px1.y;
          p.angle = Math.atan2(dy, dx);
          if (p.direction === -1) p.angle += Math.PI;
        }

        const px = latLngToPixel(interpLat, interpLng, mapRef.current, overlay);
        if (!px) return;

        const x = px.x * dpr;
        const y = px.y * dpr;
        const s = p.size * dpr * (zoom >= 20 ? 1.3 : zoom >= 18 ? 1.0 : 0.7);

        // Glow under vehicle
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, s * 2.5);
        gradient.addColorStop(0, p.color + "40");
        gradient.addColorStop(1, p.color + "00");
        ctx.fillStyle = gradient;
        ctx.arc(x, y, s * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw shaped vehicle
        const renderer = SHAPE_RENDERERS[p.vehicleType];
        renderer(ctx, x, y, s, p.angle, p.color);
      });

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [enabled, zoom, opacity]);

  // Cleanup
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

  const counts = particlesRef.current.reduce(
    (acc, p) => { acc[p.vehicleType] = (acc[p.vehicleType] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="absolute top-14 right-14 z-[15] pointer-events-none">
      <div className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg bg-black/85 backdrop-blur-sm border border-accent/30"
        style={{ boxShadow: "0 0 16px rgba(139,92,246,0.15)" }}>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-warning animate-pulse" : "bg-accent animate-pulse"}`} />
          <span className="text-[8px] font-mono text-accent font-bold uppercase">
            {loading ? "LOADING ROADS…" : "TRAFFIC SIM"}
          </span>
          <span className="text-[7px] font-mono text-muted-foreground ml-1">
            {timeInfo.period}
          </span>
        </div>
        {!loading && (
          <div className="flex items-center gap-2">
            <span className="text-[7px] font-mono text-muted-foreground">
              {roadCount} roads
            </span>
            <span className="text-[7px] font-mono" style={{ color: "#8b5cf6" }}>
              🚗{counts.car || 0}
            </span>
            <span className="text-[7px] font-mono" style={{ color: "#f59e0b" }}>
              🚛{counts.truck || 0}
            </span>
            <span className="text-[7px] font-mono" style={{ color: "#3b82f6" }}>
              🚌{counts.bus || 0}
            </span>
            <span className="text-[7px] font-mono text-muted-foreground/60">
              ×{Math.round(timeInfo.factor * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
