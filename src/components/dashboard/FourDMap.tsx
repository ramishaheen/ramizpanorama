import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { X, Globe, Satellite, Plane, Ship, Flame, Activity, Radio, Wind, Shield, Crosshair, Rocket, MapPin, Zap, Pause, Play, Eye, Anchor, Lock, Search, Target, AlertTriangle, Radar, ChevronDown, Sparkles, SlidersHorizontal, Monitor } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useEarthquakes } from "@/hooks/useEarthquakes";
import { useWildfires } from "@/hooks/useWildfires";
import { useConflictEvents } from "@/hooks/useConflictEvents";
import { useNuclearMonitors } from "@/hooks/useNuclearMonitors";
import { useAISVessels } from "@/hooks/useAISVessels";
import { useGeoFusion } from "@/hooks/useGeoFusion";
import { useAirQuality } from "@/hooks/useAirQuality";
import { getCountryGeoJSON } from "@/data/countryBorders";
import type { Rocket as RocketType } from "@/data/mockData";

interface FourDMapProps {
  onClose: () => void;
  rockets?: RocketType[];
}

interface LayerConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  count?: number;
}

// SGP4-lite propagator
function propagateSatellite(
  inclination: number, raan: number, meanAnomaly: number,
  meanMotion: number, eccentricity: number, epochYear: number,
  epochDay: number
): { lat: number; lng: number } {
  const now = new Date();
  const startOfYear = new Date(epochYear, 0, 1);
  const currentDayOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const elapsedDays = currentDayOfYear - epochDay;
  const totalRevs = elapsedDays * meanMotion;
  const currentMA = (((meanAnomaly + totalRevs * 360) % 360) + 360) % 360;
  const E = currentMA + (eccentricity * 180) / Math.PI * Math.sin((currentMA * Math.PI) / 180);
  const argLat = (E * Math.PI) / 180;
  const incRad = (inclination * Math.PI) / 180;
  const lat = Math.asin(Math.sin(incRad) * Math.sin(argLat)) * (180 / Math.PI);
  const greenwichOffset = now.getUTCHours() * 15 + now.getUTCMinutes() * 0.25 + now.getUTCSeconds() * (0.25 / 60);
  const ascNode = raan - greenwichOffset;
  const lng = (((ascNode + Math.atan2(Math.cos(incRad) * Math.sin(argLat), Math.cos(argLat)) * (180 / Math.PI)) % 360) + 540) % 360 - 180;
  return { lat: Math.max(-85, Math.min(85, lat)), lng };
}

interface SatPoint {
  name: string; lat: number; lng: number; alt: number; category: string;
  inclination: number; raan: number; meanAnomaly: number; meanMotion: number;
  eccentricity: number; epochYear: number; epochDay: number;
}

function parseTLE(name: string, tle1: string, tle2: string): SatPoint | null {
  try {
    const inclination = parseFloat(tle2.substring(8, 16).trim());
    const raan = parseFloat(tle2.substring(17, 25).trim());
    const eccentricity = parseFloat("0." + tle2.substring(26, 33).trim());
    const meanAnomaly = parseFloat(tle2.substring(43, 51).trim());
    const meanMotion = parseFloat(tle2.substring(52, 63).trim());
    const epochYearRaw = parseInt(tle1.substring(18, 20).trim());
    const epochDay = parseFloat(tle1.substring(20, 32).trim());
    const epochYear = epochYearRaw > 56 ? 1900 + epochYearRaw : 2000 + epochYearRaw;
    const T = 86400 / meanMotion;
    const a = Math.pow((398600.4418 * T * T) / (4 * Math.PI * Math.PI), 1 / 3);
    const alt = Math.max(a - 6371, 200);
    const pos = propagateSatellite(inclination, raan, meanAnomaly, meanMotion, eccentricity, epochYear, epochDay);
    const n = name.toUpperCase();
    let category = "Communication";
    if (n.includes("USA ") || n.includes("NROL") || n.includes("LACROSSE") || n.includes("COSMOS 2")) category = "Military";
    else if (n.includes("GPS") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU")) category = "Navigation";
    else if (n.includes("GOES") || n.includes("NOAA") || n.includes("METEOSAT") || n.includes("FENGYUN")) category = "Weather";
    else if (n.includes("LANDSAT") || n.includes("SENTINEL") || n.includes("WORLDVIEW") || n.includes("GAOFEN") || n.includes("BARS")) category = "Earth Observation";
    else if (n.includes("ISS") || n.includes("TIANGONG")) category = "Space Station";
    else if (n.includes("SBIRS") || n.includes("DSP")) category = "Early Warning";
    else if (n.includes("STARLINK")) category = "Starlink";
    return { name: name.trim(), lat: pos.lat, lng: pos.lng, alt: Math.min(alt, 42000), category, inclination, raan, meanAnomaly, meanMotion, eccentricity, epochYear, epochDay };
  } catch { return null; }
}

const TLE_URLS = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=tle",
];

const ALL_COUNTRY_CODES = ["IR", "IQ", "SY", "IL", "JO", "LB", "SA", "AE", "BH", "KW", "QA", "OM", "YE", "EG", "TR"];

const SEARCH_LOCATIONS: { name: string; lat: number; lng: number; type: string }[] = [
  { name: "Tehran", lat: 35.69, lng: 51.39, type: "city" },
  { name: "Baghdad", lat: 33.31, lng: 44.37, type: "city" },
  { name: "Damascus", lat: 33.51, lng: 36.29, type: "city" },
  { name: "Beirut", lat: 33.89, lng: 35.50, type: "city" },
  { name: "Jerusalem", lat: 31.77, lng: 35.23, type: "city" },
  { name: "Tel Aviv", lat: 32.08, lng: 34.78, type: "city" },
  { name: "Riyadh", lat: 24.71, lng: 46.68, type: "city" },
  { name: "Dubai", lat: 25.20, lng: 55.27, type: "city" },
  { name: "Doha", lat: 25.29, lng: 51.53, type: "city" },
  { name: "Ankara", lat: 39.93, lng: 32.85, type: "city" },
  { name: "Istanbul", lat: 41.01, lng: 28.98, type: "city" },
  { name: "Cairo", lat: 30.04, lng: 31.24, type: "city" },
  { name: "Amman", lat: 31.95, lng: 35.93, type: "city" },
  { name: "Kuwait City", lat: 29.38, lng: 47.99, type: "city" },
  { name: "Muscat", lat: 23.59, lng: 58.59, type: "city" },
  { name: "Manama", lat: 26.07, lng: 50.55, type: "city" },
  { name: "Sanaa", lat: 15.35, lng: 44.21, type: "city" },
  { name: "Aden", lat: 12.79, lng: 45.04, type: "city" },
  { name: "Isfahan", lat: 32.65, lng: 51.68, type: "city" },
  { name: "Tabriz", lat: 38.08, lng: 46.29, type: "city" },
  { name: "Natanz", lat: 33.51, lng: 51.92, type: "facility" },
  { name: "Fordow", lat: 34.88, lng: 51.23, type: "facility" },
  { name: "Bushehr NPP", lat: 28.83, lng: 50.89, type: "facility" },
  { name: "Dimona", lat: 31.00, lng: 35.15, type: "facility" },
  { name: "Incirlik Air Base", lat: 37.00, lng: 35.43, type: "military" },
  { name: "Al Udeid Air Base", lat: 25.12, lng: 51.31, type: "military" },
  { name: "Strait of Hormuz", lat: 26.57, lng: 56.25, type: "chokepoint" },
  { name: "Suez Canal", lat: 30.46, lng: 32.35, type: "chokepoint" },
  { name: "Bab el-Mandeb", lat: 12.58, lng: 43.33, type: "chokepoint" },
  { name: "Golan Heights", lat: 33.00, lng: 35.80, type: "conflict" },
  { name: "Gaza", lat: 31.50, lng: 34.47, type: "conflict" },
  { name: "Mosul", lat: 36.34, lng: 43.13, type: "city" },
  { name: "Aleppo", lat: 36.20, lng: 37.15, type: "city" },
  { name: "Hodeida", lat: 14.80, lng: 42.95, type: "city" },
  { name: "Kharg Island", lat: 29.23, lng: 50.32, type: "facility" },
  { name: "Jeddah", lat: 21.54, lng: 39.17, type: "city" },
  { name: "Basra", lat: 30.51, lng: 47.81, type: "city" },
];

// Key ISR satellites that get named labels on globe
const KEY_ISR_SATS = ["WORLDVIEW-3", "WORLDVIEW-2", "WV-LEGION-2", "WV-LEGION-1", "GAOFEN", "BARS-M", "COSMOS 2", "LACROSSE", "USA 224", "USA 245", "USA 314", "SENTINEL-2A", "SENTINEL-2B", "LANDSAT 9", "NROL"];

export const FourDMap = ({ onClose, rockets = [] }: FourDMapProps) => {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    satellites: true,
    flights: true,
    maritime: true,
    earthquakes: true,
    wildfires: true,
    conflicts: true,
    rockets: true,
    nuclear: true,
    airQuality: false,
    geoFusion: true,
    borders: true,
    gpsJamming: false,
    militaryFlights: true,
  });
  const [satellites, setSatellites] = useState<SatPoint[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const satIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const rafRef = useRef<number>();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Right panel state
  const [cleanUI, setCleanUI] = useState(false);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [sharpenEnabled, setSharpenEnabled] = useState(false);
  const [sharpenValue, setSharpenValue] = useState(50);
  const [hudEnabled, setHudEnabled] = useState(true);
  const [layoutPreset, setLayoutPreset] = useState<"TACTICAL" | "STRATEGIC" | "MINIMAL">("TACTICAL");
  const [panopticDensity, setPanopticDensity] = useState(70);
  const [panopticFlights, setPanopticFlights] = useState(true);
  const [panopticSats, setPanopticSats] = useState(true);
  const [panopticMaritime, setPanopticMaritime] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { data: earthquakes } = useEarthquakes();
  const { data: wildfires } = useWildfires();
  const { data: conflictEvents } = useConflictEvents();
  const { stations: nuclearStations, facilities: nuclearFacilities } = useNuclearMonitors();
  const { data: aisVessels } = useAISVessels();
  const { data: geoFusionData } = useGeoFusion();
  const { data: airQualityData } = useAirQuality();

  const toggleLayer = useCallback((id: string) => {
    setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const locResults = SEARCH_LOCATIONS.filter(l => l.name.toLowerCase().includes(q)).map(l => ({ ...l, source: "location" as const }));
    const satResults = satellites.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5).map(s => ({ name: s.name, lat: s.lat, lng: s.lng, type: "satellite", source: "satellite" as const }));
    const conflictResults = conflictEvents.filter(e => e.location.toLowerCase().includes(q) || e.country.toLowerCase().includes(q)).slice(0, 5).map(e => ({ name: `${e.event_type} — ${e.location}`, lat: e.lat, lng: e.lng, type: "conflict", source: "event" as const }));
    const vesselResults = aisVessels.filter(v => v.name.toLowerCase().includes(q)).slice(0, 5).map(v => ({ name: `🚢 ${v.name} (${v.flag})`, lat: v.lat, lng: v.lng, type: "vessel", source: "vessel" as const }));
    const fusionResults = (geoFusionData?.events || []).filter(e => e.location.toLowerCase().includes(q) || e.event_type.toLowerCase().includes(q)).slice(0, 5).map(e => ({ name: `📡 ${e.event_type} — ${e.location}`, lat: e.lat, lng: e.lng, type: "fusion", source: "event" as const }));
    const coordMatch = q.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
    const coordResults = coordMatch ? [{ name: `📍 ${coordMatch[1]}, ${coordMatch[2]}`, lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]), type: "coordinate", source: "location" as const }] : [];
    return [...coordResults, ...locResults, ...satResults, ...conflictResults, ...vesselResults, ...fusionResults].slice(0, 12);
  }, [searchQuery, satellites, conflictEvents, aisVessels, geoFusionData]);

  const handleSearchSelect = useCallback((result: { lat: number; lng: number }) => {
    const globe = globeRef.current;
    if (globe) globe.pointOfView({ lat: result.lat, lng: result.lng, altitude: 0.8 }, 1500);
    setSearchQuery("");
    setSearchFocused(false);
  }, []);

  // Fetch TLEs
  useEffect(() => {
    async function fetchTLEs() {
      try {
        const { data: proxyData } = await supabase.functions.invoke("tle-proxy", { body: { urls: TLE_URLS } });
        if (!proxyData?.results) return;
        const allSats: SatPoint[] = [];
        for (const result of proxyData.results) {
          const lines = (result.body || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
          for (let i = 0; i < lines.length - 2; i += 3) {
            if (lines[i + 1]?.startsWith("1 ") && lines[i + 2]?.startsWith("2 ")) {
              const sat = parseTLE(lines[i], lines[i + 1], lines[i + 2]);
              if (sat) allSats.push(sat);
            }
          }
        }
        const limited = allSats.length > 800 ? allSats.filter((_, i) => i % Math.ceil(allSats.length / 800) === 0) : allSats;
        setSatellites(limited);
      } catch (e) { console.error("4D TLE fetch error:", e); }
    }
    fetchTLEs();
  }, []);

  // Fetch flights
  useEffect(() => {
    async function fetchFlights() {
      try {
        const { data } = await supabase.functions.invoke("live-flights");
        if (data?.flights) setFlights(data.flights.slice(0, 500));
      } catch (e) { console.error("4D flights error:", e); }
    }
    fetchFlights();
    const iv = setInterval(fetchFlights, 30000);
    return () => clearInterval(iv);
  }, []);

  // Initialize globe
  useEffect(() => {
    if (!globeContainerRef.current) return;
    let destroyed = false;
    import("globe.gl").then(({ default: GlobeConstructor }) => {
      if (destroyed || !globeContainerRef.current) return;
      const globe = new GlobeConstructor(globeContainerRef.current)
        .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
        .atmosphereColor("hsl(190, 80%, 40%)")
        .atmosphereAltitude(0.18)
        .showAtmosphere(true)
        .width(globeContainerRef.current.clientWidth)
        .height(globeContainerRef.current.clientHeight)
        .pointsData([]).pointLat("lat").pointLng("lng").pointAltitude("pointAlt").pointColor("color").pointRadius("radius").pointLabel("label")
        .objectsData([]).objectLat("lat").objectLng("lng").objectAltitude("alt").objectLabel("label")
        .arcsData([]).arcStartLat("startLat").arcStartLng("startLng").arcEndLat("endLat").arcEndLng("endLng").arcColor("colors").arcStroke(0.6).arcDashLength(0.4).arcDashGap(0.15).arcDashAnimateTime(1200).arcAltitudeAutoScale(0.35)
        .polygonsData([]).polygonCapColor(() => "rgba(0, 200, 180, 0.04)").polygonSideColor(() => "rgba(0, 200, 180, 0.12)").polygonStrokeColor(() => "rgba(0, 220, 200, 0.35)").polygonAltitude(0.004);
      globe.pointOfView({ lat: 30, lng: 45, altitude: 2.2 });
      const controls = globe.controls() as any;
      if (controls) { controls.autoRotate = false; controls.enableDamping = true; controls.dampingFactor = 0.15; }
      globeRef.current = globe;
      const resizeObs = new ResizeObserver(() => {
        if (globeContainerRef.current && globe) {
          globe.width(globeContainerRef.current.clientWidth);
          globe.height(globeContainerRef.current.clientHeight);
        }
      });
      resizeObs.observe(globeContainerRef.current);
    });
    return () => { destroyed = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); if (satIntervalRef.current) clearInterval(satIntervalRef.current); };
  }, []);

  // Update sat positions
  useEffect(() => {
    if (!satellites.length) return;
    const updateSats = () => {
      const updated = satellites.map(s => {
        const pos = propagateSatellite(s.inclination, s.raan, s.meanAnomaly, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay);
        return { ...s, lat: pos.lat, lng: pos.lng };
      });
      setSatellites(updated);
    };
    satIntervalRef.current = setInterval(updateSats, 500);
    return () => clearInterval(satIntervalRef.current);
  }, [satellites.length]);

  // Stats
  const stats = useMemo(() => ({
    sats: satellites.length,
    aircraft: flights.length,
    vessels: aisVessels.length,
    quakes: earthquakes.length,
    fires: wildfires.length,
    conflicts: conflictEvents.length,
    rockets: rockets.length,
    nuclear: nuclearStations.length + (nuclearFacilities?.length || 0),
    fusion: geoFusionData?.events?.length || 0,
    airQ: airQualityData.length,
  }), [satellites, flights, aisVessels, earthquakes, wildfires, conflictEvents, rockets, nuclearStations, nuclearFacilities, geoFusionData, airQualityData]);

  const layerConfigs: LayerConfig[] = [
    { id: "satellites", label: "Satellites", icon: <Satellite className="h-3.5 w-3.5" />, color: "#00d4ff", count: stats.sats },
    { id: "flights", label: "Aircraft", icon: <Plane className="h-3.5 w-3.5" />, color: "#00d4ff", count: stats.aircraft },
    { id: "militaryFlights", label: "Military Flights", icon: <Shield className="h-3.5 w-3.5" />, color: "#ef4444" },
    { id: "maritime", label: "Maritime / AIS", icon: <Ship className="h-3.5 w-3.5" />, color: "#22c55e", count: stats.vessels },
    { id: "earthquakes", label: "Earthquakes", icon: <Activity className="h-3.5 w-3.5" />, color: "#ef4444", count: stats.quakes },
    { id: "wildfires", label: "Wildfires", icon: <Flame className="h-3.5 w-3.5" />, color: "#ff4500", count: stats.fires },
    { id: "conflicts", label: "Conflicts", icon: <Crosshair className="h-3.5 w-3.5" />, color: "#f97316", count: stats.conflicts },
    { id: "rockets", label: "Rockets / Missiles", icon: <Rocket className="h-3.5 w-3.5" />, color: "#ef4444", count: stats.rockets },
    { id: "nuclear", label: "Nuclear Intel", icon: <Radio className="h-3.5 w-3.5" />, color: "#a855f7", count: stats.nuclear },
    { id: "airQuality", label: "Air Quality", icon: <Wind className="h-3.5 w-3.5" />, color: "#22c55e", count: stats.airQ },
    { id: "geoFusion", label: "Geo-Fusion Events", icon: <Zap className="h-3.5 w-3.5" />, color: "#eab308", count: stats.fusion },
    { id: "borders", label: "Country Borders", icon: <MapPin className="h-3.5 w-3.5" />, color: "#00ffc8" },
    { id: "gpsJamming", label: "GPS Jamming", icon: <Lock className="h-3.5 w-3.5" />, color: "#e879f9" },
  ];

  const totalActive = Object.values(layers).filter(Boolean).length;

  // Timeline
  const [playing, setPlaying] = useState(false);
  const [timelineValue, setTimelineValue] = useState(100);
  const [speed, setSpeed] = useState("1m/s");
  const [orbitMode, setOrbitMode] = useState<"OFF" | "FLAT" | "SPIRAL IN" | "SPIRAL OUT">("OFF");
  const speedOptions = ["1m/s", "3m/s", "5m/s", "15m/s", "1h/s"];
  const orbitOptions: typeof orbitMode[] = ["OFF", "FLAT", "SPIRAL IN", "SPIRAL OUT"];
  const orbitRef = useRef<number>();

  const speedMultiplier = useMemo(() => {
    const map: Record<string, number> = { "1m/s": 0.07, "3m/s": 0.21, "5m/s": 0.35, "15m/s": 1.05, "1h/s": 4.2 };
    return map[speed] || 0.07;
  }, [speed]);

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setTimelineValue(prev => {
        const next = prev + speedMultiplier;
        if (next >= 100) { setPlaying(false); return 100; }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [playing, speedMultiplier]);

  const timelineTimestamp = useMemo(() => {
    const now = Date.now();
    const twentyFourH = 24 * 60 * 60 * 1000;
    return now - twentyFourH + (timelineValue / 100) * twentyFourH;
  }, [timelineValue]);

  const timelineLabel = useMemo(() => {
    const d = new Date(timelineTimestamp);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }, [timelineTimestamp]);

  // Orbit camera control
  useEffect(() => {
    if (orbitMode === "OFF") {
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current);
      const controls = globeRef.current?.controls() as any;
      if (controls) controls.autoRotate = false;
      return;
    }
    const controls = globeRef.current?.controls() as any;
    if (!controls) return;
    if (orbitMode === "FLAT") {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.5;
    } else {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 2.0;
      const animate = () => {
        const globe = globeRef.current;
        if (!globe) return;
        const pov = globe.pointOfView();
        const dir = orbitMode === "SPIRAL IN" ? -0.002 : 0.002;
        const newAlt = Math.max(0.3, Math.min(5, pov.altitude + dir));
        globe.pointOfView({ ...pov, altitude: newAlt }, 0);
        if ((orbitMode === "SPIRAL IN" && newAlt <= 0.3) || (orbitMode === "SPIRAL OUT" && newAlt >= 5)) return;
        orbitRef.current = requestAnimationFrame(animate);
      };
      orbitRef.current = requestAnimationFrame(animate);
    }
    return () => { if (orbitRef.current) cancelAnimationFrame(orbitRef.current); if (controls) controls.autoRotate = false; };
  }, [orbitMode]);

  // Emulated GPS jamming zones
  const gpsJammingZones = useMemo(() => [
    { lat: 35.5, lng: 44.4, label: "NW Iraq Corridor", severity: "high", radius: 0.3, ts: Date.now() - 3600000 * 4 },
    { lat: 33.8, lng: 35.9, label: "Eastern Med / Lebanon", severity: "critical", radius: 0.25, ts: Date.now() - 3600000 * 1 },
    { lat: 32.0, lng: 34.8, label: "Tel Aviv TMA", severity: "high", radius: 0.2, ts: Date.now() - 3600000 * 6 },
    { lat: 36.2, lng: 37.1, label: "Aleppo Corridor", severity: "medium", radius: 0.2, ts: Date.now() - 3600000 * 8 },
    { lat: 29.0, lng: 50.8, label: "Persian Gulf South", severity: "medium", radius: 0.35, ts: Date.now() - 3600000 * 12 },
    { lat: 26.5, lng: 56.3, label: "Strait of Hormuz", severity: "critical", radius: 0.3, ts: Date.now() - 3600000 * 2 },
    { lat: 15.5, lng: 44.2, label: "Yemen Highlands", severity: "high", radius: 0.25, ts: Date.now() - 3600000 * 10 },
    { lat: 34.0, lng: 43.5, label: "Central Iraq", severity: "medium", radius: 0.2, ts: Date.now() - 3600000 * 18 },
  ], []);

  // Emulated events
  const emulatedEvents = useMemo(() => [
    { lat: 33.5, lng: 36.3, type: "Airstrike", color: "#ef4444", ts: Date.now() - 3600000 * 2, label: "Airstrike — Damascus suburbs", severity: "critical" as const },
    { lat: 32.6, lng: 44.0, type: "IED", color: "#f97316", ts: Date.now() - 3600000 * 5, label: "IED detonation — Karbala road", severity: "high" as const },
    { lat: 15.3, lng: 44.2, type: "Drone Strike", color: "#ef4444", ts: Date.now() - 3600000 * 1, label: "UAV strike — Sanaa outskirts", severity: "critical" as const },
    { lat: 31.5, lng: 34.5, type: "Rocket Barrage", color: "#dc2626", ts: Date.now() - 3600000 * 3, label: "Rocket barrage — Gaza border", severity: "critical" as const },
    { lat: 36.3, lng: 43.1, type: "Recon Overflight", color: "#00d4ff", ts: Date.now() - 3600000 * 7, label: "ISR overflight — Mosul", severity: "low" as const },
    { lat: 34.9, lng: 51.3, type: "Centrifuge Activity", color: "#a855f7", ts: Date.now() - 3600000 * 9, label: "Fordow — unusual activity", severity: "high" as const },
    { lat: 29.2, lng: 50.3, type: "Naval Movement", color: "#22c55e", ts: Date.now() - 3600000 * 4, label: "IRGCN fast boats — Kharg", severity: "medium" as const },
    { lat: 25.3, lng: 55.3, type: "Cyber Incident", color: "#e879f9", ts: Date.now() - 3600000 * 11, label: "Cyber probe — Dubai infrastructure", severity: "medium" as const },
    { lat: 33.3, lng: 44.4, type: "Protest", color: "#eab308", ts: Date.now() - 3600000 * 6, label: "Mass gathering — Baghdad", severity: "low" as const },
    { lat: 37.0, lng: 35.4, type: "Military Buildup", color: "#ef4444", ts: Date.now() - 3600000 * 14, label: "Armor movement — Incirlik", severity: "high" as const },
    { lat: 30.1, lng: 31.4, type: "Border Incident", color: "#f97316", ts: Date.now() - 3600000 * 16, label: "Sinai border clash", severity: "medium" as const },
    { lat: 12.8, lng: 45.0, type: "Maritime Interdiction", color: "#00d4ff", ts: Date.now() - 3600000 * 8, label: "Vessel seizure — Bab el-Mandeb", severity: "medium" as const },
    { lat: 35.7, lng: 51.4, type: "SIGINT Spike", color: "#e879f9", ts: Date.now() - 3600000 * 13, label: "SIGINT spike — Tehran", severity: "high" as const },
    { lat: 24.7, lng: 46.7, type: "Air Defense Test", color: "#a855f7", ts: Date.now() - 3600000 * 20, label: "Patriot test fire — Riyadh", severity: "medium" as const },
  ], []);

  // Unified event feed — combines all sources, filtered by timeline
  const unifiedFeed = useMemo(() => {
    const cutoff = timelineTimestamp;
    const feed: { id: string; ts: number; type: string; label: string; lat: number; lng: number; severity: string; color: string; source: string }[] = [];

    emulatedEvents.forEach((ev, i) => {
      if (ev.ts <= cutoff) {
        feed.push({ id: `emu-${i}`, ts: ev.ts, type: ev.type, label: ev.label, lat: ev.lat, lng: ev.lng, severity: ev.severity, color: ev.color, source: "OSINT" });
      }
    });

    if (geoFusionData?.events) {
      geoFusionData.events.forEach((ev, i) => {
        const evTs = new Date(ev.timestamp).getTime();
        if (evTs <= cutoff || isNaN(evTs)) {
          const sev = ev.severity >= 4 ? "critical" : ev.severity >= 3 ? "high" : ev.severity >= 2 ? "medium" : "low";
          const col = ev.severity >= 4 ? "#dc2626" : ev.severity >= 3 ? "#f97316" : "#eab308";
          feed.push({ id: `geo-${i}`, ts: isNaN(evTs) ? Date.now() - i * 600000 : evTs, type: ev.event_type, label: `${ev.event_type} — ${ev.location}, ${ev.country}`, lat: ev.lat, lng: ev.lng, severity: sev, color: col, source: "GEO-FUSION" });
        }
      });
    }

    conflictEvents.forEach((ev, i) => {
      const evTs = new Date(ev.event_date).getTime();
      if (evTs <= cutoff || isNaN(evTs)) {
        const col = ev.severity === "critical" ? "#dc2626" : ev.severity === "high" ? "#f97316" : "#eab308";
        feed.push({ id: `con-${i}`, ts: isNaN(evTs) ? Date.now() - i * 300000 : evTs, type: ev.event_type, label: `${ev.event_type} — ${ev.location}`, lat: ev.lat, lng: ev.lng, severity: ev.severity, color: col, source: "ACLED" });
      }
    });

    earthquakes.forEach((eq, i) => {
      const eqTs = eq.time || Date.now();
      if (eqTs <= cutoff) {
        const sev = eq.magnitude >= 6 ? "critical" : eq.magnitude >= 5 ? "high" : eq.magnitude >= 3 ? "medium" : "low";
        feed.push({ id: `eq-${i}`, ts: eqTs, type: "Earthquake", label: `M${eq.magnitude} — ${eq.place}`, lat: eq.lat, lng: eq.lng, severity: sev, color: eq.magnitude >= 5 ? "#ef4444" : "#fbbf24", source: "USGS" });
      }
    });

    wildfires.slice(0, 20).forEach((f, i) => {
      const fTs = new Date(`${f.date}T${f.time || "00:00"}Z`).getTime();
      if (!isNaN(fTs) && fTs <= cutoff) {
        feed.push({ id: `fire-${i}`, ts: fTs, type: "Wildfire", label: `Thermal — FRP ${f.frp}MW ${f.region || ""}`, lat: f.lat, lng: f.lng, severity: f.frp > 50 ? "high" : "medium", color: "#ff4500", source: "FIRMS" });
      }
    });

    gpsJammingZones.forEach((z, i) => {
      if (z.ts <= cutoff) {
        feed.push({ id: `jam-${i}`, ts: z.ts, type: "GPS Jamming", label: z.label, lat: z.lat, lng: z.lng, severity: z.severity, color: "#e879f9", source: "SIGINT" });
      }
    });

    feed.sort((a, b) => b.ts - a.ts);
    return feed.slice(0, 60);
  }, [timelineTimestamp, emulatedEvents, geoFusionData, conflictEvents, earthquakes, wildfires, gpsJammingZones]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current && playing) {
      feedRef.current.scrollTop = 0;
    }
  }, [unifiedFeed.length, playing]);

  // Timeline dots
  const timelineDots = useMemo(() => {
    const now = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const dots: { position: number; color: string; label: string }[] = [];
    emulatedEvents.forEach(ev => {
      const pos = ((ev.ts - (now - h24)) / h24) * 100;
      if (pos >= 0 && pos <= 100) dots.push({ position: pos, color: ev.color, label: ev.label });
    });
    if (geoFusionData?.events) {
      geoFusionData.events.slice(0, 15).forEach((ev, i) => {
        dots.push({ position: 15 + (i / 15) * 70, color: ev.severity >= 4 ? "#ef4444" : ev.severity >= 3 ? "#f97316" : "#00d4ff", label: ev.event_type });
      });
    }
    if (earthquakes.length) {
      earthquakes.slice(0, 8).forEach((eq) => {
        const eqTime = eq.time || (now - Math.random() * h24);
        const pos = ((eqTime - (now - h24)) / h24) * 100;
        dots.push({ position: Math.max(0, Math.min(100, pos)), color: eq.magnitude >= 5 ? "#ef4444" : "#fbbf24", label: `M${eq.magnitude}` });
      });
    }
    gpsJammingZones.forEach(z => {
      const pos = ((z.ts - (now - h24)) / h24) * 100;
      if (pos >= 0 && pos <= 100) dots.push({ position: pos, color: "#e879f9", label: `GPS JAM: ${z.label}` });
    });
    return dots;
  }, [geoFusionData, earthquakes, emulatedEvents, gpsJammingZones]);

  // Density multiplier from PANOPTIC
  const densityMult = panopticDensity / 100;

  // Key ISR satellites for labeled rendering
  const isrSatellites = useMemo(() => {
    return satellites.filter(s => KEY_ISR_SATS.some(k => s.name.toUpperCase().includes(k)));
  }, [satellites]);

  // Update globe data
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const points: any[] = [];
    const cutoff = timelineTimestamp;

    if (layers.earthquakes && earthquakes.length) {
      earthquakes.forEach(eq => {
        const eqTime = eq.time || Date.now();
        if (eqTime > cutoff) return;
        points.push({ lat: eq.lat, lng: eq.lng, pointAlt: 0.01, color: eq.magnitude >= 5 ? "#ef4444" : eq.magnitude >= 3 ? "#ff6b00" : "#fbbf24", radius: Math.max(0.15, eq.magnitude * 0.08) * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid #ef4444;padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:#ef4444;font-weight:bold">⚠ SEISMIC EVENT</div><div>M${eq.magnitude} — ${eq.place}</div><div style="color:#888;font-size:9px">${eq.lat.toFixed(3)}°, ${eq.lng.toFixed(3)}° • Depth: ${eq.depth}km</div></div>` });
      });
    }

    if (layers.wildfires && wildfires.length) {
      wildfires.forEach(f => {
        points.push({ lat: f.lat, lng: f.lng, pointAlt: 0.005, color: f.frp > 50 ? "#ff2200" : "#ff6600", radius: Math.max(0.1, f.brightness / 400) * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid #ff4500;padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:#ff4500;font-weight:bold">🔥 THERMAL ANOMALY</div><div>FRP: ${f.frp} MW • Confidence: ${f.confidence}</div><div style="color:#888;font-size:9px">FIRMS/VIIRS • ${f.date} ${f.time}</div></div>` });
      });
    }

    if (layers.conflicts && conflictEvents.length) {
      conflictEvents.forEach(ev => {
        const col = ev.severity === "critical" ? "#dc2626" : ev.severity === "high" ? "#f97316" : "#eab308";
        points.push({ lat: ev.lat, lng: ev.lng, pointAlt: 0.015, color: col, radius: 0.22 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${col};font-weight:bold">⚔ ${ev.event_type.toUpperCase()}</div><div>${ev.location}, ${ev.country}</div><div style="color:#888;font-size:9px">${ev.fatalities > 0 ? `Fatalities: ${ev.fatalities} • ` : ""}${ev.source}</div></div>` });
      });
    }

    if (layers.nuclear) {
      nuclearStations.forEach(st => {
        points.push({ lat: st.lat, lng: st.lng, pointAlt: 0.02, color: "#a855f7", radius: 0.15 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid #a855f7;padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:#a855f7;font-weight:bold">☢ RADIATION MONITOR</div><div>${st.name} — ${st.country}</div><div style="color:#888;font-size:9px">${st.dose_rate} ${st.unit} • ${st.network}</div></div>` });
      });
      nuclearFacilities.forEach(fac => {
        points.push({ lat: fac.lat, lng: fac.lng, pointAlt: 0.025, color: "#e879f9", radius: 0.2 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid #e879f9;padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:#e879f9;font-weight:bold">⚛ NUCLEAR FACILITY</div><div>${fac.name} — ${fac.country}</div><div style="color:#888;font-size:9px">${fac.type} • ${fac.status}${fac.capacity_mw ? ` • ${fac.capacity_mw}MW` : ""}</div></div>` });
      });
    }

    if (layers.maritime && aisVessels.length && panopticMaritime) {
      aisVessels.forEach(v => {
        const col = v.type === "MILITARY" ? "#ef4444" : v.type === "TANKER" ? "#f97316" : "#22c55e";
        points.push({ lat: v.lat, lng: v.lng, pointAlt: 0.003, color: col, radius: 0.12 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${col};font-weight:bold">🚢 ${v.type}</div><div>${v.name} (${v.flag})</div><div style="color:#888;font-size:9px">${v.speed}kn • HDG ${v.heading}° → ${v.destination || "Unknown"}</div></div>` });
      });
    }

    if (layers.flights && flights.length && panopticFlights) {
      flights.forEach(f => {
        const isMil = f.military || f.callsign?.match(/^(RCH|EVAC|DUKE|REAC|NAVY|JAKE|RRR)/i);
        if (!layers.militaryFlights && isMil) return;
        points.push({ lat: f.lat || f.latitude, lng: f.lng || f.longitude, pointAlt: 0.04, color: isMil ? "#ef4444" : "#00d4ff", radius: (isMil ? 0.12 : 0.06) * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid ${isMil ? "#ef4444" : "#00d4ff"};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${isMil ? "#ef4444" : "#00d4ff"};font-weight:bold">✈ ${isMil ? "MILITARY" : "CIVIL"} AIRCRAFT</div><div>${f.callsign || f.icao24 || "UNKNOWN"}</div><div style="color:#888;font-size:9px">${f.velocity ? Math.round(f.velocity * 3.6) + " km/h" : ""} • FL${f.baro_altitude ? Math.round(f.baro_altitude / 30.48) : "?"} • ${f.origin_country || ""}</div></div>` });
      });
    }

    if (layers.airQuality && airQualityData.length) {
      airQualityData.forEach(aq => {
        const aqi = aq.aqi || 0;
        const color = aqi > 150 ? "#dc2626" : aqi > 100 ? "#f97316" : aqi > 50 ? "#eab308" : "#22c55e";
        points.push({ lat: aq.lat, lng: aq.lng, pointAlt: 0.008, color, radius: 0.1 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid ${color};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${color};font-weight:bold">🌬 AIR QUALITY</div><div>${aq.city} — AQI: ${aqi}</div><div style="color:#888;font-size:9px">${aq.aqi_level} • PM2.5: ${aq.pm25 || "—"}</div></div>` });
      });
    }

    if (layers.geoFusion && geoFusionData?.events?.length) {
      geoFusionData.events.forEach(ev => {
        const col = ev.severity >= 4 ? "#dc2626" : ev.severity >= 3 ? "#f97316" : "#eab308";
        points.push({ lat: ev.lat, lng: ev.lng, pointAlt: 0.02, color: col, radius: 0.18 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${col};font-weight:bold">📡 ${ev.event_type.toUpperCase()}</div><div>${ev.location}, ${ev.country}</div><div style="color:#888;font-size:9px">${ev.source} • ${ev.confidence} confidence</div></div>` });
      });
    }

    if (layers.gpsJamming) {
      gpsJammingZones.forEach(z => {
        if (z.ts > cutoff) return;
        const col = z.severity === "critical" ? "#ff00ff" : z.severity === "high" ? "#e879f9" : "#c084fc";
        points.push({ lat: z.lat, lng: z.lng, pointAlt: 0.012, color: col, radius: z.radius * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid #e879f9;padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:#e879f9;font-weight:bold">📡 GPS JAMMING ZONE</div><div>${z.label}</div><div style="color:#888;font-size:9px">Severity: ${z.severity.toUpperCase()} • ${new Date(z.ts).toISOString().slice(11, 19)} UTC</div></div>` });
      });
    }

    emulatedEvents.forEach(ev => {
      if (ev.ts > cutoff) return;
      points.push({ lat: ev.lat, lng: ev.lng, pointAlt: 0.018, color: ev.color, radius: 0.2 * densityMult,
        label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid ${ev.color};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${ev.color};font-weight:bold">🎯 ${ev.type.toUpperCase()}</div><div>${ev.label}</div><div style="color:#888;font-size:9px">${new Date(ev.ts).toISOString().replace("T", " ").slice(0, 19)} UTC</div></div>` });
    });

    globe.pointsData(points);

    // Satellites with ISR labels
    if (layers.satellites && satellites.length && panopticSats) {
      const satObjects = satellites.map(s => {
        const isISR = KEY_ISR_SATS.some(k => s.name.toUpperCase().includes(k));
        const isMil = s.category === "Military" || s.category === "Early Warning";
        const satCol = isMil ? "#ef4444" : s.category === "Earth Observation" ? "#00d4ff" : s.category === "Navigation" ? "#22c55e" : s.category === "Weather" ? "#a855f7" : "#00d4ff";
        return {
          lat: s.lat, lng: s.lng,
          alt: s.alt / 6371 * 0.15,
          label: isISR
            ? `<div style="font-family:monospace;font-size:10px;background:rgba(5,5,15,0.95);border:1px solid ${satCol};padding:4px 8px;border-radius:3px;color:#f0f0f0;box-shadow:0 0 12px ${satCol}40">
                <div style="display:flex;align-items:center;gap:4px">
                  <span style="color:${satCol};font-size:8px">◆</span>
                  <span style="color:${satCol};font-weight:bold;font-size:9px;letter-spacing:1px">${s.name}</span>
                </div>
                <div style="color:#888;font-size:8px;margin-top:2px">${Math.round(s.alt)}km • ${s.category} • Inc ${s.inclination.toFixed(1)}°</div>
              </div>`
            : `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.9);border:1px solid #00d4ff;padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:#00d4ff;font-weight:bold">🛰 ${s.category.toUpperCase()}</div><div>${s.name}</div><div style="color:#888;font-size:9px">Alt: ${Math.round(s.alt)}km • Inc: ${s.inclination.toFixed(1)}°</div></div>`,
          satColor: satCol,
        };
      });
      globe.objectsData(satObjects);
    } else {
      globe.objectsData([]);
    }

    // Arcs — rockets, OSINT corridors, and satellite scan cones
    const arcs: any[] = [];
    if (layers.rockets && rockets.length) {
      rockets.forEach(r => {
        arcs.push({ startLat: r.originLat, startLng: r.originLng, endLat: r.targetLat, endLng: r.targetLng,
          colors: [r.severity === "critical" ? "rgba(239,68,68,0.9)" : "rgba(255,107,0,0.9)", r.status === "intercepted" ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.6)"] });
      });
    }
    if (layers.geoFusion) {
      arcs.push(
        { startLat: 35.69, startLng: 51.39, endLat: 33.51, endLng: 36.29, colors: ["rgba(239,68,68,0.5)", "rgba(239,68,68,0.2)"] },
        { startLat: 15.35, startLng: 44.21, endLat: 12.58, endLng: 43.33, colors: ["rgba(249,115,22,0.5)", "rgba(249,115,22,0.2)"] },
        { startLat: 26.57, startLng: 56.25, endLat: 25.20, endLng: 55.27, colors: ["rgba(234,179,8,0.4)", "rgba(234,179,8,0.15)"] },
        { startLat: 33.31, startLng: 44.37, endLat: 36.34, endLng: 43.13, colors: ["rgba(168,85,247,0.4)", "rgba(168,85,247,0.15)"] },
      );
    }
    // Satellite scan cone arcs for ISR sats
    if (layers.satellites && panopticSats) {
      isrSatellites.slice(0, 15).forEach(s => {
        const isMil = s.category === "Military" || s.category === "Early Warning";
        const col = isMil ? "rgba(239,68,68,0.35)" : "rgba(0,212,255,0.3)";
        arcs.push({ startLat: s.lat, startLng: s.lng, endLat: s.lat + (Math.random() - 0.5) * 4, endLng: s.lng + (Math.random() - 0.5) * 4,
          colors: [col, "rgba(255,255,255,0.05)"] });
      });
    }
    globe.arcsData(arcs);

    if (layers.borders) {
      globe.polygonsData(getCountryGeoJSON(ALL_COUNTRY_CODES).features);
    } else {
      globe.polygonsData([]);
    }
  }, [layers, earthquakes, wildfires, conflictEvents, nuclearStations, nuclearFacilities, aisVessels, flights, airQualityData, geoFusionData, satellites, rockets, timelineTimestamp, gpsJammingZones, emulatedEvents, densityMult, panopticFlights, panopticSats, panopticMaritime, isrSatellites]);

  const chipLayers = [
    { id: "flights", label: "Commercial Flights", icon: <Plane className="h-3 w-3" />, color: "#00d4ff" },
    { id: "militaryFlights", label: "Military Flights", icon: <Shield className="h-3 w-3" />, color: "#ef4444" },
    { id: "gpsJamming", label: "GPS Jamming", icon: <Lock className="h-3 w-3" />, color: "#22c55e" },
    { id: "satellites", label: "Imaging Satellites", icon: <Satellite className="h-3 w-3" />, color: "#00d4ff" },
    { id: "maritime", label: "Maritime Traffic", icon: <Anchor className="h-3 w-3" />, color: "#22c55e" },
    { id: "borders", label: "Airspace Closures", icon: <Shield className="h-3 w-3" />, color: "#ef4444" },
  ];

  const eventTypes = [
    { label: "Kinetic", color: "#ef4444" },
    { label: "Retaliation", color: "#ef4444" },
    { label: "Civilian Impact", color: "#f97316" },
    { label: "Maritime", color: "#00d4ff" },
    { label: "Infrastructure", color: "#a855f7" },
    { label: "Escalation", color: "#eab308" },
    { label: "Airspace Closure", color: "#22c55e" },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "city": return "🏙"; case "facility": return "⚛"; case "military": return "🎯";
      case "chokepoint": return "⚓"; case "conflict": return "⚔"; case "satellite": return "🛰";
      case "vessel": return "🚢"; case "fusion": return "📡"; case "coordinate": return "📍";
      default: return "📌";
    }
  };

  const getSeverityBorder = (sev: string) => {
    switch (sev) {
      case "critical": return "border-l-[#dc2626]";
      case "high": return "border-l-[#f97316]";
      case "medium": return "border-l-[#eab308]";
      default: return "border-l-[#00d4ff]";
    }
  };

  const handleFeedClick = useCallback((lat: number, lng: number) => {
    const globe = globeRef.current;
    if (globe) globe.pointOfView({ lat, lng, altitude: 1.0 }, 1200);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-[hsl(220,25%,5%)] flex flex-col" style={{
      filter: bloomEnabled ? "brightness(1.05) contrast(1.08)" : undefined,
    }}>
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-[10000] opacity-[0.03]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,210,255,0.1) 2px, rgba(0,210,255,0.1) 4px)",
      }} />

      <div className="flex flex-1 min-h-0">
        {/* Left Panel */}
        {!cleanUI && (
          <div className="w-56 flex-shrink-0 bg-[hsl(220,20%,7%)] border-r border-[hsl(190,60%,20%)] flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[hsl(190,60%,15%)] bg-[hsl(220,20%,6%)]">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Radar className="h-4 w-4 text-primary" />
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">GOTHAM • 4D</div>
                  <div className="text-[8px] tracking-[0.15em] text-muted-foreground uppercase">Intelligence Fusion</div>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)] bg-[hsl(220,20%,5%)]">
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "SAT", value: stats.sats, color: "#00d4ff" },
                  { label: "AIR", value: stats.aircraft, color: "#00d4ff" },
                  { label: "SEA", value: stats.vessels, color: "#22c55e" },
                  { label: "EQ", value: stats.quakes, color: "#ef4444" },
                  { label: "FIRE", value: stats.fires, color: "#ff4500" },
                  { label: "INTEL", value: stats.fusion, color: "#eab308" },
                ].map(s => (
                  <div key={s.label} className="text-center py-1 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,15%)]">
                    <div className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[7px] font-mono text-muted-foreground tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
              <span className="text-[9px] text-muted-foreground font-mono tracking-wider">
                {totalActive}/{layerConfigs.length} LAYERS ACTIVE
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {layerConfigs.map(layer => (
                <button key={layer.id} onClick={() => toggleLayer(layer.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all duration-150 border-l-2 ${layers[layer.id] ? "bg-[hsl(190,30%,10%)] border-l-primary" : "bg-transparent border-l-transparent hover:bg-[hsl(220,15%,10%)] hover:border-l-[hsl(190,60%,20%)]"}`}>
                  <Checkbox checked={layers[layer.id]} onCheckedChange={() => toggleLayer(layer.id)} className="h-3 w-3 pointer-events-none rounded-sm" />
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: layers[layer.id] ? layer.color : "#374151" }} />
                  <span className={`flex items-center gap-1 text-[10px] font-mono tracking-wide ${layers[layer.id] ? "text-foreground" : "text-muted-foreground"}`}>
                    {layer.icon} {layer.label}
                  </span>
                  {layer.count !== undefined && layers[layer.id] && layer.count > 0 && (
                    <span className="ml-auto text-[8px] font-mono px-1 py-0.5 rounded bg-[hsl(220,15%,15%)] text-muted-foreground">{layer.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-[hsl(190,60%,12%)] bg-[hsl(220,20%,5%)]">
              <div className="text-[7px] font-mono text-muted-foreground tracking-[0.15em] uppercase">WAROS • PALANTIR-CLASS OSINT</div>
              <div className="text-[7px] font-mono text-primary/40 mt-0.5">{new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</div>
            </div>
          </div>
        )}

        {/* Globe area */}
        <div className="flex-1 relative" style={{
          filter: sharpenEnabled ? `contrast(${1 + sharpenValue / 200})` : undefined,
        }}>
          <div ref={globeContainerRef} className="w-full h-full" />

          {/* Search bar */}
          {!cleanUI && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-80">
              <div className="relative">
                <div className="flex items-center bg-[hsl(220,20%,7%)/0.92] backdrop-blur-md border border-[hsl(190,60%,20%)] rounded-md overflow-hidden shadow-[0_0_20px_hsl(190,100%,50%/0.08)]">
                  <Search className="h-3.5 w-3.5 text-primary ml-3 flex-shrink-0" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    placeholder="Search locations, satellites, events..."
                    className="w-full bg-transparent text-[11px] font-mono text-foreground placeholder:text-muted-foreground px-3 py-2 outline-none" />
                  {searchQuery && <button onClick={() => setSearchQuery("")} className="mr-2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
                </div>
                {searchFocused && searchResults.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-[hsl(220,20%,7%)] border border-[hsl(190,60%,18%)] rounded-md shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <button key={i} onClick={() => handleSearchSelect(r)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[hsl(190,30%,12%)] transition-colors border-b border-[hsl(220,15%,12%)] last:border-0">
                        <span className="text-xs">{getTypeIcon(r.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-mono text-foreground truncate">{r.name}</div>
                          <div className="text-[8px] font-mono text-muted-foreground">{r.lat.toFixed(2)}°, {r.lng.toFixed(2)}°</div>
                        </div>
                        <Target className="h-3 w-3 text-primary/50 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* X close button — top right */}
          <button onClick={onClose}
            className="absolute top-3 right-3 z-30 w-8 h-8 flex items-center justify-center rounded bg-[hsl(220,20%,8%)/0.9] backdrop-blur border border-[hsl(0,60%,40%)] text-[hsl(0,80%,65%)] hover:bg-[hsl(0,60%,20%)] hover:text-[hsl(0,80%,80%)] transition-all shadow-[0_0_12px_hsl(0,80%,50%/0.2)]">
            <X className="h-4 w-4" />
          </button>

          {/* Title overlay */}
          {!cleanUI && hudEnabled && (
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[hsl(220,20%,7%)/0.85] backdrop-blur border border-[hsl(190,60%,18%)]">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold font-mono tracking-[0.15em] text-foreground">4D <span className="text-primary">MAP</span></span>
                <div className="w-px h-3 bg-[hsl(190,60%,20%)] mx-1" />
                <span className="text-[8px] font-mono text-muted-foreground tracking-[0.1em]">MULTI-SOURCE INTELLIGENCE FUSION</span>
                <div className="flex items-center gap-1 ml-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[8px] font-mono text-success">LIVE</span>
                </div>
              </div>
            </div>
          )}

          {/* REC indicator + ORB/PASS counters — top right area (left of X) */}
          {!cleanUI && hudEnabled && (
            <div className="absolute top-3 right-14 z-20 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[hsl(220,20%,7%)/0.85] backdrop-blur border border-[hsl(220,15%,15%)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                <span className="text-[8px] font-mono text-[#ef4444] tracking-wider">REC</span>
                <span className="text-[8px] font-mono text-muted-foreground">{new Date().toISOString().slice(11, 19)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[hsl(220,20%,7%)/0.85] backdrop-blur border border-[hsl(220,15%,15%)]">
                <span className="text-[8px] font-mono text-[#00d4ff]">ORB {isrSatellites.length}</span>
                <span className="text-[7px] text-muted-foreground">|</span>
                <span className="text-[8px] font-mono text-[#22c55e]">PASS {Math.min(isrSatellites.length, 5)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — Attributes + Event Feed */}
        {!cleanUI && (
          <div className="w-64 flex-shrink-0 bg-[hsl(220,20%,7%)] border-l border-[hsl(190,60%,20%)] flex flex-col overflow-hidden">
            {/* Attributes Header */}
            <div className="px-3 py-2 border-b border-[hsl(190,60%,15%)] bg-[hsl(220,20%,6%)]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">ATTRIBUTES</span>
              </div>
            </div>

            {/* Visual Controls */}
            <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)] space-y-2">
              {/* BLOOM */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-[#eab308]" />
                  <span className="text-[9px] font-mono text-foreground tracking-wider">BLOOM</span>
                </div>
                <button onClick={() => setBloomEnabled(!bloomEnabled)}
                  className={`w-8 h-4 rounded-full transition-colors ${bloomEnabled ? "bg-[#eab308]" : "bg-[hsl(220,15%,20%)]"}`}>
                  <div className={`w-3 h-3 rounded-full bg-foreground transition-transform mx-0.5 ${bloomEnabled ? "translate-x-3.5" : ""}`} />
                </button>
              </div>

              {/* SHARPEN */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-foreground tracking-wider">SHARPEN</span>
                  <button onClick={() => setSharpenEnabled(!sharpenEnabled)}
                    className={`w-8 h-4 rounded-full transition-colors ${sharpenEnabled ? "bg-primary" : "bg-[hsl(220,15%,20%)]"}`}>
                    <div className={`w-3 h-3 rounded-full bg-foreground transition-transform mx-0.5 ${sharpenEnabled ? "translate-x-3.5" : ""}`} />
                  </button>
                </div>
                {sharpenEnabled && (
                  <input type="range" min={0} max={100} value={sharpenValue} onChange={e => setSharpenValue(parseInt(e.target.value))}
                    className="w-full h-0.5 appearance-none bg-[hsl(190,30%,18%)] rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary" />
                )}
              </div>

              {/* HUD */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Monitor className="h-3 w-3 text-[#00d4ff]" />
                  <span className="text-[9px] font-mono text-foreground tracking-wider">HUD</span>
                </div>
                <button onClick={() => setHudEnabled(!hudEnabled)}
                  className={`w-8 h-4 rounded-full transition-colors ${hudEnabled ? "bg-[#00d4ff]" : "bg-[hsl(220,15%,20%)]"}`}>
                  <div className={`w-3 h-3 rounded-full bg-foreground transition-transform mx-0.5 ${hudEnabled ? "translate-x-3.5" : ""}`} />
                </button>
              </div>
            </div>

            {/* LAYOUT */}
            <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)]">
              <span className="text-[8px] font-mono text-muted-foreground tracking-[0.15em]">LAYOUT</span>
              <div className="flex gap-1 mt-1">
                {(["TACTICAL", "STRATEGIC", "MINIMAL"] as const).map(p => (
                  <button key={p} onClick={() => setLayoutPreset(p)}
                    className={`flex-1 px-1 py-1 rounded text-[8px] font-mono border transition-colors ${layoutPreset === p ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* PANOPTIC */}
            <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="text-[9px] font-mono text-[#22c55e] tracking-[0.15em] font-bold">PANOPTIC</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[8px] font-mono text-muted-foreground">DENSITY</span>
                    <span className="text-[8px] font-mono text-primary">{panopticDensity}%</span>
                  </div>
                  <input type="range" min={10} max={100} value={panopticDensity} onChange={e => setPanopticDensity(parseInt(e.target.value))}
                    className="w-full h-0.5 appearance-none bg-[hsl(190,30%,18%)] rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#22c55e]" />
                </div>
                {[
                  { label: "Flights", value: panopticFlights, set: setPanopticFlights, icon: <Plane className="h-2.5 w-2.5" /> },
                  { label: "Satellites", value: panopticSats, set: setPanopticSats, icon: <Satellite className="h-2.5 w-2.5" /> },
                  { label: "Maritime", value: panopticMaritime, set: setPanopticMaritime, icon: <Ship className="h-2.5 w-2.5" /> },
                ].map(t => (
                  <div key={t.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {t.icon}
                      <span className="text-[8px] font-mono text-muted-foreground">{t.label}</span>
                    </div>
                    <button onClick={() => t.set(!t.value)}
                      className={`w-7 h-3.5 rounded-full transition-colors ${t.value ? "bg-[#22c55e]" : "bg-[hsl(220,15%,20%)]"}`}>
                      <div className={`w-2.5 h-2.5 rounded-full bg-foreground transition-transform mx-0.5 ${t.value ? "translate-x-3" : ""}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* CLEAN UI */}
            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,12%)]">
              <button onClick={() => setCleanUI(true)}
                className="w-full px-2 py-1.5 rounded text-[9px] font-mono tracking-wider border border-[hsl(220,15%,18%)] text-muted-foreground hover:bg-[hsl(220,15%,12%)] hover:text-foreground transition-colors text-center">
                CLEAN UI
              </button>
            </div>

            {/* Event Feed Header */}
            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,12%)] bg-[hsl(220,20%,6%)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-[#f97316]" />
                  <span className="text-[9px] font-bold tracking-[0.15em] text-foreground uppercase font-mono">EVENT FEED</span>
                </div>
                <span className="text-[8px] font-mono text-muted-foreground">{unifiedFeed.length}</span>
              </div>
            </div>

            {/* Event Feed Scroll */}
            <div ref={feedRef} className="flex-1 overflow-y-auto">
              {unifiedFeed.map(ev => (
                <button key={ev.id} onClick={() => handleFeedClick(ev.lat, ev.lng)}
                  className={`w-full text-left px-2 py-1.5 border-b border-[hsl(220,15%,10%)] border-l-2 ${getSeverityBorder(ev.severity)} hover:bg-[hsl(190,20%,10%)] transition-colors`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono font-bold truncate" style={{ color: ev.color }}>{ev.type.toUpperCase()}</span>
                    <span className="text-[7px] font-mono text-muted-foreground flex-shrink-0 ml-1">{ev.source}</span>
                  </div>
                  <div className="text-[8px] font-mono text-foreground/80 truncate mt-0.5">{ev.label}</div>
                  <div className="text-[7px] font-mono text-muted-foreground mt-0.5">
                    {new Date(ev.ts).toISOString().slice(11, 19)} UTC • {ev.lat.toFixed(2)}°, {ev.lng.toFixed(2)}°
                  </div>
                </button>
              ))}
              {unifiedFeed.length === 0 && (
                <div className="px-3 py-4 text-center text-[9px] font-mono text-muted-foreground">No events in current window</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CLEAN UI restore button */}
      {cleanUI && (
        <button onClick={() => setCleanUI(false)}
          className="fixed bottom-20 right-4 z-[10001] px-3 py-1.5 rounded bg-[hsl(220,20%,7%)/0.8] backdrop-blur border border-[hsl(190,60%,18%)] text-[9px] font-mono text-primary hover:bg-primary/10 transition-colors">
          RESTORE UI
        </button>
      )}

      {/* Bottom Timeline Bar */}
      {!cleanUI && (
        <div className="flex-shrink-0 bg-[hsl(220,20%,6%)] border-t border-[hsl(190,60%,15%)]">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button onClick={() => setPlaying(!playing)}
              className="flex items-center justify-center h-6 w-6 rounded border border-[hsl(190,60%,20%)] text-primary hover:bg-primary/10 transition-colors">
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <span className="text-[8px] font-mono text-muted-foreground w-28 flex-shrink-0">{timelineLabel}</span>
            <div className="flex-1 relative h-5 flex items-center">
              {timelineDots.map((dot, i) => (
                <div key={i} className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full z-10 pointer-events-none" style={{ left: `${dot.position}%`, backgroundColor: dot.color }} title={dot.label} />
              ))}
              <input type="range" min={0} max={100} step={0.1} value={timelineValue} onChange={e => { setTimelineValue(parseFloat(e.target.value)); setPlaying(false); }}
                className="w-full h-0.5 appearance-none bg-[hsl(190,30%,18%)] rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_8px_hsl(190_100%_50%/0.4)] [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20" />
            </div>
            <span className="text-[8px] font-mono text-primary flex-shrink-0">{timelineValue >= 99.5 ? "LIVE" : `T-${Math.round((100 - timelineValue) * 14.4)}m`}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 border-t border-[hsl(220,15%,10%)]">
            <span className="text-[8px] font-mono text-muted-foreground tracking-[0.15em]">SPEED:</span>
            {speedOptions.map(s => (
              <button key={s} onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${speed === s ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>{s}</button>
            ))}
            <div className="w-px h-3 bg-[hsl(220,15%,15%)] mx-1" />
            <span className="text-[8px] font-mono text-muted-foreground tracking-[0.15em]">ORBIT:</span>
            {orbitOptions.map(o => (
              <button key={o} onClick={() => setOrbitMode(o)}
                className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${orbitMode === o ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>{o}</button>
            ))}
            <div className="flex-1" />
            <span className="text-[8px] font-mono text-muted-foreground">{unifiedFeed.length} EVENTS</span>
          </div>

          <div className="flex items-center gap-1 px-3 py-1 border-t border-[hsl(220,15%,10%)] flex-wrap">
            {chipLayers.map(chip => (
              <button key={chip.id} onClick={() => toggleLayer(chip.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${layers[chip.id] ? "border-primary/40 bg-primary/8 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>
                {chip.icon} {chip.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1 border-t border-[hsl(220,15%,10%)]">
            {eventTypes.map(evt => (
              <div key={evt.label} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: evt.color }} />
                <span className="text-[8px] font-mono text-muted-foreground">{evt.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
