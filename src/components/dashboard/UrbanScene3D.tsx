import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { X, RefreshCw, Search, Building2, Plane, Navigation, Eye, EyeOff, Flame, AlertTriangle, MapPin, Shield, Anchor, Radio } from "lucide-react";

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
  vertical_rate: number;
  is_military: boolean;
}

interface ConflictPoint {
  lat: number;
  lng: number;
  severity: number;
}

const PRESETS = [
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Tehran", lat: 35.6892, lng: 51.389 },
  { name: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
  { name: "Beirut", lat: 33.8938, lng: 35.5018 },
  { name: "Damascus", lat: 33.5138, lng: 36.2765 },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { name: "Baghdad", lat: 33.3152, lng: 44.3661 },
  { name: "Amman", lat: 31.9454, lng: 35.9284 },
];

export const UrbanScene3D = ({ onClose, initialCoords, initialEvent }: UrbanSceneProps) => {
  const [lat, setLat] = useState(initialCoords?.lat || initialEvent?.lat || 25.2048);
  const [lng, setLng] = useState(initialCoords?.lng || initialEvent?.lng || 55.2708);
  const [lng, setLng] = useState(initialCoords?.lng || 55.2708);
  const [searchInput, setSearchInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFlights, setShowFlights] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [showTrails, setShowTrails] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [conflictPoints, setConflictPoints] = useState<ConflictPoint[]>([]);
  const heatCanvasRef = useRef<HTMLCanvasElement>(null);
  const trailHistoryRef = useRef<Record<string, { lat: number; lng: number; ts: number }[]>>({});
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [mapVersion, setMapVersion] = useState(0); // increment on map move to re-render overlays
  const flightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const scriptLoadedRef = useRef(false);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-maps-key");
        if (!error && data?.apiKey) {
          setApiKey(data.apiKey);
        }
      } catch (e) {
        console.error("Failed to fetch Google Maps key:", e);
      } finally {
        setApiKeyLoading(false);
      }
    };
    fetchKey();
  }, []);

  // Load Google Maps JS API and create map
  useEffect(() => {
    if (!apiKey || scriptLoadedRef.current) return;

    const initMap = () => {
      if (!mapDivRef.current || !(window as any).google?.maps) return;
      const google = (window as any).google;
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat, lng },
        zoom: 12, // wider zoom so flights are visible
        mapTypeId: "satellite",
        tilt: 45,
        heading: 0,
        mapId: "WAROS_3D_MAP",
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;

      // Create a custom overlay to access MapCanvasProjection
      const overlay = new google.maps.OverlayView();
      overlay.onAdd = () => {};
      overlay.draw = () => {};
      overlay.onRemove = () => {};
      overlay.setMap(map);
      overlayRef.current = overlay;

      // Listen for map movements to re-render overlays
      const updateOverlays = () => setMapVersion((v) => v + 1);
      map.addListener("idle", updateOverlays);
      map.addListener("zoom_changed", updateOverlays);
      map.addListener("bounds_changed", updateOverlays);
    };

    if ((window as any).google?.maps) {
      scriptLoadedRef.current = true;
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=maps3d`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      initMap();
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
    };
    document.head.appendChild(script);
  }, [apiKey]);

  // Update map center when lat/lng changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat, lng });
    }
  }, [lat, lng]);

  // Helper: convert lat/lng to pixel using Google Maps projection
  const latLngToPixel = useCallback(
    (pLat: number, pLng: number): { x: number; y: number } | null => {
      const overlay = overlayRef.current;
      if (!overlay) return null;
      try {
        const projection = overlay.getProjection();
        if (!projection) return null;
        const google = (window as any).google;
        const point = projection.fromLatLngToContainerPixel(
          new google.maps.LatLng(pLat, pLng)
        );
        if (!point) return null;
        return { x: point.x, y: point.y };
      } catch {
        return null;
      }
    },
    [mapVersion] // re-bind when map moves
  );

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
      } catch (e) {
        console.error("Heatmap data error:", e);
      }
    };
    fetchConflicts();
    const iv = setInterval(fetchConflicts, 300_000);
    return () => clearInterval(iv);
  }, []);

  // Render heatmap on canvas
  useEffect(() => {
    const canvas = heatCanvasRef.current;
    if (!canvas) return;
    const { w, h } = containerSize;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (!showHeatmap || conflictPoints.length === 0) return;

    conflictPoints.forEach((pt) => {
      const pos = latLngToPixel(pt.lat, pt.lng);
      if (!pos) return;
      if (pos.x < -150 || pos.x > w + 150 || pos.y < -150 || pos.y > h + 150) return;
      const radius = 30 + pt.severity * 20;
      const intensity = 0.15 + pt.severity * 0.08;
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
      if (pt.severity >= 3) {
        grad.addColorStop(0, `rgba(239, 68, 68, ${intensity})`);
        grad.addColorStop(0.5, `rgba(239, 68, 68, ${intensity * 0.4})`);
        grad.addColorStop(1, "rgba(239, 68, 68, 0)");
      } else {
        grad.addColorStop(0, `rgba(251, 191, 36, ${intensity})`);
        grad.addColorStop(0.5, `rgba(251, 146, 36, ${intensity * 0.4})`);
        grad.addColorStop(1, "rgba(251, 146, 36, 0)");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
    });
  }, [conflictPoints, showHeatmap, latLngToPixel, containerSize, mapVersion]);

  // Fetch live flights
  const fetchFlights = useCallback(async () => {
    if (!showFlights) return;
    setFlightsLoading(true);
    try {
      // Use map bounds if available, otherwise use center +/- 3 deg
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
        bbox = { lamin: lat - 3, lamax: lat + 3, lomin: lng - 3, lomax: lng + 3 };
      }

      const { data, error } = await supabase.functions.invoke("live-flights", { body: bbox });
      if (!error && data?.aircraft) {
        const newAircraft: Aircraft[] = data.aircraft;
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
        // Record trail history
        const now = Date.now();
        const history = { ...trailHistoryRef.current };
        const MAX_TRAIL = 8;
        const TRAIL_EXPIRE = 5 * 60 * 1000;
        newAircraft.forEach((ac) => {
          const trail = history[ac.icao24] || [];
          const last = trail[trail.length - 1];
          if (!last || last.lat !== ac.lat || last.lng !== ac.lng) {
            trail.push({ lat: ac.lat, lng: ac.lng, ts: now });
          }
          history[ac.icao24] = trail.filter(p => now - p.ts < TRAIL_EXPIRE).slice(-MAX_TRAIL);
        });
        const activeIds = new Set(newAircraft.map(a => a.icao24));
        Object.keys(history).forEach(id => { if (!activeIds.has(id)) delete history[id]; });
        trailHistoryRef.current = history;
        setAircraft(newAircraft);
      }
    } catch (e) {
      console.error("Failed to fetch flights:", e);
    } finally {
      setFlightsLoading(false);
    }
  }, [lat, lng, showFlights]);

  useEffect(() => {
    fetchFlights();
    flightIntervalRef.current = setInterval(fetchFlights, 30000);
    return () => {
      if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
    };
  }, [fetchFlights]);

  const navigateTo = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setSelectedAircraft(null);
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
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`)
      .then((r) => r.json())
      .then((results) => {
        if (results.length > 0) {
          navigateTo(parseFloat(results[0].lat), parseFloat(results[0].lon));
          setShowSearch(false);
        }
      })
      .catch(console.error);
  }, [searchInput, navigateTo]);

  const militaryCount = aircraft.filter((a) => a.is_military).length;
  const civilCount = aircraft.length - militaryCount;

  // Compute marker positions using Google Maps projection
  const markerPositions = useMemo(() => {
    if (!showMarkers || !showFlights) return [];
    return aircraft
      .map((ac) => {
        const pos = latLngToPixel(ac.lat, ac.lng);
        if (!pos) return null;
        const visible =
          pos.x >= -20 && pos.x <= containerSize.w + 20 &&
          pos.y >= -20 && pos.y <= containerSize.h + 20;
        if (!visible) return null;
        // Compute trail pixel positions
        const trail = (trailHistoryRef.current[ac.icao24] || [])
          .map((p) => latLngToPixel(p.lat, p.lng))
          .filter(Boolean) as { x: number; y: number }[];
        return { ...ac, px: pos.x, py: pos.y, visible: true, trail };
      })
      .filter(Boolean) as (Aircraft & { px: number; py: number; visible: boolean; trail: { x: number; y: number }[] })[];
  }, [aircraft, latLngToPixel, containerSize, showMarkers, showFlights, mapVersion]);

  return (
    <div className="absolute inset-0 z-[2000] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/90 backdrop-blur border-b border-border z-20">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
            Google 3D View
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            GOOGLE 3D TILES
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showSearch ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <Search className="h-3 w-3" /> Location
          </button>
          <button
            onClick={() => setShowFlights(!showFlights)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showFlights ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <Plane className="h-3 w-3" />
            Flights
            {aircraft.length > 0 && (
              <span className="bg-primary/20 text-primary text-[8px] px-1 rounded-full font-bold">
                {aircraft.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowMarkers(!showMarkers)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showMarkers ? "border-accent/50 bg-accent/10 text-accent-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            {showMarkers ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Markers
          </button>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showHeatmap ? "border-orange-500/50 bg-orange-500/10 text-orange-400" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <Flame className="h-3 w-3" />
            Heatmap
            {conflictPoints.length > 0 && (
              <span className="bg-orange-500/20 text-orange-400 text-[8px] px-1 rounded-full font-bold">
                {conflictPoints.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowTrails(!showTrails)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border transition-all ${showTrails ? "border-accent/50 bg-accent/10 text-accent-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <Navigation className="h-3 w-3" />
            Trails
          </button>
          <button
            onClick={() => fetchFlights()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase border border-border text-muted-foreground hover:bg-secondary transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${flightsLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search + presets */}
      {showSearch && (
        <div className="px-3 py-1.5 bg-card/80 backdrop-blur border-b border-border/50 z-20 space-y-1.5">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              placeholder="City name or coordinates (lat, lng)…"
              className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none"
              autoFocus
            />
            <button
              onClick={handleSearchSubmit}
              className="px-2 py-0.5 rounded text-[9px] font-mono uppercase border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
            >
              Go
            </button>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  navigateTo(p.lat, p.lng);
                  setShowSearch(false);
                }}
                className={`flex-shrink-0 px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${
                  Math.abs(lat - p.lat) < 0.01 && Math.abs(lng - p.lng) < 0.01
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative" ref={containerRef}>
        {/* Google Maps */}
        {apiKeyLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
                Initializing Google 3D Tiles…
              </p>
            </div>
          </div>
        ) : apiKey ? (
          <div ref={mapDivRef} className="absolute inset-0 w-full h-full" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="text-center space-y-2 max-w-sm px-4">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs font-mono text-muted-foreground">
                Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to enable 3D tiles.
              </p>
            </div>
          </div>
        )}

        {/* ===== CONFLICT HEATMAP CANVAS ===== */}
        <canvas
          ref={heatCanvasRef}
          className="absolute inset-0 w-full h-full z-[8] pointer-events-none"
          style={{ opacity: showHeatmap ? 0.85 : 0, transition: "opacity 0.5s ease" }}
        />

        {/* ===== TRAIL LINES ===== */}
        {showFlights && showMarkers && showTrails && markerPositions.length > 0 && (
          <svg className="absolute inset-0 w-full h-full z-[9] pointer-events-none overflow-hidden">
            <defs>
              <linearGradient id="trail-civ" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(96,165,250,0)" />
                <stop offset="100%" stopColor="rgba(96,165,250,0.7)" />
              </linearGradient>
              <linearGradient id="trail-mil" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(239,68,68,0)" />
                <stop offset="100%" stopColor="rgba(239,68,68,0.7)" />
              </linearGradient>
            </defs>
            {markerPositions.map((ac) => {
              if (ac.trail.length < 2) return null;
              const points = [...ac.trail, { x: ac.px, y: ac.py }];
              const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
              return (
                <path
                  key={`trail-${ac.icao24}`}
                  d={d}
                  fill="none"
                  stroke={`url(#trail-${ac.is_military ? "mil" : "civ"})`}
                  strokeWidth={ac.is_military ? 2 : 1.5}
                  strokeLinecap="round"
                  strokeDasharray={ac.is_military ? "none" : "4 2"}
                  opacity={0.8}
                  style={{ filter: `drop-shadow(0 0 3px ${ac.is_military ? "rgba(239,68,68,0.5)" : "rgba(96,165,250,0.4)"})` }}
                />
              );
            })}
          </svg>
        )}

        {/* ===== AIRCRAFT MARKERS OVERLAY ===== */}
        {showFlights && showMarkers && markerPositions.length > 0 && (
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            {markerPositions.map((ac) => (
              <div
                key={ac.icao24}
                className="absolute pointer-events-auto cursor-pointer group"
                style={{
                  left: ac.px,
                  top: ac.py,
                  transform: "translate(-50%, -50%)",
                  transition: "left 1.5s linear, top 1.5s linear",
                }}
                onClick={() => setSelectedAircraft(selectedAircraft?.icao24 === ac.icao24 ? null : ac)}
              >
                <div
                  className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{
                    width: 24,
                    height: 24,
                    marginLeft: -4,
                    marginTop: -4,
                    backgroundColor: ac.is_military ? "rgba(239,68,68,0.4)" : "rgba(96,165,250,0.3)",
                  }}
                />
                <div
                  className="relative flex items-center justify-center w-4 h-4"
                  style={{
                    filter: `drop-shadow(0 0 4px ${ac.is_military ? "rgba(239,68,68,0.8)" : "rgba(96,165,250,0.7)"})`,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={ac.is_military ? "#ef4444" : "#60a5fa"}
                    style={{ transform: `rotate(${ac.heading}deg)`, transition: "transform 1.5s linear" }}
                  >
                    <path d="M12 2L8 9H3l2 3.5L3 16h5l4 6 4-6h5l-2-3.5L21 9h-5L12 2z" />
                  </svg>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  <div
                    className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold"
                    style={{
                      backgroundColor: ac.is_military ? "rgba(239,68,68,0.85)" : "rgba(96,165,250,0.85)",
                      color: "#fff",
                      boxShadow: `0 0 8px ${ac.is_military ? "rgba(239,68,68,0.5)" : "rgba(96,165,250,0.5)"}`,
                    }}
                  >
                    {ac.callsign || ac.icao24}
                    <span className="text-white/70 ml-1">
                      {Math.round(ac.altitude)}m
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HUD Overlay */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div
            className="bg-black/70 backdrop-blur border border-primary/30 rounded px-2.5 py-1.5 font-mono text-[9px] text-primary/80 space-y-0.5"
            style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.1)" }}
          >
            <div className="text-primary font-bold text-[10px]">// GOOGLE 3D SATELLITE</div>
            <div>
              SECTOR {lat.toFixed(4)}N {Math.abs(lng).toFixed(4)}
              {lng >= 0 ? "E" : "W"}
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              PHOTOREALISTIC 3D TILES
            </div>
            {showMarkers && markerPositions.length > 0 && (
              <div className="flex items-center gap-1 text-blue-400">
                <Plane className="h-2.5 w-2.5" />
                {markerPositions.length} MARKERS ACTIVE
              </div>
            )}
          </div>
        </div>

        {/* Flight overlay */}
        {showFlights && aircraft.length > 0 && (
          <div className="absolute top-3 right-3 z-10 pointer-events-auto">
            <div
              className="bg-black/80 backdrop-blur border border-primary/30 rounded-lg p-2 w-56 max-h-[50vh] overflow-hidden"
              style={{ boxShadow: "0 0 20px hsl(190 100% 50% / 0.1)" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Plane className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-mono font-bold text-primary uppercase">
                    Live Airspace
                  </span>
                </div>
                <span className="text-[8px] font-mono text-muted-foreground">
                  {aircraft.length} tracked
                </span>
              </div>

              <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-border/30">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[8px] font-mono text-blue-400">
                    CIV: {civilCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-[8px] font-mono text-red-400">
                    MIL: {militaryCount}
                  </span>
                </div>
              </div>

              <div className="space-y-0.5 max-h-[35vh] overflow-y-auto">
                {aircraft
                  .sort((a, b) => (b.is_military ? 1 : 0) - (a.is_military ? 1 : 0))
                  .slice(0, 40)
                  .map((ac) => (
                    <button
                      key={ac.icao24}
                      onClick={() => setSelectedAircraft(selectedAircraft?.icao24 === ac.icao24 ? null : ac)}
                      className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-all ${
                        selectedAircraft?.icao24 === ac.icao24
                          ? "bg-primary/15 border border-primary/30"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <Plane
                        className="h-2.5 w-2.5 flex-shrink-0"
                        style={{
                          color: ac.is_military ? "#ef4444" : "#60a5fa",
                          transform: `rotate(${ac.heading}deg)`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-mono font-bold text-foreground/90 block truncate">
                          {ac.callsign || ac.icao24}
                        </span>
                        <span className="text-[7px] font-mono text-muted-foreground/60">
                          {Math.round(ac.altitude)}m • {Math.round(ac.velocity * 3.6)}km/h •{" "}
                          {ac.origin_country}
                        </span>
                      </div>
                      {ac.is_military && (
                        <span className="text-[6px] font-mono font-bold text-red-400 bg-red-500/15 px-1 rounded">
                          MIL
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Selected aircraft detail */}
        {selectedAircraft && (
          <div
            className="absolute bottom-14 left-3 z-10 pointer-events-auto bg-black/85 backdrop-blur border rounded-lg p-2.5 w-60"
            style={{
              borderColor: selectedAircraft.is_military
                ? "rgba(239,68,68,0.4)"
                : "rgba(96,165,250,0.4)",
              boxShadow: `0 0 20px ${
                selectedAircraft.is_military
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(96,165,250,0.15)"
              }`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Plane
                  className="h-3.5 w-3.5"
                  style={{
                    color: selectedAircraft.is_military ? "#ef4444" : "#60a5fa",
                    transform: `rotate(${selectedAircraft.heading}deg)`,
                  }}
                />
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{
                    color: selectedAircraft.is_military ? "#ef4444" : "#60a5fa",
                  }}
                >
                  {selectedAircraft.callsign || selectedAircraft.icao24}
                </span>
                {selectedAircraft.is_military && (
                  <span className="text-[7px] font-mono font-bold text-red-400 bg-red-500/15 px-1 rounded">
                    MILITARY
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedAircraft(null)}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <DataRow label="ICAO" value={selectedAircraft.icao24} />
              <DataRow label="ORIGIN" value={selectedAircraft.origin_country} />
              <DataRow label="ALT" value={`${Math.round(selectedAircraft.altitude)}m`} />
              <DataRow label="SPEED" value={`${Math.round(selectedAircraft.velocity * 3.6)} km/h`} />
              <DataRow label="HDG" value={`${Math.round(selectedAircraft.heading)}°`} />
              <DataRow label="V/S" value={`${selectedAircraft.vertical_rate > 0 ? "+" : ""}${selectedAircraft.vertical_rate.toFixed(1)} m/s`} />
              <DataRow label="LAT" value={selectedAircraft.lat.toFixed(4)} />
              <DataRow label="LNG" value={selectedAircraft.lng.toFixed(4)} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-card/70 backdrop-blur border-t border-border/50 z-20">
        <span className="text-[8px] font-mono text-muted-foreground uppercase">
          SRC: Google Photorealistic 3D Tiles • OpenSky Network
        </span>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/50">
          {showFlights
            ? `${aircraft.length} aircraft tracked • ${militaryCount} military • ${markerPositions.length} markers • Updates every 30s`
            : "Flight layer disabled"}
        </span>
      </div>
    </div>
  );
};

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[6px] font-mono text-muted-foreground/40 uppercase tracking-wider">
      {label}
    </span>
    <span className="text-[9px] font-mono text-foreground/80">{value}</span>
  </div>
);
