import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { X, RefreshCw, Search, Building2, Plane, Navigation, Eye, EyeOff, Flame, AlertTriangle, MapPin, Shield, Anchor, Radio, Maximize2, RotateCcw, ZoomIn, ZoomOut, Compass, Target, CloudRain, Ship, Activity, Car, Layers, ChevronLeft, ChevronRight, Rocket, Video, Camera, Signal } from "lucide-react";

interface IntelEvent {
  title: string;
  lat: number;
  lng: number;
  severity?: string;
  source?: string;
  type?: string;
  summary?: string;
}

interface UrbanSceneProps {
  onClose: () => void;
  initialCoords?: { lat: number; lng: number };
  initialEvent?: IntelEvent;
}

interface Aircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
  heading: number;
  registration?: string;
  type?: string;
  vertical_rate: number;
  is_military: boolean;
}

interface ConflictPoint {
  lat: number;
  lng: number;
  severity: number;
}

const PRESETS = [
  { name: "Middle East", lat: 29.5, lng: 47.5 },
  { name: "Tehran", lat: 35.6892, lng: 51.389 },
  { name: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
  { name: "Beirut", lat: 33.8938, lng: 35.5018 },
  { name: "Damascus", lat: 33.5138, lng: 36.2765 },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { name: "Baghdad", lat: 33.3152, lng: 44.3661 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Amman", lat: 31.9454, lng: 35.9284 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
];

const MARITIME_CORRIDORS = [
  { latMin: 23.5, latMax: 30.8, lngMin: 47.5, lngMax: 56.8 }, // Persian Gulf
  { latMin: 22.0, latMax: 27.8, lngMin: 55.8, lngMax: 62.8 }, // Gulf of Oman
  { latMin: 12.0, latMax: 30.8, lngMin: 32.0, lngMax: 43.8 }, // Red Sea + Bab el-Mandeb
  { latMin: 30.0, latMax: 33.6, lngMin: 31.8, lngMax: 33.2 }, // Suez Canal
  { latMin: 31.0, latMax: 37.2, lngMin: 33.2, lngMax: 36.8 }, // Eastern Mediterranean coast
  { latMin: 36.3, latMax: 47.2, lngMin: 47.0, lngMax: 54.8 }, // Caspian Sea
];

function isLikelyWaterPosition(lat: number, lng: number): boolean {
  return MARITIME_CORRIDORS.some((c) => lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax);
}

function sanitizeVesselsToWater<T extends { lat: number; lng: number }>(rows: T[]): T[] {
  return rows.filter((v) => isLikelyWaterPosition(v.lat, v.lng));
}

function createAircraftSvg(isMilitary: boolean, heading: number, isTracked: boolean): string {
  const color = isMilitary ? "#ef4444" : "#3b82f6";
  const glow = isMilitary ? "rgba(239,68,68,0.8)" : "rgba(59,130,246,0.7)";
  const size = isTracked ? 40 : 30;
  const c = size / 2;
  const trackRing = isTracked
    ? `<circle cx="${c}" cy="${c}" r="${c - 2}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 3" opacity="0.7">
        <animateTransform attributeName="transform" type="rotate" from="0 ${c} ${c}" to="360 ${c} ${c}" dur="3s" repeatCount="indefinite"/>
      </circle>`
    : "";
  const pulse = `<circle cx="${c}" cy="${c}" r="${c * 0.5}" fill="none" stroke="${color}" stroke-width="1" opacity="0.4">
    <animate attributeName="r" values="${c * 0.5};${c - 1}" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.4;0" dur="2s" repeatCount="indefinite"/>
  </circle>`;
  // Clear airplane silhouette — fuselage + swept wings + tail
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><filter id="af${isTracked?1:0}"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${glow}"/></filter></defs>
    ${trackRing}${pulse}
    <g transform="rotate(${heading} ${c} ${c})" filter="url(#af${isTracked?1:0})">
      <!-- fuselage -->
      <ellipse cx="${c}" cy="${c}" rx="${size * 0.06}" ry="${size * 0.35}" fill="${color}"/>
      <!-- wings -->
      <polygon points="${c},${c - size * 0.02} ${c - size * 0.35},${c + size * 0.08} ${c - size * 0.3},${c + size * 0.12} ${c},${c + size * 0.05}" fill="${color}" opacity="0.95"/>
      <polygon points="${c},${c - size * 0.02} ${c + size * 0.35},${c + size * 0.08} ${c + size * 0.3},${c + size * 0.12} ${c},${c + size * 0.05}" fill="${color}" opacity="0.95"/>
      <!-- tail fin -->
      <polygon points="${c},${c + size * 0.22} ${c - size * 0.12},${c + size * 0.32} ${c - size * 0.1},${c + size * 0.35} ${c},${c + size * 0.28}" fill="${color}" opacity="0.85"/>
      <polygon points="${c},${c + size * 0.22} ${c + size * 0.12},${c + size * 0.32} ${c + size * 0.1},${c + size * 0.35} ${c},${c + size * 0.28}" fill="${color}" opacity="0.85"/>
      <!-- cockpit -->
      <ellipse cx="${c}" cy="${c - size * 0.28}" rx="${size * 0.035}" ry="${size * 0.05}" fill="rgba(255,255,255,0.35)"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Generate a projected route backward from current position using heading & speed
function generateProjectedRoute(ac: Aircraft, trailHistory: { lat: number; lng: number; ts: number }[]): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  // Use trail history if available
  if (trailHistory.length > 0) {
    trailHistory.forEach(p => points.push({ lat: p.lat, lng: p.lng }));
  }
  // If fewer than 3 trail points, project backward from heading to create a visible route
  if (points.length < 3) {
    const headingRad = ((ac.heading + 180) % 360) * Math.PI / 180; // reverse heading
    const speedKmh = ac.velocity * 3.6;
    const distKm = Math.max(speedKmh * 0.05, 15); // ~3 min of flight or 15km min
    for (let i = 5; i >= 1; i--) {
      const d = (distKm * i) / 111.32;
      points.unshift({
        lat: ac.lat + Math.cos(headingRad) * d,
        lng: ac.lng + Math.sin(headingRad) * d / Math.cos(ac.lat * Math.PI / 180),
      });
    }
  }
  // Add current position
  points.push({ lat: ac.lat, lng: ac.lng });
  return points;
}

export const UrbanScene3D = ({ onClose, initialCoords, initialEvent }: UrbanSceneProps) => {
  const [lat, setLat] = useState(initialCoords?.lat || initialEvent?.lat || 29.5);
  const [lng, setLng] = useState(initialCoords?.lng || initialEvent?.lng || 47.5);
  
  const [searchInput, setSearchInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFlights, setShowFlights] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const aircraftSnapshotRef = useRef<Aircraft[]>([]); // last poll snapshot for interpolation
  const lastPollTimeRef = useRef<number>(Date.now());
  const [interpolatedAircraft, setInterpolatedAircraft] = useState<Aircraft[]>([]);
  const [showTrails, setShowTrails] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(!!initialEvent);
  const [conflictPoints, setConflictPoints] = useState<ConflictPoint[]>([]);
  const [streetViewActive, setStreetViewActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(14);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetViewRef = useRef<any>(null);
  const trailHistoryRef = useRef<Record<string, { lat: number; lng: number; ts: number }[]>>({});
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [trackedAircraftId, setTrackedAircraftId] = useState<string | null>(null);
  const [flightSource, setFlightSource] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const flightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interpolationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapListenersRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const trailLinesRef = useRef<any[]>([]);
  const heatmapLayerRef = useRef<any>(null);
  
  const [showIntelCard, setShowIntelCard] = useState(!!initialEvent);
  const [nearbyIntel, setNearbyIntel] = useState<{ alerts: any[]; vessels: any[]; airspace: any[] }>({ alerts: [], vessels: [], airspace: [] });

  // New real-time layers
  const [showVessels, setShowVessels] = useState(true);
  const [showEarthquakes, setShowEarthquakes] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [vessels, setVessels] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const vesselMarkersRef = useRef<any[]>([]);
  const earthquakeMarkersRef = useRef<any[]>([]);
  const trafficLayerRef = useRef<any>(null);
  const weatherOverlayRef = useRef<any>(null);
  const weatherMarkersRef = useRef<any[]>([]);
  const [weatherData, setWeatherData] = useState<any[]>([]);

  // Rocket/missile layer
  const [showRockets, setShowRockets] = useState(true);
  const [rockets, setRockets] = useState<any[]>([]);
  const rocketMarkersRef = useRef<any[]>([]);
  const rocketLinesRef = useRef<any[]>([]);

  // City landmarks layer
  const [showCities, setShowCities] = useState(true);
  const cityMarkersRef = useRef<any[]>([]);
  const cityInfoWindowRef = useRef<any>(null);

  // Mapillary street-level viewer
  const [mapillaryActive, setMapillaryActive] = useState(false);
  const [mapillaryImageId, setMapillaryImageId] = useState<string | null>(null);
  const [mapillaryToken, setMapillaryToken] = useState<string | null>(null);
  const [mapillaryLoading, setMapillaryLoading] = useState(false);
  const mapillaryViewerRef = useRef<any>(null);

  // Live camera layer
  const [showCameras, setShowCameras] = useState(true);
  const [cameras, setCameras] = useState<any[]>([]);
  const cameraMarkersRef = useRef<any[]>([]);
  const [activeCameraFeed, setActiveCameraFeed] = useState<any>(null);
  
  // AI Object Detection overlay
  const [showAIDetection, setShowAIDetection] = useState(true);
  const [aiDetections, setAiDetections] = useState<{ id: string; label: string; confidence: number; x: number; y: number; w: number; h: number; color: string }[]>([]);
  const aiDetectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // City intel HUD (shown in street-level mode)
  const [cityIntel, setCityIntel] = useState<{ weather?: any; alerts?: number; cameras?: number; traffic?: string } | null>(null);

  // Walking experience state
  const [walkingPath, setWalkingPath] = useState<{ lat: number; lng: number }[]>([]);
  const [walkingSteps, setWalkingSteps] = useState(0);

  // Layer panel & opacity
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [viewStyle, setViewStyle] = useState<"normal" | "crt" | "nvg" | "flir" | "noir" | "snow">("normal");
  const [vesselSource, setVesselSource] = useState<string>("loading");
  const [opacityFlights, setOpacityFlights] = useState(1);
  const [opacityVessels, setOpacityVessels] = useState(1);
  const [opacityEarthquakes, setOpacityEarthquakes] = useState(1);
  const [opacityWeather, setOpacityWeather] = useState(0.6);
  const [opacityHeatmap, setOpacityHeatmap] = useState(0.7);
  const [opacityTraffic, setOpacityTraffic] = useState(0.8);
  const [showAirspacePanel, setShowAirspacePanel] = useState(true);
  const [airspacePanelPos, setAirspacePanelPos] = useState({ x: 12, y: 160 });
  const airspaceDragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });

  // Fetch nearby intel
  useEffect(() => {
    const fetchNearby = async () => {
      const radius = 5;
      try {
        const [alertsRes, vesselsRes, airspaceRes] = await Promise.all([
          supabase.from("geo_alerts").select("*").gte("lat", lat - radius).lte("lat", lat + radius).gte("lng", lng - radius).lte("lng", lng + radius),
          supabase.from("vessels").select("*").gte("lat", lat - radius).lte("lat", lat + radius).gte("lng", lng - radius).lte("lng", lng + radius),
          supabase.from("airspace_alerts").select("*").gte("lat", lat - radius).lte("lat", lat + radius).gte("lng", lng - radius).lte("lng", lng + radius),
        ]);
        setNearbyIntel({ alerts: alertsRes.data || [], vessels: vesselsRes.data || [], airspace: airspaceRes.data || [] });
      } catch (e) { console.error("Nearby intel fetch error:", e); }
    };
    fetchNearby();
    const iv = setInterval(fetchNearby, 60_000);
    return () => clearInterval(iv);
  }, [lat, lng]);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-maps-key");
        if (!error && data?.apiKey) setApiKey(data.apiKey);
      } catch (e) { console.error("Failed to fetch Google Maps key:", e); }
      finally { setApiKeyLoading(false); }
    };
    fetchKey();
  }, []);

  // Load Google Maps JS API and create map
  useEffect(() => {
    if (!apiKey) return;

    const initMap = () => {
      if (mapInstanceRef.current) {
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        trailLinesRef.current.forEach(l => l.setMap(null));
        trailLinesRef.current = [];
        mapListenersRef.current.forEach((listener) => (window as any).google?.maps?.event?.removeListener?.(listener));
        mapListenersRef.current = [];
        mapInstanceRef.current = null;
      }
      const google = (window as any).google;
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat, lng },
        zoom: initialEvent ? 16 : 14,
        mapTypeId: "satellite",
        tilt: 45,
        heading: 0,
        mapId: "WAROS_3D_MAP",
        disableDefaultUI: false,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        maxZoom: 21,
      });

      const syncMapState = () => {
        const center = map.getCenter();
        if (center) {
          setLat(center.lat());
          setLng(center.lng());
        }
        setZoomLevel(Math.round(map.getZoom() || 14));
      };

      mapListenersRef.current = [
        google.maps.event.addListener(map, "idle", syncMapState),
        google.maps.event.addListener(map, "zoom_changed", () => {
          setZoomLevel(Math.round(map.getZoom() || 14));
        }),
      ];

      syncMapState();
      mapInstanceRef.current = map;
    };

    if ((window as any).google?.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=visualization,marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => initMap();
    script.onerror = () => console.error("Failed to load Google Maps script");
    document.head.appendChild(script);
  }, [apiKey]);

  // Update map center when lat/lng changes
  useEffect(() => {
    if (mapInstanceRef.current) mapInstanceRef.current.panTo({ lat, lng });
  }, [lat, lng]);

  // Fetch Mapillary street-level imagery
  const activateMapillary = useCallback(async (targetLat: number, targetLng: number) => {
    setMapillaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mapillary", {
        body: { lat: targetLat, lng: targetLng, radius: 2000, limit: 10 },
      });
      if (!error && data?.images?.length > 0) {
        // Prefer panoramic images for immersive experience
        const pano = data.images.find((img: any) => img.is_pano);
        const best = pano || data.images[0];
        setMapillaryImageId(best.id);
        setMapillaryToken(data.token);
        setMapillaryActive(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Mapillary fetch error:", e);
      return false;
    } finally {
      setMapillaryLoading(false);
    }
  }, []);

  // Load Mapillary viewer script
  useEffect(() => {
    if (!mapillaryActive || !mapillaryImageId || !mapillaryToken) return;

    const loadViewer = () => {
      const container = document.getElementById("mapillary-viewer");
      if (!container) return;

      // Load Mapillary JS + CSS if not yet loaded
      if (!(window as any).mapillary) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.css";
        document.head.appendChild(css);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.js";
        script.onload = () => initViewer(container);
        document.head.appendChild(script);
      } else {
        initViewer(container);
      }
    };

    const initViewer = (container: HTMLElement) => {
      const { Viewer, NavigationDirection } = (window as any).mapillary;
      if (mapillaryViewerRef.current) {
        mapillaryViewerRef.current.remove();
      }
      const viewer = new Viewer({
        accessToken: mapillaryToken,
        container,
        imageId: mapillaryImageId,
        component: {
          cover: false,
          direction: true,
          sequence: true,
          zoom: true,
          bearing: true,
          cache: true,
          image: true,
          navigation: true,
          popup: true,
          spatial: true,
        },
      });
      // Allow walking/navigating between connected images
      viewer.on("image", (event: any) => {
        if (event.image?.id) {
          setMapillaryImageId(event.image.id);
        }
      });
      mapillaryViewerRef.current = viewer;
    };

    loadViewer();

    return () => {
      if (mapillaryViewerRef.current) {
        mapillaryViewerRef.current.remove();
        mapillaryViewerRef.current = null;
      }
    };
  }, [mapillaryActive, mapillaryImageId, mapillaryToken]);

  // Toggle Street View 360° with Mapillary fallback
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !apiKey) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (streetViewActive) {
      const currentZoom = map.getZoom?.() || 6;
      if (currentZoom < 12) {
        toast({ title: "Zoom In Required", description: "Please zoom into a city first (zoom 12+) to activate Street View. Use the preset buttons or zoom controls.", duration: 4000 });
        setStreetViewActive(false);
        return;
      }

      const center = map.getCenter?.();
      const targetLat = center?.lat?.() ?? lat;
      const targetLng = center?.lng?.() ?? lng;

      const svService = new google.maps.StreetViewService();
      svService.getPanorama({ location: { lat: targetLat, lng: targetLng }, radius: 5000 }, async (data: any, status: any) => {
        if (status === google.maps.StreetViewStatus.OK) {
          const sv = map.getStreetView();
          sv.setPosition(data.location.latLng);
          sv.setPov({ heading: 0, pitch: 0 });
          sv.setVisible(true);
          streetViewRef.current = sv;
          const listener = google.maps.event.addListener(sv, "visible_changed", () => {
            if (!sv.getVisible()) setStreetViewActive(false);
          });
          return () => google.maps.event.removeListener(listener);
        } else {
          // Fallback to Mapillary
          toast({ title: "Trying Mapillary…", description: "No Google Street View here. Searching Mapillary street-level imagery…", duration: 3000 });
          const found = await activateMapillary(targetLat, targetLng);
          if (!found) {
            toast({ title: "360° View Unavailable", description: `No street-level imagery near ${targetLat.toFixed(4)}°, ${targetLng.toFixed(4)}. Try a city center.`, duration: 4000 });
          }
          setStreetViewActive(false);
        }
      });
    } else {
      if (streetViewRef.current) {
        streetViewRef.current.setVisible(false);
        streetViewRef.current = null;
      }
    }
  }, [streetViewActive, lat, lng, apiKey, activateMapillary]);

  // ===== RENDER AIRCRAFT MARKERS =====
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (!showFlights || !showMarkers || interpolatedAircraft.length === 0) return;

    const newMarkers: any[] = [];
    interpolatedAircraft.forEach((ac) => {
      const isTracked = trackedAircraftId === ac.icao24;
      const isMil = ac.is_military;
      const color = isMil ? "#ef4444" : "#3b82f6";
      const size = isTracked ? 40 : 30;

      const marker = new google.maps.Marker({
        position: { lat: ac.lat, lng: ac.lng },
        map,
        icon: {
          url: createAircraftSvg(isMil, ac.heading, isTracked),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        },
        title: `${ac.callsign || ac.icao24} | ${ac.origin_country}`,
        zIndex: isTracked ? 200 : (isMil ? 100 : 50),
        optimized: false,
      });

      const altFt = Math.round(ac.altitude * 3.281);
      const speedKts = Math.round(ac.velocity * 1.944);
      const speedKmh = Math.round(ac.velocity * 3.6);
      const vsArrow = ac.vertical_rate > 0.5 ? "▲" : ac.vertical_rate < -0.5 ? "▼" : "—";
      const vsColor = ac.vertical_rate > 0.5 ? "#22c55e" : ac.vertical_rate < -0.5 ? "#ef4444" : "#888";

      const infoContent = `
        <div style="background:#0d1117;color:#e6edf3;padding:10px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10px;min-width:220px;border:1px solid ${color}40;box-shadow:0 4px 24px rgba(0,0,0,0.5);">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-weight:700;font-size:13px;color:${color};">
              ${isMil ? '🛩️' : '✈️'} ${ac.callsign || 'N/A'}
            </span>
            <span style="font-size:8px;padding:2px 6px;border-radius:4px;background:${color}20;color:${color};font-weight:600;">
              ${isMil ? 'MILITARY' : 'CIVIL'}
            </span>
          </div>
          ${ac.type || ac.registration ? `<div style="display:flex;gap:8px;margin-bottom:6px;font-size:9px;color:#7d8590;">
            ${ac.type ? `<span>✈ ${ac.type}</span>` : ''}
            ${ac.registration ? `<span>📋 ${ac.registration}</span>` : ''}
          </div>` : ''}
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;">
            <span style="color:#7d8590;">ICAO</span><span>${ac.icao24}</span>
            <span style="color:#7d8590;">ORIGIN</span><span>${ac.origin_country}</span>
            <span style="color:#7d8590;">ALT</span><span>${altFt.toLocaleString()} ft (${Math.round(ac.altitude)}m)</span>
            <span style="color:#7d8590;">SPEED</span><span>${speedKts} kts (${speedKmh} km/h)</span>
            <span style="color:#7d8590;">HDG</span><span>${Math.round(ac.heading)}°</span>
            <span style="color:#7d8590;">V/S</span><span style="color:${vsColor};">${vsArrow} ${ac.vertical_rate > 0 ? '+' : ''}${ac.vertical_rate.toFixed(1)} m/s</span>
            <span style="color:#7d8590;">POS</span><span>${ac.lat.toFixed(4)}°, ${ac.lng.toFixed(4)}°</span>
          </div>
          <div style="margin-top:8px;font-size:9px;color:${isTracked ? '#22c55e' : '#7d8590'};">
            ${isTracked ? '📡 TRACKING — click to stop' : '🖱️ Click to track'}
          </div>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });

      marker.addListener("click", () => {
        setTrackedAircraftId(prev => prev === ac.icao24 ? null : ac.icao24);
        setSelectedAircraft(selectedAircraft?.icao24 === ac.icao24 ? null : ac);
        infoWindow.open(map, marker);
      });

      marker.addListener("mouseover", () => infoWindow.open(map, marker));
      marker.addListener("mouseout", () => infoWindow.close());

      newMarkers.push(marker);
    });
    markersRef.current = newMarkers;
  }, [interpolatedAircraft, showFlights, showMarkers, trackedAircraftId]);

  // ===== RENDER FLIGHT ROUTES & TRAILS WITH ANIMATED DOTS =====
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    trailLinesRef.current.forEach(l => l.setMap(null));
    trailLinesRef.current = [];

    if (!showFlights || !showMarkers || !showTrails || interpolatedAircraft.length === 0) return;

    const newLines: any[] = [];
    interpolatedAircraft.forEach((ac) => {
      const history = trailHistoryRef.current[ac.icao24] || [];
      const isMil = ac.is_military;
      const isTracked = trackedAircraftId === ac.icao24;
      const color = isMil ? "#ef4444" : "#3b82f6";

      // Generate full route — uses trail history + projected backward path
      const routePath = generateProjectedRoute(ac, history);

      // Projected/old portion (animated dashed)
      if (routePath.length > 3) {
        const oldPortion = routePath.slice(0, -2);
        const fadedLine = new google.maps.Polyline({
          path: oldPortion,
          map,
          strokeColor: color,
          strokeOpacity: 0,
          strokeWeight: isTracked ? 2.5 : 1.5,
          geodesic: true,
          icons: [{
            icon: { path: "M 0,-1 0,1", strokeOpacity: isTracked ? 0.5 : 0.35, strokeColor: color, scale: isTracked ? 3 : 2 },
            offset: "0%",
            repeat: "12px",
          }],
        });
        newLines.push(fadedLine);
      }

      // Recent trail (animated dashed, brighter)
      const recentPath = routePath.slice(Math.max(0, routePath.length - 6));
      const recentLine = new google.maps.Polyline({
        path: recentPath,
        map,
        strokeColor: color,
        strokeOpacity: 0,
        strokeWeight: isTracked ? 3.5 : 2.5,
        geodesic: true,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: isTracked ? 0.9 : 0.65, strokeColor: color, scale: isTracked ? 3.5 : 2.5 },
          offset: "0%",
          repeat: "10px",
        }],
      });
      newLines.push(recentLine);

      // Forward prediction line — animated dotted
      const headingRad = ac.heading * Math.PI / 180;
      const speedKmh = ac.velocity * 3.6;
      const predMinutes = isTracked ? 5 : (isMil ? 3 : 2);
      const predDistKm = Math.max(speedKmh * (predMinutes / 60), 8);
      const predColor = isTracked ? "#22c55e" : (isMil ? "#f97316" : "#60a5fa");
      const predOpacity = isTracked ? 0.6 : (isMil ? 0.4 : 0.25);

      const fwdPoints = [{ lat: ac.lat, lng: ac.lng }];
      for (let step = 1; step <= 3; step++) {
        const d = (predDistKm * step / 3) / 111.32;
        fwdPoints.push({
          lat: ac.lat + Math.cos(headingRad) * d,
          lng: ac.lng + Math.sin(headingRad) * d / Math.cos(ac.lat * Math.PI / 180),
        });
      }

      const fwdLine = new google.maps.Polyline({
        path: fwdPoints,
        map,
        strokeColor: predColor,
        strokeOpacity: 0,
        strokeWeight: isTracked ? 2.5 : 1.5,
        geodesic: true,
        icons: [{
          icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: isTracked ? 3 : 2, strokeColor: predColor, strokeOpacity: predOpacity + 0.2 },
          offset: "100%",
        }, {
          icon: { path: "M 0,-1 0,1", strokeOpacity: predOpacity, strokeColor: predColor, scale: 2 },
          offset: "0%",
          repeat: isTracked ? "8px" : "12px",
        }],
      });
      newLines.push(fwdLine);
    });
    trailLinesRef.current = newLines;

    // Animate dash offset for flowing dot effect on Google Maps polylines
    let animOffset = 0;
    const animInterval = setInterval(() => {
      animOffset = (animOffset + 0.5) % 100;
      trailLinesRef.current.forEach(line => {
        const icons = line.get("icons");
        if (icons && icons.length > 0) {
          // Shift the first dash icon offset to create movement
          const updated = icons.map((ic: any, idx: number) => {
            if (idx === 0 || (icons.length === 2 && idx === 1)) {
              return { ...ic, offset: `${animOffset}%` };
            }
            return ic;
          });
          line.set("icons", updated);
        }
      });
    }, 80);

    return () => clearInterval(animInterval);
  }, [interpolatedAircraft, showFlights, showMarkers, showTrails, trackedAircraftId]);

  // ===== HEATMAP LAYER =====
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps?.visualization) return;

    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setMap(null);
      heatmapLayerRef.current = null;
    }

    if (!showHeatmap || conflictPoints.length === 0) return;

    const heatmapData = conflictPoints.map(pt => ({
      location: new google.maps.LatLng(pt.lat, pt.lng),
      weight: pt.severity,
    }));

    heatmapLayerRef.current = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map,
      radius: 40,
      opacity: opacityHeatmap,
      gradient: [
        "rgba(0,0,0,0)",
        "rgba(251,191,36,0.4)",
        "rgba(251,146,36,0.6)",
        "rgba(239,68,68,0.7)",
        "rgba(239,68,68,0.9)",
      ],
    });
  }, [conflictPoints, showHeatmap]);

  // ===== REAL-TIME VESSEL LAYER (Live AIS API) =====
  useEffect(() => {
    const fetchVessels = async () => {
      try {
        const map = mapInstanceRef.current;
        let bbox: any;
        if (map) {
          const bounds = map.getBounds();
          if (bounds) {
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            bbox = { lamin: sw.lat(), lamax: ne.lat(), lomin: sw.lng(), lomax: ne.lng() };
          }
        }
        if (!bbox) bbox = { lamin: lat - 10, lamax: lat + 10, lomin: lng - 15, lomax: lng + 15 };

        // Try live AIS API first
        const { data, error } = await supabase.functions.invoke("ais-vessels", { body: bbox });
        if (!error && data?.vessels && data.vessels.length > 0) {
          const seaSafe = sanitizeVesselsToWater(data.vessels);
          setVessels(seaSafe);
          setVesselSource(data.source || "live");
        } else {
          // Fallback to DB
          const { data: dbData } = await supabase.from("vessels").select("*");
          if (dbData && dbData.length > 0) {
            const seaSafe = sanitizeVesselsToWater(dbData);
            setVessels(seaSafe);
            setVesselSource("database");
          }
        }
      } catch (e) {
        console.error("Vessel fetch error:", e);
        // DB fallback
        const { data: dbData } = await supabase.from("vessels").select("*");
        if (dbData) {
          const seaSafe = sanitizeVesselsToWater(dbData);
          setVessels(seaSafe);
          setVesselSource("database");
        }
      }
    };
    fetchVessels();
    const iv = setInterval(fetchVessels, 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    vesselMarkersRef.current.forEach(m => m.setMap(null));
    vesselMarkersRef.current = [];

    if (!showVessels || vessels.length === 0) return;

    const typeColors: Record<string, string> = { MILITARY: "#ef4444", CARGO: "#3b82f6", TANKER: "#f59e0b", FISHING: "#22c55e", UNKNOWN: "#9ca3af" };

    vessels.forEach((v: any) => {
      const color = typeColors[v.type] || "#9ca3af";
      const isMil = v.type === "MILITARY";
      const size = isMil ? 28 : 22;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>`;

      const marker = new google.maps.Marker({
        position: { lat: v.lat, lng: v.lng },
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        },
        zIndex: isMil ? 80 : 40,
      });

      vesselMarkersRef.current.push(marker);
    });
  }, [vessels, showVessels]);

  // ===== REAL-TIME EARTHQUAKE LAYER =====
  useEffect(() => {
    const fetchQuakes = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("usgs-earthquakes");
        if (!error && data?.earthquakes) setEarthquakes(data.earthquakes);
      } catch (e) { console.error("Earthquake fetch error:", e); }
    };
    fetchQuakes();
    const iv = setInterval(fetchQuakes, 300_000); // 5 min
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    earthquakeMarkersRef.current.forEach(m => m.setMap(null));
    earthquakeMarkersRef.current = [];

    if (!showEarthquakes || earthquakes.length === 0) return;

    earthquakes.forEach((eq: any) => {
      const mag = eq.magnitude || 0;
      const size = Math.max(16, Math.min(mag * 8, 48));
      const color = mag >= 6 ? "#ef4444" : mag >= 4.5 ? "#f59e0b" : mag >= 3 ? "#eab308" : "#22c55e";
      const pulseSize = size + 10;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pulseSize}" height="${pulseSize}" viewBox="0 0 ${pulseSize} ${pulseSize}">
        <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="${size/2}" fill="${color}40" stroke="${color}" stroke-width="2">
          <animate attributeName="r" values="${size/2};${pulseSize/2};${size/2}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${pulseSize/2}" cy="${pulseSize/2}" r="${size/4}" fill="${color}"/>
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: eq.lat, lng: eq.lng },
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(pulseSize, pulseSize),
          anchor: new google.maps.Point(pulseSize / 2, pulseSize / 2),
        },
        title: `M${mag.toFixed(1)} — ${eq.place}`,
        zIndex: 60,
      });

      const timeAgo = eq.time ? new Date(eq.time).toLocaleString() : "Unknown";
      const infoContent = `
        <div style="background:#0d1117;color:#e6edf3;padding:10px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10px;min-width:200px;border:1px solid ${color}40;box-shadow:0 4px 24px rgba(0,0,0,0.5);">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-weight:700;font-size:14px;color:${color};">🔴 M${mag.toFixed(1)}</span>
            ${eq.tsunami ? '<span style="font-size:8px;padding:2px 6px;border-radius:4px;background:#ef444420;color:#ef4444;font-weight:600;">⚠️ TSUNAMI</span>' : ''}
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;">
            <span style="color:#7d8590;">PLACE</span><span>${eq.place}</span>
            <span style="color:#7d8590;">DEPTH</span><span>${eq.depth?.toFixed(1) || "?"} km</span>
            <span style="color:#7d8590;">TIME</span><span>${timeAgo}</span>
            <span style="color:#7d8590;">FELT</span><span>${eq.felt || "N/A"} reports</span>
          </div>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("mouseover", () => infoWindow.open(map, marker));
      marker.addListener("mouseout", () => infoWindow.close());
      marker.addListener("click", () => { if (eq.url) window.open(eq.url, "_blank"); });

      earthquakeMarkersRef.current.push(marker);
    });
  }, [earthquakes, showEarthquakes]);

  // ===== TRAFFIC LAYER =====
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
      trafficLayerRef.current = null;
    }

    if (showTraffic) {
      trafficLayerRef.current = new google.maps.TrafficLayer();
      trafficLayerRef.current.setMap(map);
    }
  }, [showTraffic]);

  // ===== LIVE CAMERA LAYER =====
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const { data, error } = await supabase.from("cameras").select("*").eq("is_active", true);
        if (!error && data) setCameras(data);
      } catch (e) { console.error("Camera fetch error:", e); }
    };
    fetchCameras();
    const iv = setInterval(fetchCameras, 120_000);
    return () => clearInterval(iv);
  }, []);

  // Render camera markers on map — glowing camera icons visible at city zoom
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    cameraMarkersRef.current.forEach(m => m.setMap(null));
    cameraMarkersRef.current = [];

    if (!showCameras || cameras.length === 0) return;

    // Only show camera icons when zoomed to city level (12+)
    if (zoomLevel < 10) return;

    const catColors: Record<string, string> = {
      traffic: "#10b981", tourism: "#8b5cf6", ports: "#3b82f6", weather: "#06b6d4", public: "#f59e0b",
    };

    const sizeBase = Math.min(48, Math.max(28, (zoomLevel - 10) * 6 + 28));

    cameras.forEach((cam) => {
      const color = catColors[cam.category] || "#f59e0b";
      const s = sizeBase;
      const c = s / 2;
      // Glowing camera icon SVG
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
        <defs>
          <filter id="camglow_${cam.id?.slice(0,4)}">
            <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${color}" flood-opacity="0.8"/>
          </filter>
          <radialGradient id="camgrad_${cam.id?.slice(0,4)}" cx="50%" cy="50%">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <!-- Outer glow pulse -->
        <circle cx="${c}" cy="${c}" r="${c - 2}" fill="url(#camgrad_${cam.id?.slice(0,4)})">
          <animate attributeName="r" values="${c - 4};${c};${c - 4}" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <!-- Scan ring -->
        <circle cx="${c}" cy="${c}" r="${c * 0.6}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5" stroke-dasharray="3 2">
          <animateTransform attributeName="transform" type="rotate" from="0 ${c} ${c}" to="360 ${c} ${c}" dur="6s" repeatCount="indefinite"/>
        </circle>
        <!-- Camera body -->
        <g filter="url(#camglow_${cam.id?.slice(0,4)})">
          <rect x="${c - s*0.22}" y="${c - s*0.15}" width="${s*0.35}" height="${s*0.25}" rx="2" fill="${color}" opacity="0.9"/>
          <polygon points="${c + s*0.13},${c - s*0.08} ${c + s*0.25},${c - s*0.16} ${c + s*0.25},${c + s*0.08} ${c + s*0.13},${c + s*0.02}" fill="${color}" opacity="0.85"/>
          <circle cx="${c - s*0.06}" cy="${c - s*0.02}" r="${s*0.06}" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <circle cx="${c - s*0.06}" cy="${c - s*0.02}" r="${s*0.025}" fill="white" opacity="0.9"/>
        </g>
        <!-- LIVE badge -->
        <rect x="${c - s*0.18}" y="${c + s*0.18}" width="${s*0.36}" height="${s*0.12}" rx="2" fill="#ef4444" opacity="0.9"/>
        <text x="${c}" y="${c + s*0.27}" text-anchor="middle" font-family="monospace" font-size="${s*0.08}" font-weight="bold" fill="white">LIVE</text>
        <!-- Recording dot -->
        <circle cx="${c + s*0.22}" cy="${c + s*0.24}" r="${s*0.025}" fill="#ef4444">
          <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: cam.lat, lng: cam.lng },
        map,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(s, s),
          anchor: new google.maps.Point(c, c),
        },
        title: `📹 ${cam.name} (${cam.city}, ${cam.country})`,
        zIndex: 120,
        optimized: false,
      });

      const infoContent = `
        <div style="background:#0d1117;color:#e6edf3;padding:12px 16px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:10px;min-width:240px;border:1px solid ${color}60;box-shadow:0 0 30px ${color}30,0 8px 32px rgba(0,0,0,0.6);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse 1s infinite;"></div>
            <span style="font-weight:700;font-size:13px;color:${color};">${cam.name}</span>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;">
            <span style="color:#7d8590;">📍 CITY</span><span>${cam.city}, ${cam.country}</span>
            <span style="color:#7d8590;">📷 TYPE</span><span style="text-transform:uppercase;color:${color};font-weight:600;">${cam.category}</span>
            <span style="color:#7d8590;">📡 STATUS</span><span style="color:${cam.status === 'active' ? '#22c55e' : '#ef4444'};font-weight:600;">${cam.status?.toUpperCase() || 'ACTIVE'}</span>
            <span style="color:#7d8590;">🔗 SOURCE</span><span>${cam.source_name || 'Public'}</span>
          </div>
          <div style="margin-top:10px;padding:6px;background:${color}15;border:1px solid ${color}30;border-radius:6px;text-align:center;">
            <span style="font-size:11px;color:${color};font-weight:700;cursor:pointer;">▶ TAP TO VIEW LIVE FEED</span>
          </div>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("mouseover", () => infoWindow.open(map, marker));
      marker.addListener("mouseout", () => infoWindow.close());
      marker.addListener("click", () => {
        setActiveCameraFeed(cam);
        infoWindow.close();
      });

      cameraMarkersRef.current.push(marker);
    });
  }, [cameras, showCameras, zoomLevel]);

  // ===== AI OBJECT DETECTION SIMULATION =====
  useEffect(() => {
    if (!activeCameraFeed && !streetViewActive && !mapillaryActive) {
      setAiDetections([]);
      if (aiDetectionIntervalRef.current) clearInterval(aiDetectionIntervalRef.current);
      return;
    }
    if (!showAIDetection) { setAiDetections([]); return; }

    const objectTypes = [
      { label: "Vehicle", color: "#22c55e", minW: 8, maxW: 18, minH: 5, maxH: 12 },
      { label: "Person", color: "#3b82f6", minW: 3, maxW: 7, minH: 6, maxH: 14 },
      { label: "Truck", color: "#f59e0b", minW: 12, maxW: 22, minH: 6, maxH: 14 },
      { label: "Bus", color: "#8b5cf6", minW: 14, maxW: 24, minH: 5, maxH: 12 },
      { label: "Bicycle", color: "#06b6d4", minW: 3, maxW: 6, minH: 4, maxH: 8 },
      { label: "Military Vehicle", color: "#ef4444", minW: 10, maxW: 20, minH: 6, maxH: 14 },
      { label: "Building", color: "#64748b", minW: 15, maxW: 30, minH: 20, maxH: 40 },
      { label: "Drone", color: "#f43f5e", minW: 2, maxW: 5, minH: 2, maxH: 4 },
    ];

    const generateDetections = () => {
      const count = Math.floor(Math.random() * 8) + 3;
      const dets = [];
      for (let i = 0; i < count; i++) {
        const type = objectTypes[Math.floor(Math.random() * objectTypes.length)];
        const w = type.minW + Math.random() * (type.maxW - type.minW);
        const h = type.minH + Math.random() * (type.maxH - type.minH);
        dets.push({
          id: `det-${i}-${Date.now()}`,
          label: type.label,
          confidence: 0.65 + Math.random() * 0.33,
          x: 5 + Math.random() * (85 - w),
          y: 10 + Math.random() * (80 - h),
          w, h,
          color: type.color,
        });
      }
      setAiDetections(dets);
    };

    generateDetections();
    aiDetectionIntervalRef.current = setInterval(generateDetections, 4000);
    return () => { if (aiDetectionIntervalRef.current) clearInterval(aiDetectionIntervalRef.current); };
  }, [activeCameraFeed, streetViewActive, mapillaryActive, showAIDetection]);

  // ===== WALKING EXPERIENCE — track path during Mapillary =====
  useEffect(() => {
    if (!mapillaryActive) {
      setWalkingPath([]);
      setWalkingSteps(0);
      return;
    }
    // Track position changes
    setWalkingPath(prev => {
      const last = prev[prev.length - 1];
      if (!last || Math.abs(last.lat - lat) > 0.0001 || Math.abs(last.lng - lng) > 0.0001) {
        return [...prev.slice(-50), { lat, lng }];
      }
      return prev;
    });
    setWalkingSteps(prev => prev + 1);
  }, [mapillaryActive, lat, lng]);

  // ===== CITY INTEL HUD =====
  useEffect(() => {
    if (!streetViewActive && !mapillaryActive) {
      setCityIntel(null);
      return;
    }
    const fetchCityIntel = async () => {
      const nearbyCams = cameras.filter(c => Math.abs(c.lat - lat) < 0.5 && Math.abs(c.lng - lng) < 0.5).length;
      const nearbyAlerts = nearbyIntel.alerts.length;
      setCityIntel({
        cameras: nearbyCams,
        alerts: nearbyAlerts,
        traffic: showTraffic ? "Active" : "Off",
      });
    };
    fetchCityIntel();
  }, [streetViewActive, mapillaryActive, lat, lng, cameras, nearbyIntel, showTraffic]);


  // ===== REAL-TIME ROCKET/MISSILE LAYER =====
  useEffect(() => {
    const fetchRockets = async () => {
      try {
        const { data, error } = await supabase.from("rockets").select("*");
        if (!error && data) setRockets(data);
      } catch (e) { console.error("Rocket fetch error:", e); }
    };
    fetchRockets();
    const iv = setInterval(fetchRockets, 10_000); // 10s refresh
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    // Cleanup previous
    rocketMarkersRef.current.forEach(m => m.setMap(null));
    rocketMarkersRef.current = [];
    rocketLinesRef.current.forEach(l => l.setMap(null));
    rocketLinesRef.current = [];

    if (!showRockets || rockets.length === 0) return;

    const statusColors: Record<string, string> = {
      launched: "#ff6b00", in_flight: "#ef4444", intercepted: "#22c55e", impact: "#ff0000",
    };

    rockets.forEach((rkt: any) => {
      const color = statusColors[rkt.status] || "#ef4444";
      const isActive = rkt.status === "launched" || rkt.status === "in_flight";

      // Dashed trajectory line (origin → target)
      const trajectoryLine = new google.maps.Polyline({
        path: [
          { lat: rkt.origin_lat, lng: rkt.origin_lng },
          { lat: rkt.target_lat, lng: rkt.target_lng },
        ],
        strokeColor: color,
        strokeOpacity: 0.35,
        strokeWeight: 2,
        map,
        geodesic: true,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeWeight: 2, scale: 3 },
          offset: "0", repeat: "15px",
        }],
      });
      rocketLinesRef.current.push(trajectoryLine);

      // Active flight path (origin → current)
      if (isActive) {
        const flightPath = new google.maps.Polyline({
          path: [
            { lat: rkt.origin_lat, lng: rkt.origin_lng },
            { lat: rkt.current_lat, lng: rkt.current_lng },
          ],
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: 3,
          map,
          geodesic: true,
        });
        rocketLinesRef.current.push(flightPath);
      }

      // Origin marker (small circle)
      const originMarker = new google.maps.Marker({
        position: { lat: rkt.origin_lat, lng: rkt.origin_lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: color,
          fillOpacity: 0.6,
          strokeColor: color,
          strokeWeight: 1,
        },
        zIndex: 90,
      });
      rocketMarkersRef.current.push(originMarker);

      // Target marker (crosshair circle)
      const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 3" opacity="0.6">
          ${isActive ? '<animate attributeName="r" values="8;11;8" dur="1.5s" repeatCount="indefinite"/>' : ''}
        </circle>
        <line x1="12" y1="2" x2="12" y2="8" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <line x1="12" y1="16" x2="12" y2="22" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <line x1="2" y1="12" x2="8" y2="12" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <line x1="16" y1="12" x2="22" y2="12" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
      </svg>`;
      const targetMarker = new google.maps.Marker({
        position: { lat: rkt.target_lat, lng: rkt.target_lng },
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(targetSvg),
          scaledSize: new google.maps.Size(24, 24),
          anchor: new google.maps.Point(12, 12),
        },
        zIndex: 85,
      });
      rocketMarkersRef.current.push(targetMarker);

      // Current position marker (rocket icon with pulse)
      const rocketSize = isActive ? 32 : 24;
      const rocketSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rocketSize}" height="${rocketSize}" viewBox="0 0 ${rocketSize} ${rocketSize}">
        ${isActive ? `<circle cx="${rocketSize/2}" cy="${rocketSize/2}" r="${rocketSize/2 - 2}" fill="${color}" opacity="0.2">
          <animate attributeName="r" values="${rocketSize/2 - 4};${rocketSize/2};${rocketSize/2 - 4}" dur="1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1s" repeatCount="indefinite"/>
        </circle>` : ''}
        <text x="${rocketSize/2}" y="${rocketSize/2 + 5}" text-anchor="middle" font-size="${isActive ? 18 : 14}">🚀</text>
      </svg>`;

      const rocketMarker = new google.maps.Marker({
        position: { lat: rkt.current_lat, lng: rkt.current_lng },
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(rocketSvg),
          scaledSize: new google.maps.Size(rocketSize, rocketSize),
          anchor: new google.maps.Point(rocketSize / 2, rocketSize / 2),
        },
        zIndex: isActive ? 150 : 70,
      });

      const statusLabel = rkt.status.toUpperCase();
      const statusEmoji = rkt.status === "intercepted" ? "🛡️" : rkt.status === "impact" ? "💥" : "🚀";
      const infoContent = `
        <div style="background:#0d1117;color:#e6edf3;padding:10px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10px;min-width:220px;border:1px solid ${color}40;box-shadow:0 4px 24px rgba(0,0,0,0.5);">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-weight:700;font-size:13px;color:${color};">${statusEmoji} ${rkt.name}</span>
            <span style="font-size:8px;padding:2px 6px;border-radius:4px;background:${color}20;color:${color};font-weight:600;">${rkt.type}</span>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;">
            <span style="color:#7d8590;">STATUS</span><span style="color:${color};font-weight:700;">${statusLabel}</span>
            <span style="color:#7d8590;">SPEED</span><span>${rkt.speed?.toLocaleString() || 0} km/h</span>
            <span style="color:#7d8590;">ALT</span><span>${rkt.altitude || 0} km</span>
            <span style="color:#7d8590;">SEVERITY</span><span style="color:${rkt.severity === 'critical' ? '#ef4444' : '#ff6b00'};font-weight:600;">${(rkt.severity || 'high').toUpperCase()}</span>
          </div>
          <div style="margin-top:6px;font-size:9px;color:#7d8590;">${new Date(rkt.timestamp).toLocaleString()}</div>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      rocketMarker.addListener("mouseover", () => infoWindow.open(map, rocketMarker));
      rocketMarker.addListener("mouseout", () => infoWindow.close());

      rocketMarkersRef.current.push(rocketMarker);
    });
  }, [rockets, showRockets]);

  // ===== CITY LANDMARK MARKERS =====
  const CITY_LANDMARKS_3D = [
    { name: "Tehran", lat: 35.69, lng: 51.39, country: "Iran", landmark: "Azadi Tower", image: "https://images.unsplash.com/photo-1573225935973-40b81e22e6e3?w=320&h=200&fit=crop", pop: "9.1M" },
    { name: "Isfahan", lat: 32.65, lng: 51.68, country: "Iran", landmark: "Naqsh-e Jahan Square", image: "https://images.unsplash.com/photo-1565447786498-aa4c35d2aa6b?w=320&h=200&fit=crop", pop: "2.2M" },
    { name: "Shiraz", lat: 29.59, lng: 52.58, country: "Iran", landmark: "Nasir al-Mulk Mosque", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "1.9M" },
    { name: "Tabriz", lat: 38.08, lng: 46.29, country: "Iran", landmark: "Tabriz Grand Bazaar", image: "https://images.unsplash.com/photo-1590595978583-3967cf17d2ea?w=320&h=200&fit=crop", pop: "1.8M" },
    { name: "Mashhad", lat: 36.3, lng: 59.6, country: "Iran", landmark: "Imam Reza Shrine", image: "https://images.unsplash.com/photo-1580834341580-8c17a3a630c1?w=320&h=200&fit=crop", pop: "3.4M" },
    { name: "Kerman", lat: 30.28, lng: 57.08, country: "Iran", landmark: "Ganjali Khan Complex", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "738K" },
    { name: "Yazd", lat: 31.9, lng: 54.37, country: "Iran", landmark: "Tower of Silence", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "530K" },
    { name: "Amman", lat: 31.95, lng: 35.93, country: "Jordan", landmark: "Roman Theatre", image: "https://images.unsplash.com/photo-1580834341580-8c17a3a630c1?w=320&h=200&fit=crop", pop: "4.1M" },
    { name: "Petra (Wadi Musa)", lat: 30.33, lng: 35.44, country: "Jordan", landmark: "The Treasury", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "35K" },
    { name: "Aqaba", lat: 29.53, lng: 35.01, country: "Jordan", landmark: "Red Sea Port", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "188K" },
    { name: "Irbid", lat: 32.56, lng: 35.85, country: "Jordan", landmark: "Yarmouk University", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "500K" },
    { name: "Zarqa", lat: 32.07, lng: 36.09, country: "Jordan", landmark: "Industrial Hub", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "635K" },
    { name: "Jerash", lat: 32.27, lng: 35.89, country: "Jordan", landmark: "Roman Ruins of Gerasa", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "50K" },
    { name: "Madaba", lat: 31.72, lng: 35.79, country: "Jordan", landmark: "Mosaic Map of Holy Land", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "83K" },
    { name: "Salt", lat: 32.04, lng: 35.73, country: "Jordan", landmark: "Ottoman Architecture", image: "https://images.unsplash.com/photo-1580834341580-8c17a3a630c1?w=320&h=200&fit=crop", pop: "97K" },
    { name: "Karak", lat: 31.18, lng: 35.70, country: "Jordan", landmark: "Karak Castle", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "68K" },
    { name: "Mafraq", lat: 32.34, lng: 36.21, country: "Jordan", landmark: "Northern Gateway", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "57K" },
    { name: "Tafilah", lat: 30.84, lng: 35.60, country: "Jordan", landmark: "Dana Nature Reserve", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "33K" },
    { name: "Ma'an", lat: 30.20, lng: 35.73, country: "Jordan", landmark: "Gateway to Petra", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "41K" },
    { name: "Ajloun", lat: 32.33, lng: 35.75, country: "Jordan", landmark: "Ajloun Castle", image: "https://images.unsplash.com/photo-1564399580075-5dfe19c205f0?w=320&h=200&fit=crop", pop: "42K" },
    { name: "Wadi Rum", lat: 29.57, lng: 35.42, country: "Jordan", landmark: "Valley of the Moon", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "—" },
    { name: "Umm Qais", lat: 32.65, lng: 35.68, country: "Jordan", landmark: "Gadara Ruins", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "—" },
    { name: "Sweimeh (Dead Sea)", lat: 31.72, lng: 35.59, country: "Jordan", landmark: "Dead Sea Resorts", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "—" },
    { name: "Russeifa", lat: 32.01, lng: 36.05, country: "Jordan", landmark: "Eastern Amman Suburb", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "350K" },
    { name: "Aqaba Port", lat: 29.52, lng: 35.01, country: "Jordan", landmark: "Red Sea Gateway", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "—" },
    { name: "Jerusalem", lat: 31.77, lng: 35.23, country: "Israel/Palestine", landmark: "Dome of the Rock", image: "https://images.unsplash.com/photo-1547483238-2cbf881a559f?w=320&h=200&fit=crop", pop: "936K" },
    { name: "Tel Aviv", lat: 32.08, lng: 34.78, country: "Israel", landmark: "White City", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "460K" },
    { name: "Dubai", lat: 25.2, lng: 55.27, country: "UAE", landmark: "Burj Khalifa", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=320&h=200&fit=crop", pop: "3.5M" },
    { name: "Abu Dhabi", lat: 24.45, lng: 54.38, country: "UAE", landmark: "Sheikh Zayed Mosque", image: "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=320&h=200&fit=crop", pop: "1.5M" },
    { name: "Sharjah", lat: 25.34, lng: 55.39, country: "UAE", landmark: "Al Majaz Waterfront", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "1.4M" },
    { name: "Ajman", lat: 25.41, lng: 55.44, country: "UAE", landmark: "Ajman Corniche", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "504K" },
    { name: "Ras Al Khaimah", lat: 25.79, lng: 55.97, country: "UAE", landmark: "Jebel Jais", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "345K" },
    { name: "Fujairah", lat: 25.13, lng: 56.33, country: "UAE", landmark: "Fujairah Fort", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "225K" },
    { name: "Umm Al Quwain", lat: 25.56, lng: 55.55, country: "UAE", landmark: "UAQ Fort", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "72K" },
    { name: "Al Ain", lat: 24.22, lng: 55.76, country: "UAE", landmark: "Jebel Hafeet", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "766K" },
    { name: "Manama", lat: 26.07, lng: 50.55, country: "Bahrain", landmark: "World Trade Center", image: "https://images.unsplash.com/photo-1580745482925-d3806a527cec?w=320&h=200&fit=crop", pop: "411K" },
    { name: "Kuwait City", lat: 29.38, lng: 47.99, country: "Kuwait", landmark: "Kuwait Towers", image: "https://images.unsplash.com/photo-1568816132a-27b5c4caa97a?w=320&h=200&fit=crop", pop: "3.1M" },
    { name: "Doha", lat: 25.29, lng: 51.53, country: "Qatar", landmark: "Museum of Islamic Art", image: "https://images.unsplash.com/photo-1548017544-240c59b4ae3c?w=320&h=200&fit=crop", pop: "1.2M" },
    { name: "Muscat", lat: 23.59, lng: 58.59, country: "Oman", landmark: "Sultan Qaboos Mosque", image: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=320&h=200&fit=crop", pop: "1.4M" },
    { name: "Baghdad", lat: 33.31, lng: 44.37, country: "Iraq", landmark: "Al-Shaheed Monument", image: "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?w=320&h=200&fit=crop", pop: "8.1M" },
    { name: "Erbil", lat: 36.19, lng: 44.01, country: "Iraq", landmark: "Erbil Citadel", image: "https://images.unsplash.com/photo-1601918774946-7c269a6be31a?w=320&h=200&fit=crop", pop: "880K" },
    { name: "Basra", lat: 30.51, lng: 47.78, country: "Iraq", landmark: "Shatt al-Arab", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "2.1M" },
    { name: "Riyadh", lat: 24.71, lng: 46.67, country: "Saudi Arabia", landmark: "Kingdom Centre", image: "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=320&h=200&fit=crop", pop: "7.6M" },
    { name: "Mecca", lat: 21.43, lng: 39.83, country: "Saudi Arabia", landmark: "Masjid al-Haram", image: "https://images.unsplash.com/photo-1591604129939-f1efa4d99f7e?w=320&h=200&fit=crop", pop: "2.4M" },
    { name: "Medina", lat: 24.47, lng: 39.61, country: "Saudi Arabia", landmark: "Al-Masjid an-Nabawi", image: "https://images.unsplash.com/photo-1542816417-0983c9c7ad7c?w=320&h=200&fit=crop", pop: "1.5M" },
    { name: "Jeddah", lat: 21.54, lng: 39.17, country: "Saudi Arabia", landmark: "King Fahd Fountain", image: "https://images.unsplash.com/photo-1587974928442-77dc3e0748b1?w=320&h=200&fit=crop", pop: "4.7M" },
    { name: "Beirut", lat: 33.89, lng: 35.5, country: "Lebanon", landmark: "Pigeon Rocks", image: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=320&h=200&fit=crop", pop: "2.4M" },
    { name: "Damascus", lat: 33.51, lng: 36.29, country: "Syria", landmark: "Umayyad Mosque", image: "https://images.unsplash.com/photo-1566236297412-60a3c6883482?w=320&h=200&fit=crop", pop: "2.5M" },
    { name: "Aleppo", lat: 36.2, lng: 37.16, country: "Syria", landmark: "Citadel of Aleppo", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "1.9M" },
    { name: "Cairo", lat: 30.04, lng: 31.24, country: "Egypt", landmark: "Pyramids of Giza", image: "https://images.unsplash.com/photo-1539768942893-daf53e736495?w=320&h=200&fit=crop", pop: "21M" },
    { name: "Sana'a", lat: 15.37, lng: 44.19, country: "Yemen", landmark: "Old City", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=320&h=200&fit=crop", pop: "4M" },
    { name: "Aden", lat: 12.78, lng: 45.04, country: "Yemen", landmark: "Aden Harbor", image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=320&h=200&fit=crop", pop: "1.0M" },
    { name: "Ankara", lat: 39.93, lng: 32.86, country: "Turkey", landmark: "Anıtkabir", image: "https://images.unsplash.com/photo-1589254065878-42c014f2d4d6?w=320&h=200&fit=crop", pop: "5.7M" },
    { name: "Istanbul", lat: 41.01, lng: 28.98, country: "Turkey", landmark: "Hagia Sophia", image: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=320&h=200&fit=crop", pop: "15.8M" },
  ];

  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    // Cleanup previous
    cityMarkersRef.current.forEach(m => m.setMap(null));
    cityMarkersRef.current = [];
    if (cityInfoWindowRef.current) { cityInfoWindowRef.current.close(); cityInfoWindowRef.current = null; }

    if (!showCities) return;

    const cityIcon = (name: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24" viewBox="0 0 120 24">
        <rect x="0" y="0" width="120" height="24" rx="6" fill="rgba(0,12,24,0.85)" stroke="rgba(0,220,255,0.4)" stroke-width="1"/>
        <circle cx="12" cy="12" r="4" fill="#00dcff" opacity="0.9">
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite"/>
        </circle>
        <text x="22" y="16" font-family="monospace" font-size="10" font-weight="bold" fill="#00dcff">${name}</text>
      </svg>`;
      return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    };

    CITY_LANDMARKS_3D.forEach(city => {
      const marker = new google.maps.Marker({
        position: { lat: city.lat, lng: city.lng },
        map,
        icon: {
          url: cityIcon(city.name),
          scaledSize: new google.maps.Size(120, 24),
          anchor: new google.maps.Point(0, 12),
        },
        zIndex: 60,
        title: city.name,
      });

      const infoContent = `
        <div style="font-family:'SF Mono',monospace;width:220px;background:#0a0e14;border:1px solid rgba(0,220,255,0.3);border-radius:8px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6);">
          <div style="position:relative;height:120px;overflow:hidden;">
            <img src="${city.image}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.height='0'" />
            <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(10,14,20,0.9),transparent 60%);"></div>
            <div style="position:absolute;bottom:6px;left:8px;right:8px;">
              <div style="font-size:12px;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.8);">${city.landmark}</div>
              <div style="font-size:9px;color:rgba(255,255,255,0.6);">${city.name}, ${city.country}</div>
            </div>
          </div>
          <div style="padding:6px 8px;display:flex;gap:12px;border-top:1px solid rgba(0,220,255,0.15);">
            <div>
              <div style="font-size:7px;color:rgba(0,220,255,0.5);text-transform:uppercase;letter-spacing:0.1em;">Population</div>
              <div style="font-size:10px;color:#00dcff;font-weight:700;">${city.pop}</div>
            </div>
            <div>
              <div style="font-size:7px;color:rgba(0,220,255,0.5);text-transform:uppercase;letter-spacing:0.1em;">Coords</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.6);">${city.lat.toFixed(2)}°, ${city.lng.toFixed(2)}°</div>
            </div>
          </div>
        </div>`;

      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("click", () => {
        if (cityInfoWindowRef.current) cityInfoWindowRef.current.close();
        infoWindow.open(map, marker);
        cityInfoWindowRef.current = infoWindow;
      });

      cityMarkersRef.current.push(marker);
    });
  }, [showCities]);


  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    if (weatherOverlayRef.current) {
      map.overlayMapTypes.forEach((_: any, i: number) => {
        if (map.overlayMapTypes.getAt(i) === weatherOverlayRef.current) {
          map.overlayMapTypes.removeAt(i);
        }
      });
      weatherOverlayRef.current = null;
    }

    if (showWeather) {
      const weatherTileType = new google.maps.ImageMapType({
        getTileUrl: (coord: any, zoom: number) =>
          `https://tile.openweathermap.org/map/precipitation_new/${zoom}/${coord.x}/${coord.y}.png?appid=b1b15e88fa797225412429c1c50c122a1`,
        tileSize: new google.maps.Size(256, 256),
        opacity: opacityWeather,
        name: "Weather",
      });
      map.overlayMapTypes.push(weatherTileType);
      weatherOverlayRef.current = weatherTileType;
    }
  }, [showWeather]);


  // ===== FETCH WEATHER DATA FOR CITY MARKERS =====
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("weather-data");
        if (!error && data?.weather) setWeatherData(data.weather);
      } catch (e) { console.error("3D weather fetch:", e); }
    };
    fetchWeather();
    const iv = setInterval(fetchWeather, 5 * 60_000);
    return () => clearInterval(iv);
  }, []);

  // ===== WEATHER CITY MARKERS ON 3D MAP =====
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps) return;

    weatherMarkersRef.current.forEach(m => m.setMap(null));
    weatherMarkersRef.current = [];

    if (!showWeather || weatherData.length === 0) return;

    const condEmoji: Record<string, string> = { Clear: "☀️", Clouds: "☁️", Rain: "🌧️", Thunderstorm: "⛈️", Dust: "🌪️", Haze: "🌫️", Mist: "🌫️", Snow: "❄️", Drizzle: "🌦️" };

    weatherData.forEach((w: any) => {
      const emoji = condEmoji[w.condition] || "🌤️";
      const tempColor = w.temp >= 40 ? "#ef4444" : w.temp >= 30 ? "#f97316" : w.temp >= 20 ? "#eab308" : w.temp >= 10 ? "#06b6d4" : "#3b82f6";
      const size = 40;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="28" viewBox="0 0 ${size} 28">
        <rect x="0" y="0" width="${size}" height="28" rx="6" fill="rgba(0,0,0,0.85)" stroke="${tempColor}" stroke-width="1" stroke-opacity="0.4"/>
        <text x="12" y="18" font-size="11" font-family="monospace" font-weight="bold" fill="${tempColor}">${w.temp}°</text>
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: w.lat, lng: w.lng },
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(size, 28),
          anchor: new google.maps.Point(size / 2, 14),
        },
        title: `${w.city}: ${w.temp}°C ${w.condition}`,
        zIndex: 30,
      });

      const infoContent = `
        <div style="background:#0d1117;color:#e6edf3;padding:10px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10px;min-width:180px;border:1px solid ${tempColor}40;box-shadow:0 4px 24px rgba(0,0,0,0.5);">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:16px;">${emoji}</span>
            <span style="font-weight:700;font-size:13px;color:${tempColor};">${w.city}</span>
            <span style="font-size:9px;color:#7d8590;">${w.country}</span>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;">
            <span style="color:#7d8590;">TEMP</span><span style="color:${tempColor};font-weight:700;">${w.temp}°C (feels ${w.feels_like}°C)</span>
            <span style="color:#7d8590;">WIND</span><span>${w.wind_speed} km/h</span>
            <span style="color:#7d8590;">HUMIDITY</span><span>${w.humidity}%</span>
            <span style="color:#7d8590;">VISIBILITY</span><span>${w.visibility} km</span>
            <span style="color:#7d8590;">CLOUDS</span><span>${w.clouds}%</span>
            <span style="color:#7d8590;">CONDITION</span><span>${w.description}</span>
          </div>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("mouseover", () => infoWindow.open(map, marker));
      marker.addListener("mouseout", () => infoWindow.close());

      weatherMarkersRef.current.push(marker);
    });
  }, [weatherData, showWeather]);

  const flashZoomIndicator = useCallback((zoom: number) => {
    setZoomLevel(zoom);
    setShowZoomIndicator(true);
    if (zoomIndicatorTimerRef.current) clearTimeout(zoomIndicatorTimerRef.current);
    zoomIndicatorTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1500);
  }, []);

  const handleZoomIn = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      const newZoom = Math.min((map.getZoom() || 6) + 1, 21);
      map.setZoom(newZoom);
      flashZoomIndicator(newZoom);
    }
  }, [flashZoomIndicator]);
  const handleZoomOut = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      const newZoom = Math.max((map.getZoom() || 6) - 1, 1);
      map.setZoom(newZoom);
      flashZoomIndicator(newZoom);
    }
  }, [flashZoomIndicator]);
  const handleRotate = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) map.setHeading((map.getHeading() || 0) + 45);
  }, []);
  const handleResetView = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) { map.setTilt(45); map.setHeading(0); map.setZoom(6); map.panTo({ lat: 29.5, lng: 47.5 }); }
  }, []);
  const handleToggleTilt = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) map.setTilt(map.getTilt() === 0 ? 45 : 0);
  }, []);

  // Fetch conflict data for heatmap
  useEffect(() => {
    const fetchConflicts = async () => {
      try {
        const [geoRes, conflictRes] = await Promise.all([
          supabase.from("geo_alerts").select("lat,lng,severity"),
          supabase.functions.invoke("conflict-events"),
        ]);
        const points: ConflictPoint[] = [];
        const sevMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
        (geoRes.data || []).forEach((g: any) => {
          if (g.lat && g.lng) points.push({ lat: g.lat, lng: g.lng, severity: sevMap[g.severity] || 2 });
        });
        const events = conflictRes.data?.data || [];
        events.forEach((e: any) => {
          if (e.lat && e.lng) points.push({ lat: e.lat, lng: e.lng, severity: sevMap[e.severity] || 2 });
        });
        setConflictPoints(points);
      } catch (e) { console.error("Heatmap data error:", e); }
    };
    fetchConflicts();
    const iv = setInterval(fetchConflicts, 300_000);
    return () => clearInterval(iv);
  }, []);

  // Fetch live flights — 15s interval, worldwide bbox
  const fetchFlights = useCallback(async () => {
    if (!showFlights) return;
    setFlightsLoading(true);
    try {
      const map = mapInstanceRef.current;
      let bbox: any;
      if (map) {
        const bounds = map.getBounds();
        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          bbox = { lamin: sw.lat(), lamax: ne.lat(), lomin: sw.lng(), lomax: ne.lng() };
        }
      }
      if (!bbox) {
        bbox = { lamin: lat - 10, lamax: lat + 10, lomin: lng - 15, lomax: lng + 15 };
      }

      const { data, error } = await supabase.functions.invoke("live-flights", { body: bbox });
      if (!error && data?.aircraft) {
        const newAircraft: Aircraft[] = data.aircraft;
        if (data.source) setFlightSource(data.source);

        // --- ALERT: New military aircraft entering viewport ---
        const prevMilIds = new Set(aircraft.filter(a => a.is_military).map(a => a.icao24));
        const newMil = newAircraft.filter(a => a.is_military && !prevMilIds.has(a.icao24));
        if (newMil.length > 0 && aircraft.length > 0) {
          const names = newMil.slice(0, 3).map(a => a.callsign || a.icao24).join(", ");
          toast({
            title: "🛩️ Military Aircraft Detected",
            description: `${newMil.length} military callsign${newMil.length > 1 ? "s" : ""} entered airspace: ${names}${newMil.length > 3 ? ` +${newMil.length - 3} more` : ""}`,
            duration: 8000,
          });
        }

        // --- ALERT: Rapid altitude change on military aircraft ---
        if (aircraft.length > 0) {
          const prevMap = new Map(aircraft.filter(a => a.is_military).map(a => [a.icao24, a]));
          newAircraft.filter(a => a.is_military).forEach(ac => {
            const prev = prevMap.get(ac.icao24);
            if (prev) {
              const altDelta = Math.abs(ac.altitude - prev.altitude);
              const vrAbs = Math.abs(ac.vertical_rate);
              // Alert if altitude changed >300m between polls OR vertical rate > 15 m/s
              if (altDelta > 300 || vrAbs > 15) {
                const dir = ac.altitude > prev.altitude ? "CLIMBING" : "DESCENDING";
                const arrow = ac.altitude > prev.altitude ? "⬆️" : "⬇️";
                toast({
                  title: `${arrow} Military Rapid ${dir}`,
                  description: `${ac.callsign || ac.icao24} (${ac.origin_country}) — ${dir.toLowerCase()} at ${vrAbs.toFixed(1)} m/s, ALT ${Math.round(ac.altitude * 3.281).toLocaleString()} ft`,
                  variant: "destructive",
                  duration: 10000,
                });
              }
            }
          });
        }
        // Trail history
        const now = Date.now();
        const history = { ...trailHistoryRef.current };
        const MAX_TRAIL = 20;
        const TRAIL_EXPIRE = 10 * 60 * 1000;
        newAircraft.forEach((ac) => {
          const trail = history[ac.icao24] || [];
          const last = trail[trail.length - 1];
          if (!last || Math.abs(last.lat - ac.lat) > 0.001 || Math.abs(last.lng - ac.lng) > 0.001) {
            trail.push({ lat: ac.lat, lng: ac.lng, ts: now });
          }
          history[ac.icao24] = trail.filter(p => now - p.ts < TRAIL_EXPIRE).slice(-MAX_TRAIL);
        });
        const activeIds = new Set(newAircraft.map(a => a.icao24));
        Object.keys(history).forEach(id => { if (!activeIds.has(id)) delete history[id]; });
        trailHistoryRef.current = history;
        aircraftSnapshotRef.current = newAircraft;
        lastPollTimeRef.current = Date.now();
        setAircraft(newAircraft);
        setInterpolatedAircraft(newAircraft);
      }
    } catch (e) {
      console.error("Failed to fetch flights:", e);
    } finally {
      setFlightsLoading(false);
    }
  }, [lat, lng, showFlights]);

  useEffect(() => {
    fetchFlights();
    flightIntervalRef.current = setInterval(fetchFlights, 15000);
    return () => { if (flightIntervalRef.current) clearInterval(flightIntervalRef.current); };
  }, [fetchFlights]);

  // ===== REAL-TIME INTERPOLATION ENGINE — move aircraft smoothly between polls =====
  useEffect(() => {
    if (!showFlights) return;
    interpolationRef.current = setInterval(() => {
      const snapshot = aircraftSnapshotRef.current;
      if (snapshot.length === 0) return;
      const elapsed = (Date.now() - lastPollTimeRef.current) / 1000; // seconds since last poll
      const moved = snapshot.map(ac => {
        const headingRad = ac.heading * Math.PI / 180;
        const speedDegPerSec = ac.velocity / 111320; // m/s to deg/s approx
        const dLat = Math.cos(headingRad) * speedDegPerSec * elapsed;
        const dLng = Math.sin(headingRad) * speedDegPerSec * elapsed / Math.max(Math.cos(ac.lat * Math.PI / 180), 0.01);
        return { ...ac, lat: ac.lat + dLat, lng: ac.lng + dLng };
      });
      setInterpolatedAircraft(moved);
    }, 200); // update positions every 200ms
    return () => { if (interpolationRef.current) clearInterval(interpolationRef.current); };
  }, [showFlights]);

  // Auto-pan to tracked aircraft
  useEffect(() => {
    if (!trackedAircraftId || !mapInstanceRef.current) return;
    const ac = interpolatedAircraft.find(f => f.icao24 === trackedAircraftId);
    if (ac) {
      mapInstanceRef.current.panTo({ lat: ac.lat, lng: ac.lng });
      setSelectedAircraft(ac);
    } else {
      setTrackedAircraftId(null);
      setSelectedAircraft(null);
    }
  }, [interpolatedAircraft, trackedAircraftId]);

  const navigateTo = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setSelectedAircraft(null);
    setTrackedAircraftId(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const input = searchInput.trim();
    if (!input) return;
    const coordMatch = input.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
      navigateTo(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
      setShowSearch(false);
      return;
    }
    // Also check if it matches a callsign
    const matchAc = aircraft.find(a => a.callsign.toLowerCase() === input.toLowerCase() || a.icao24.toLowerCase() === input.toLowerCase());
    if (matchAc) {
      setTrackedAircraftId(matchAc.icao24);
      setSelectedAircraft(matchAc);
      if (mapInstanceRef.current) mapInstanceRef.current.panTo({ lat: matchAc.lat, lng: matchAc.lng });
      setShowSearch(false);
      return;
    }
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`)
      .then((r) => r.json())
      .then((results) => {
        if (results.length > 0) {
          navigateTo(parseFloat(results[0].lat), parseFloat(results[0].lon));
          setShowSearch(false);
        }
      })
      .catch(console.error);
  }, [searchInput, navigateTo, aircraft]);

  const militaryCount = interpolatedAircraft.filter((a) => a.is_military).length;
  const civilCount = interpolatedAircraft.length - militaryCount;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      trailLinesRef.current.forEach(l => l.setMap(null));
      vesselMarkersRef.current.forEach(m => m.setMap(null));
      earthquakeMarkersRef.current.forEach(m => m.setMap(null));
      weatherMarkersRef.current.forEach(m => m.setMap(null));
      rocketMarkersRef.current.forEach(m => m.setMap(null));
      rocketLinesRef.current.forEach(l => l.setMap(null));
      cityMarkersRef.current.forEach(m => m.setMap(null));
      if (heatmapLayerRef.current) heatmapLayerRef.current.setMap(null);
      if (trafficLayerRef.current) trafficLayerRef.current.setMap(null);
      cameraMarkersRef.current.forEach(m => m.setMap(null));
      mapListenersRef.current.forEach((listener) => (window as any).google?.maps?.event?.removeListener?.(listener));
      mapListenersRef.current = [];
      if (interpolationRef.current) clearInterval(interpolationRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[2000] bg-black flex flex-col">
      {/* Header */}
      <div className="flex flex-col bg-card/90 backdrop-blur border-b border-border z-20">
        {/* Top row: Title + close/refresh */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Google 3D View</span>
            <span className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">PHOTOREALISTIC TILES</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchFlights()} className="flex items-center justify-center w-7 h-7 rounded-md border border-border/60 text-white/80 hover:bg-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105 active:scale-95">
              <RefreshCw className={`h-3 w-3 ${flightsLoading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-md border border-border/60 text-white/80 hover:bg-destructive/20 hover:text-destructive transition-all duration-300 hover:scale-110 active:scale-95">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bottom row: Layer toggles grouped by category */}
        <div className="flex items-center gap-3 px-3 py-1.5 overflow-x-auto">
          {/* Tools */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-muted-foreground/60 uppercase mr-0.5">Tools</span>
            <button onClick={() => setShowSearch(!showSearch)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showSearch ? "border-primary/60 bg-primary/20 text-white shadow-[0_0_8px_hsl(var(--primary)/0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Search className="h-3 w-3" /> Search
            </button>
            <button onClick={() => setStreetViewActive(!streetViewActive)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${streetViewActive ? "border-green-500/60 bg-green-500/20 text-white shadow-[0_0_8px_rgba(34,197,94,0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Compass className="h-3 w-3" /> 360°
            </button>
          </div>

          <div className="w-px h-5 bg-border/40" />

          {/* Air */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-muted-foreground/60 uppercase mr-0.5">Air</span>
            <button onClick={() => setShowFlights(!showFlights)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showFlights ? "border-primary/60 bg-primary/20 text-white shadow-[0_0_8px_hsl(var(--primary)/0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Plane className="h-3 w-3" /> Flights
              {interpolatedAircraft.length > 0 && <span className="bg-primary/30 text-white text-[8px] px-1 rounded-full font-bold ml-0.5">{interpolatedAircraft.length}</span>}
            </button>
            <button onClick={() => setShowTrails(!showTrails)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showTrails ? "border-accent/60 bg-accent/20 text-white shadow-[0_0_8px_hsl(var(--accent)/0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Navigation className="h-3 w-3" /> Trails
            </button>
          </div>

          <div className="w-px h-5 bg-border/40" />

          {/* Sea */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-muted-foreground/60 uppercase mr-0.5">Sea</span>
            <button onClick={() => setShowVessels(!showVessels)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showVessels ? "border-blue-500/60 bg-blue-500/20 text-white shadow-[0_0_8px_rgba(59,130,246,0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Ship className="h-3 w-3" /> Vessels
              {vessels.length > 0 && <span className="bg-blue-500/30 text-white text-[8px] px-1 rounded-full font-bold ml-0.5">{vessels.length}</span>}
            </button>
          </div>

          <div className="w-px h-5 bg-border/40" />

          {/* Missiles */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-muted-foreground/60 uppercase mr-0.5">Threat</span>
            <button onClick={() => setShowRockets(!showRockets)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showRockets ? "border-red-500/60 bg-red-500/20 text-white shadow-[0_0_8px_rgba(239,68,68,0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Rocket className="h-3 w-3" /> Missiles
              {rockets.filter(r => r.status === "launched" || r.status === "in_flight").length > 0 && (
                <span className="bg-red-500/30 text-white text-[8px] px-1 rounded-full font-bold ml-0.5 animate-pulse">
                  {rockets.filter(r => r.status === "launched" || r.status === "in_flight").length}
                </span>
              )}
            </button>
          </div>

          <div className="w-px h-5 bg-border/40" />

          {/* Layers */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-muted-foreground/60 uppercase mr-0.5">Layers</span>
            <button onClick={() => setShowMarkers(!showMarkers)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showMarkers ? "border-accent/60 bg-accent/20 text-white shadow-[0_0_8px_hsl(var(--accent)/0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              {showMarkers ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} Markers
            </button>
            <button onClick={() => setShowHeatmap(!showHeatmap)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showHeatmap ? "border-orange-500/60 bg-orange-500/20 text-white shadow-[0_0_8px_rgba(249,115,22,0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Flame className="h-3 w-3" /> Heatmap
            </button>
            <button onClick={() => setShowEarthquakes(!showEarthquakes)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showEarthquakes ? "border-yellow-500/60 bg-yellow-500/20 text-white shadow-[0_0_8px_rgba(234,179,8,0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Activity className="h-3 w-3" /> Quakes
              {earthquakes.length > 0 && <span className="bg-yellow-500/30 text-white text-[8px] px-1 rounded-full font-bold ml-0.5">{earthquakes.length}</span>}
            </button>
            <button onClick={() => setShowWeather(!showWeather)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showWeather ? "border-cyan-500/60 bg-cyan-500/20 text-white shadow-[0_0_8px_rgba(6,182,212,0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <CloudRain className="h-3 w-3" /> Weather
            </button>
            <button onClick={() => setShowTraffic(!showTraffic)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase border transition-all duration-200 ${showTraffic ? "border-emerald-500/60 bg-emerald-500/20 text-white shadow-[0_0_8px_rgba(16,185,129,0.25)]" : "border-border/40 text-white/70 hover:bg-white/10"}`}>
              <Car className="h-3 w-3" /> Traffic
            </button>
          </div>
        </div>
      </div>

      {/* Search + presets */}
      {showSearch && (
        <div className="px-3 py-1.5 bg-card/80 backdrop-blur border-b border-border/50 z-20 space-y-1.5">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()} placeholder="City, coordinates, or callsign (e.g. UAE231)…" className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none" autoFocus />
            <button onClick={handleSearchSubmit} className="px-2 py-0.5 rounded text-[9px] font-mono uppercase border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-all">Go</button>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => { navigateTo(p.lat, p.lng); setShowSearch(false); }}
                className={`flex-shrink-0 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${Math.abs(lat - p.lat) < 0.01 && Math.abs(lng - p.lng) < 0.01 ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative" ref={containerRef}>
        {apiKeyLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Initializing Google 3D Tiles…</p>
            </div>
          </div>
        ) : apiKey ? (
          <div ref={mapDivRef} className="absolute inset-0 w-full h-full" style={{
            filter: viewStyle === "crt"
              ? "contrast(1.3) saturate(0.6) brightness(0.9)"
              : viewStyle === "nvg"
              ? "brightness(0.7) contrast(1.4) saturate(0) sepia(1) hue-rotate(70deg) brightness(1.3)"
              : viewStyle === "flir"
              ? "saturate(0) contrast(1.6) brightness(1.1) invert(1) hue-rotate(180deg)"
              : viewStyle === "noir"
              ? "saturate(0) contrast(1.3) brightness(0.85)"
              : viewStyle === "snow"
              ? "brightness(1.3) contrast(0.85) saturate(0.3)"
              : "none",
          }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="text-center space-y-2 max-w-sm px-4">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs font-mono text-muted-foreground">Google Maps API key not configured.</p>
            </div>
          </div>
        )}

        {/* Map navigation controls */}
        {apiKey && !streetViewActive && (
          <div className="absolute right-3 bottom-16 z-[12] flex flex-col gap-1.5 pointer-events-auto">
            {[
              { icon: <ZoomIn className="h-3.5 w-3.5" />, action: handleZoomIn, tip: "Zoom In" },
              { icon: <ZoomOut className="h-3.5 w-3.5" />, action: handleZoomOut, tip: "Zoom Out" },
              { icon: <RotateCcw className="h-3.5 w-3.5" />, action: handleRotate, tip: "Rotate 45°" },
              { icon: <Maximize2 className="h-3.5 w-3.5" />, action: handleToggleTilt, tip: "Toggle 3D Tilt" },
              { icon: <Compass className="h-3.5 w-3.5" />, action: handleResetView, tip: "Reset View" },
              { icon: <span className="text-[10px] font-bold">360°</span>, action: () => setStreetViewActive(true), tip: "Enter 360° Street View" },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} title={btn.tip}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-black/80 backdrop-blur border border-primary/25 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                {btn.icon}
              </button>
            ))}
          </div>
        )}

        {/* Zoom level indicator */}
        {showZoomIndicator && (
          <div className="absolute right-14 bottom-24 z-[13] pointer-events-none animate-fade-in">
            <div className="px-3 py-1.5 rounded-lg bg-black/85 backdrop-blur border border-primary/30 font-mono" style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.15)" }}>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Zoom </span>
              <span className="text-sm font-bold text-primary">{zoomLevel}</span>
              <span className="text-[8px] text-muted-foreground/60"> / 21</span>
            </div>
          </div>
        )}

        {/* Layer Panel Sidebar */}
        <div className={`absolute top-0 left-0 z-[16] h-full transition-all duration-300 pointer-events-auto ${showLayerPanel ? "w-64" : "w-0"}`}>
          {showLayerPanel && (
            <div className="h-full w-64 bg-black/90 backdrop-blur-xl border-r border-border/40 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">Layer Control</span>
                </div>
                <button onClick={() => setShowLayerPanel(false)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10">
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                {/* Flight layer */}
                <LayerControl icon={<Plane className="h-3 w-3" />} label="Flights" color="hsl(var(--primary))" active={showFlights} onToggle={() => setShowFlights(!showFlights)} count={interpolatedAircraft.length} opacity={opacityFlights} onOpacity={setOpacityFlights} source="OSINT Unified (5 feeds)" />
                <LayerControl icon={<Navigation className="h-3 w-3" />} label="Trails" color="hsl(var(--accent))" active={showTrails} onToggle={() => setShowTrails(!showTrails)} opacity={1} onOpacity={() => {}} source="Flight trails" />
                <LayerControl icon={showMarkers ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} label="Markers" color="hsl(var(--accent))" active={showMarkers} onToggle={() => setShowMarkers(!showMarkers)} opacity={1} onOpacity={() => {}} />

                <div className="border-t border-border/20 my-2" />

                <LayerControl icon={<Ship className="h-3 w-3" />} label="Vessels" color="#3b82f6" active={showVessels} onToggle={() => setShowVessels(!showVessels)} count={vessels.length} opacity={opacityVessels} onOpacity={setOpacityVessels} source={vesselSource === "database" ? "DB Fallback" : vesselSource === "loading" ? "Loading…" : `AIS (${vesselSource})`} />

                <div className="border-t border-border/20 my-2" />

                <LayerControl icon={<Activity className="h-3 w-3" />} label="Earthquakes" color="#eab308" active={showEarthquakes} onToggle={() => setShowEarthquakes(!showEarthquakes)} count={earthquakes.length} opacity={opacityEarthquakes} onOpacity={setOpacityEarthquakes} source="USGS" />
                <LayerControl icon={<Flame className="h-3 w-3" />} label="Heatmap" color="#f97316" active={showHeatmap} onToggle={() => setShowHeatmap(!showHeatmap)} opacity={opacityHeatmap} onOpacity={setOpacityHeatmap} source="Conflict data" />

                <div className="border-t border-border/20 my-2" />

                <LayerControl icon={<CloudRain className="h-3 w-3" />} label="Weather" color="#06b6d4" active={showWeather} onToggle={() => setShowWeather(!showWeather)} opacity={opacityWeather} onOpacity={setOpacityWeather} source="OpenWeatherMap" />
                <LayerControl icon={<Car className="h-3 w-3" />} label="Traffic" color="#10b981" active={showTraffic} onToggle={() => setShowTraffic(!showTraffic)} opacity={opacityTraffic} onOpacity={setOpacityTraffic} source="Google" />
                <LayerControl icon={<Compass className="h-3 w-3" />} label="360° Street View" color="#22c55e" active={streetViewActive} onToggle={() => setStreetViewActive(!streetViewActive)} opacity={1} onOpacity={() => {}} />
                <LayerControl icon={<Eye className="h-3 w-3" />} label="Mapillary" color="#05CB63" active={mapillaryActive} onToggle={() => {
                  if (mapillaryActive) {
                    setMapillaryActive(false);
                    setMapillaryImageId(null);
                  } else {
                    const map = mapInstanceRef.current;
                    const center = map?.getCenter?.();
                    activateMapillary(center?.lat?.() ?? lat, center?.lng?.() ?? lng);
                  }
                }} opacity={1} onOpacity={() => {}} source="Street-level" />

                <div className="border-t border-border/20 my-2" />

                <LayerControl icon={<MapPin className="h-3 w-3" />} label="City Landmarks" color="#00dcff" active={showCities} onToggle={() => setShowCities(!showCities)} count={CITY_LANDMARKS_3D.length} opacity={1} onOpacity={() => {}} source={`${CITY_LANDMARKS_3D.length} cities`} />
                <LayerControl icon={<Video className="h-3 w-3" />} label="Live Cameras" color="#f59e0b" active={showCameras} onToggle={() => setShowCameras(!showCameras)} count={cameras.length} opacity={1} onOpacity={() => {}} source={`${cameras.length} feeds`} />
              </div>
              <div className="px-3 py-2 border-t border-border/30">
                <span className="text-[7px] font-mono text-muted-foreground/50">Real-time data • Auto-refresh</span>
              </div>
            </div>
          )}
        </div>

        {/* Layer panel toggle button */}
        {!showLayerPanel && apiKey && (
          <button onClick={() => setShowLayerPanel(true)} className="absolute top-32 left-3 z-[16] pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-md bg-black/80 backdrop-blur border border-primary/30 text-primary hover:bg-primary/15 transition-all" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }} title="Open Layer Panel">
            <Layers className="h-3.5 w-3.5" />
            <span className="text-[9px] font-mono uppercase">Layers</span>
          </button>
        )}


        {/* View Style Presets Bar */}
        {apiKey && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[16] pointer-events-auto">
            <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-border/40" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
              {([
                { id: "normal" as const, label: "Normal", icon: "🌍" },
                { id: "crt" as const, label: "CRT", icon: "📺" },
                { id: "nvg" as const, label: "NVG", icon: "🌙" },
                { id: "flir" as const, label: "FLIR", icon: "🔥" },
                { id: "noir" as const, label: "Noir", icon: "🎬" },
                { id: "snow" as const, label: "Snow", icon: "❄️" },
              ]).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setViewStyle(preset.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase transition-all duration-200 ${
                    viewStyle === preset.id
                      ? "bg-primary/20 text-primary border border-primary/40 shadow-[0_0_10px_hsl(190_100%_50%/0.2)]"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="text-sm">{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CRT scanline overlay */}
        {viewStyle === "crt" && (
          <div className="absolute inset-0 z-[11] pointer-events-none" style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.03) 2px, rgba(0,255,0,0.03) 4px)",
            mixBlendMode: "overlay",
          }} />
        )}

        {/* NVG green tint overlay */}
        {viewStyle === "nvg" && (
          <div className="absolute inset-0 z-[11] pointer-events-none" style={{
            background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
            boxShadow: "inset 0 0 120px rgba(0,0,0,0.5)",
          }} />
        )}

        {/* Snow overlay particles */}
        {viewStyle === "snow" && (
          <div className="absolute inset-0 z-[11] pointer-events-none overflow-hidden">
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 70%)",
            }} />
          </div>
        )}

        {streetViewActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[15] pointer-events-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 backdrop-blur border border-green-500/40" style={{ boxShadow: "0 0 20px rgba(34,197,94,0.2)" }}>
              <Compass className="h-4 w-4 text-green-400 animate-spin" style={{ animationDuration: "4s" }} />
              <span className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-widest">360° STREET VIEW ACTIVE</span>
              <button onClick={() => setStreetViewActive(false)} className="ml-2 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">EXIT</button>
            </div>
          </div>
        )}

        {/* Mapillary street-level viewer overlay with enhanced walking */}
        {mapillaryActive && mapillaryImageId && (
          <div className="absolute inset-0 z-[20] pointer-events-auto">
            <div id="mapillary-viewer" className="w-full h-full" />

            {/* AI Detection overlay on Mapillary */}
            {showAIDetection && aiDetections.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-[22]">
                {aiDetections.map((det) => (
                  <div key={det.id} className="absolute transition-all duration-700"
                    style={{ left: `${det.x}%`, top: `${det.y}%`, width: `${det.w}%`, height: `${det.h}%` }}>
                    <div className="w-full h-full border-2 rounded-sm" style={{
                      borderColor: det.color, boxShadow: `0 0 8px ${det.color}50, inset 0 0 4px ${det.color}20`,
                    }}>
                      <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: det.color }} />
                      <div className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: det.color }} />
                      <div className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: det.color }} />
                      <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: det.color }} />
                    </div>
                    <div className="absolute -top-4 left-0 flex items-center gap-1 px-1 py-0.5 rounded-sm text-[7px] font-mono font-bold whitespace-nowrap"
                      style={{ background: `${det.color}dd`, color: "#fff" }}>
                      {det.label} {(det.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
                <div className="absolute top-14 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur border border-cyan-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[8px] font-mono text-cyan-400 font-bold">AI DETECTION</span>
                  <span className="text-[7px] font-mono text-muted-foreground">{aiDetections.length} objects</span>
                </div>
              </div>
            )}

            {/* Enhanced walking HUD */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[21]">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 backdrop-blur border border-emerald-500/40" style={{ boxShadow: "0 0 20px rgba(5,203,99,0.2)" }}>
                <Eye className="h-4 w-4 text-emerald-400" />
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">STREET WALK MODE</span>
                <span className="text-[8px] font-mono text-muted-foreground/70">|</span>
                <span className="text-[8px] font-mono text-emerald-400/80">{walkingSteps} steps</span>
                <button onClick={() => setShowAIDetection(!showAIDetection)} className={`px-1.5 py-0.5 rounded text-[7px] font-mono uppercase border transition-all ${showAIDetection ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400" : "border-border/40 text-muted-foreground"}`}>
                  🔍 AI
                </button>
                <button onClick={() => { setMapillaryActive(false); setMapillaryImageId(null); }} className="ml-1 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">EXIT</button>
              </div>
            </div>

            {/* Walking mini-map */}
            <div className="absolute bottom-4 left-4 z-[21] w-36 h-36 rounded-lg overflow-hidden border border-emerald-500/30 bg-black/70 backdrop-blur"
              style={{ boxShadow: "0 0 15px rgba(5,203,99,0.15)" }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                  {/* Walking path visualization */}
                  <svg className="absolute inset-0 w-full h-full">
                    {walkingPath.length > 1 && walkingPath.map((p, i) => {
                      if (i === 0) return null;
                      const prev = walkingPath[i - 1];
                      const cx = 68 + (p.lng - lng) * 8000;
                      const cy = 68 + (lat - p.lat) * 8000;
                      const px = 68 + (prev.lng - lng) * 8000;
                      const py = 68 + (lat - prev.lat) * 8000;
                      return <line key={i} x1={px} y1={py} x2={cx} y2={cy} stroke="#22c55e" strokeWidth="2" opacity="0.6" />;
                    })}
                    {/* Current position */}
                    <circle cx="68" cy="68" r="5" fill="#22c55e" opacity="0.9">
                      <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="68" cy="68" r="3" fill="white" opacity="0.9" />
                  </svg>
                  {/* Nearby cameras on mini-map */}
                  {cameras.filter(c => Math.abs(c.lat - lat) < 0.01 && Math.abs(c.lng - lng) < 0.01).map((c, i) => {
                    const cx = 68 + (c.lng - lng) * 8000;
                    const cy = 68 + (lat - c.lat) * 8000;
                    if (cx < 0 || cx > 136 || cy < 0 || cy > 136) return null;
                    return (
                      <div key={i} className="absolute w-2 h-2 rounded-full bg-amber-400 border border-amber-300" style={{ left: cx - 4, top: cy - 4, boxShadow: "0 0 6px rgba(251,191,36,0.6)" }} />
                    );
                  })}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/80 text-center">
                <span className="text-[7px] font-mono text-emerald-400/80">📍 {lat.toFixed(4)}°, {lng.toFixed(4)}°</span>
              </div>
            </div>

            {/* Walking controls hint */}
            <div className="absolute bottom-4 right-4 z-[21] pointer-events-none">
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-border/30 space-y-1">
                <span className="text-[8px] font-mono text-foreground/80 font-bold block">Navigation</span>
                <span className="text-[7px] font-mono text-muted-foreground/70 block">🖱️ Click arrows to walk</span>
                <span className="text-[7px] font-mono text-muted-foreground/70 block">🔄 Drag to look around</span>
                <span className="text-[7px] font-mono text-muted-foreground/70 block">⬆️⬇️ Scroll to zoom</span>
              </div>
            </div>
          </div>
        )}

        {/* Mapillary loading indicator */}
        {mapillaryLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[15] pointer-events-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 backdrop-blur border border-emerald-500/40">
              <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Searching Mapillary…</span>
            </div>
          </div>
        )}

        {/* Live Camera Feed Viewer with AI Detection Overlay */}
        {activeCameraFeed && (
          <div className="absolute inset-0 z-[25] pointer-events-auto flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card/95 backdrop-blur-xl border border-border rounded-lg w-[90%] max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-mono font-bold text-foreground">{activeCameraFeed.name}</span>
                  <span className="text-[8px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/50 uppercase">{activeCameraFeed.category}</span>
                  <span className="flex items-center gap-1 text-[8px] font-mono text-emerald-400">
                    <Signal className="h-2.5 w-2.5" /> LIVE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAIDetection(!showAIDetection)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${showAIDetection ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400" : "border-border/40 text-muted-foreground hover:bg-white/5"}`}>
                    <Eye className="h-2.5 w-2.5" /> AI Detection
                  </button>
                  <span className="text-[8px] font-mono text-muted-foreground">{activeCameraFeed.city}, {activeCameraFeed.country}</span>
                  <button onClick={() => setActiveCameraFeed(null)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary transition-colors">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="aspect-video bg-black relative">
                {activeCameraFeed.embed_url ? (
                  <iframe
                    src={activeCameraFeed.embed_url}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={activeCameraFeed.name}
                  />
                ) : activeCameraFeed.stream_url ? (
                  <iframe
                    src={activeCameraFeed.stream_url}
                    className="w-full h-full"
                    allowFullScreen
                    title={activeCameraFeed.name}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-muted-foreground text-sm font-mono">No stream available</span>
                  </div>
                )}
                {/* AI Object Detection Overlay */}
                {showAIDetection && aiDetections.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none z-[5]">
                    {aiDetections.map((det) => (
                      <div key={det.id} className="absolute transition-all duration-700"
                        style={{
                          left: `${det.x}%`, top: `${det.y}%`,
                          width: `${det.w}%`, height: `${det.h}%`,
                        }}>
                        <div className="w-full h-full border-2 rounded-sm" style={{
                          borderColor: det.color,
                          boxShadow: `0 0 8px ${det.color}50, inset 0 0 4px ${det.color}20`,
                        }}>
                          {/* Corner brackets */}
                          <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: det.color }} />
                          <div className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: det.color }} />
                          <div className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: det.color }} />
                          <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: det.color }} />
                        </div>
                        {/* Label */}
                        <div className="absolute -top-4 left-0 flex items-center gap-1 px-1 py-0.5 rounded-sm text-[7px] font-mono font-bold whitespace-nowrap"
                          style={{ background: `${det.color}dd`, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                          {det.label} {(det.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                    {/* AI HUD overlay info */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 backdrop-blur border border-cyan-500/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[8px] font-mono text-cyan-400 font-bold">AI DETECTION</span>
                      <span className="text-[7px] font-mono text-muted-foreground">{aiDetections.length} objects</span>
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 backdrop-blur border border-border/30">
                      <span className="text-[7px] font-mono text-muted-foreground">MODEL: YOLOv8-OSINT</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-2 border-t border-border/50 flex items-center gap-3">
                <span className="text-[8px] font-mono text-muted-foreground">📍 {activeCameraFeed.lat.toFixed(4)}°N, {activeCameraFeed.lng.toFixed(4)}°E</span>
                <span className="text-[8px] font-mono text-muted-foreground">SRC: {activeCameraFeed.source_name}</span>
                {showAIDetection && <span className="text-[8px] font-mono text-cyan-400">🔍 {aiDetections.length} detections</span>}
                <button onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.panTo({ lat: activeCameraFeed.lat, lng: activeCameraFeed.lng });
                    mapInstanceRef.current.setZoom(17);
                  }
                  setActiveCameraFeed(null);
                }} className="ml-auto text-[9px] font-mono text-primary border border-primary/30 px-2 py-0.5 rounded hover:bg-primary/10 transition-colors">
                  📍 Go to Location
                </button>
              </div>
            </div>
          </div>
        )}

        {/* City Intel HUD — shown during street-level viewing */}
        {(streetViewActive || mapillaryActive) && cityIntel && (
          <div className="absolute bottom-16 right-3 z-[18] pointer-events-auto">
            <div className="bg-black/85 backdrop-blur-xl border border-primary/25 rounded-lg p-3 w-52 space-y-2" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 15px hsl(190 100% 50% / 0.08)" }}>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-mono font-bold text-primary uppercase">City Intel</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1.5 py-1 rounded bg-secondary/20">
                  <span className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground"><Camera className="h-2.5 w-2.5" /> Cameras</span>
                  <span className="text-[9px] font-mono font-bold text-amber-400">{cityIntel.cameras || 0} nearby</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 rounded bg-secondary/20">
                  <span className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground"><AlertTriangle className="h-2.5 w-2.5" /> Alerts</span>
                  <span className={`text-[9px] font-mono font-bold ${(cityIntel.alerts || 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>{cityIntel.alerts || 0} active</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 rounded bg-secondary/20">
                  <span className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground"><Car className="h-2.5 w-2.5" /> Traffic</span>
                  <span className="text-[9px] font-mono font-bold text-emerald-400">{cityIntel.traffic}</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 rounded bg-secondary/20">
                  <span className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground"><Ship className="h-2.5 w-2.5" /> Vessels</span>
                  <span className="text-[9px] font-mono font-bold text-blue-400">{nearbyIntel.vessels.length} nearby</span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 rounded bg-secondary/20">
                  <span className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground"><Radio className="h-2.5 w-2.5" /> Airspace</span>
                  <span className="text-[9px] font-mono font-bold text-yellow-400">{nearbyIntel.airspace.length} alerts</span>
                </div>
              </div>
              <div className="pt-1 border-t border-border/30">
                <span className="text-[7px] font-mono text-muted-foreground/50">📍 {lat.toFixed(4)}°N, {Math.abs(lng).toFixed(4)}°{lng >= 0 ? "E" : "W"}</span>
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div className="bg-black/70 backdrop-blur border border-primary/30 rounded-lg px-3 py-2 font-mono text-[9px] text-primary/80 space-y-1"
            style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.1)" }}>
            <div className="text-primary font-bold text-[10px]">// GOOGLE 3D SATELLITE</div>
            <div>SECTOR {lat.toFixed(4)}N {Math.abs(lng).toFixed(4)}{lng >= 0 ? "E" : "W"}</div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              PHOTOREALISTIC 3D TILES
            </div>
            {showFlights && interpolatedAircraft.length > 0 && (
              <>
                <div className="border-t border-primary/20 pt-1 mt-1 flex items-center gap-2">
                  <Plane className="h-2.5 w-2.5 text-primary" />
                  <span className="text-primary font-bold">{interpolatedAircraft.length}</span>
                  <span>AIRCRAFT</span>
                  <span className="text-[8px] font-mono px-1 rounded bg-primary/15">
                    OSINT UNIFIED
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3b82f6" }} />
                    <span style={{ color: "#3b82f6" }}>{civilCount}</span> CIV
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }} />
                    <span style={{ color: "#ef4444" }}>{militaryCount}</span> MIL
                  </span>
                </div>
                {flightSource && (
                  <div className="text-[7px] text-muted-foreground/50 leading-tight">
                    SRC: {flightSource}
                  </div>
                )}
                {trackedAircraftId && (
                  <div className="flex items-center gap-1 text-green-400 border-t border-primary/20 pt-1">
                    <Target className="h-2.5 w-2.5" />
                    <span className="font-bold">TRACKING:</span>
                    <span>{aircraft.find(a => a.icao24 === trackedAircraftId)?.callsign || trackedAircraftId}</span>
                    <button onClick={() => { setTrackedAircraftId(null); setSelectedAircraft(null); }}
                      className="ml-auto text-[8px] text-red-400 hover:text-red-300 pointer-events-auto">
                      STOP
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Flight sidebar — below Layers button */}
        {showFlights && aircraft.length > 0 && showAirspacePanel && (
          <div className="absolute z-10 pointer-events-auto"
            style={{ left: airspacePanelPos.x, top: airspacePanelPos.y }}>
            <div className="bg-black/85 backdrop-blur-xl border border-primary/25 rounded-lg w-60 max-h-[50vh] overflow-hidden"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 20px hsl(190 100% 50% / 0.05)" }}>
              <div className="px-2.5 py-2 border-b border-border/30 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => {
                  airspaceDragRef.current = { dragging: true, offsetX: e.clientX - airspacePanelPos.x, offsetY: e.clientY - airspacePanelPos.y };
                  const onMove = (ev: MouseEvent) => {
                    if (!airspaceDragRef.current.dragging) return;
                    setAirspacePanelPos({ x: ev.clientX - airspaceDragRef.current.offsetX, y: ev.clientY - airspaceDragRef.current.offsetY });
                  };
                  const onUp = () => { airspaceDragRef.current.dragging = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Plane className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-mono font-bold text-primary uppercase">Live Airspace</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-muted-foreground">{aircraft.length} tracked</span>
                    <button onClick={() => setShowAirspacePanel(false)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-500/20 transition-all" title="Close">
                      <X className="h-3.5 w-3.5 text-blue-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />
                    <span className="text-[8px] font-mono" style={{ color: "#3b82f6" }}>CIV: {civilCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
                    <span className="text-[8px] font-mono" style={{ color: "#ef4444" }}>MIL: {militaryCount}</span>
                  </div>
                  <span className="ml-auto text-[7px] font-mono text-muted-foreground/50">15s refresh</span>
                </div>
              </div>
              <div className="divide-y divide-border/10 max-h-[38vh] overflow-y-auto">
                {interpolatedAircraft
                  .sort((a, b) => {
                    if (a.icao24 === trackedAircraftId) return -1;
                    if (b.icao24 === trackedAircraftId) return 1;
                    if (a.is_military !== b.is_military) return a.is_military ? -1 : 1;
                    return (a.callsign || a.icao24).localeCompare(b.callsign || b.icao24);
                  })
                  .slice(0, 80)
                  .map((ac) => {
                    const isTracked = trackedAircraftId === ac.icao24;
                    const color = ac.is_military ? "#ef4444" : "#3b82f6";
                    return (
                      <button key={ac.icao24}
                        onClick={() => {
                          setTrackedAircraftId(isTracked ? null : ac.icao24);
                          setSelectedAircraft(isTracked ? null : ac);
                          if (!isTracked && mapInstanceRef.current) mapInstanceRef.current.panTo({ lat: ac.lat, lng: ac.lng });
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-all ${
                          isTracked ? "bg-primary/10" : "hover:bg-white/5"
                        }`}>
                        <Plane className="h-3 w-3 flex-shrink-0" style={{ color, transform: `rotate(${ac.heading}deg)` }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-mono font-bold text-foreground/90 truncate">{ac.callsign || ac.icao24}</span>
                            {ac.is_military && <span className="text-[6px] font-mono font-bold px-1 rounded" style={{ color: "#ef4444", background: "rgba(239,68,68,0.15)" }}>MIL</span>}
                            {isTracked && <Target className="h-2.5 w-2.5 text-green-400 flex-shrink-0" />}
                          </div>
                          <span className="text-[7px] font-mono text-muted-foreground/60">
                            {ac.type ? `${ac.type} · ` : ""}{Math.round(ac.altitude * 3.281).toLocaleString()}ft · {Math.round(ac.velocity * 1.944)}kts · {ac.origin_country}{ac.registration ? ` · ${ac.registration}` : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
        {/* Re-open airspace panel button */}
        {showFlights && aircraft.length > 0 && !showAirspacePanel && (
          <button onClick={() => setShowAirspacePanel(true)} className="absolute top-40 left-3 z-10 pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-md bg-black/80 backdrop-blur border border-blue-500/30 text-blue-400 hover:bg-blue-500/15 transition-all" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
            <Plane className="h-3.5 w-3.5" />
            <span className="text-[9px] font-mono uppercase">Airspace ({aircraft.length})</span>
          </button>
        )}

        {/* Selected aircraft detail panel */}
        {selectedAircraft && (
          <div className="absolute bottom-14 left-3 z-10 pointer-events-auto flight-info-panel rounded-lg p-3 w-64"
            style={{ borderColor: selectedAircraft.is_military ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.4)", boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 20px ${selectedAircraft.is_military ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)"}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4" style={{ color: selectedAircraft.is_military ? "#ef4444" : "#3b82f6", transform: `rotate(${selectedAircraft.heading}deg)` }} />
                <span className="text-[11px] font-mono font-bold" style={{ color: selectedAircraft.is_military ? "#ef4444" : "#3b82f6" }}>
                  {selectedAircraft.callsign || selectedAircraft.icao24}
                </span>
                {selectedAircraft.is_military && <span className="text-[7px] font-mono font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">MILITARY</span>}
              </div>
              <div className="flex items-center gap-1">
                {trackedAircraftId !== selectedAircraft.icao24 ? (
                  <button onClick={() => setTrackedAircraftId(selectedAircraft.icao24)}
                    className="text-[8px] font-mono text-green-400 border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 rounded hover:bg-green-500/20 transition-all">
                    📡 TRACK
                  </button>
                ) : (
                  <button onClick={() => setTrackedAircraftId(null)}
                    className="text-[8px] font-mono text-red-400 border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 rounded hover:bg-red-500/20 transition-all">
                    ✕ STOP
                  </button>
                )}
                <button onClick={() => { setSelectedAircraft(null); }} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <FlightStat label="ICAO" value={selectedAircraft.icao24} />
              <FlightStat label="ORIGIN" value={selectedAircraft.origin_country} />
              <FlightStat label="ALTITUDE" value={`${Math.round(selectedAircraft.altitude * 3.281).toLocaleString()} ft`} />
              <FlightStat label="SPEED" value={`${Math.round(selectedAircraft.velocity * 1.944)} kts`} />
              <FlightStat label="HEADING" value={`${Math.round(selectedAircraft.heading)}°`} />
              <FlightStat label="V/S" value={`${selectedAircraft.vertical_rate > 0 ? "+" : ""}${selectedAircraft.vertical_rate.toFixed(1)} m/s`}
                color={selectedAircraft.vertical_rate > 0.5 ? "#22c55e" : selectedAircraft.vertical_rate < -0.5 ? "#ef4444" : undefined} />
              <FlightStat label="LAT" value={selectedAircraft.lat.toFixed(4) + "°"} />
              <FlightStat label="LNG" value={selectedAircraft.lng.toFixed(4) + "°"} />
            </div>
            {/* Trail point count */}
            <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
              <span className="text-[7px] font-mono text-muted-foreground/50">
                TRAIL: {(trailHistoryRef.current[selectedAircraft.icao24] || []).length} points
              </span>
              <span className="text-[7px] font-mono text-muted-foreground/50">
                {Math.round(selectedAircraft.velocity * 3.6)} km/h
              </span>
            </div>
          </div>
        )}

        {/* Intel Briefing Card */}
        {showIntelCard && initialEvent && (
          <div className="absolute bottom-14 right-3 z-[15] pointer-events-auto w-72 max-h-[60vh] overflow-y-auto">
            <div className="bg-black/90 backdrop-blur-xl border rounded-lg p-3 space-y-2"
              style={{ borderColor: initialEvent.severity === "critical" ? "rgba(239,68,68,0.6)" : initialEvent.severity === "high" ? "rgba(251,146,36,0.6)" : "hsl(var(--primary) / 0.4)", boxShadow: initialEvent.severity === "critical" ? "0 0 25px rgba(239,68,68,0.2)" : "0 0 20px hsl(var(--primary) / 0.1)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: initialEvent.severity === "critical" ? "#ef4444" : initialEvent.severity === "high" ? "#f59e0b" : "hsl(var(--primary))" }} />
                  <span className="text-[9px] font-mono font-bold text-primary uppercase">Intel Briefing</span>
                </div>
                <button onClick={() => setShowIntelCard(false)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10"><X className="h-2.5 w-2.5 text-muted-foreground" /></button>
              </div>
              {initialEvent.severity && (
                <div className="flex items-center gap-1.5">
                  <span className={`text-[7px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${initialEvent.severity === "critical" ? "bg-red-500/20 text-red-400" : initialEvent.severity === "high" ? "bg-orange-500/20 text-orange-400" : initialEvent.severity === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}>{initialEvent.severity} SEVERITY</span>
                  {initialEvent.type && <span className="text-[7px] font-mono text-muted-foreground/70 uppercase px-1.5 py-0.5 rounded border border-border/30">{initialEvent.type}</span>}
                </div>
              )}
              <div className="text-[10px] font-mono font-bold text-foreground/90 leading-tight">{initialEvent.title}</div>
              {initialEvent.summary && <p className="text-[8px] font-mono text-muted-foreground/80 leading-relaxed">{initialEvent.summary}</p>}
              <div className="flex items-center gap-2 text-[7px] font-mono text-muted-foreground/60"><MapPin className="h-2.5 w-2.5" /><span>{initialEvent.lat.toFixed(4)}°N, {initialEvent.lng.toFixed(4)}°E</span></div>
              {initialEvent.source && <div className="text-[7px] font-mono text-muted-foreground/50 italic">SRC: {initialEvent.source}</div>}
              <div className="border-t border-border/30 pt-2 mt-1 space-y-1">
                <span className="text-[8px] font-mono font-bold text-primary/80 uppercase">Nearby Activity</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="flex flex-col items-center p-1.5 rounded bg-white/5 border border-border/20">
                    <Shield className="h-3 w-3 text-orange-400 mb-0.5" /><span className="text-[9px] font-mono font-bold text-foreground/80">{nearbyIntel.alerts.length}</span><span className="text-[6px] font-mono text-muted-foreground/50 uppercase">Alerts</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded bg-white/5 border border-border/20">
                    <Anchor className="h-3 w-3 text-blue-400 mb-0.5" /><span className="text-[9px] font-mono font-bold text-foreground/80">{nearbyIntel.vessels.length}</span><span className="text-[6px] font-mono text-muted-foreground/50 uppercase">Vessels</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded bg-white/5 border border-border/20">
                    <Radio className="h-3 w-3 text-yellow-400 mb-0.5" /><span className="text-[9px] font-mono font-bold text-foreground/80">{nearbyIntel.airspace.length}</span><span className="text-[6px] font-mono text-muted-foreground/50 uppercase">Airspace</span>
                  </div>
                </div>
                {nearbyIntel.alerts.length > 0 && (
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {nearbyIntel.alerts.slice(0, 5).map((a: any, i: number) => (
                      <div key={a.id || i} className="flex items-start gap-1 px-1 py-0.5 rounded bg-white/3">
                        <span className={`w-1 h-1 rounded-full mt-1 flex-shrink-0 ${a.severity === "critical" ? "bg-red-500" : a.severity === "high" ? "bg-orange-400" : "bg-yellow-400"}`} />
                        <span className="text-[7px] font-mono text-foreground/70 leading-tight">{a.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                {nearbyIntel.vessels.length > 0 && (
                  <div className="space-y-0.5">
                    {nearbyIntel.vessels.slice(0, 3).map((v: any, i: number) => (
                      <div key={v.id || i} className="flex items-center gap-1 px-1 py-0.5 text-[7px] font-mono text-blue-400/80">
                        <Anchor className="h-2 w-2 flex-shrink-0" /><span className="truncate">{v.name}</span><span className="text-muted-foreground/50 ml-auto">{v.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar with search */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-card/70 backdrop-blur border-t border-border/50 z-20">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            placeholder="Search city or coordinates…"
            className="w-44 bg-secondary/30 border border-border/40 rounded px-2 py-0.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
          />
          <button onClick={handleSearchSubmit} className="px-1.5 py-0.5 rounded text-[8px] font-mono uppercase border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all">Go</button>
        </div>
        <div className="w-px h-4 bg-border/40" />
        <span className="text-[8px] font-mono text-muted-foreground uppercase truncate">
          SRC: OSINT • {flightSource || "—"}
          {showVessels ? ` • ${vessels.length} vessels` : ""}{showEarthquakes ? ` • ${earthquakes.length} quakes` : ""}{showTraffic ? " • Traffic" : ""}
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/50 flex-shrink-0">
          {showFlights ? `${interpolatedAircraft.length} aircraft · ${militaryCount} mil` : "Flights OFF"}
        </span>
      </div>
    </div>
  );
};

const FlightStat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="flight-stat rounded px-2 py-1">
    <span className="text-[6px] font-mono text-muted-foreground/50 uppercase tracking-wider block">{label}</span>
    <span className="text-[9px] font-mono font-medium block" style={color ? { color } : undefined}>{value}</span>
  </div>
);

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[6px] font-mono text-muted-foreground/40 uppercase tracking-wider">{label}</span>
    <span className="text-[9px] font-mono text-foreground/80">{value}</span>
  </div>
);

const LayerControl = ({ icon, label, color, active, onToggle, count, opacity, onOpacity, source }: {
  icon: React.ReactNode; label: string; color: string; active: boolean; onToggle: () => void;
  count?: number; opacity: number; onOpacity: (v: number) => void; source?: string;
}) => (
  <div className={`rounded-lg border transition-all duration-200 ${active ? "border-white/15 bg-white/5" : "border-transparent"}`}>
    <div className="flex items-center gap-2 px-2 py-1.5">
      <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0">
        <span style={{ color: active ? color : "#6b7280" }}>{icon}</span>
        <span className={`text-[10px] font-mono uppercase truncate ${active ? "text-foreground/90 font-bold" : "text-muted-foreground/60"}`}>{label}</span>
      </button>
      {count !== undefined && count > 0 && (
        <span className="text-[8px] font-mono font-bold px-1.5 rounded-full" style={{ background: `${color}20`, color }}>{count}</span>
      )}
      <button onClick={onToggle} className={`w-7 h-4 rounded-full relative transition-all duration-200 ${active ? "bg-white/20" : "bg-white/5"}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${active ? "left-3.5" : "left-0.5"}`} style={{ background: active ? color : "#4b5563" }} />
      </button>
    </div>
    {active && onOpacity !== (() => {}) && (
      <div className="px-2 pb-1.5 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono text-muted-foreground/50 w-10">Opacity</span>
          <input type="range" min="0" max="1" step="0.05" value={opacity}
            onChange={(e) => onOpacity(parseFloat(e.target.value))}
            className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
            style={{ background: `linear-gradient(to right, ${color} ${opacity * 100}%, #333 ${opacity * 100}%)`, accentColor: color }} />
          <span className="text-[7px] font-mono text-muted-foreground/60 w-6 text-right">{Math.round(opacity * 100)}%</span>
        </div>
        {source && <span className="text-[7px] font-mono text-muted-foreground/40 block">SRC: {source}</span>}
      </div>
    )}
  </div>
);
