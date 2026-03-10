import { useEffect, useRef, useState, useCallback } from "react";
import { X, Globe, Satellite, Plane, Ship, Flame, Activity, Radio, Wind, Shield, Crosshair, Rocket, MapPin, Zap } from "lucide-react";
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
import militarySatSprite from "@/assets/military-sat-sprite.png";
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

// SGP4-lite propagator (reused from SatelliteGlobe)
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
  const nu = E;
  const argLat = (nu * Math.PI) / 180;
  const incRad = (inclination * Math.PI) / 180;
  const lat = Math.asin(Math.sin(incRad) * Math.sin(argLat)) * (180 / Math.PI);
  const greenwichOffset = now.getUTCHours() * 15 + now.getUTCMinutes() * 0.25 + now.getUTCSeconds() * (0.25 / 60);
  const ascNode = raan - greenwichOffset;
  const lng = (((ascNode + Math.atan2(Math.cos(incRad) * Math.sin(argLat), Math.cos(argLat)) * (180 / Math.PI)) % 360) + 540) % 360 - 180;
  return { lat: Math.max(-85, Math.min(85, lat)), lng };
}

interface SatPoint {
  name: string;
  lat: number;
  lng: number;
  alt: number;
  category: string;
  inclination: number;
  raan: number;
  meanAnomaly: number;
  meanMotion: number;
  eccentricity: number;
  epochYear: number;
  epochDay: number;
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
    const GM = 398600.4418;
    const T = 86400 / meanMotion;
    const a = Math.pow((GM * T * T) / (4 * Math.PI * Math.PI), 1 / 3);
    const alt = Math.max(a - 6371, 200);
    const pos = propagateSatellite(inclination, raan, meanAnomaly, meanMotion, eccentricity, epochYear, epochDay);
    const n = name.toUpperCase();
    let category = "Communication";
    if (n.includes("USA ") || n.includes("NROL") || n.includes("LACROSSE") || n.includes("COSMOS 2")) category = "Military";
    else if (n.includes("GPS") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU")) category = "Navigation";
    else if (n.includes("GOES") || n.includes("NOAA") || n.includes("METEOSAT") || n.includes("FENGYUN")) category = "Weather";
    else if (n.includes("LANDSAT") || n.includes("SENTINEL") || n.includes("WORLDVIEW")) category = "Earth Observation";
    else if (n.includes("ISS") || n.includes("TIANGONG")) category = "Space Station";
    else if (n.includes("SBIRS") || n.includes("DSP")) category = "Early Warning";
    return { name: name.trim(), lat: pos.lat, lng: pos.lng, alt: Math.min(alt, 42000), category, inclination, raan, meanAnomaly, meanMotion, eccentricity, epochYear, epochDay };
  } catch { return null; }
}

const TLE_URLS = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=tle",
];

const ALL_COUNTRY_CODES = ["IR", "IQ", "SY", "IL", "JO", "LB", "SA", "AE", "BH", "KW", "QA", "OM", "YE", "EG", "TR"];

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
  });
  const [satellites, setSatellites] = useState<SatPoint[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const satIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const rafRef = useRef<number>();

  // Hooks for data
  const { data: earthquakes } = useEarthquakes();
  const { data: wildfires } = useWildfires();
  const { data: conflictEvents } = useConflictEvents();
  const { stations: nuclearStations } = useNuclearMonitors();
  const { data: aisVessels } = useAISVessels();
  const { data: geoFusionData } = useGeoFusion();
  const { data: airQualityData } = useAirQuality();

  const toggleLayer = useCallback((id: string) => {
    setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Fetch TLE data for satellites
  useEffect(() => {
    async function fetchTLEs() {
      try {
        const { data: proxyData } = await supabase.functions.invoke("tle-proxy", {
          body: { urls: TLE_URLS },
        });
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
        // Limit to ~800 for performance
        const limited = allSats.length > 800
          ? allSats.filter((_, i) => i % Math.ceil(allSats.length / 800) === 0)
          : allSats;
        setSatellites(limited);
      } catch (e) {
        console.error("4D TLE fetch error:", e);
      }
    }
    fetchTLEs();
  }, []);

  // Fetch live flights
  useEffect(() => {
    async function fetchFlights() {
      try {
        const { data } = await supabase.functions.invoke("live-flights");
        if (data?.flights) setFlights(data.flights.slice(0, 500));
      } catch (e) {
        console.error("4D flights error:", e);
      }
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
        .atmosphereColor("hsl(190, 100%, 50%)")
        .atmosphereAltitude(0.2)
        .showAtmosphere(true)
        .animations(true)
        .width(globeContainerRef.current.clientWidth)
        .height(globeContainerRef.current.clientHeight)
        .pointsData([])
        .pointLat("lat")
        .pointLng("lng")
        .pointAltitude("pointAlt")
        .pointColor("color")
        .pointRadius("radius")
        .pointLabel("label")
        .objectsData([])
        .objectLat("lat")
        .objectLng("lng")
        .objectAltitude("alt")
        .objectLabel("label")
        .arcsData([])
        .arcStartLat("startLat")
        .arcStartLng("startLng")
        .arcEndLat("endLat")
        .arcEndLng("endLng")
        .arcColor("colors")
        .arcStroke(0.5)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(1500)
        .arcAltitudeAutoScale(0.3)
        .polygonsData([])
        .polygonCapColor(() => "rgba(0, 255, 200, 0.06)")
        .polygonSideColor(() => "rgba(0, 255, 200, 0.15)")
        .polygonStrokeColor(() => "rgba(0, 255, 200, 0.4)")
        .polygonAltitude(0.005);

      globe.pointOfView({ lat: 30, lng: 45, altitude: 2.5 });

      // Enable auto-rotate
      const controls = globe.controls() as any;
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
      }

      globeRef.current = globe;

      // Handle resize
      const resizeObs = new ResizeObserver(() => {
        if (globeContainerRef.current && globe) {
          globe.width(globeContainerRef.current.clientWidth);
          globe.height(globeContainerRef.current.clientHeight);
        }
      });
      resizeObs.observe(globeContainerRef.current);
    });

    return () => {
      destroyed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (satIntervalRef.current) clearInterval(satIntervalRef.current);
    };
  }, []);

  // Update satellite positions every 500ms
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

  // Update globe data based on active layers
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    // Collect points
    const points: any[] = [];

    if (layers.earthquakes && earthquakes.length) {
      earthquakes.forEach(eq => {
        points.push({
          lat: eq.lat, lng: eq.lng,
          pointAlt: 0.01,
          color: eq.magnitude >= 5 ? "#ef4444" : eq.magnitude >= 3 ? "#ff6b00" : "#fbbf24",
          radius: Math.max(0.15, eq.magnitude * 0.08),
          label: `🔴 M${eq.magnitude} — ${eq.place}`,
        });
      });
    }

    if (layers.wildfires && wildfires.length) {
      wildfires.forEach(f => {
        points.push({
          lat: f.lat, lng: f.lng,
          pointAlt: 0.005,
          color: "#ff4500",
          radius: Math.max(0.1, f.brightness / 500),
          label: `🔥 Fire — FRP: ${f.frp} — ${f.confidence}`,
        });
      });
    }

    if (layers.conflicts && conflictEvents.length) {
      conflictEvents.forEach(ev => {
        points.push({
          lat: ev.lat, lng: ev.lng,
          pointAlt: 0.015,
          color: ev.severity === "critical" ? "#dc2626" : ev.severity === "high" ? "#f97316" : "#eab308",
          radius: 0.2,
          label: `⚔️ ${ev.event_type} — ${ev.location}, ${ev.country}`,
        });
      });
    }

    if (layers.nuclear && nuclearStations.length) {
      nuclearStations.forEach(st => {
        points.push({
          lat: st.lat, lng: st.lng,
          pointAlt: 0.02,
          color: "#a855f7",
          radius: 0.15,
          label: `☢️ ${st.name} — ${st.dose_rate} ${st.unit}`,
        });
      });
    }

    if (layers.maritime && aisVessels.length) {
      aisVessels.forEach(v => {
        points.push({
          lat: v.lat, lng: v.lng,
          pointAlt: 0.003,
          color: v.type === "MILITARY" ? "#ef4444" : v.type === "TANKER" ? "#f97316" : "#22c55e",
          radius: 0.12,
          label: `🚢 ${v.name} (${v.flag}) — ${v.speed}kn → ${v.destination || "Unknown"}`,
        });
      });
    }

    if (layers.flights && flights.length) {
      flights.forEach(f => {
        points.push({
          lat: f.lat || f.latitude, lng: f.lng || f.longitude,
          pointAlt: 0.04,
          color: f.military ? "#ef4444" : "#00d4ff",
          radius: 0.08,
          label: `✈️ ${f.callsign || f.icao24 || "Unknown"} — ${f.velocity ? Math.round(f.velocity * 3.6) + " km/h" : ""}`,
        });
      });
    }

    if (layers.airQuality && airQualityData.length) {
      airQualityData.forEach(aq => {
        const aqi = aq.aqi || 0;
        const color = aqi > 150 ? "#dc2626" : aqi > 100 ? "#f97316" : aqi > 50 ? "#eab308" : "#22c55e";
        points.push({
          lat: aq.lat, lng: aq.lng,
          pointAlt: 0.008,
          color,
          radius: 0.1,
          label: `🌬️ ${aq.city} — AQI: ${aqi} (${aq.aqi_level})`,
        });
      });
    }

    if (layers.geoFusion && geoFusionData?.events?.length) {
      geoFusionData.events.forEach(ev => {
        points.push({
          lat: ev.lat, lng: ev.lng,
          pointAlt: 0.02,
          color: ev.severity >= 4 ? "#dc2626" : ev.severity >= 3 ? "#f97316" : "#eab308",
          radius: 0.18,
          label: `📡 ${ev.event_type} — ${ev.location}, ${ev.country}`,
        });
      });
    }

    globe.pointsData(points);

    // Satellites as objects
    if (layers.satellites && satellites.length) {
      const satObjects = satellites.map(s => ({
        lat: s.lat,
        lng: s.lng,
        alt: s.alt / 6371 * 0.15,
        label: `🛰️ ${s.name} — ${s.category} — Alt: ${Math.round(s.alt)}km`,
        satColor: s.category === "Military" ? "#ef4444" : s.category === "Navigation" ? "#22c55e" : "#00d4ff",
      }));
      globe.objectsData(satObjects);
    } else {
      globe.objectsData([]);
    }

    // Arcs for rockets
    if (layers.rockets && rockets.length) {
      const arcs = rockets.map(r => ({
        startLat: r.originLat,
        startLng: r.originLng,
        endLat: r.targetLat,
        endLng: r.targetLng,
        colors: [
          r.severity === "critical" ? "rgba(239,68,68,0.9)" : "rgba(255,107,0,0.9)",
          r.status === "intercepted" ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.6)",
        ],
      }));
      globe.arcsData(arcs);
    } else {
      globe.arcsData([]);
    }

    // Polygons for borders
    if (layers.borders) {
      const geojson = getCountryGeoJSON(ALL_COUNTRY_CODES);
      globe.polygonsData(geojson.features);
    } else {
      globe.polygonsData([]);
    }
  }, [layers, earthquakes, wildfires, conflictEvents, nuclearStations, aisVessels, flights, airQualityData, geoFusionData, satellites, rockets]);

  // Layer configs for UI
  const layerConfigs: LayerConfig[] = [
    { id: "satellites", label: "Satellites", icon: <Satellite className="h-3.5 w-3.5" />, color: "#00d4ff", count: layers.satellites ? satellites.length : 0 },
    { id: "flights", label: "Aircraft", icon: <Plane className="h-3.5 w-3.5" />, color: "#00d4ff", count: layers.flights ? flights.length : 0 },
    { id: "maritime", label: "Maritime / AIS", icon: <Ship className="h-3.5 w-3.5" />, color: "#22c55e", count: layers.maritime ? aisVessels.length : 0 },
    { id: "earthquakes", label: "Earthquakes", icon: <Activity className="h-3.5 w-3.5" />, color: "#ef4444", count: layers.earthquakes ? earthquakes.length : 0 },
    { id: "wildfires", label: "Wildfires", icon: <Flame className="h-3.5 w-3.5" />, color: "#ff4500", count: layers.wildfires ? wildfires.length : 0 },
    { id: "conflicts", label: "Conflicts", icon: <Crosshair className="h-3.5 w-3.5" />, color: "#f97316", count: layers.conflicts ? conflictEvents.length : 0 },
    { id: "rockets", label: "Rockets / Missiles", icon: <Rocket className="h-3.5 w-3.5" />, color: "#ef4444", count: layers.rockets ? rockets.length : 0 },
    { id: "nuclear", label: "Nuclear Monitors", icon: <Radio className="h-3.5 w-3.5" />, color: "#a855f7", count: layers.nuclear ? nuclearStations.length : 0 },
    { id: "airQuality", label: "Air Quality", icon: <Wind className="h-3.5 w-3.5" />, color: "#22c55e", count: layers.airQuality ? airQualityData.length : 0 },
    { id: "geoFusion", label: "Geo-Fusion Events", icon: <Zap className="h-3.5 w-3.5" />, color: "#eab308", count: layers.geoFusion ? (geoFusionData?.events?.length || 0) : 0 },
    { id: "borders", label: "Country Borders", icon: <MapPin className="h-3.5 w-3.5" />, color: "#00ffc8" },
    { id: "gpsJamming", label: "GPS Jamming", icon: <Shield className="h-3.5 w-3.5" />, color: "#e879f9" },
  ];

  const totalActive = Object.values(layers).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex">
      {/* Left Panel */}
      <div className="w-64 flex-shrink-0 bg-card/95 backdrop-blur border-r border-border flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold tracking-wider text-foreground uppercase">4D Intelligence Layers</span>
        </div>

        {/* Active count */}
        <div className="px-4 py-2 border-b border-border/50">
          <span className="text-[10px] text-muted-foreground font-mono">
            {totalActive} / {layerConfigs.length} layers active
          </span>
        </div>

        {/* Layer toggles */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {layerConfigs.map(layer => (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-all duration-200 ${
                layers[layer.id]
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-transparent border border-transparent hover:bg-muted/50 hover:border-border/50"
              }`}
            >
              <Checkbox
                checked={layers[layer.id]}
                onCheckedChange={() => toggleLayer(layer.id)}
                className="h-3.5 w-3.5 pointer-events-none"
              />
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: layers[layer.id] ? layer.color : "#4b5563" }}
              />
              <span className={`flex items-center gap-1.5 text-[11px] font-medium ${
                layers[layer.id] ? "text-foreground" : "text-muted-foreground"
              }`}>
                {layer.icon}
                {layer.label}
              </span>
              {layer.count !== undefined && layers[layer.id] && (
                <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {layer.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-[9px] text-muted-foreground font-mono">
          WAROS 4D • Multi-Source Intel Globe
        </div>
      </div>

      {/* Globe */}
      <div className="flex-1 relative">
        <div ref={globeContainerRef} className="w-full h-full" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card/80 backdrop-blur border border-border text-foreground hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="text-xs font-mono">Close</span>
        </button>

        {/* Title overlay */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card/80 backdrop-blur border border-primary/30">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              4D <span className="text-primary">MAP</span>
            </span>
            <span className="text-[9px] font-mono text-muted-foreground ml-2">
              LIVE MULTI-SOURCE INTELLIGENCE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
