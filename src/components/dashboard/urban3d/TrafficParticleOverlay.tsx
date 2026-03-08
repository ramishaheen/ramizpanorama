import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * TrafficParticleOverlay — Real-time Traffic Intelligence System
 *
 * Multi-factor Traffic Density Index (TDI):
 *   TDI = (VehicleFlow / RoadCapacity) × SpeedFactor × WeatherImpact × TimeOfDayFactor
 *
 * FULL ROAD COVERAGE: Densifies polylines, stitches connected segments,
 * filters drivable-only roads, spawns particles across the entire road length.
 */

// ── Types ────────────────────────────────────────────────────────

interface Road {
  id: number;
  points: { lat: number; lng: number }[];       // densified points
  rawPoints: { lat: number; lng: number }[];     // original OSM nodes
  highway: string;
  lanes: number;
  maxspeed: number;
  capacity: number;
  tdi: number;
  progressStops: number[];
  lengthM: number;
}

interface Particle {
  roadIdx: number;
  progress: number;
  speed: number;
  direction: 1 | -1;
  laneOffset: number;
}

interface IntelData {
  weather: {
    temperature: number;
    windSpeed: number;
    precipitation: number;
    visibility: number;
    weatherCode: number;
    weatherImpactFactor: number;
    description: string;
  };
  timeFactors: {
    hour: number;
    isRushHour: boolean;
    isWeekend: boolean;
    timeOfDayFactor: number;
    period: string;
  };
}

// ── Constants ────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Only fetch drivable road types
const DRIVABLE_HIGHWAY_TYPES = new Set([
  "motorway", "motorway_link",
  "trunk", "trunk_link",
  "primary", "primary_link",
  "secondary", "secondary_link",
  "tertiary", "tertiary_link",
  "residential", "service",
  "unclassified", "living_street",
]);

const ROAD_CAPACITY_PER_LANE: Record<string, number> = {
  motorway: 2200, motorway_link: 1800,
  trunk: 2000, trunk_link: 1600,
  primary: 1800, primary_link: 1400,
  secondary: 1400, secondary_link: 1000,
  tertiary: 1000, tertiary_link: 800,
  residential: 600, service: 300,
  unclassified: 500, living_street: 200,
};

const FREE_FLOW_SPEED: Record<string, number> = {
  motorway: 120, motorway_link: 80,
  trunk: 100, trunk_link: 70,
  primary: 80, primary_link: 60,
  secondary: 60, secondary_link: 50,
  tertiary: 50, tertiary_link: 40,
  residential: 40, service: 20,
  unclassified: 40, living_street: 20,
};

const ROAD_LINE_WIDTH: Record<string, number> = {
  motorway: 12, motorway_link: 8,
  trunk: 10, trunk_link: 7,
  primary: 8, primary_link: 6,
  secondary: 7, secondary_link: 5,
  tertiary: 6, tertiary_link: 4,
  residential: 4, service: 3,
  unclassified: 3.5, living_street: 3,
};

// Densification interval in meters — smaller = smoother curves
const DENSIFY_INTERVAL_M = 5;

// ── Utility Functions ────────────────────────────────────────────

function tdiToColor(tdi: number, alpha = 0.7): string {
  const t = Math.max(0, Math.min(3, tdi));
  let r: number, g: number, b: number;
  if (t < 1) {
    r = Math.round(34 + t * (234 - 34));
    g = Math.round(197 + t * (179 - 197));
    b = Math.round(94 - t * 86);
  } else if (t < 2) {
    const u = t - 1;
    r = Math.round(234 + u * (249 - 234));
    g = Math.round(179 - u * 64);
    b = Math.round(8 + u * 14);
  } else {
    const u = t - 2;
    r = Math.round(249 - u * 29);
    g = Math.round(115 - u * 77);
    b = Math.round(22 + u * 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

function tdiToParticleSpeed(tdi: number, highway: string): number {
  const base = highway.includes("motorway") ? 0.004 : highway.includes("trunk") ? 0.0035 :
    highway.includes("primary") ? 0.003 : highway.includes("secondary") ? 0.0025 : 0.0018;
  return base * Math.max(0.15, 1 - tdi * 0.3);
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
  if (laneVal > 0) return laneVal;
  if (highway.includes("motorway")) return 6;
  if (highway.includes("trunk")) return 4;
  if (highway.includes("primary")) return 4;
  if (highway.includes("secondary")) return 3;
  return 2;
}

function parseMaxSpeed(tags: Record<string, any> = {}, highway: string): number {
  const raw = String(tags?.maxspeed ?? "").trim();
  const num = parseInt(raw, 10);
  if (Number.isFinite(num) && num > 0) return num;
  return FREE_FLOW_SPEED[highway] ?? 50;
}

/** Haversine distance in meters between two lat/lng points */
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111320;
  const dLng = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Densify a polyline by interpolating points every `intervalM` meters */
function densifyPolyline(points: { lat: number; lng: number }[], intervalM: number): { lat: number; lng: number }[] {
  if (points.length < 2) return [...points];
  const result: { lat: number; lng: number }[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segDist = distanceM(prev, curr);

    if (segDist > intervalM) {
      const numInserts = Math.floor(segDist / intervalM);
      for (let j = 1; j <= numInserts; j++) {
        const t = j / (numInserts + 1);
        result.push({
          lat: prev.lat + (curr.lat - prev.lat) * t,
          lng: prev.lng + (curr.lng - prev.lng) * t,
        });
      }
    }
    result.push(curr);
  }
  return result;
}

/** Stitch connected road segments of the same type by matching endpoints */
function stitchRoads(
  segments: Array<{ id: number; points: { lat: number; lng: number }[]; highway: string; tags: Record<string, any> }>
): Array<{ id: number; points: { lat: number; lng: number }[]; highway: string; tags: Record<string, any> }> {
  // Group by highway type for stitching
  const byType = new Map<string, typeof segments>();
  for (const seg of segments) {
    const arr = byType.get(seg.highway) || [];
    arr.push(seg);
    byType.set(seg.highway, arr);
  }

  const result: typeof segments = [];
  const STITCH_THRESHOLD = 0.00005; // ~5m in degrees

  for (const [, group] of byType) {
    const used = new Set<number>();
    
    for (let i = 0; i < group.length; i++) {
      if (used.has(i)) continue;
      used.add(i);
      
      let chain = [...group[i].points];
      let merged = true;

      while (merged) {
        merged = false;
        for (let j = 0; j < group.length; j++) {
          if (used.has(j)) continue;
          const other = group[j].points;
          if (other.length < 2) continue;

          const chainStart = chain[0];
          const chainEnd = chain[chain.length - 1];
          const otherStart = other[0];
          const otherEnd = other[other.length - 1];

          // Check 4 connection cases
          const dEndStart = Math.abs(chainEnd.lat - otherStart.lat) + Math.abs(chainEnd.lng - otherStart.lng);
          const dEndEnd = Math.abs(chainEnd.lat - otherEnd.lat) + Math.abs(chainEnd.lng - otherEnd.lng);
          const dStartStart = Math.abs(chainStart.lat - otherStart.lat) + Math.abs(chainStart.lng - otherStart.lng);
          const dStartEnd = Math.abs(chainStart.lat - otherEnd.lat) + Math.abs(chainStart.lng - otherEnd.lng);

          if (dEndStart < STITCH_THRESHOLD) {
            chain = [...chain, ...other.slice(1)];
            used.add(j);
            merged = true;
          } else if (dEndEnd < STITCH_THRESHOLD) {
            chain = [...chain, ...[...other].reverse().slice(1)];
            used.add(j);
            merged = true;
          } else if (dStartEnd < STITCH_THRESHOLD) {
            chain = [...other, ...chain.slice(1)];
            used.add(j);
            merged = true;
          } else if (dStartStart < STITCH_THRESHOLD) {
            chain = [...[...other].reverse(), ...chain.slice(1)];
            used.add(j);
            merged = true;
          }
        }
      }

      result.push({ ...group[i], points: chain, id: group[i].id });
    }
  }

  return result;
}

function buildProgressStops(points: { lat: number; lng: number }[]): number[] {
  if (points.length < 2) return [0, 1];
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceM(points[i - 1], points[i]);
    cum.push(total);
  }
  return total <= 0 ? points.map((_, i) => i / (points.length - 1)) : cum.map((d) => d / total);
}

function estimateRoadLengthM(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceM(points[i - 1], points[i]);
  }
  return total;
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

function calculateTDI(
  highway: string, lanes: number, maxspeed: number,
  weatherImpact: number, timeOfDayFactor: number,
): number {
  const capacityPerLane = ROAD_CAPACITY_PER_LANE[highway] ?? 600;
  const totalCapacity = capacityPerLane * Math.max(1, lanes);
  const roadImportance = highway.includes("motorway") ? 0.85 : highway.includes("trunk") ? 0.75 :
    highway.includes("primary") ? 0.65 : highway.includes("secondary") ? 0.5 :
    highway.includes("tertiary") ? 0.35 : 0.2;
  const simulatedFlow = totalCapacity * roadImportance * timeOfDayFactor;
  const flowRatio = simulatedFlow / totalCapacity;
  const estimatedSpeed = maxspeed * Math.max(0.1, 1 - flowRatio * 0.8);
  const speedFactor = maxspeed / Math.max(1, estimatedSpeed);
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.max(0, Math.min(3, flowRatio * speedFactor * weatherImpact * jitter));
}

// ── Component ────────────────────────────────────────────────────

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
  const intelRef = useRef<IntelData | null>(null);

  const [roadCount, setRoadCount] = useState(0);
  const [particleCount, setParticleCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [avgTDI, setAvgTDI] = useState(0);
  const [intelInfo, setIntelInfo] = useState<IntelData | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [stitchedCount, setStitchedCount] = useState(0);
  const [densifiedPointCount, setDensifiedPointCount] = useState(0);

  // Fetch traffic intelligence factors
  const fetchIntel = useCallback(async (centerLat: number, centerLng: number) => {
    try {
      const { data, error } = await supabase.functions.invoke("traffic-intel", {
        body: { lat: centerLat, lng: centerLng },
      });
      if (error) throw error;
      intelRef.current = data;
      setIntelInfo(data);
    } catch (e) {
      console.warn("[TrafficIntel] Failed to fetch intel, using defaults:", e);
      const fallback: IntelData = {
        weather: {
          temperature: 30, windSpeed: 5, precipitation: 0,
          visibility: 50000, weatherCode: 0,
          weatherImpactFactor: 1.0, description: "Clear (offline)",
        },
        timeFactors: {
          hour: new Date().getHours(), isRushHour: false,
          isWeekend: false, timeOfDayFactor: 0.6, period: "OFFLINE",
        },
      };
      intelRef.current = fallback;
      setIntelInfo(fallback);
    }
  }, []);

  useEffect(() => {
    if (!enabled || zoom < MIN_ZOOM) return;
    fetchIntel(lat, lng);
    const iv = setInterval(() => fetchIntel(lat, lng), 300_000);
    return () => clearInterval(iv);
  }, [enabled, lat, lng, zoom, fetchIntel]);

  // Fetch roads from Overpass — drivable only, stitch + densify
  const fetchRoads = useCallback(async (centerLat: number, centerLng: number) => {
    const map = mapRef.current;
    let bbox: string;
    if (map && map.getBounds) {
      try {
        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        // Pad viewport by 50% for seamless tile boundaries
        const padLat = (ne.lat() - sw.lat()) * 0.5;
        const padLng = (ne.lng() - sw.lng()) * 0.5;
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

    // Filter to drivable road types only
    const highwayFilter = Array.from(DRIVABLE_HIGHWAY_TYPES)
      .map(t => `way["highway"="${t}"](${bbox});`)
      .join("");
    const query = `[out:json][timeout:20];(${highwayFilter});out geom;`;
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
        console.warn("[TrafficIntel] Overpass endpoint failed:", e);
      }
    }

    if (!data) {
      setLoading(false);
      lastFetchRef.current = "";
      return;
    }

    try {
      const intel = intelRef.current;
      const weatherImpact = intel?.weather.weatherImpactFactor ?? 1.0;
      const timeOfDayFactor = intel?.timeFactors.timeOfDayFactor ?? 0.6;

      // 1. Parse raw segments
      const rawSegments = (data.elements || [])
        .filter((el: any) => el.type === "way" && el.geometry?.length >= 2)
        .filter((el: any) => {
          const hw = el.tags?.highway || "";
          return DRIVABLE_HIGHWAY_TYPES.has(hw);
        })
        .map((el: any) => ({
          id: el.id,
          points: el.geometry.map((g: any) => ({ lat: g.lat, lng: g.lon })),
          highway: el.tags?.highway || "unclassified",
          tags: el.tags || {},
        }));

      // 2. Stitch connected segments of same type
      const stitched = stitchRoads(rawSegments);
      setStitchedCount(rawSegments.length - stitched.length); // how many were merged

      // 3. Densify + build road objects
      let totalDensifiedPts = 0;
      const roads: Road[] = stitched.map((seg) => {
        const highway = seg.highway;
        const lanes = parseLaneCount(seg.tags, highway);
        const maxspeed = parseMaxSpeed(seg.tags, highway);
        const capacity = (ROAD_CAPACITY_PER_LANE[highway] ?? 600) * lanes;
        const rawPoints = seg.points;

        // Densify polyline for full curve coverage
        const densified = densifyPolyline(rawPoints, DENSIFY_INTERVAL_M);
        totalDensifiedPts += densified.length;

        const tdi = calculateTDI(highway, lanes, maxspeed, weatherImpact, timeOfDayFactor);
        const lengthM = estimateRoadLengthM(densified);

        return {
          id: seg.id, highway, lanes, maxspeed, capacity, tdi, lengthM,
          points: densified,
          rawPoints,
          progressStops: buildProgressStops(densified),
        };
      });

      roadsRef.current = roads;
      setRoadCount(roads.length);
      setDensifiedPointCount(totalDensifiedPts);

      // Compute average TDI
      if (roads.length > 0) {
        const sum = roads.reduce((s, r) => s + r.tdi, 0);
        setAvgTDI(sum / roads.length);
      }

      // 4. Generate particles — uniform distribution across full road length
      const particles: Particle[] = [];
      roads.forEach((road, ri) => {
        const totalLanes = Math.max(1, road.lanes);
        // More particles for longer roads, scaled by TDI
        const baseDensity = road.lengthM / 8; // 1 particle per 8m base
        const tdiMultiplier = Math.max(0.4, road.tdi);
        const carsPerLane = Math.max(4, Math.round(baseDensity * tdiMultiplier));
        const particleSpeed = tdiToParticleSpeed(road.tdi, road.highway);
        const laneSpreadPx = zoom >= 20 ? 4 : zoom >= 18 ? 3 : 2;

        for (let lane = 0; lane < totalLanes; lane++) {
          const dir: 1 | -1 = lane < Math.ceil(totalLanes / 2) ? 1 : -1;
          const normalizedLane = totalLanes <= 1 ? 0 : lane / (totalLanes - 1) - 0.5;
          const laneOffset = normalizedLane * laneSpreadPx * 2;

          for (let i = 0; i < carsPerLane; i++) {
            // Uniform distribution across full road length
            const baseProgress = i / carsPerLane;
            const jitter = (Math.random() - 0.5) * (1 / carsPerLane) * 0.5;
            particles.push({
              roadIdx: ri,
              progress: Math.max(0, Math.min(1, baseProgress + jitter)),
              speed: particleSpeed * (0.8 + Math.random() * 0.4),
              direction: dir,
              laneOffset,
            });
          }
        }
      });

      particlesRef.current = particles;
      setParticleCount(particles.length);
    } catch (e) {
      console.error("[TrafficIntel] Parse error:", e);
    } finally {
      setLoading(false);
    }
  }, [zoom]);

  // Google Maps OverlayView setup
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
        this.getPanes()?.overlayLayer?.appendChild(canvas);
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

  // 60 FPS animation loop
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
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // 1. Draw TDI-coloured road lines — full polyline coverage
      roads.forEach((road, ri) => {
        const baseW = ROAD_LINE_WIDTH[road.highway] ?? 3;
        const zoomScale = zoom >= 21 ? 2.5 : zoom >= 20 ? 2.0 : zoom >= 19 ? 1.5 : zoom >= 18 ? 1.1 : 0.8;
        const lineW = baseW * zoomScale * dpr;

        // Convert ALL densified points to pixels
        const pixels: { x: number; y: number }[] = [];
        for (const p of road.points) {
          const px = latLngToPixel(p.lat, p.lng, mapRef.current, overlay);
          if (px) pixels.push({ x: px.x * dpr, y: px.y * dpr });
        }
        if (pixels.length < 2) return;

        // Outer glow — full polyline
        ctx.beginPath();
        ctx.moveTo(pixels[0].x, pixels[0].y);
        for (let i = 1; i < pixels.length; i++) {
          ctx.lineTo(pixels[i].x, pixels[i].y);
        }
        ctx.strokeStyle = tdiToColor(road.tdi, 0.15);
        ctx.lineWidth = lineW * 2.5;
        ctx.stroke();

        // Main road line — full polyline
        ctx.beginPath();
        ctx.moveTo(pixels[0].x, pixels[0].y);
        for (let i = 1; i < pixels.length; i++) {
          ctx.lineTo(pixels[i].x, pixels[i].y);
        }
        ctx.strokeStyle = tdiToColor(road.tdi, 0.55);
        ctx.lineWidth = lineW;
        ctx.stroke();

        // Inner bright center line
        ctx.beginPath();
        ctx.moveTo(pixels[0].x, pixels[0].y);
        for (let i = 1; i < pixels.length; i++) {
          ctx.lineTo(pixels[i].x, pixels[i].y);
        }
        ctx.strokeStyle = tdiToColor(road.tdi, 0.8);
        ctx.lineWidth = lineW * 0.4;
        ctx.stroke();

        // ── Debug overlays ──
        if (debugMode) {
          // Show densified points as tiny dots
          for (let i = 0; i < pixels.length; i++) {
            ctx.beginPath();
            ctx.arc(pixels[i].x, pixels[i].y, 1.5 * dpr, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0,255,200,0.4)";
            ctx.fill();
          }

          // Show original OSM nodes as larger cyan dots
          for (const rp of road.rawPoints) {
            const rpx = latLngToPixel(rp.lat, rp.lng, mapRef.current, overlay);
            if (rpx) {
              ctx.beginPath();
              ctx.arc(rpx.x * dpr, rpx.y * dpr, 3 * dpr, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(0,200,255,0.7)";
              ctx.fill();
              ctx.strokeStyle = "rgba(0,200,255,0.9)";
              ctx.lineWidth = 1 * dpr;
              ctx.stroke();
            }
          }

          // Segment boundary markers (first and last point)
          const first = pixels[0];
          const last = pixels[pixels.length - 1];
          for (const ep of [first, last]) {
            ctx.beginPath();
            ctx.rect(ep.x - 4 * dpr, ep.y - 4 * dpr, 8 * dpr, 8 * dpr);
            ctx.strokeStyle = "rgba(255,100,0,0.8)";
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
          }

          // Label at midpoint: L:<lanes> P:<particles> D:<densified pts>
          const midPx = pixels[Math.floor(pixels.length / 2)];
          if (midPx) {
            const pCount = particles.filter(pp => pp.roadIdx === ri).length;
            const debugLabel = `L:${road.lanes} P:${pCount} D:${road.points.length}`;
            const fontSize = Math.round(7 * dpr);
            ctx.font = `bold ${fontSize}px monospace`;
            const tw = ctx.measureText(debugLabel).width;
            const pad = 3 * dpr;
            const bw = tw + pad * 2;
            const bh = fontSize + pad * 2;

            ctx.fillStyle = "rgba(0,0,0,0.85)";
            ctx.strokeStyle = "rgba(0,255,200,0.6)";
            ctx.lineWidth = 1 * dpr;
            ctx.beginPath();
            ctx.roundRect(midPx.x - bw / 2, midPx.y - bh / 2, bw, bh, 2 * dpr);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "rgba(0,255,200,0.95)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(debugLabel, midPx.x, midPx.y);
          }
        }
      });

      // 2. Animate particles along roads — full coverage
      const dotR = (zoom >= 20 ? 3 : 2.2) * dpr;

      particles.forEach((p) => {
        p.progress += p.speed * p.direction;
        if (p.progress > 1) p.progress = 0;
        if (p.progress < 0) p.progress = 1;

        const road = roads[p.roadIdx];
        if (!road || road.points.length < 2) return;

        const geo = interpolateRoad(road, p.progress);
        const px = latLngToPixel(geo.lat, geo.lng, mapRef.current, overlay);
        if (!px) return;

        // Road angle for lane offset
        const stops = road.progressStops;
        let segIdx = 0;
        while (segIdx < stops.length - 2 && p.progress > stops[segIdx + 1]) segIdx++;
        const p1 = road.points[segIdx];
        const p2 = road.points[Math.min(segIdx + 1, road.points.length - 1)];
        const px1 = latLngToPixel(p1.lat, p1.lng, mapRef.current, overlay);
        const px2 = latLngToPixel(p2.lat, p2.lng, mapRef.current, overlay);
        let roadAngle = 0;
        if (px1 && px2) roadAngle = Math.atan2(px2.y - px1.y, px2.x - px1.x);

        const perpAngle = roadAngle + Math.PI / 2;
        const x = (px.x + Math.cos(perpAngle) * p.laneOffset) * dpr;
        const y = (px.y + Math.sin(perpAngle) * p.laneOffset) * dpr;

        // Particle glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, dotR * 2.5);
        glow.addColorStop(0, tdiToColor(road.tdi, 0.5));
        glow.addColorStop(1, tdiToColor(road.tdi, 0));
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(x, y, dotR * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Particle dot
        ctx.beginPath();
        ctx.fillStyle = tdiToColor(road.tdi, 0.95);
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();

        // Debug: show spawn positions as small crosses
        if (debugMode) {
          ctx.strokeStyle = "rgba(255,255,0,0.5)";
          ctx.lineWidth = 0.5 * dpr;
          ctx.beginPath();
          ctx.moveTo(x - 2 * dpr, y);
          ctx.lineTo(x + 2 * dpr, y);
          ctx.moveTo(x, y - 2 * dpr);
          ctx.lineTo(x, y + 2 * dpr);
          ctx.stroke();
        }

        // Coordinate label at high zoom
        if (zoom >= 20) {
          const fontSize = Math.round(5.5 * dpr);
          const label = `${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`;
          const boxW = 48 * dpr;
          const boxH = 14 * dpr;
          const rectX = x - boxW / 2;
          const rectY = y - boxH - dotR - 2 * dpr;

          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.strokeStyle = tdiToColor(road.tdi, 0.6);
          ctx.lineWidth = 0.8 * dpr;
          ctx.beginPath();
          ctx.rect(rectX, rectY, boxW, boxH);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#fff";
          ctx.font = `${fontSize}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, x, rectY + boxH / 2);
        }
      });

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [enabled, zoom, opacity, debugMode]);

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

  const tdiLabel = avgTDI < 0.8 ? "FREE FLOW" : avgTDI < 1.5 ? "MODERATE" : avgTDI < 2.2 ? "CONGESTED" : "GRIDLOCK";

  return (
    <div className="absolute top-14 right-14 z-[15] pointer-events-none">
      <div className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-black/90 backdrop-blur-sm border border-accent/30"
        style={{ boxShadow: "0 0 20px rgba(139,92,246,0.2)", minWidth: 200 }}>
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-warning animate-pulse" : "bg-accent animate-pulse"}`} />
          <span className="text-[8px] font-mono text-accent font-bold uppercase">
            {loading ? "LOADING…" : "TRAFFIC INTEL"}
          </span>
        </div>

        {!loading && (
          <>
            {/* TDI Score */}
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-mono text-muted-foreground">TDI</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono font-bold" style={{ color: tdiToColor(avgTDI, 1) }}>
                  {avgTDI.toFixed(2)}
                </span>
                <span className="text-[7px] font-mono px-1 py-0.5 rounded"
                  style={{ backgroundColor: tdiToColor(avgTDI, 0.2), color: tdiToColor(avgTDI, 1) }}>
                  {tdiLabel}
                </span>
              </div>
            </div>

            {/* Stats + Debug toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-muted-foreground">
                {roadCount} roads · {particleCount} pts
              </span>
              <button
                onClick={() => setDebugMode(d => !d)}
                className={`text-[6px] font-mono px-1 py-0.5 rounded border pointer-events-auto cursor-pointer transition-colors ${
                  debugMode
                    ? "bg-accent/20 border-accent/40 text-accent"
                    : "bg-muted/20 border-muted-foreground/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {debugMode ? "DBG ON" : "DBG"}
              </button>
            </div>

            {/* Debug info panel */}
            {debugMode && (
              <div className="border-t border-accent/20 pt-1 mt-0.5 space-y-0.5">
                <span className="text-[7px] font-mono text-accent block">── DEBUG ──</span>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="text-[6px] font-mono text-muted-foreground">
                    Stitched: <span className="text-accent">{stitchedCount}</span> segs merged
                  </span>
                  <span className="text-[6px] font-mono text-muted-foreground">
                    Densified: <span className="text-accent">{densifiedPointCount}</span> pts
                  </span>
                  <span className="text-[6px] font-mono text-muted-foreground">
                    Interval: <span className="text-accent">{DENSIFY_INTERVAL_M}m</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: "rgba(0,200,255,0.7)" }} />
                    <span className="text-[6px] font-mono text-muted-foreground">OSM node</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(0,255,200,0.5)" }} />
                    <span className="text-[6px] font-mono text-muted-foreground">Densified</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 border border-orange-400" />
                    <span className="text-[6px] font-mono text-muted-foreground">Seg bound</span>
                  </div>
                </div>
              </div>
            )}

            {/* Weather info */}
            {intelInfo && (
              <div className="flex items-center gap-1.5 border-t border-accent/10 pt-1 mt-0.5">
                <span className="text-[7px] font-mono text-muted-foreground">
                  🌤 {intelInfo.weather.description}
                </span>
                <span className="text-[7px] font-mono text-muted-foreground">
                  {intelInfo.weather.temperature}°C
                </span>
              </div>
            )}

            {/* Time info */}
            {intelInfo && (
              <div className="flex items-center gap-1.5">
                <span className="text-[7px] font-mono text-muted-foreground">
                  🕐 {intelInfo.timeFactors.period}
                </span>
                <span className="text-[7px] font-mono text-muted-foreground/60">
                  ×{Math.round(intelInfo.timeFactors.timeOfDayFactor * 100)}%
                </span>
                {intelInfo.weather.weatherImpactFactor > 1.1 && (
                  <span className="text-[7px] font-mono text-warning">
                    ⚠ wx×{intelInfo.weather.weatherImpactFactor.toFixed(1)}
                  </span>
                )}
              </div>
            )}

            {/* Density legend */}
            <div className="flex items-center gap-1 border-t border-accent/10 pt-1 mt-0.5">
              <div className="flex items-center gap-0.5">
                <div className="w-2 h-1.5 rounded-sm" style={{ background: tdiToColor(0.3, 1) }} />
                <div className="w-2 h-1.5 rounded-sm" style={{ background: tdiToColor(1.0, 1) }} />
                <div className="w-2 h-1.5 rounded-sm" style={{ background: tdiToColor(2.0, 1) }} />
                <div className="w-2 h-1.5 rounded-sm" style={{ background: tdiToColor(3.0, 1) }} />
              </div>
              <span className="text-[6px] font-mono text-muted-foreground/60">FREE→GRIDLOCK</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
