import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { X, RefreshCw, Search, Building2, Plane, Navigation, Eye, EyeOff, Flame, AlertTriangle, MapPin, Shield, Anchor, Radio, Maximize2, RotateCcw, ZoomIn, ZoomOut, Compass, Target, CloudRain, Ship, Activity, Car, Layers, ChevronLeft, ChevronRight } from "lucide-react";

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
  const markersRef = useRef<any[]>([]);
  const trailLinesRef = useRef<any[]>([]);
  const heatmapLayerRef = useRef<any>(null);
  
  const [showIntelCard, setShowIntelCard] = useState(!!initialEvent);
  const [nearbyIntel, setNearbyIntel] = useState<{ alerts: any[]; vessels: any[]; airspace: any[] }>({ alerts: [], vessels: [], airspace: [] });

  // New real-time layers
  const [showVessels, setShowVessels] = useState(true);
  const [showEarthquakes, setShowEarthquakes] = useState(true);
  const [showWeather, setShowWeather] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [vessels, setVessels] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const vesselMarkersRef = useRef<any[]>([]);
  const earthquakeMarkersRef = useRef<any[]>([]);
  const trafficLayerRef = useRef<any>(null);
  const weatherOverlayRef = useRef<any>(null);

  // Layer panel & opacity
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [vesselSource, setVesselSource] = useState<string>("loading");
  const [opacityFlights, setOpacityFlights] = useState(1);
  const [opacityVessels, setOpacityVessels] = useState(1);
  const [opacityEarthquakes, setOpacityEarthquakes] = useState(1);
  const [opacityWeather, setOpacityWeather] = useState(0.6);
  const [opacityHeatmap, setOpacityHeatmap] = useState(0.7);
  const [opacityTraffic, setOpacityTraffic] = useState(0.8);

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
      if (!mapDivRef.current || !(window as any).google?.maps) return;
      if (mapInstanceRef.current) {
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        trailLinesRef.current.forEach(l => l.setMap(null));
        trailLinesRef.current = [];
        mapInstanceRef.current = null;
      }
      const google = (window as any).google;
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat, lng },
        zoom: initialEvent ? 16 : 6,
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

  // Toggle Street View 360°
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !apiKey) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (streetViewActive) {
      const svService = new google.maps.StreetViewService();
      svService.getPanorama({ location: { lat, lng }, radius: 500 }, (data: any, status: any) => {
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
          toast({ title: "360° View Unavailable", description: "No Street View coverage at this location. Try zooming into a city first.", duration: 4000 });
          setStreetViewActive(false);
        }
      });
    } else {
      if (streetViewRef.current) {
        streetViewRef.current.setVisible(false);
        streetViewRef.current = null;
      }
    }
  }, [streetViewActive, lat, lng, apiKey]);

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
          setVessels(data.vessels);
          setVesselSource(data.source || "live");
        } else {
          // Fallback to DB
          const { data: dbData } = await supabase.from("vessels").select("*");
          if (dbData && dbData.length > 0) {
            setVessels(dbData);
            setVesselSource("database");
          }
        }
      } catch (e) {
        console.error("Vessel fetch error:", e);
        // DB fallback
        const { data: dbData } = await supabase.from("vessels").select("*");
        if (dbData) { setVessels(dbData); setVesselSource("database"); }
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
        title: `${v.name} (${v.type})`,
        zIndex: isMil ? 80 : 40,
      });

      const speedKts = (v.speed || 0).toFixed(1);
      const infoContent = `
        <div style="background:#0d1117;color:#e6edf3;padding:10px 14px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:10px;min-width:200px;border:1px solid ${color}40;box-shadow:0 4px 24px rgba(0,0,0,0.5);">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-weight:700;font-size:13px;color:${color};">🚢 ${v.name}</span>
            <span style="font-size:8px;padding:2px 6px;border-radius:4px;background:${color}20;color:${color};font-weight:600;">${v.type}</span>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;">
            <span style="color:#7d8590;">FLAG</span><span>🏴 ${v.flag}</span>
            <span style="color:#7d8590;">SPEED</span><span>${speedKts} kts</span>
            <span style="color:#7d8590;">HDG</span><span>${Math.round(v.heading)}°</span>
            <span style="color:#7d8590;">DEST</span><span>${v.destination || "Unknown"}</span>
            <span style="color:#7d8590;">POS</span><span>${v.lat.toFixed(4)}°, ${v.lng.toFixed(4)}°</span>
          </div>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("mouseover", () => infoWindow.open(map, marker));
      marker.addListener("mouseout", () => infoWindow.close());

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

  // ===== WEATHER OVERLAY (OpenWeatherMap precipitation tiles) =====
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


  const handleZoomIn = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) map.setZoom(Math.min((map.getZoom() || 6) + 1, 21));
  }, []);
  const handleZoomOut = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) map.setZoom(Math.max((map.getZoom() || 6) - 1, 1));
  }, []);
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
      if (heatmapLayerRef.current) heatmapLayerRef.current.setMap(null);
      if (trafficLayerRef.current) trafficLayerRef.current.setMap(null);
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
          <div ref={mapDivRef} className="absolute inset-0 w-full h-full" />
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


        {streetViewActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[15] pointer-events-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 backdrop-blur border border-green-500/40" style={{ boxShadow: "0 0 20px rgba(34,197,94,0.2)" }}>
              <Compass className="h-4 w-4 text-green-400 animate-spin" style={{ animationDuration: "4s" }} />
              <span className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-widest">360° STREET VIEW ACTIVE</span>
              <button onClick={() => setStreetViewActive(false)} className="ml-2 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">EXIT</button>
            </div>
          </div>
        )}

        {/* HUD Overlay */}
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

        {/* Flight sidebar */}
        {showFlights && aircraft.length > 0 && (
          <div className="absolute top-3 right-14 z-10 pointer-events-auto">
            <div className="bg-black/85 backdrop-blur-xl border border-primary/25 rounded-lg w-60 max-h-[55vh] overflow-hidden"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 20px hsl(190 100% 50% / 0.05)" }}>
              <div className="px-2.5 py-2 border-b border-border/30">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Plane className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-mono font-bold text-primary uppercase">Live Airspace</span>
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground">{aircraft.length} tracked</span>
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
              <div className="divide-y divide-border/10 max-h-[42vh] overflow-y-auto">
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
                        className={`flex items-center gap-1.5 px-2 py-1.5 text-left transition-all bg-black/50 ${
                          isTracked ? "bg-primary/10" : "hover:bg-white/5"
                        }`}>
                        <Plane className="h-3 w-3 flex-shrink-0" style={{ color, transform: `rotate(${ac.heading}deg)` }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-mono font-bold text-foreground/90 truncate">{ac.callsign || ac.icao24}</span>
                            {ac.is_military && <span className="text-[6px] font-mono font-bold px-1 rounded" style={{ color: "#ef4444", background: "rgba(239,68,68,0.15)" }}>MIL</span>}
                            {isTracked && <Target className="h-2.5 w-2.5 text-green-400 flex-shrink-0" />}
                          </div>
                          <span className="text-[7px] font-mono text-muted-foreground/60 truncate block">
                            {ac.type ? `${ac.type} · ` : ""}{Math.round(ac.altitude * 3.281).toLocaleString()}ft · {Math.round(ac.velocity * 1.944)}kts
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
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

      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-card/70 backdrop-blur border-t border-border/50 z-20">
        <span className="text-[8px] font-mono text-muted-foreground uppercase">
          SRC: OSINT UNIFIED • {flightSource || "—"}
          {showVessels ? ` • ${vessels.length} vessels (${vesselSource})` : ""}{showEarthquakes ? ` • ${earthquakes.length} quakes` : ""}{showWeather ? " • Weather ON" : ""}{showTraffic ? " • Traffic ON" : ""}
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/50">
          {showFlights ? `${interpolatedAircraft.length} aircraft · ${militaryCount} military · 15s refresh` : "Flight layer disabled"}
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
