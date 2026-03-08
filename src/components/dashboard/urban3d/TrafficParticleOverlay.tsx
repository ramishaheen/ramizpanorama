import { useEffect, useRef, useCallback, useState, useMemo } from "react";

/**
 * TrafficParticleOverlay
 * Fetches road segments from OpenStreetMap (Overpass API) when zoom >= 17,
 * then renders a canvas overlay that paints each road with a density-based
 * colour (green → yellow → orange → red) reflecting simulated traffic
 * load at the current time-of-day.
 */

interface Road {
  id: number;
  points: { lat: number; lng: number }[];
  highway: string;
  lanes: number;
  densityLevel: number;
  progressStops: number[];
}

interface Particle {
  roadIdx: number;
  progress: number;
  speed: number;
  direction: 1 | -1;
  laneOffset: number;
}

/* ── Traffic density colours ─────────────────────────────────── */

// Returns an rgba colour string for a 0..1 density value
function densityColor(d: number, alpha = 0.72): string {
  // green (free) → yellow (moderate) → orange (busy) → red (jam)
  const clamped = Math.max(0, Math.min(1, d));
  let r: number, g: number, b: number;
  if (clamped < 0.33) {
    const t = clamped / 0.33;
    r = Math.round(34 + t * (234 - 34));
    g = Math.round(197 + t * (179 - 197));
    b = Math.round(94 + t * (8 - 94));
  } else if (clamped < 0.66) {
    const t = (clamped - 0.33) / 0.33;
    r = Math.round(234 + t * (249 - 234));
    g = Math.round(179 - t * (179 - 115));
    b = Math.round(8 + t * (22 - 8));
  } else {
    const t = (clamped - 0.66) / 0.34;
    r = Math.round(249 - t * (249 - 220));
    g = Math.round(115 - t * (115 - 38));
    b = Math.round(22 + t * (38 - 22));
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Highway importance → base density weight ────────────────── */

const HIGHWAY_WEIGHT: Record<string, number> = {
  motorway: 0.85, motorway_link: 0.75,
  trunk: 0.78, trunk_link: 0.68,
  primary: 0.65, primary_link: 0.55,
  secondary: 0.52, secondary_link: 0.45,
  tertiary: 0.40, tertiary_link: 0.35,
  residential: 0.25, service: 0.15,
  unclassified: 0.20, living_street: 0.12,
};

/* ── Road line width by type (in CSS px, scaled later by dpr) ── */

const HIGHWAY_LINE_WIDTH: Record<string, number> = {
  motorway: 10, motorway_link: 7,
  trunk: 9, trunk_link: 6,
  primary: 7, primary_link: 5,
  secondary: 6, secondary_link: 4,
  tertiary: 5, tertiary_link: 3.5,
  residential: 3.5, service: 2.5,
  unclassified: 3, living_street: 2.5,
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
  if (hour >= 9 && hour < 16) return { factor: 0.7, period: "MIDDAY" };
  if (hour >= 19 && hour < 23) return { factor: 0.5, period: "EVENING" };
  return { factor: 0.35, period: "NIGHT" };
}

function parseLaneNumber(raw: unknown): number {
  const val = String(raw ?? "").trim();
  if (!val) return 0;
  const nums = val.split(/[;|,]/).map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0);
}

function parseLaneCount(tags: Record<string, any> = {}, highway: string): number {
  const fw = parseLaneNumber(tags?.["lanes:forward"]);
  const bw = parseLaneNumber(tags?.["lanes:backward"]);
  if (fw + bw > 0) return Math.max(1, fw + bw);
  const laneVal = parseLaneNumber(tags?.lanes);
  if (laneVal > 0) return Math.max(1, laneVal);
  if (highway.includes("motorway")) return 6;
  if (highway.includes("trunk")) return 4;
  if (highway.includes("primary")) return 4;
  if (highway.includes("secondary")) return 3;
  return 2;
}

function buildProgressStops(points: { lat: number; lng: number }[]): number[] {
  if (points.length < 2) return [0, 1];
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dLat = (points[i].lat - points[i - 1].lat) * 111320;
    const dLng = (points[i].lng - points[i - 1].lng) * 111320 * Math.cos((points[i].lat * Math.PI) / 180);
    total += Math.sqrt(dLat * dLat + dLng * dLng);
    cum.push(total);
  }
  return total <= 0 ? points.map((_, i) => i / (points.length - 1)) : cum.map((d) => d / total);
}

function interpolateRoad(road: Road, progress: number): { lat: number; lng: number } {
  const stops = road.progressStops;
  let segIdx = 0;
  while (segIdx < stops.length - 2 && progress > stops[segIdx + 1]) segIdx++;
  const segRange = Math.max(0.000001, stops[segIdx + 1] - stops[segIdx]);
  const t = (progress - stops[segIdx]) / segRange;
  const p1 = road.points[segIdx];
  const p2 = road.points[segIdx + 1];
  return { lat: p1.lat + (p2.lat - p1.lat) * t, lng: p1.lng + (p2.lng - p1.lng) * t };
}

function latLngToPixel(lat: number, lng: number, _map: any, overlay: any): { x: number; y: number } | null {
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

const MIN_ZOOM = 17;

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

  const [timeInfo, setTimeInfo] = useState(() => getTimeDensityFactor());
  useEffect(() => {
    const iv = setInterval(() => setTimeInfo(getTimeDensityFactor()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const fetchRoads = useCallback(async (centerLat: number, centerLng: number) => {
    const map = mapRef.current;
    let bbox: string;
    if (map && map.getBounds) {
      try {
        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        // 100% padding: fetch one extra viewport around all sides for full tile coverage
        const padLat = (ne.lat() - sw.lat()) * 1.0;
        const padLng = (ne.lng() - sw.lng()) * 1.0;
        bbox = `${sw.lat() - padLat},${sw.lng() - padLng},${ne.lat() + padLat},${ne.lng() + padLng}`;
      } catch {
        const delta = zoom >= 20 ? 0.01 : zoom >= 18 ? 0.02 : 0.04;
        bbox = `${centerLat - delta},${centerLng - delta},${centerLat + delta},${centerLng + delta}`;
      }
    } else {
      const delta = zoom >= 20 ? 0.01 : zoom >= 18 ? 0.02 : 0.04;
      bbox = `${centerLat - delta},${centerLng - delta},${centerLat + delta},${centerLng + delta}`;
    }

    if (bbox === lastFetchRef.current) return;
    lastFetchRef.current = bbox;

    setLoading(true);
    const query = `[out:json][timeout:15];way["highway"](${bbox});out geom;`;
    const body = `data=${encodeURIComponent(query)}`;

    let data: any = null;
    for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
      const url = OVERPASS_ENDPOINTS[(endpointIdx.current + attempt) % OVERPASS_ENDPOINTS.length];
      try {
        const resp = await fetch(url, {
          method: "POST", body,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (resp.status === 429 || resp.status === 504) continue;
        if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
        data = await resp.json();
        endpointIdx.current = (endpointIdx.current + attempt) % OVERPASS_ENDPOINTS.length;
        break;
      } catch (e) {
        console.warn(`[TrafficOverlay] endpoint failed:`, e);
      }
    }

    if (!data) {
      console.error("[TrafficOverlay] All Overpass endpoints failed");
      setLoading(false);
      lastFetchRef.current = "";
      return;
    }

    try {
      const { factor } = getTimeDensityFactor();
      const roads: Road[] = (data.elements || [])
        .filter((el: any) => el.type === "way" && el.geometry?.length >= 2)
        .map((el: any) => {
          const highway = el.tags?.highway || "unclassified";
          const lanes = parseLaneCount(el.tags || {}, highway);
          const baseWeight = HIGHWAY_WEIGHT[highway] ?? 0.3;
          // Add per-road randomness for visual realism
          const jitter = 0.85 + Math.random() * 0.3;
          const densityLevel = Math.min(1, baseWeight * factor * jitter);

          return {
            id: el.id,
            highway,
            points: el.geometry.map((g: any) => ({ lat: g.lat, lng: g.lon })),
            lanes,
            densityLevel,
          };
        });

      roadsRef.current = roads;
      setRoadCount(roads.length);
    } catch (e) {
      console.error("[TrafficOverlay] Parse error:", e);
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

    class TrafficOverlay extends google.maps.OverlayView {
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

    const overlay = new TrafficOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    const idleListener = map.addListener("idle", () => {
      if (!enabled || zoom < MIN_ZOOM) return;
      const center = map.getCenter();
      if (center) {
        lastFetchRef.current = "";
        fetchRoads(center.lat(), center.lng());
      }
    });

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      google.maps.event.removeListener(idleListener);
    };
  }, [enabled, zoom >= MIN_ZOOM, mapRef.current]);

  useEffect(() => {
    if (!enabled || zoom < MIN_ZOOM) return;
    fetchRoads(lat, lng);
  }, [enabled, lat, lng, zoom, fetchRoads]);

  // Render loop — paint coloured road lines
  useEffect(() => {
    if (!enabled || zoom < MIN_ZOOM) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let lastDraw = 0;
    const draw = (ts: number) => {
      // Throttle to ~20 fps since we're not animating particles
      if (ts - lastDraw < 48) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDraw = ts;

      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      const roads = roadsRef.current;

      if (!canvas || !overlay || roads.length === 0) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) { animFrameRef.current = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = opacity;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw each road as a coloured line proportional to its density
      roads.forEach((road) => {
        const baseWidthPx = HIGHWAY_LINE_WIDTH[road.highway] ?? 3;
        // Scale line width with zoom for natural look
        const zoomScale = zoom >= 21 ? 2.2 : zoom >= 20 ? 1.7 : zoom >= 19 ? 1.3 : zoom >= 18 ? 1.0 : 0.75;
        const lineW = baseWidthPx * zoomScale * dpr;

        // Build path
        ctx.beginPath();
        let started = false;
        for (const p of road.points) {
          const px = latLngToPixel(p.lat, p.lng, mapRef.current, overlay);
          if (!px) continue;
          if (!started) { ctx.moveTo(px.x * dpr, px.y * dpr); started = true; }
          else ctx.lineTo(px.x * dpr, px.y * dpr);
        }

        if (!started) return;

        // Outer glow for depth
        ctx.strokeStyle = densityColor(road.densityLevel, 0.25);
        ctx.lineWidth = lineW * 1.8;
        ctx.stroke();

        // Main coloured road
        ctx.beginPath();
        started = false;
        for (const p of road.points) {
          const px = latLngToPixel(p.lat, p.lng, mapRef.current, overlay);
          if (!px) continue;
          if (!started) { ctx.moveTo(px.x * dpr, px.y * dpr); started = true; }
          else ctx.lineTo(px.x * dpr, px.y * dpr);
        }
        ctx.strokeStyle = densityColor(road.densityLevel, 0.65);
        ctx.lineWidth = lineW;
        ctx.stroke();

        // Bright center line for shine
        ctx.beginPath();
        started = false;
        for (const p of road.points) {
          const px = latLngToPixel(p.lat, p.lng, mapRef.current, overlay);
          if (!px) continue;
          if (!started) { ctx.moveTo(px.x * dpr, px.y * dpr); started = true; }
          else ctx.lineTo(px.x * dpr, px.y * dpr);
        }
        ctx.strokeStyle = densityColor(road.densityLevel, 0.9);
        ctx.lineWidth = lineW * 0.35;
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [enabled, zoom, opacity]);

  // Cleanup
  useEffect(() => {
    if (!enabled) {
      roadsRef.current = [];
      setRoadCount(0);
      lastFetchRef.current = "";
    }
  }, [enabled]);

  if (!enabled || zoom < MIN_ZOOM) return null;

  return (
    <div className="absolute top-14 right-14 z-[15] pointer-events-none">
      <div className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg bg-black/85 backdrop-blur-sm border border-accent/30"
        style={{ boxShadow: "0 0 16px rgba(139,92,246,0.15)" }}>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-warning animate-pulse" : "bg-accent animate-pulse"}`} />
          <span className="text-[8px] font-mono text-accent font-bold uppercase">
            {loading ? "LOADING ROADS…" : "TRAFFIC DENSITY"}
          </span>
          <span className="text-[7px] font-mono text-muted-foreground ml-1">
            {timeInfo.period} · {Math.round(timeInfo.factor * 100)}%
          </span>
        </div>
        {!loading && (
          <div className="flex items-center gap-2">
            <span className="text-[7px] font-mono text-muted-foreground">
              {roadCount} roads
            </span>
            {/* Density legend */}
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-1.5 rounded-sm" style={{ background: densityColor(0.1, 1) }} />
              <div className="w-2 h-1.5 rounded-sm" style={{ background: densityColor(0.4, 1) }} />
              <div className="w-2 h-1.5 rounded-sm" style={{ background: densityColor(0.7, 1) }} />
              <div className="w-2 h-1.5 rounded-sm" style={{ background: densityColor(1.0, 1) }} />
            </div>
            <span className="text-[6px] font-mono text-muted-foreground/60">
              FREE → JAM
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
