import { useState, useCallback, MutableRefObject, useEffect } from "react";
import {
  Search, ChevronDown, ChevronRight, Circle, Eye, Rocket,
  Shield, MapPin, Mountain, Route, Layers, BarChart3,
  Grid3x3, Navigation, ArrowRight, Crosshair, Triangle,
  Landmark, BrickWall, Satellite, Map, MapPinned, Radio,
  Activity, Wifi, Camera, Trash2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface ToolDef {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SectionDef {
  id: string;
  title: string;
  description: string;
  tools: ToolDef[];
  guidedWorkflow?: boolean;
}

const SECTIONS: SectionDef[] = [
  {
    id: "range-ring",
    title: "Range Ring",
    description: "Analyze distance and line-of-sight from a point of interest.",
    tools: [
      { id: "range-ring", label: "Range ring", icon: Circle },
      { id: "intervisibility", label: "Intervisibility", icon: Eye },
      { id: "ballistic", label: "Ballistic", icon: Rocket },
    ],
  },
  {
    id: "alerts",
    title: "Alerts",
    description: "Define geofence perimeters and proximity triggers.",
    tools: [
      { id: "geofence", label: "Geofence", icon: Shield },
      { id: "proximity", label: "Proximity", icon: MapPin },
    ],
  },
  {
    id: "terrain",
    title: "Terrain",
    description: "Slope analysis, land cover classification, route planning.",
    tools: [
      { id: "slope", label: "Slope", icon: Triangle },
      { id: "land-cover", label: "Land cover", icon: Layers },
      { id: "pathways", label: "Pathways", icon: Route },
      { id: "projection", label: "Projection", icon: Navigation },
      { id: "route", label: "Route", icon: Route },
    ],
    guidedWorkflow: true,
  },
  {
    id: "key-terrain",
    title: "Key Terrain",
    description: "Identify critical terrain features for operational planning.",
    tools: [
      { id: "peaks", label: "Peaks", icon: Mountain },
      { id: "bridges", label: "Bridges", icon: BrickWall },
      { id: "key-terrain", label: "Key terrain", icon: Landmark },
    ],
    guidedWorkflow: true,
  },
  {
    id: "heatmap",
    title: "Heatmap",
    description: "Density overlays and thematic visualizations.",
    tools: [
      { id: "heatmap", label: "Heatmap", icon: BarChart3 },
      { id: "choropleth", label: "Choropleth", icon: Layers },
    ],
  },
  {
    id: "grg",
    title: "GRG Builder",
    description: "Grid Reference Graphic for sequential reference points.",
    tools: [
      { id: "grg-builder", label: "GRG Builder", icon: Grid3x3 },
    ],
  },
];

// ====== MAP LAYER DEFINITIONS ======
interface MapLayerDef {
  id: string;
  label: string;
  icon: React.ElementType;
  type: "base" | "overlay";
}

const MAP_LAYERS: MapLayerDef[] = [
  { id: "satellite", label: "Satellite", icon: Satellite, type: "base" },
  { id: "terrain", label: "Terrain", icon: Mountain, type: "base" },
  { id: "hybrid", label: "Hybrid", icon: Map, type: "base" },
  { id: "roadmap", label: "Roadmap", icon: Route, type: "base" },
];

const OVERLAY_LAYERS: MapLayerDef[] = [
  { id: "transit", label: "Transit Lines", icon: Route, type: "overlay" },
  { id: "traffic", label: "Traffic Flow", icon: Activity, type: "overlay" },
  { id: "bicycling", label: "Cycling Paths", icon: Route, type: "overlay" },
];

// ====== INTELLIGENCE OVERLAY DEFINITIONS ======
interface IntelLayerDef {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  fetchFn: string; // DB table or edge function identifier
}

const INTEL_LAYERS: IntelLayerDef[] = [
  { id: "geo-alerts", label: "Geo Alerts", icon: MapPinned, color: "#ef4444", fetchFn: "geo_alerts" },
  { id: "intel-events", label: "Intel Events", icon: Activity, color: "#f97316", fetchFn: "intel_events" },
  { id: "target-tracks", label: "Target Tracks", icon: Crosshair, color: "#ef4444", fetchFn: "target_tracks" },
  { id: "force-units", label: "Force Units", icon: Shield, color: "#3b82f6", fetchFn: "force_units" },
  { id: "sensor-coverage", label: "Sensor Coverage", icon: Radio, color: "#a855f7", fetchFn: "sensor_feeds" },
  { id: "cameras-intel", label: "Cameras / CCTV", icon: Camera, color: "#06b6d4", fetchFn: "cameras" },
  { id: "earthquakes", label: "Earthquakes", icon: Activity, color: "#eab308", fetchFn: "usgs-earthquakes" },
  { id: "wildfires", label: "Wildfires / Thermal", icon: Activity, color: "#f97316", fetchFn: "nasa-wildfires" },
  { id: "vessels", label: "AIS Vessels", icon: Layers, color: "#0ea5e9", fetchFn: "ais-vessels" },
  { id: "conflict-events", label: "Conflict Events", icon: MapPinned, color: "#dc2626", fetchFn: "conflict-events" },
];

// ====== DATA SOURCES (simulated from sensor_feeds) ======
interface DataSourceDef {
  id: string;
  name: string;
  type: string;
  status: "active" | "degraded" | "offline";
  lastData: string;
  icon: React.ElementType;
}

interface GeoAnalysisToolsPanelProps {
  mapRef: MutableRefObject<any>;
  lat: number;
  lng: number;
}

export const GeoAnalysisToolsPanel = ({ mapRef, lat, lng }: GeoAnalysisToolsPanelProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "range-ring": true,
    alerts: true,
  });
  const [activeTools, setActiveTools] = useState<Set<string>>(new Set());
  const [overlays, setOverlays] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBaseLayer, setActiveBaseLayer] = useState("satellite");
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());
  const [overlayLayers, setOverlayLayers] = useState<any[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceDef[]>([]);
  const [activeIntelLayers, setActiveIntelLayers] = useState<Set<string>>(new Set());
  const [intelMarkers, setIntelMarkers] = useState<Record<string, any[]>>({});

  // Fetch data sources from sensor_feeds
  useEffect(() => {
    const fetchSources = async () => {
      const { data } = await supabase.from("sensor_feeds").select("id, source_name, feed_type, status, last_data_at").limit(20);
      if (data) {
        setDataSources(data.map((s: any) => ({
          id: s.id,
          name: s.source_name,
          type: s.feed_type,
          status: s.status === "active" ? "active" : s.status === "degraded" ? "degraded" : "offline",
          lastData: s.last_data_at || "N/A",
          icon: s.feed_type === "cctv" ? Camera : s.feed_type === "satellite" ? Satellite : s.feed_type === "sigint" ? Radio : Wifi,
        })));
      }
    };
    fetchSources();
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearOverlays = useCallback(() => {
    overlays.forEach((o) => { try { o.setMap(null); } catch {} });
    setOverlays([]);
  }, [overlays]);

  const getGoogle = () => {
    const g = (window as any).google;
    return g?.maps ? g : null;
  };

  // ===== TOOL IMPLEMENTATIONS =====

  const drawRangeRings = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const radii = [1000, 5000, 10000];
    const colors = ["#ef4444", "#f97316", "#eab308"];
    const newOverlays = radii.map((radius, i) => {
      const circle = new google.maps.Circle({
        map, center: { lat, lng }, radius,
        strokeColor: colors[i], strokeWeight: 1.5, strokeOpacity: 0.8,
        fillColor: colors[i], fillOpacity: 0.06,
      });
      // Label
      const label = new google.maps.Marker({
        map, position: { lat: lat + (radius / 111320), lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `${radius >= 1000 ? radius / 1000 + "km" : radius + "m"}`, color: colors[i], fontSize: "9px", fontFamily: "monospace", fontWeight: "bold" },
      });
      return [circle, label];
    }).flat();
    setOverlays(prev => [...prev, ...newOverlays]);
  }, [mapRef, lat, lng]);

  const drawIntervisibility = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    // Line-of-sight rays from center in 8 directions
    const rays: any[] = [];
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = (angle * Math.PI) / 180;
      const dist = 0.03 + Math.random() * 0.02;
      const endLat = lat + Math.cos(rad) * dist;
      const endLng = lng + Math.sin(rad) * dist;
      const blocked = Math.random() > 0.6;
      const line = new google.maps.Polyline({
        map, path: [{ lat, lng }, { lat: endLat, lng: endLng }],
        strokeColor: blocked ? "#ef4444" : "#22c55e",
        strokeWeight: 2, strokeOpacity: 0.7,
        icons: blocked ? [{ icon: { path: "M -1,-1 1,1 M -1,1 1,-1", strokeColor: "#ef4444", strokeWeight: 2, scale: 3 }, offset: "100%" }] : [],
      });
      rays.push(line);
    }
    // Visible area fill
    const visiblePoly = new google.maps.Circle({
      map, center: { lat, lng }, radius: 3000,
      strokeColor: "#22c55e", strokeWeight: 1, strokeOpacity: 0.4,
      fillColor: "#22c55e", fillOpacity: 0.05,
    });
    rays.push(visiblePoly);
    setOverlays(prev => [...prev, ...rays]);
  }, [mapRef, lat, lng]);

  const drawBallistic = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    // Ballistic arcs from center to 3 impact points
    const targets = [
      { lat: lat + 0.08, lng: lng + 0.05, label: "IMPACT-1" },
      { lat: lat - 0.04, lng: lng + 0.1, label: "IMPACT-2" },
      { lat: lat + 0.02, lng: lng - 0.08, label: "IMPACT-3" },
    ];
    const items: any[] = [];
    targets.forEach((t, i) => {
      // Arc path (parabolic)
      const steps = 20;
      const path = [];
      for (let s = 0; s <= steps; s++) {
        const frac = s / steps;
        const midLat = lat + (t.lat - lat) * frac;
        const midLng = lng + (t.lng - lng) * frac;
        path.push({ lat: midLat, lng: midLng });
      }
      const arc = new google.maps.Polyline({
        map, path,
        strokeColor: "#ef4444", strokeWeight: 2, strokeOpacity: 0.8,
        geodesic: true,
        icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: "#ef4444", fillOpacity: 1, strokeWeight: 0 }, offset: "100%" }],
      });
      const impact = new google.maps.Circle({
        map, center: { lat: t.lat, lng: t.lng }, radius: 500,
        strokeColor: "#ef4444", strokeWeight: 2, strokeOpacity: 0.6,
        fillColor: "#ef4444", fillOpacity: 0.15,
      });
      const marker = new google.maps.Marker({
        map, position: { lat: t.lat, lng: t.lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: t.label, color: "#ef4444", fontSize: "8px", fontFamily: "monospace", fontWeight: "bold" },
      });
      items.push(arc, impact, marker);
    });
    // Origin marker
    const origin = new google.maps.Marker({
      map, position: { lat, lng },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: "#f97316", fillOpacity: 0.9, strokeColor: "#fff", strokeWeight: 2 },
      title: "Launch Origin",
    });
    items.push(origin);
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawGeofence = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const fence = new google.maps.Circle({
      map, center: { lat, lng }, radius: 2000,
      strokeColor: "#22d3ee", strokeWeight: 2, strokeOpacity: 0.9,
      fillColor: "#22d3ee", fillOpacity: 0.08, editable: true,
    });
    setOverlays((prev) => [...prev, fence]);
  }, [mapRef, lat, lng]);

  const drawProximity = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    // Proximity alert zones at nearby random positions
    const points = [
      { lat: lat + 0.01, lng: lng - 0.008, label: "ALERT-A", dist: "1.2km" },
      { lat: lat - 0.006, lng: lng + 0.012, label: "ALERT-B", dist: "0.8km" },
      { lat: lat + 0.015, lng: lng + 0.005, label: "ALERT-C", dist: "1.7km" },
    ];
    points.forEach(p => {
      const circle = new google.maps.Circle({
        map, center: { lat: p.lat, lng: p.lng }, radius: 300,
        strokeColor: "#f97316", strokeWeight: 1.5, strokeOpacity: 0.7,
        fillColor: "#f97316", fillOpacity: 0.1,
      });
      const line = new google.maps.Polyline({
        map, path: [{ lat, lng }, { lat: p.lat, lng: p.lng }],
        strokeColor: "#f97316", strokeWeight: 1, strokeOpacity: 0.4,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.6, scale: 2 }, offset: "0", repeat: "8px" }],
      });
      const marker = new google.maps.Marker({
        map, position: { lat: p.lat, lng: p.lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `${p.label} (${p.dist})`, color: "#f97316", fontSize: "8px", fontFamily: "monospace" },
      });
      items.push(circle, line, marker);
    });
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawSlope = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    // Slope gradient overlay using colored rectangles
    const items: any[] = [];
    const gridSize = 0.005;
    const slopeColors = ["#22c55e", "#86efac", "#fef08a", "#fbbf24", "#f97316", "#ef4444"];
    for (let dLat = -0.025; dLat <= 0.025; dLat += gridSize) {
      for (let dLng = -0.025; dLng <= 0.025; dLng += gridSize) {
        const slopeVal = Math.abs(Math.sin(dLat * 200) * Math.cos(dLng * 300)) + Math.random() * 0.2;
        const colorIdx = Math.min(Math.floor(slopeVal * slopeColors.length), slopeColors.length - 1);
        const rect = new google.maps.Rectangle({
          map,
          bounds: {
            north: lat + dLat + gridSize, south: lat + dLat,
            east: lng + dLng + gridSize, west: lng + dLng,
          },
          strokeWeight: 0, fillColor: slopeColors[colorIdx], fillOpacity: 0.3,
        });
        items.push(rect);
      }
    }
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawLandCover = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    const coverTypes = [
      { color: "#166534", label: "Forest", opacity: 0.25 },
      { color: "#a16207", label: "Bare Soil", opacity: 0.2 },
      { color: "#1d4ed8", label: "Water", opacity: 0.3 },
      { color: "#4ade80", label: "Cropland", opacity: 0.2 },
      { color: "#6b7280", label: "Urban", opacity: 0.25 },
    ];
    const gridSize = 0.008;
    for (let dLat = -0.03; dLat <= 0.03; dLat += gridSize) {
      for (let dLng = -0.03; dLng <= 0.03; dLng += gridSize) {
        const type = coverTypes[Math.floor(Math.abs(Math.sin(dLat * 100 + dLng * 200)) * coverTypes.length)];
        const rect = new google.maps.Rectangle({
          map,
          bounds: {
            north: lat + dLat + gridSize, south: lat + dLat,
            east: lng + dLng + gridSize, west: lng + dLng,
          },
          strokeWeight: 0.5, strokeColor: type.color, strokeOpacity: 0.3,
          fillColor: type.color, fillOpacity: type.opacity,
        });
        items.push(rect);
      }
    }
    // Legend
    coverTypes.forEach((t, i) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: lat + 0.035, lng: lng - 0.03 + i * 0.015 },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: t.color, fillOpacity: 0.8, strokeWeight: 1, strokeColor: "#fff" },
        title: t.label,
      });
      items.push(marker);
    });
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawPathways = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    // Simulated movement corridors
    const corridors = [
      { path: [{ lat, lng }, { lat: lat + 0.02, lng: lng + 0.01 }, { lat: lat + 0.04, lng: lng + 0.005 }], label: "CORRIDOR-ALPHA", color: "#22c55e" },
      { path: [{ lat, lng }, { lat: lat - 0.01, lng: lng + 0.03 }, { lat: lat - 0.02, lng: lng + 0.05 }], label: "CORRIDOR-BRAVO", color: "#3b82f6" },
      { path: [{ lat, lng }, { lat: lat + 0.015, lng: lng - 0.02 }, { lat: lat + 0.035, lng: lng - 0.03 }], label: "CORRIDOR-CHARLIE", color: "#eab308" },
    ];
    corridors.forEach(c => {
      const polyline = new google.maps.Polyline({
        map, path: c.path,
        strokeColor: c.color, strokeWeight: 3, strokeOpacity: 0.7,
        icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, fillColor: c.color, fillOpacity: 1, strokeWeight: 0 }, offset: "50%" }],
      });
      const label = new google.maps.Marker({
        map, position: c.path[1],
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: c.label, color: c.color, fontSize: "8px", fontFamily: "monospace", fontWeight: "bold" },
      });
      items.push(polyline, label);
    });
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawProjection = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    // Bearing projection line from center
    const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
    bearings.forEach(bearing => {
      const rad = (bearing * Math.PI) / 180;
      const dist = 0.05;
      const endLat = lat + Math.cos(rad) * dist;
      const endLng = lng + Math.sin(rad) * (dist / Math.cos(lat * Math.PI / 180));
      const line = new google.maps.Polyline({
        map, path: [{ lat, lng }, { lat: endLat, lng: endLng }],
        strokeColor: "#06b6d4", strokeWeight: 1, strokeOpacity: 0.5,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.4, scale: 2 }, offset: "0", repeat: "10px" }],
      });
      const label = new google.maps.Marker({
        map, position: { lat: endLat, lng: endLng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `${bearing}°`, color: "#06b6d4", fontSize: "7px", fontFamily: "monospace" },
      });
      items.push(line, label);
    });
    // Center crosshair
    const center = new google.maps.Marker({
      map, position: { lat, lng },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: "#06b6d4", fillOpacity: 0.9, strokeColor: "#fff", strokeWeight: 1.5 },
    });
    items.push(center);
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawRoute = useCallback(async () => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    // Use Google Directions service
    const dest = { lat: lat + 0.05 + Math.random() * 0.02, lng: lng + 0.03 + Math.random() * 0.02 };
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map, suppressMarkers: false,
      polylineOptions: { strokeColor: "#8b5cf6", strokeWeight: 4, strokeOpacity: 0.8 },
    });
    try {
      const result = await directionsService.route({
        origin: { lat, lng },
        destination: dest,
        travelMode: google.maps.TravelMode.DRIVING,
      });
      directionsRenderer.setDirections(result);
      setOverlays(prev => [...prev, directionsRenderer]);
    } catch {
      // Fallback straight line if directions fail
      const line = new google.maps.Polyline({
        map, path: [{ lat, lng }, dest],
        strokeColor: "#8b5cf6", strokeWeight: 3, strokeOpacity: 0.7,
      });
      setOverlays(prev => [...prev, line]);
    }
  }, [mapRef, lat, lng]);

  const drawPeaks = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    const peaks = [
      { lat: lat + 0.012, lng: lng - 0.008, elev: 890, name: "PEAK-1" },
      { lat: lat - 0.015, lng: lng + 0.01, elev: 1240, name: "PEAK-2" },
      { lat: lat + 0.008, lng: lng + 0.018, elev: 670, name: "PEAK-3" },
      { lat: lat - 0.005, lng: lng - 0.02, elev: 1050, name: "PEAK-4" },
    ];
    peaks.forEach(p => {
      const marker = new google.maps.Marker({
        map, position: { lat: p.lat, lng: p.lng },
        icon: { path: "M 0,-8 L 6,4 L -6,4 Z", fillColor: "#f97316", fillOpacity: 0.9, strokeColor: "#fff", strokeWeight: 1.5, scale: 1.2 },
        title: `${p.name}: ${p.elev}m`,
      });
      const label = new google.maps.Marker({
        map, position: { lat: p.lat + 0.002, lng: p.lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `▲ ${p.name} (${p.elev}m)`, color: "#f97316", fontSize: "8px", fontFamily: "monospace", fontWeight: "bold" },
      });
      items.push(marker, label);
    });
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawBridges = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    const bridges = [
      { lat: lat + 0.005, lng: lng + 0.01, name: "BRIDGE-N1", span: "120m" },
      { lat: lat - 0.008, lng: lng - 0.005, name: "BRIDGE-S1", span: "85m" },
      { lat: lat + 0.018, lng: lng - 0.012, name: "BRIDGE-W1", span: "200m" },
    ];
    bridges.forEach(b => {
      const marker = new google.maps.Marker({
        map, position: { lat: b.lat, lng: b.lng },
        icon: { path: "M -6,0 L -4,-4 L 4,-4 L 6,0 L 4,4 L -4,4 Z", fillColor: "#3b82f6", fillOpacity: 0.9, strokeColor: "#fff", strokeWeight: 1.5, scale: 1.5 },
        title: `${b.name}: ${b.span}`,
      });
      const label = new google.maps.Marker({
        map, position: { lat: b.lat + 0.002, lng: b.lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `🌉 ${b.name} (${b.span})`, color: "#3b82f6", fontSize: "8px", fontFamily: "monospace" },
      });
      items.push(marker, label);
    });
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawKeyTerrain = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    const features = [
      { lat: lat + 0.01, lng: lng + 0.005, name: "RIDGELINE", type: "commanding_ground", color: "#ef4444" },
      { lat: lat - 0.012, lng: lng + 0.015, name: "INTERSECTION", type: "chokepoint", color: "#f97316" },
      { lat: lat + 0.003, lng: lng - 0.018, name: "RIVER FORD", type: "crossing", color: "#3b82f6" },
      { lat: lat - 0.007, lng: lng - 0.01, name: "DEPRESSION", type: "concealment", color: "#22c55e" },
    ];
    features.forEach(f => {
      const polygon = new google.maps.Circle({
        map, center: { lat: f.lat, lng: f.lng }, radius: 400,
        strokeColor: f.color, strokeWeight: 2, strokeOpacity: 0.8,
        fillColor: f.color, fillOpacity: 0.12,
      });
      const marker = new google.maps.Marker({
        map, position: { lat: f.lat, lng: f.lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: f.color, fillOpacity: 0.9, strokeColor: "#fff", strokeWeight: 1.5 },
        title: `${f.name} (${f.type})`,
      });
      const label = new google.maps.Marker({
        map, position: { lat: f.lat + 0.003, lng: f.lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `${f.name}`, color: f.color, fontSize: "8px", fontFamily: "monospace", fontWeight: "bold" },
      });
      items.push(polygon, marker, label);
    });
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawHeatmap = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google?.maps?.visualization) {
      // Fallback if heatmap library not loaded — use circles
      if (!map || !google) return;
      const items: any[] = [];
      for (let i = 0; i < 40; i++) {
        const pLat = lat + (Math.random() - 0.5) * 0.06;
        const pLng = lng + (Math.random() - 0.5) * 0.06;
        const intensity = Math.random();
        const color = intensity > 0.7 ? "#ef4444" : intensity > 0.4 ? "#f97316" : "#eab308";
        const circle = new google.maps.Circle({
          map, center: { lat: pLat, lng: pLng }, radius: 200 + intensity * 600,
          strokeWeight: 0, fillColor: color, fillOpacity: 0.2 + intensity * 0.2,
        });
        items.push(circle);
      }
      setOverlays(prev => [...prev, ...items]);
      return;
    }
    const heatmapData = [];
    for (let i = 0; i < 60; i++) {
      heatmapData.push({
        location: new google.maps.LatLng(lat + (Math.random() - 0.5) * 0.06, lng + (Math.random() - 0.5) * 0.06),
        weight: Math.random() * 10,
      });
    }
    const heatmap = new google.maps.visualization.HeatmapLayer({
      data: heatmapData, map, radius: 30, opacity: 0.6,
    });
    setOverlays(prev => [...prev, heatmap]);
  }, [mapRef, lat, lng]);

  const drawChoropleth = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    // Grid-based choropleth (simulated density)
    const gridSize = 0.01;
    const colors = ["#dcfce7", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d"];
    for (let dLat = -0.04; dLat <= 0.04; dLat += gridSize) {
      for (let dLng = -0.04; dLng <= 0.04; dLng += gridSize) {
        const val = Math.abs(Math.sin(dLat * 80) * Math.cos(dLng * 60) + Math.random() * 0.3);
        const idx = Math.min(Math.floor(val * colors.length), colors.length - 1);
        const rect = new google.maps.Rectangle({
          map,
          bounds: {
            north: lat + dLat + gridSize, south: lat + dLat,
            east: lng + dLng + gridSize, west: lng + dLng,
          },
          strokeWeight: 0.5, strokeColor: "#ffffff", strokeOpacity: 0.2,
          fillColor: colors[idx], fillOpacity: 0.35,
        });
        items.push(rect);
      }
    }
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  const drawGRG = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const items: any[] = [];
    const gridSize = 0.005;
    const cols = 8;
    const rows = 6;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellLat = lat - (rows / 2) * gridSize + r * gridSize;
        const cellLng = lng - (cols / 2) * gridSize + c * gridSize;
        const rect = new google.maps.Rectangle({
          map,
          bounds: {
            north: cellLat + gridSize, south: cellLat,
            east: cellLng + gridSize, west: cellLng,
          },
          strokeWeight: 1, strokeColor: "#06b6d4", strokeOpacity: 0.6,
          fillColor: "#06b6d4", fillOpacity: 0.03,
        });
        const cellName = `${letters[r]}${c + 1}`;
        const label = new google.maps.Marker({
          map,
          position: { lat: cellLat + gridSize / 2, lng: cellLng + gridSize / 2 },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
          label: { text: cellName, color: "#06b6d4", fontSize: "9px", fontFamily: "monospace", fontWeight: "bold" },
        });
        items.push(rect, label);
      }
    }
    setOverlays(prev => [...prev, ...items]);
  }, [mapRef, lat, lng]);

  // ===== TOOL DISPATCH =====
  const TOOL_ACTIONS: Record<string, () => void> = {
    "range-ring": drawRangeRings,
    "intervisibility": drawIntervisibility,
    "ballistic": drawBallistic,
    "geofence": drawGeofence,
    "proximity": drawProximity,
    "slope": drawSlope,
    "land-cover": drawLandCover,
    "pathways": drawPathways,
    "projection": drawProjection,
    "route": drawRoute,
    "peaks": drawPeaks,
    "bridges": drawBridges,
    "key-terrain": drawKeyTerrain,
    "heatmap": drawHeatmap,
    "choropleth": drawChoropleth,
    "grg-builder": drawGRG,
  };

  const toggleTool = (toolId: string) => {
    const next = new Set(activeTools);
    if (next.has(toolId)) {
      next.delete(toolId);
      // Clear all overlays for this tool
      clearOverlays();
      // Re-draw any remaining active tools
      next.forEach(t => { TOOL_ACTIONS[t]?.(); });
    } else {
      next.add(toolId);
      TOOL_ACTIONS[toolId]?.();
      toast({ title: `${toolId.replace(/-/g, " ").toUpperCase()} active`, description: "Overlay rendered on map." });
    }
    setActiveTools(next);
  };

  // ===== MAP LAYER SWITCHING =====
  const switchBaseLayer = (layerId: string) => {
    const map = mapRef.current;
    if (!map) return;
    setActiveBaseLayer(layerId);
    try {
      map.setMapTypeId(layerId);
    } catch {}
  };

  const toggleOverlayLayer = (layerId: string) => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;
    const next = new Set(activeOverlays);
    if (next.has(layerId)) {
      next.delete(layerId);
      // Remove the overlay layer
      overlayLayers.forEach(l => { try { l.setMap(null); } catch {} });
      setOverlayLayers([]);
    } else {
      next.add(layerId);
      try {
        if (layerId === "traffic") {
          const layer = new google.maps.TrafficLayer();
          layer.setMap(map);
          setOverlayLayers(prev => [...prev, layer]);
        } else if (layerId === "transit") {
          const layer = new google.maps.TransitLayer();
          layer.setMap(map);
          setOverlayLayers(prev => [...prev, layer]);
        } else if (layerId === "bicycling") {
          const layer = new google.maps.BicyclingLayer();
          layer.setMap(map);
          setOverlayLayers(prev => [...prev, layer]);
        }
      } catch {}
    }
    setActiveOverlays(next);
  };

  const clearAllTools = () => {
    clearOverlays();
    setActiveTools(new Set());
    toast({ title: "All tools cleared", description: "Map overlays removed." });
  };

  // ===== INTELLIGENCE LAYER TOGGLE =====
  const toggleIntelLayer = useCallback(async (layerId: string) => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;

    const next = new Set(activeIntelLayers);

    if (next.has(layerId)) {
      // Remove markers
      next.delete(layerId);
      (intelMarkers[layerId] || []).forEach((m: any) => { try { m.setMap(null); } catch {} });
      setIntelMarkers(prev => { const c = { ...prev }; delete c[layerId]; return c; });
    } else {
      next.add(layerId);
      const layerDef = INTEL_LAYERS.find(l => l.id === layerId);
      if (!layerDef) return;

      let items: any[] = [];
      const newMarkers: any[] = [];

      try {
        // DB table sources
        const dbTables = ["geo_alerts", "intel_events", "target_tracks", "force_units", "sensor_feeds", "cameras"];
        if (dbTables.includes(layerDef.fetchFn)) {
          const { data } = await supabase.from(layerDef.fetchFn as any).select("*").limit(100);
          items = data || [];
        } else {
          // Edge function sources
          const { data } = await supabase.functions.invoke(layerDef.fetchFn);
          if (layerDef.fetchFn === "usgs-earthquakes") items = data?.earthquakes || [];
          else if (layerDef.fetchFn === "nasa-wildfires") items = data?.fires || [];
          else if (layerDef.fetchFn === "ais-vessels") items = data?.vessels || [];
          else if (layerDef.fetchFn === "conflict-events") items = data?.data || [];
        }

        items.forEach((item: any) => {
          const iLat = item.lat ?? item.latitude;
          const iLng = item.lng ?? item.longitude;
          if (!iLat || !iLng) return;

          if (layerDef.id === "sensor-coverage") {
            const circle = new google.maps.Circle({
              map, center: { lat: iLat, lng: iLng },
              radius: (item.coverage_radius_km || 10) * 1000,
              strokeColor: layerDef.color, strokeWeight: 1, strokeOpacity: 0.5,
              fillColor: layerDef.color, fillOpacity: 0.06,
            });
            newMarkers.push(circle);
          } else if (layerDef.id === "earthquakes") {
            const mag = item.magnitude || 3;
            const circle = new google.maps.Circle({
              map, center: { lat: iLat, lng: iLng },
              radius: Math.pow(2, mag) * 200,
              strokeColor: mag >= 5 ? "#ef4444" : "#eab308", strokeWeight: 1.5, strokeOpacity: 0.7,
              fillColor: mag >= 5 ? "#ef4444" : "#eab308", fillOpacity: 0.15,
            });
            newMarkers.push(circle);
          } else {
            const marker = new google.maps.Marker({
              map, position: { lat: iLat, lng: iLng },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: layerDef.color,
                fillOpacity: 0.85,
                strokeColor: "#fff",
                strokeWeight: 1,
              },
              title: item.title || item.name || item.source_name || item.track_id || `${iLat.toFixed(3)}, ${iLng.toFixed(3)}`,
            });
            newMarkers.push(marker);
          }
        });

        setIntelMarkers(prev => ({ ...prev, [layerId]: newMarkers }));
        toast({ title: `${layerDef.label} loaded`, description: `${items.length} items on map` });
      } catch (e) {
        console.error(`Intel layer ${layerId} error:`, e);
        toast({ title: "Layer error", description: String(e), variant: "destructive" });
      }
    }

    setActiveIntelLayers(next);
  }, [mapRef, activeIntelLayers, intelMarkers]);

  const filteredSections = searchQuery
    ? SECTIONS.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.tools.some((t) => t.label.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : SECTIONS;

  const STATUS_COLORS = { active: "#22c55e", degraded: "#eab308", offline: "#ef4444" };

  return (
    <div className="absolute top-0 left-0 bottom-0 z-30 w-[252px] flex flex-col bg-background/95 backdrop-blur-md border-r border-border/40" style={{ boxShadow: "4px 0 24px rgba(0,0,0,0.4)" }}>
      <Tabs defaultValue="tools" className="flex flex-col h-full">
        <TabsList className="rounded-none bg-muted/40 border-b border-border/30 h-9 px-1 shrink-0">
          <TabsTrigger value="layers" className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Map layers</TabsTrigger>
          <TabsTrigger value="sources" className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Data sources</TabsTrigger>
          <TabsTrigger value="tools" className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Tools</TabsTrigger>
        </TabsList>

        {/* ===== MAP LAYERS TAB ===== */}
        <TabsContent value="layers" className="flex-1 flex flex-col overflow-hidden mt-0">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {/* Base layers */}
              <div>
                <span className="text-[8px] font-mono font-bold text-muted-foreground tracking-[0.15em] px-1">BASE MAP</span>
                <div className="mt-1.5 space-y-1">
                  {MAP_LAYERS.map(layer => {
                    const Icon = layer.icon;
                    const isActive = activeBaseLayer === layer.id;
                    return (
                      <button
                        key={layer.id}
                        onClick={() => switchBaseLayer(layer.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-sm border text-[9px] font-mono transition-all ${
                          isActive
                            ? "bg-primary/15 border-primary/50 text-primary"
                            : "bg-muted/10 border-border/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="font-bold">{layer.label}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Overlay layers */}
              <div>
                <span className="text-[8px] font-mono font-bold text-muted-foreground tracking-[0.15em] px-1">OVERLAYS</span>
                <div className="mt-1.5 space-y-1">
                  {OVERLAY_LAYERS.map(layer => {
                    const Icon = layer.icon;
                    const isActive = activeOverlays.has(layer.id);
                    return (
                      <button
                        key={layer.id}
                        onClick={() => toggleOverlayLayer(layer.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-sm border text-[9px] font-mono transition-all ${
                          isActive
                            ? "bg-primary/15 border-primary/50 text-primary"
                            : "bg-muted/10 border-border/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="font-bold">{layer.label}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ===== DATA SOURCES TAB ===== */}
        <TabsContent value="sources" className="flex-1 flex flex-col overflow-hidden mt-0">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[8px] font-mono font-bold text-muted-foreground tracking-[0.15em]">CONNECTED FEEDS</span>
                <span className="text-[8px] font-mono text-primary">{dataSources.length}</span>
              </div>
              {dataSources.length === 0 && (
                <div className="text-center py-6 text-[9px] font-mono text-muted-foreground">
                  <Wifi className="h-5 w-5 mx-auto mb-2 opacity-30" />
                  Loading feeds...
                </div>
              )}
              {dataSources.map(src => {
                const Icon = src.icon;
                return (
                  <div key={src.id} className="flex items-center gap-2 px-2.5 py-2 rounded-sm border border-border/20 bg-muted/10 hover:border-primary/20 transition-colors">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-mono font-bold text-foreground truncate">{src.name}</div>
                      <div className="text-[7px] font-mono text-muted-foreground">{src.type.toUpperCase()}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[src.status] }} />
                      <span className="text-[7px] font-mono" style={{ color: STATUS_COLORS[src.status] }}>{src.status.toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ===== TOOLS TAB ===== */}
        <TabsContent value="tools" className="flex-1 flex flex-col overflow-hidden mt-0">
          {/* Search */}
          <div className="px-2 py-2 border-b border-border/20 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-[10px] font-mono bg-muted/30 border border-border/30 rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Active tools indicator + clear */}
          {activeTools.size > 0 && (
            <div className="px-2 py-1.5 border-b border-border/20 flex items-center justify-between shrink-0">
              <span className="text-[8px] font-mono text-primary">{activeTools.size} tool{activeTools.size > 1 ? "s" : ""} active</span>
              <button onClick={clearAllTools} className="flex items-center gap-1 text-[8px] font-mono text-destructive hover:text-destructive/80 transition-colors">
                <Trash2 className="h-2.5 w-2.5" /> Clear all
              </button>
            </div>
          )}

          {/* Sections */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredSections.map((section) => {
                const isExpanded = expandedSections[section.id] ?? false;
                const activeSectionTools = section.tools.filter(t => activeTools.has(t.id));
                return (
                  <div key={section.id} className="border border-border/20 rounded-sm bg-muted/10">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted/20 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">{section.title}</span>
                      {activeSectionTools.length > 0 && (
                        <span className="ml-auto text-[7px] font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{activeSectionTools.length}</span>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-2.5 pb-2.5">
                        <p className="text-[8px] font-mono text-muted-foreground mb-2 leading-relaxed">{section.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {section.tools.map((tool) => {
                            const Icon = tool.icon;
                            const isActive = activeTools.has(tool.id);
                            return (
                              <button
                                key={tool.id}
                                onClick={() => toggleTool(tool.id)}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-sm border text-[9px] font-mono transition-all ${
                                  isActive
                                    ? "bg-primary/20 border-primary/60 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.2)]"
                                    : "bg-muted/20 border-border/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                                <span>{tool.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        {section.guidedWorkflow && (
                          <button className="mt-2 flex items-center gap-1 text-[8px] font-mono text-primary hover:text-primary/80 transition-colors">
                            <span>Guided workflow</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Bottom coordinate bar */}
          <div className="shrink-0 border-t border-border/30 bg-muted/20 px-2.5 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Crosshair className="h-3 w-3 text-primary" />
              <span className="text-[8px] font-mono font-bold text-primary uppercase">Position</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px] font-mono">
              <span className="text-muted-foreground">LAT</span>
              <span className="text-foreground">{lat.toFixed(6)}°</span>
              <span className="text-muted-foreground">LNG</span>
              <span className="text-foreground">{lng.toFixed(6)}°</span>
              <span className="text-muted-foreground">MGRS</span>
              <span className="text-foreground">{latLngToMGRS(lat, lng)}</span>
              <span className="text-muted-foreground">ELEV</span>
              <span className="text-foreground">~{Math.round(Math.abs(lat * 3) + 50)}m ASL</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function latLngToMGRS(lat: number, lng: number): string {
  const zoneNum = Math.floor((lng + 180) / 6) + 1;
  const letters = "CDEFGHJKLMNPQRSTUVWX";
  const latBand = letters[Math.floor((lat + 80) / 8)] || "X";
  const easting = Math.round(((lng % 6) + 3) * 100000 / 6);
  const northing = Math.round((lat % 8) * 100000 / 8);
  return `${zoneNum}${latBand} ${String(easting).padStart(5, "0")} ${String(Math.abs(northing)).padStart(5, "0")}`;
}
