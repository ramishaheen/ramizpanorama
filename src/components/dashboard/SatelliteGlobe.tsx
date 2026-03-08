import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, Satellite, Search, Tag, Tags, ZoomIn, ZoomOut, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCw, RotateCcw, Shield, Eye, Radio, Navigation, Cloud, Globe, HelpCircle, Bot, Send, Loader2, Crosshair, Clock, MapPin } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface SatelliteData {
  name: string;
  lat: number;
  lng: number;
  alt: number;
  category: string;
  noradId?: string;
  inclination?: number;
  meanMotion?: number;
  eccentricity?: number;
  period?: number;
  epochYear?: number;
  epochDay?: number;
  launchYear?: string;
  intlDesignator?: string;
  velocity?: number;
  raan?: number;
  meanAnomaly?: number;
  country?: string;
  operator?: string;
  source?: string; // which TLE group it came from
}

interface SatelliteGlobeProps {
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Military: "#ef4444",
  ISR: "#ff6b00",
  Communication: "#ffd54f",
  Navigation: "#22c55e",
  Weather: "#a855f7",
  "Earth Observation": "#ffb800",
  Unknown: "#d4a843",
};

// ---- Proper SGP4-lite position propagator ----
function propagateSatellite(
  inclination: number,
  raan: number,
  meanAnomaly: number,
  meanMotion: number, // rev/day
  eccentricity: number,
  epochYear: number,
  epochDay: number,
  alt: number
): { lat: number; lng: number } {
  const now = new Date();
  const startOfYear = new Date(epochYear, 0, 1);
  const currentDayOfYear =
    (now.getTime() - startOfYear.getTime()) / 86400000;
  const elapsedDays = currentDayOfYear - epochDay;
  const totalRevs = elapsedDays * meanMotion;
  const currentMA =
    (((meanAnomaly + totalRevs * 360) % 360) + 360) % 360;

  // Approximate true anomaly (good enough for eccentricity < 0.1)
  const E =
    currentMA +
    (eccentricity * 180) / Math.PI * Math.sin((currentMA * Math.PI) / 180);
  const nu = E; // For near-circular orbits

  const argLat = (nu * Math.PI) / 180;
  const incRad = (inclination * Math.PI) / 180;

  // Position in orbital plane -> geographic
  const lat =
    Math.asin(Math.sin(incRad) * Math.sin(argLat)) * (180 / Math.PI);

  // Longitude: account for Earth's rotation
  const greenwichOffset =
    now.getUTCHours() * 15 +
    now.getUTCMinutes() * 0.25 +
    now.getUTCSeconds() * (0.25 / 60);
  const ascNode = raan - greenwichOffset;
  const lng =
    (((ascNode +
      Math.atan2(
        Math.cos(incRad) * Math.sin(argLat),
        Math.cos(argLat)
      ) *
        (180 / Math.PI)) %
      360) +
      540) %
    360 -
    180;

  return {
    lat: Math.max(-85, Math.min(85, lat)),
    lng,
  };
}

function parseTLEFull(
  name: string,
  tle1: string,
  tle2: string
): SatelliteData | null {
  try {
    const inclination = parseFloat(tle2.substring(8, 16).trim());
    const raan = parseFloat(tle2.substring(17, 25).trim());
    const eccentricity = parseFloat("0." + tle2.substring(26, 33).trim());
    const meanAnomaly = parseFloat(tle2.substring(43, 51).trim());
    const meanMotion = parseFloat(tle2.substring(52, 63).trim());
    const intlDesignator = tle1.substring(9, 17).trim();
    const epochYearRaw = parseInt(tle1.substring(18, 20).trim());
    const epochDay = parseFloat(tle1.substring(20, 32).trim());
    const epochYear =
      epochYearRaw > 56 ? 1900 + epochYearRaw : 2000 + epochYearRaw;

    const GM = 398600.4418;
    const T = 86400 / meanMotion;
    const a = Math.pow((GM * T * T) / (4 * Math.PI * Math.PI), 1 / 3);
    const alt = Math.max(a - 6371, 200);
    const period = T / 60;
    const velocity = Math.sqrt(GM / a);
    const noradId = tle1.substring(2, 7).trim();
    const launchYear = intlDesignator.substring(0, 2);

    const pos = propagateSatellite(
      inclination, raan, meanAnomaly, meanMotion,
      eccentricity, epochYear, epochDay, alt
    );

    return {
      name: name.trim(),
      lat: pos.lat,
      lng: pos.lng,
      alt: Math.min(alt, 42000),
      category: categorizeSatellite(name),
      noradId,
      inclination,
      meanMotion,
      eccentricity,
      period,
      epochYear,
      epochDay,
      launchYear: launchYear
        ? parseInt(launchYear) > 56
          ? `19${launchYear}`
          : `20${launchYear}`
        : undefined,
      intlDesignator,
      velocity,
      raan,
      meanAnomaly,
    };
  } catch {
    return null;
  }
}

function categorizeSatellite(name: string, sourceGroup?: string): string {
  const n = name.toUpperCase();
  // Source group overrides
  if (sourceGroup === "military") return "Military";
  if (sourceGroup === "isr") return "ISR";
  if (sourceGroup === "geo") return "Communication";
  if (sourceGroup === "gnss") return "Navigation";
  if (sourceGroup === "weather") return "Weather";
  if (sourceGroup === "resource" || sourceGroup === "sarsat") return "Earth Observation";
  // Name-based detection
  if (n.includes("USA ") || n.includes("NOSS") || n.includes("LACROSSE") || n.includes("ONYX") || n.includes("MISTY") || n.includes("SBIRS") || n.includes("DSP") || n.includes("WGS") || n.includes("AEHF") || n.includes("MUOS") || n.includes("MILSTAR") || n.includes("NROL") || n.includes("GSSAP")) return "Military";
  if (n.includes("KEYHOLE") || n.includes("KH-") || n.includes("CRYSTAL") || n.includes("ORION") || n.includes("MENTOR") || n.includes("TRUMPET") || n.includes("INTRUDER") || n.includes("PROWLER") || n.includes("SHARP") || n.includes("MISTY") || n.includes("TOPAZ") || n.includes("SAPPHIRE") || n.includes("YAOGAN") || n.includes("OFEK") || n.includes("EROS") || n.includes("SHIJIAN") || n.includes("COSMOS 2")) return "ISR";
  if (n.includes("STARLINK") || n.includes("IRIDIUM") || n.includes("INTELSAT") || n.includes("SES") || n.includes("VIASAT") || n.includes("ONEWEB") || n.includes("THURAYA") || n.includes("ARABSAT") || n.includes("BADR") || n.includes("ASTRA") || n.includes("EUTELSAT") || n.includes("TELSTAR") || n.includes("GLOBALSTAR") || n.includes("O3B")) return "Communication";
  if (n.includes("GPS") || n.includes("NAVSTAR") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU") || n.includes("IRNSS") || n.includes("QZSS") || n.includes("NAVIC")) return "Navigation";
  if (n.includes("NOAA") || n.includes("GOES") || n.includes("METEOSAT") || n.includes("HIMAWARI") || n.includes("DMSP") || n.includes("METEOR-M") || n.includes("FENGYUN") || n.includes("INSAT") || n.includes("METOP") || n.includes("SUOMI") || n.includes("JPSS")) return "Weather";
  if (n.includes("LANDSAT") || n.includes("SENTINEL") || n.includes("WORLDVIEW") || n.includes("PLEIADES") || n.includes("SPOT") || n.includes("TERRA") || n.includes("AQUA") || n.includes("CARTOSAT") || n.includes("RESOURCESAT") || n.includes("KOMPSAT") || n.includes("RADARSAT") || n.includes("COSMO-SKYMED") || n.includes("ALOS") || n.includes("GAOFEN")) return "Earth Observation";
  return "Unknown";
}

function detectCountry(name: string, intlDesignator?: string): { country: string; operator: string } {
  const n = name.toUpperCase();
  const id = (intlDesignator || "").toUpperCase();
  // US
  if (n.includes("USA ") || n.includes("GPS") || n.includes("NAVSTAR") || n.includes("GOES") || n.includes("NOAA") || n.includes("STARLINK") || n.includes("LANDSAT") || n.includes("NROL") || n.includes("SBIRS") || n.includes("WGS") || n.startsWith("TDRS")) return { country: "🇺🇸 USA", operator: "US DoD/NASA/SpaceX" };
  // Russia
  if (n.includes("COSMOS") || n.includes("GLONASS") || n.includes("METEOR") || n.includes("RESURS") || n.includes("GONETS") || n.includes("LUCH")) return { country: "🇷🇺 Russia", operator: "Roscosmos/VKS" };
  // China
  if (n.includes("BEIDOU") || n.includes("YAOGAN") || n.includes("SHIJIAN") || n.includes("FENGYUN") || n.includes("GAOFEN") || n.includes("TIANLIAN") || n.includes("ZHONGXING") || n.includes("CZ-")) return { country: "🇨🇳 China", operator: "CNSA/PLA" };
  // Israel
  if (n.includes("OFEK") || n.includes("AMOS") || n.includes("EROS")) return { country: "🇮🇱 Israel", operator: "IAI/ISA" };
  // Iran
  if (n.includes("NAHID") || n.includes("NOOR") || n.includes("KHAYYAM")) return { country: "🇮🇷 Iran", operator: "ISA Iran" };
  // India
  if (n.includes("CARTOSAT") || n.includes("IRNSS") || n.includes("INSAT") || n.includes("GSAT") || n.includes("RESOURCESAT") || n.includes("NAVIC")) return { country: "🇮🇳 India", operator: "ISRO" };
  // Europe
  if (n.includes("GALILEO") || n.includes("SENTINEL") || n.includes("METEOSAT") || n.includes("METOP") || n.includes("EUTELSAT") || n.includes("COSMO-SKYMED") || n.includes("PLEIADES") || n.includes("SPOT")) return { country: "🇪🇺 Europe", operator: "ESA/EUMETSAT" };
  // Japan
  if (n.includes("HIMAWARI") || n.includes("QZSS") || n.includes("ALOS") || n.includes("IGS")) return { country: "🇯🇵 Japan", operator: "JAXA" };
  // South Korea
  if (n.includes("KOMPSAT") || n.includes("ANASIS")) return { country: "🇰🇷 S.Korea", operator: "KARI" };
  // UAE
  if (n.includes("KHALIFASAT") || n.includes("DUBAISAT") || n.includes("FALCON EYE")) return { country: "🇦🇪 UAE", operator: "MBRSC" };
  // Saudi
  if (n.includes("SAUDISAT") || n.includes("SGS")) return { country: "🇸🇦 KSA", operator: "KACST" };
  // Turkey
  if (n.includes("TURKSAT") || n.includes("GOKTURK")) return { country: "🇹🇷 Turkey", operator: "TAI/TUA" };
  // Intl designator country code
  if (id.startsWith("98067") || id.includes("US")) return { country: "🇺🇸 USA", operator: "Various" };
  return { country: "Unknown", operator: "Unknown" };
}

function getOrbitType(alt: number, _inc?: number, ecc?: number): string {
  if (alt < 2000) return "LEO";
  if (alt >= 2000 && alt < 35000) return "MEO";
  if (alt >= 35000 && alt <= 36500) return "GEO";
  if ((ecc || 0) > 0.1) return "HEO";
  return "Other";
}

// Compute full orbital path (one revolution) as array of {lat, lng}
function computeOrbitPath(
  inclination: number, raan: number, meanAnomaly: number,
  meanMotion: number, eccentricity: number, epochYear: number,
  epochDay: number, alt: number, steps = 120
): { lat: number; lng: number }[] {
  const periodDays = 1 / meanMotion; // one revolution in days
  const points: { lat: number; lng: number }[] = [];
  const now = new Date();
  const startOfYear = new Date(epochYear, 0, 1);
  const currentDayOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const dayOffset = -periodDays * 0.5 + fraction * periodDays; // half rev behind, half ahead
    const day = currentDayOfYear + dayOffset;
    const elapsedDays = day - epochDay;
    const totalRevs = elapsedDays * meanMotion;
    const currentMA = (((meanAnomaly + totalRevs * 360) % 360) + 360) % 360;
    const E = currentMA + (eccentricity * 180) / Math.PI * Math.sin((currentMA * Math.PI) / 180);
    const nu = E;
    const argLat = (nu * Math.PI) / 180;
    const incRad = (inclination * Math.PI) / 180;
    const lat = Math.asin(Math.sin(incRad) * Math.sin(argLat)) * (180 / Math.PI);

    // Use the time-shifted greenwich offset
    const shiftedTime = new Date(now.getTime() + dayOffset * 86400000);
    const greenwichOffset = shiftedTime.getUTCHours() * 15 + shiftedTime.getUTCMinutes() * 0.25 + shiftedTime.getUTCSeconds() * (0.25 / 60);
    const ascNode = raan - greenwichOffset;
    const lng = (((ascNode + Math.atan2(Math.cos(incRad) * Math.sin(argLat), Math.cos(argLat)) * (180 / Math.PI)) % 360) + 540) % 360 - 180;

    points.push({ lat: Math.max(-85, Math.min(85, lat)), lng });
  }
  return points;
}

const CITY_PRESETS = [
  { name: "Jordan", lat: 31.95, lng: 35.93 },
  { name: "Israel", lat: 31.77, lng: 35.23 },
  { name: "UAE", lat: 24.45, lng: 54.65 },
  { name: "Bahrain", lat: 26.07, lng: 50.55 },
  { name: "Iraq", lat: 33.31, lng: 44.37 },
  { name: "KSA", lat: 24.71, lng: 46.67 },
  { name: "Moscow", lat: 55.75, lng: 37.62 },
  { name: "China", lat: 35.86, lng: 104.2 },
  { name: "Beijing", lat: 39.9, lng: 116.4 },
];

// Store raw TLE data for re-propagation
interface RawSatTLE {
  name: string;
  inclination: number;
  raan: number;
  meanAnomaly: number;
  meanMotion: number;
  eccentricity: number;
  epochYear: number;
  epochDay: number;
  alt: number;
  category: string;
  noradId: string;
  intlDesignator: string;
  period: number;
  velocity: number;
  launchYear?: string;
  country?: string;
  operator?: string;
  source?: string;
}

export const SatelliteGlobe = ({ onClose }: SatelliteGlobeProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const globeElRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<any>(null);
  const rawTLERef = useRef<RawSatTLE[]>([]);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedSat, setSelectedSat] = useState<SatelliteData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SatelliteData[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [lastPropagated, setLastPropagated] = useState<Date>(new Date());
  const [orbitPath, setOrbitPath] = useState<{ lat: number; lng: number }[] | null>(null);
  const [orbitColor, setOrbitColor] = useState<string>("#ffffff");
  const [hoveredSat, setHoveredSat] = useState<SatelliteData | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [aiChatSat, setAiChatSat] = useState<SatelliteData | null>(null);
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const satsRef = useRef<SatelliteData[]>([]);
  const [predicting, setPredicting] = useState(false);
  const [predictionData, setPredictionData] = useState<{
    positions?: { time: string; lat: number; lng: number; alt: number }[];
    passes?: { startTime: string; closestTime: string; endTime: string; minDistKm: number; maxElevation: number }[];
    ai_analysis?: string;
    satellite_name?: string;
  } | null>(null);
  const [predictionTrack, setPredictionTrack] = useState<{ lat: number; lng: number }[] | null>(null);

  useEffect(() => {
    satsRef.current = satellites;
  }, [satellites]);

  // Track mouse position for tooltip
  useEffect(() => {
    const handler = (e: MouseEvent) => setHoverPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Scroll AI chat
  useEffect(() => {
    aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [aiMessages]);

  const openAiChat = useCallback((sat: SatelliteData) => {
    setAiChatSat(sat);
    setHoveredSat(null);
    const initialQ = `Provide OSINT intelligence analysis on satellite "${sat.name}" (NORAD: ${sat.noradId || "N/A"}, Category: ${sat.category}, Country: ${sat.country || "Unknown"}, Operator: ${sat.operator || "Unknown"}, Alt: ${Math.round(sat.alt)}km, Orbit: ${getOrbitType(sat.alt, sat.inclination, sat.eccentricity)}, Inc: ${sat.inclination?.toFixed(1) || "N/A"}°, Source: ${sat.source || "CelesTrak"}). Include: mission purpose, military/intelligence significance, coverage area over Middle East, operator details, and any known OSINT about this satellite's recent activities or significance in current geopolitical context.`;
    setAiMessages([{ role: "user", content: initialQ }]);
    setAiLoading(true);
    supabase.functions.invoke("war-chat", {
      body: { messages: [{ role: "user", content: initialQ }] },
    }).then(({ data, error }) => {
      setAiLoading(false);
      if (error || !data) {
        setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ Unable to reach AI. Try again later." }]);
        return;
      }
      const text = typeof data === "string" ? data : data?.choices?.[0]?.message?.content || JSON.stringify(data);
      setAiMessages(prev => [...prev, { role: "assistant", content: text }]);
    });
  }, []);

  const sendAiMessage = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const newMsgs = [...aiMessages, { role: "user", content: text }];
    setAiMessages(newMsgs);
    setAiInput("");
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("war-chat", {
      body: { messages: newMsgs },
    });
    setAiLoading(false);
    if (error || !data) {
      setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error connecting to AI." }]);
      return;
    }
    const reply = typeof data === "string" ? data : data?.choices?.[0]?.message?.content || JSON.stringify(data);
    setAiMessages(prev => [...prev, { role: "assistant", content: reply }]);
  }, [aiInput, aiLoading, aiMessages]);

  const runPrediction = useCallback(async (sat: SatelliteData) => {
    setPredicting(true);
    setPredictionData(null);
    setPredictionTrack(null);
    try {
      const { data, error } = await supabase.functions.invoke("orbit-predict", {
        body: {
          action: "full_analysis",
          satellite: {
            name: sat.name,
            noradId: sat.noradId,
            category: sat.category,
            country: sat.country,
            operator: sat.operator,
            lat: sat.lat,
            lng: sat.lng,
            alt: sat.alt,
            inclination: sat.inclination,
            raan: sat.raan,
            meanAnomaly: sat.meanAnomaly,
            meanMotion: sat.meanMotion,
            eccentricity: sat.eccentricity,
            epochYear: sat.epochYear,
            epochDay: sat.epochDay,
          },
          hoursAhead: 24,
          targetLat: 31.5,
          targetLng: 34.8,
          radiusKm: 1500,
        },
      });
      if (error) throw error;
      setPredictionData(data);
      // Show predicted track on globe
      if (data?.positions) {
        setPredictionTrack(data.positions.map((p: any) => ({ lat: p.lat, lng: p.lng })));
      }
    } catch (err) {
      console.error("Prediction failed:", err);
      setPredictionData({ ai_analysis: "⚠️ Prediction failed. Try again." });
    } finally {
      setPredicting(false);
    }
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.toUpperCase().trim();
    const results = satsRef.current
      .filter(
        (s) =>
          s.name.toUpperCase().includes(q) ||
          (s.noradId && s.noradId.includes(q))
      )
      .slice(0, 20);
    setSearchResults(results);
  }, []);

  const flyToSatellite = useCallback((sat: SatelliteData) => {
    setSelectedSat(sat);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: sat.lat, lng: sat.lng, altitude: 1.8 },
        1000
      );
    }
  }, []);

  const flyToCity = useCallback((city: (typeof CITY_PRESETS)[0]) => {
    setActiveCity(city.name);
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: city.lat, lng: city.lng, altitude: 2.0 },
        1500
      );
    }
  }, []);

  const fetchSatellites = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from multiple specialized CelesTrak groups for comprehensive OSINT coverage
      const TLE_SOURCES: { url: string; group: string }[] = [
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle", group: "active" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=tle", group: "military" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle", group: "resource" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle", group: "weather" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gnss&FORMAT=tle", group: "gnss" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle", group: "geo" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=sarsat&FORMAT=tle", group: "sarsat" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=tle", group: "recent" },
      ];

      const responses = await Promise.allSettled(
        TLE_SOURCES.map(async (src) => {
          const resp = await fetch(src.url).then((r) => r.text()).catch(() => "");
          return { text: resp, group: src.group };
        })
      );

      const allSats: SatelliteData[] = [];
      const rawTLEs: RawSatTLE[] = [];
      const seen = new Set<string>();

      for (const result of responses) {
        if (result.status !== "fulfilled") continue;
        const { text, group } = result.value;
        if (!text.trim()) continue;
        const lines = text.trim().split("\n").map((l) => l.trim());
        for (let i = 0; i < lines.length - 2; i += 3) {
          const name = lines[i],
            tle1 = lines[i + 1],
            tle2 = lines[i + 2];
          if (!tle1?.startsWith("1 ") || !tle2?.startsWith("2 ")) continue;
          if (seen.has(name)) continue;
          seen.add(name);
          const sat = parseTLEFull(name, tle1, tle2);
          if (sat) {
            // Override category based on source group for accuracy
            sat.category = categorizeSatellite(sat.name, group);
            const { country, operator } = detectCountry(sat.name, sat.intlDesignator);
            sat.country = country;
            sat.operator = operator;
            sat.source = group;
            allSats.push(sat);
            rawTLEs.push({
              name: sat.name,
              inclination: sat.inclination!,
              raan: sat.raan!,
              meanAnomaly: sat.meanAnomaly!,
              meanMotion: sat.meanMotion!,
              eccentricity: sat.eccentricity!,
              epochYear: sat.epochYear!,
              epochDay: sat.epochDay!,
              alt: sat.alt,
              category: sat.category,
              noradId: sat.noradId!,
              intlDesignator: sat.intlDesignator!,
              period: sat.period!,
              velocity: sat.velocity!,
              launchYear: sat.launchYear,
              country,
              operator,
              source: group,
            });
          }
        }
      }

      // Prioritize: Military & ISR first, then others
      const prioritized = [
        ...allSats.filter((s) => s.category === "Military" || s.category === "ISR"),
        ...allSats.filter((s) => s.category === "Navigation"),
        ...allSats.filter((s) => s.category === "Weather" || s.category === "Earth Observation"),
        ...allSats.filter((s) => s.category === "Communication").slice(0, 500),
        ...allSats.filter((s) => s.category === "Unknown").slice(0, 200),
      ];

      // Deduplicate after merge
      const finalSeen = new Set<string>();
      const deduped = prioritized.filter((s) => {
        if (finalSeen.has(s.name)) return false;
        finalSeen.add(s.name);
        return true;
      });

      const limited = deduped.slice(0, 3500);
      rawTLERef.current = rawTLEs.filter((r) => deduped.some((d) => d.name === r.name)).slice(0, 3500);
      setSatellites(limited);
      console.log(`[ORBITAL INTEL] Loaded ${limited.length} satellites from ${responses.filter(r => r.status === 'fulfilled').length} CelesTrak groups`);
    } catch (err) {
      console.error("Failed to fetch satellites:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSatellites();
  }, [fetchSatellites]);

  // Re-propagate positions every 4 seconds using real orbital mechanics
  useEffect(() => {
    if (rawTLERef.current.length === 0) return;
    const interval = setInterval(() => {
      const globe = globeRef.current;
      if (!globe) return;
      const raws = rawTLERef.current;
      const catFilter = selectedCat;
      const updated: SatelliteData[] = raws.map((r) => {
        const pos = propagateSatellite(
          r.inclination, r.raan, r.meanAnomaly, r.meanMotion,
          r.eccentricity, r.epochYear, r.epochDay, r.alt
        );
        return {
          name: r.name,
          lat: pos.lat,
          lng: pos.lng,
          alt: r.alt,
          category: r.category,
          noradId: r.noradId,
          inclination: r.inclination,
          meanMotion: r.meanMotion,
          eccentricity: r.eccentricity,
          period: r.period,
          epochYear: r.epochYear,
          epochDay: r.epochDay,
          launchYear: r.launchYear,
          intlDesignator: r.intlDesignator,
          velocity: r.velocity,
          raan: r.raan,
          meanAnomaly: r.meanAnomaly,
          country: r.country,
          operator: r.operator,
          source: r.source,
        };
      });
      satsRef.current = updated;
      setLastPropagated(new Date());
      const filtered = catFilter
        ? updated.filter((s) => s.category === catFilter)
        : updated;
      globe.objectsData(filtered);
    }, 4000);
    return () => clearInterval(interval);
  }, [satellites.length, selectedCat]);

  // Init globe with 3D satellite objects
  useEffect(() => {
    if (!wrapperRef.current || satellites.length === 0) return;

    if (!globeElRef.current) {
      globeElRef.current = document.createElement("div");
      globeElRef.current.style.cssText =
        "width:100%;height:100%;position:absolute;inset:0;";
      wrapperRef.current.appendChild(globeElRef.current);
    }

    let cancelled = false;

    const initGlobe = async () => {
      const [mod, THREE] = await Promise.all([
        import("globe.gl"),
        import("three"),
      ]);
      const Globe = mod.default;
      if (cancelled || !globeElRef.current) return;

      if (globeRef.current) {
        globeElRef.current.innerHTML = "";
      }

      const el = globeElRef.current;
      const filtered = selectedCat
        ? satellites.filter((s) => s.category === selectedCat)
        : satellites;

      // Create a reusable satellite 3D mesh factory
      const createSatMesh = (sat: SatelliteData) => {
        const color = new THREE.Color(CATEGORY_COLORS[sat.category] || "#d4a843");
        const group = new THREE.Group();

        // Main satellite body
        const isMilOrISR = sat.category === "Military" || sat.category === "ISR";
        const isNav = sat.category === "Navigation";
        const bodySize = isMilOrISR ? 0.6 : isNav ? 0.45 : 0.3;

        const bodyGeo = new THREE.BoxGeometry(bodySize, bodySize * 0.5, bodySize * 0.7);
        const bodyMat = new THREE.MeshPhongMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.9,
          shininess: 100,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Solar panels (two flat rectangles extending from body)
        const panelWidth = bodySize * 1.8;
        const panelHeight = bodySize * 0.7;
        const panelGeo = new THREE.BoxGeometry(panelWidth, 0.04, panelHeight);
        const panelMat = new THREE.MeshPhongMaterial({
          color: 0x1a3a5c,
          emissive: new THREE.Color(0x0a1a2e),
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.85,
          shininess: 150,
        });

        const panelLeft = new THREE.Mesh(panelGeo, panelMat);
        panelLeft.position.set(-(bodySize * 0.5 + panelWidth * 0.5), 0, 0);
        group.add(panelLeft);

        const panelRight = new THREE.Mesh(panelGeo, panelMat);
        panelRight.position.set(bodySize * 0.5 + panelWidth * 0.5, 0, 0);
        group.add(panelRight);

        // Antenna dish for comm/ISR satellites
        if (sat.category === "Communication" || sat.category === "ISR") {
          const dishGeo = new THREE.ConeGeometry(bodySize * 0.3, bodySize * 0.4, 8);
          const dishMat = new THREE.MeshPhongMaterial({
            color: 0xcccccc,
            emissive: color,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.8,
          });
          const dish = new THREE.Mesh(dishGeo, dishMat);
          dish.position.set(0, bodySize * 0.4, 0);
          dish.rotation.x = Math.PI;
          group.add(dish);
        }

        // Glow point at center
        const glowGeo = new THREE.SphereGeometry(bodySize * 0.15, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        group.add(glow);

        // Random slight rotation for visual variety
        group.rotation.y = Math.random() * Math.PI * 2;
        group.rotation.z = (Math.random() - 0.5) * 0.3;

        return group;
      };

      const globe = new Globe(el)
        .globeImageUrl(
          "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        )
        .bumpImageUrl(
          "//unpkg.com/three-globe/example/img/earth-topology.png"
        )
        .backgroundImageUrl(
          "//unpkg.com/three-globe/example/img/night-sky.png"
        )
        .width(el.clientWidth)
        .height(el.clientHeight)
        .atmosphereColor("#1a6b8a")
        .atmosphereAltitude(0.18)
        // 3D satellite objects at real orbital positions
        .objectsData(filtered)
        .objectLat("lat")
        .objectLng("lng")
        .objectAltitude((d: any) => {
          const s = d as SatelliteData;
          return Math.min(s.alt / 6371 * 0.3 + 0.01, 0.7);
        })
        .objectThreeObject((d: any) => createSatMesh(d as SatelliteData))
        .onObjectClick((d: any) => {
          const s = d as SatelliteData;
          setSelectedSat(s);
          // Compute orbital trail
          if (s.inclination != null && s.raan != null && s.meanAnomaly != null && s.meanMotion != null && s.eccentricity != null && s.epochYear != null && s.epochDay != null) {
            const path = computeOrbitPath(s.inclination, s.raan, s.meanAnomaly, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay, s.alt);
            setOrbitPath(path);
            setOrbitColor(CATEGORY_COLORS[s.category] || "#d4a843");
          }
          globe.pointOfView(
            { lat: s.lat, lng: s.lng, altitude: 1.5 },
            1000
          );
        })
        .onObjectHover((d: any) => {
          if (d) {
            setHoveredSat(d as SatelliteData);
          } else {
            setHoveredSat(null);
          }
        })
        // Labels
        .labelsData(
          showLabels
            ? filtered
                .filter((s) => s.category === "Military" || s.category === "ISR" || s.category === "Navigation")
                .slice(0, 150)
            : []
        )
        .labelLat("lat")
        .labelLng("lng")
        .labelAltitude((d: any) => {
          const s = d as SatelliteData;
          return Math.min(s.alt / 6371 * 0.3 + 0.02, 0.72);
        })
        .labelText("name")
        .labelSize(0.3)
        .labelDotRadius(0.08)
        .labelColor((d: any) => {
          const s = d as SatelliteData;
          return CATEGORY_COLORS[s.category] || "rgba(255,213,79,0.7)";
        })
        .labelResolution(1)
        .onLabelClick((d: any) => {
          const s = d as SatelliteData;
          setSelectedSat(s);
          if (s.inclination != null && s.raan != null && s.meanAnomaly != null && s.meanMotion != null && s.eccentricity != null && s.epochYear != null && s.epochDay != null) {
            const path = computeOrbitPath(s.inclination, s.raan, s.meanAnomaly, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay, s.alt);
            setOrbitPath(path);
            setOrbitColor(CATEGORY_COLORS[s.category] || "#d4a843");
          }
          globe.pointOfView(
            { lat: s.lat, lng: s.lng, altitude: 1.5 },
            1000
          );
        });

      // Add ambient + directional light for 3D objects
      const scene = globe.scene();
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 3, 5);
      scene.add(dirLight);

      globe.pointOfView({ lat: 30, lng: 44, altitude: 0.85 }, 1500);
      globe.controls().autoRotate = false;
      globe.controls().enableDamping = true;
      globe.controls().dampingFactor = 0.15;

      globeRef.current = globe;
    };

    initGlobe();
    return () => {
      cancelled = true;
    };
  }, [satellites.length > 0, selectedCat, showLabels]);

  // Render orbit trail when a satellite is selected
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const allSegments: { coords: { lat: number; lng: number }[]; type: string }[] = [];

    // Current orbit path
    if (orbitPath && orbitPath.length > 1 && selectedSat) {
      let currentSegment: { lat: number; lng: number }[] = [orbitPath[0]];
      for (let i = 1; i < orbitPath.length; i++) {
        const prev = orbitPath[i - 1];
        const curr = orbitPath[i];
        if (Math.abs(curr.lng - prev.lng) > 90) {
          if (currentSegment.length > 1) allSegments.push({ coords: currentSegment, type: "orbit" });
          currentSegment = [curr];
        } else {
          currentSegment.push(curr);
        }
      }
      if (currentSegment.length > 1) allSegments.push({ coords: currentSegment, type: "orbit" });
    }

    // Predicted future track (green dashed)
    if (predictionTrack && predictionTrack.length > 1) {
      let currentSegment: { lat: number; lng: number }[] = [predictionTrack[0]];
      for (let i = 1; i < predictionTrack.length; i++) {
        const prev = predictionTrack[i - 1];
        const curr = predictionTrack[i];
        if (Math.abs(curr.lng - prev.lng) > 90) {
          if (currentSegment.length > 1) allSegments.push({ coords: currentSegment, type: "predict" });
          currentSegment = [curr];
        } else {
          currentSegment.push(curr);
        }
      }
      if (currentSegment.length > 1) allSegments.push({ coords: currentSegment, type: "predict" });
    }

    if (allSegments.length > 0) {
      const altitude = selectedSat ? Math.min(selectedSat.alt / 6371 * 0.3 + 0.01, 0.7) : 0.05;

      globe
        .pathsData(allSegments)
        .pathPoints('coords')
        .pathPointLat((p: any) => p.lat)
        .pathPointLng((p: any) => p.lng)
        .pathPointAlt(() => altitude)
        .pathColor((seg: any) => seg.type === "predict" ? ['#22c55ecc', '#22c55e33'] : [orbitColor + 'cc', orbitColor + '33'])
        .pathStroke((seg: any) => seg.type === "predict" ? 2 : 1.5)
        .pathDashLength(0.02)
        .pathDashGap(0.01)
        .pathDashAnimateTime((seg: any) => seg.type === "predict" ? 6000 : 4000)
        .pathTransitionDuration(300);
    } else {
      globe.pathsData([]);
    }
  }, [orbitPath, selectedSat, orbitColor, predictionTrack]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      if (globeRef.current && globeElRef.current) {
        globeRef.current
          .width(globeElRef.current.clientWidth)
          .height(globeElRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (globeElRef.current) {
        globeElRef.current.remove();
        globeElRef.current = null;
      }
      globeRef.current = null;
    };
  }, []);

  const categories = Object.entries(CATEGORY_COLORS);

  const now = new Date();
  const timestamp = `REC ${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
    now.getUTCHours()
  ).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(
    now.getUTCSeconds()
  ).padStart(2, "0")}Z`;

  return (
    <div className="absolute inset-0 z-[2000] bg-[#050a12] flex flex-col overflow-hidden">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none opacity-[0.03]"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
        }}
      />

      {/* Top-left HUD */}
      <div className="absolute top-3 left-3 z-[2002] pointer-events-none space-y-1">
        <div
          className="font-mono text-[11px] font-bold tracking-[0.2em] text-primary/90"
          style={{ textShadow: "0 0 10px hsl(190 100% 50% / 0.5)" }}
        >
          ORBITAL INTELLIGENCE
        </div>
        <div className="text-[8px] font-mono text-muted-foreground/60 tracking-wider">
          REAL-TIME SATELLITE TRACKING
        </div>
        <div className="mt-2 space-y-0.5 text-[8px] font-mono text-primary/60">
          <div>TOP SECRET // SI-TK // NOFORN</div>
          <div>
            TRACKING {satellites.length} OBJECTS • MIL:{" "}
            {satellites.filter((s) => s.category === "Military").length} ISR:{" "}
            {satellites.filter((s) => s.category === "ISR").length} NAV:{" "}
            {satellites.filter((s) => s.category === "Navigation").length}
          </div>
          <div>
            LEO: {satellites.filter((s) => s.alt < 2000).length} • MEO:{" "}
            {satellites.filter((s) => s.alt >= 2000 && s.alt < 35000).length} • GEO:{" "}
            {satellites.filter((s) => s.alt >= 35000 && s.alt <= 36500).length}
          </div>
          <div>
            SOURCES: CELESTRAK × 8 GROUPS • NORAD TLE
          </div>
          <div className="text-white/60">
            LAST PROPAGATION: {lastPropagated.toISOString().replace('T', ' ').slice(0, 19)}Z
          </div>
        </div>
      </div>

      {/* Top-right timestamp */}
      <div className="absolute top-3 right-3 z-[2002] pointer-events-none text-right space-y-0.5">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-mono text-red-400">
            {timestamp}
          </span>
        </div>
        <div className="text-[8px] font-mono text-muted-foreground/50">
          CELESTRAK NORAD TLE • LIVE
        </div>
      </div>

      {/* Category filters - bottom center, above city presets */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[2002] pointer-events-auto">
        <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg px-2 py-1">
          <button
            onClick={() => setSelectedCat(null)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono font-semibold transition-all ${
              !selectedCat ? "bg-white text-black shadow-md" : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" style={!selectedCat ? { backgroundColor: '#000' } : {}} />
            ALL ({satellites.length})
          </button>
          {categories.map(([cat, color]) => {
            const count = satellites.filter((s) => s.category === cat).length;
            if (count === 0) return null;
            const CatIcon = cat === "Military" ? Shield
              : cat === "ISR" ? Eye
              : cat === "Communication" ? Radio
              : cat === "Navigation" ? Navigation
              : cat === "Weather" ? Cloud
              : cat === "Earth Observation" ? Globe
              : HelpCircle;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono font-semibold transition-all ${
                  selectedCat === cat
                    ? "bg-white text-black shadow-md"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <CatIcon className="h-3 w-3" style={{ color: selectedCat === cat ? color : color }} />
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Right sidebar controls */}
      <div className="absolute top-20 right-3 z-[2002] space-y-1.5 pointer-events-auto w-28">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase border transition-all ${
            showLabels
              ? "border-white/50 bg-white/15 text-white"
              : "border-white/20 text-white/70 hover:text-white hover:border-white/40"
          }`}
        >
          {showLabels ? (
            <Tag className="h-2.5 w-2.5" />
          ) : (
            <Tags className="h-2.5 w-2.5" />
          )}{" "}
          Labels
        </button>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase border transition-all ${
            showSearch
              ? "border-white/50 bg-white/15 text-white"
              : "border-white/20 text-white/70 hover:text-white hover:border-white/40"
          }`}
        >
          <Search className="h-2.5 w-2.5" /> Search
        </button>
        <button
          onClick={fetchSatellites}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all"
        >
          <RefreshCw
            className={`h-2.5 w-2.5 ${loading ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </button>
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase border border-red-400/40 text-red-300 hover:bg-red-500/10 transition-all"
        >
          <X className="h-2.5 w-2.5" /> Close
        </button>
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[2003] w-80 pointer-events-auto">
          <div
            className="rounded-lg border border-primary/30 bg-black/90 backdrop-blur-md p-2 space-y-1.5"
            style={{ boxShadow: "0 0 30px hsl(190 100% 50% / 0.1)" }}
          >
            <div className="flex items-center gap-2">
              <Search className="h-3 w-3 text-primary/60 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search satellite name or NORAD ID…"
                className="flex-1 bg-transparent text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border-t border-border/20 pt-1">
                {searchResults.map((sat, i) => (
                  <button
                    key={sat.noradId || i}
                    onClick={() => flyToSatellite(sat)}
                    className="w-full flex items-center gap-2 px-2 py-1 text-left hover:bg-primary/10 rounded transition-colors"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: CATEGORY_COLORS[sat.category],
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-mono font-bold text-foreground/90 block truncate">
                        {sat.name}
                      </span>
                      <span className="text-[7px] font-mono text-muted-foreground/50">
                        {sat.noradId} • {sat.category} •{" "}
                        {Math.round(sat.alt)}km
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Globe container */}
      <div ref={wrapperRef} className="absolute inset-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-[2002] pointer-events-none">
            <div className="text-center space-y-2">
              <div className="h-8 w-8 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest">
                Acquiring TLE data…
              </p>
            </div>
          </div>
        )}

        {/* Selected satellite detail panel */}
        {selectedSat && (
          <div
            className="absolute top-20 left-36 z-[2003] w-64 rounded border backdrop-blur-md pointer-events-auto animate-fade-in"
            style={{
              borderColor: CATEGORY_COLORS[selectedSat.category] + "60",
              background: "rgba(5,10,18,0.92)",
              boxShadow: `0 0 20px ${CATEGORY_COLORS[selectedSat.category]}22`,
            }}
          >
            <div
              className="flex items-center justify-between px-2.5 py-1.5 border-b"
              style={{
                borderColor: CATEGORY_COLORS[selectedSat.category] + "30",
                background: CATEGORY_COLORS[selectedSat.category] + "08",
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Satellite
                  className="h-3 w-3 flex-shrink-0"
                  style={{
                    color: CATEGORY_COLORS[selectedSat.category],
                  }}
                />
                <span
                  className="text-[10px] font-mono font-bold truncate"
                  style={{
                    color: CATEGORY_COLORS[selectedSat.category],
                  }}
                >
                  {selectedSat.name}
                </span>
              </div>
              <button
                onClick={() => { setSelectedSat(null); setOrbitPath(null); }}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[selectedSat.category],
                  }}
                />
                <span className="text-[8px] font-mono text-muted-foreground/70 uppercase">
                  {selectedSat.category} •{" "}
                  {getOrbitType(
                    selectedSat.alt,
                    selectedSat.inclination,
                    selectedSat.eccentricity
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <DataRow
                  label="NORAD"
                  value={selectedSat.noradId || "N/A"}
                />
                <DataRow
                  label="COUNTRY"
                  value={selectedSat.country || "N/A"}
                />
                <DataRow
                  label="OPERATOR"
                  value={selectedSat.operator || "N/A"}
                />
                <DataRow
                  label="INTL"
                  value={selectedSat.intlDesignator || "N/A"}
                />
                <DataRow
                  label="ALT"
                  value={`${Math.round(selectedSat.alt)} km`}
                />
                <DataRow
                  label="VEL"
                  value={
                    selectedSat.velocity
                      ? `${selectedSat.velocity.toFixed(1)} km/s`
                      : "N/A"
                  }
                />
                <DataRow
                  label="INC"
                  value={`${selectedSat.inclination?.toFixed(2) || "N/A"}°`}
                />
                <DataRow
                  label="ECC"
                  value={selectedSat.eccentricity?.toFixed(5) || "N/A"}
                />
                <DataRow
                  label="PERIOD"
                  value={
                    selectedSat.period
                      ? `${selectedSat.period.toFixed(0)} min`
                      : "N/A"
                  }
                />
                <DataRow
                  label="REV/DAY"
                  value={selectedSat.meanMotion?.toFixed(2) || "N/A"}
                />
                <DataRow
                  label="LAT"
                  value={`${selectedSat.lat.toFixed(3)}°`}
                />
                <DataRow
                  label="LNG"
                  value={`${selectedSat.lng.toFixed(3)}°`}
                />
              </div>
              <div className="text-[7px] font-mono text-muted-foreground/30 pt-1 border-t border-border/20">
                EPOCH: {selectedSat.epochYear} DAY{" "}
                {selectedSat.epochDay?.toFixed(2)} • CELESTRAK
              </div>
              {/* Prediction Buttons */}
              <div className="flex gap-1 pt-1.5">
                <button
                  onClick={() => runPrediction(selectedSat)}
                  disabled={predicting}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-mono font-bold bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-40 transition-all"
                >
                  {predicting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                  {predicting ? "PREDICTING..." : "AI PREDICT"}
                </button>
                <button
                  onClick={() => openAiChat(selectedSat)}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-mono font-bold bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  <Bot className="h-3 w-3" /> ASK AI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Prediction Results Panel */}
        {predictionData && (
          <div
            className="absolute top-20 left-[340px] z-[2004] w-80 rounded border backdrop-blur-md pointer-events-auto animate-fade-in"
            style={{ background: "rgba(5,10,18,0.94)", borderColor: "#22c55e40", boxShadow: "0 0 25px #22c55e15" }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#22c55e30", background: "#22c55e08" }}>
              <div className="flex items-center gap-1.5">
                <Crosshair className="h-3 w-3 text-green-400" />
                <span className="text-[10px] font-mono font-bold text-green-400">
                  ORBIT PREDICTION: {predictionData.satellite_name}
                </span>
              </div>
              <button
                onClick={() => { setPredictionData(null); setPredictionTrack(null); }}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-3">
              {/* Passes */}
              {predictionData.passes && predictionData.passes.length > 0 && (
                <div>
                  <div className="text-[8px] font-mono text-green-400/80 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" /> MIDDLE EAST PASSES (NEXT 48H)
                  </div>
                  <div className="space-y-1">
                    {predictionData.passes.slice(0, 6).map((pass, i) => (
                      <div key={i} className="bg-white/5 rounded px-2 py-1.5 border border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-white/90 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-green-400" />
                            {new Date(pass.closestTime).toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" })} UTC
                          </span>
                          <span className="text-[8px] font-mono text-green-400">{Math.round(pass.minDistKm)} km</span>
                        </div>
                        <div className="text-[8px] font-mono text-white/50 mt-0.5">
                          {new Date(pass.startTime).toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" })} → {new Date(pass.endTime).toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" })}
                          {pass.maxElevation && <span className="ml-1">• EL: {pass.maxElevation.toFixed(1)}°</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              {predictionData.ai_analysis && (
                <div>
                  <div className="text-[8px] font-mono text-green-400/80 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Bot className="h-2.5 w-2.5" /> AI ORBITAL ANALYSIS
                  </div>
                  <div className="bg-white/5 rounded px-2.5 py-2 border border-white/10">
                    <div className="prose prose-sm prose-invert max-w-none text-[9px] font-mono text-white/80 leading-relaxed [&_h1]:text-[11px] [&_h2]:text-[10px] [&_h3]:text-[9px] [&_p]:mb-1.5 [&_li]:mb-0.5 [&_ul]:pl-3 [&_ol]:pl-3 [&_strong]:text-green-400">
                      <ReactMarkdown>{predictionData.ai_analysis}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Track info */}
              {predictionData.positions && (
                <div className="text-[7px] font-mono text-white/30 pt-1 border-t border-white/10">
                  {predictionData.positions.length} PREDICTED POSITIONS • 24H TRACK PLOTTED ON GLOBE
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hover Tooltip */}
      {hoveredSat && !selectedSat && (
        <div
          className="fixed z-[2010] pointer-events-auto animate-fade-in"
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 260),
            top: Math.max(hoverPos.y - 40, 10),
          }}
        >
          <div className="bg-black/90 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 min-w-[200px] shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: CATEGORY_COLORS[hoveredSat.category] || "#d4a843" }}
              />
              <span className="text-[11px] font-mono font-bold text-white truncate">
                {hoveredSat.name}
              </span>
            </div>
            <div className="text-[9px] font-mono text-white/60 space-y-0.5">
              <div>TYPE: <span className="text-white/90">{hoveredSat.category}</span></div>
              <div>ALT: <span className="text-white/90">{Math.round(hoveredSat.alt)} km</span> • ORBIT: <span className="text-white/90">{getOrbitType(hoveredSat.alt, hoveredSat.inclination, hoveredSat.eccentricity)}</span></div>
              {hoveredSat.country && <div>COUNTRY: <span className="text-white/90">{hoveredSat.country}</span></div>}
              {hoveredSat.operator && hoveredSat.operator !== "Unknown" && <div>OPERATOR: <span className="text-white/90">{hoveredSat.operator}</span></div>}
              {hoveredSat.noradId && <div>NORAD: <span className="text-white/90">{hoveredSat.noradId}</span></div>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openAiChat(hoveredSat);
              }}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-white/10 border border-white/20 text-[10px] font-mono font-semibold text-white hover:bg-white/20 transition-all"
            >
              <Bot className="h-3 w-3" /> Ask AI
            </button>
          </div>
        </div>
      )}

      {/* AI Chat Panel */}
      {aiChatSat && (
        <div className="absolute top-16 right-36 z-[2005] w-80 pointer-events-auto animate-fade-in">
          <div
            className="rounded-lg border border-white/20 bg-black/92 backdrop-blur-md shadow-2xl flex flex-col"
            style={{ maxHeight: "70vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-[10px] font-mono font-bold text-white truncate">
                  AI INTEL: {aiChatSat.name}
                </span>
              </div>
              <button
                onClick={() => { setAiChatSat(null); setAiMessages([]); setAiInput(""); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
              >
                <X className="h-3 w-3 text-white/70" />
              </button>
            </div>

            {/* Messages */}
            <div ref={aiScrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ maxHeight: "50vh" }}>
              {aiMessages.map((msg, i) => (
                <div key={i} className={`text-[10px] font-mono ${msg.role === "user" ? "text-white/50 italic" : "text-white/90"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none text-[10px]">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded px-2 py-1">{msg.content}</div>
                  )}
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/50">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analyzing satellite data…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-white/10">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
                placeholder="Ask about this satellite…"
                className="flex-1 bg-transparent text-[10px] font-mono text-white placeholder:text-white/30 outline-none"
              />
              <button
                onClick={sendAiMessage}
                disabled={aiLoading || !aiInput.trim()}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30"
              >
                <Send className="h-3 w-3 text-white/70" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation & Zoom Controls - bottom right */}
      <div className="absolute bottom-16 right-3 z-[2002] pointer-events-auto flex flex-col items-center gap-1.5">
        {/* Zoom */}
        <div className="flex flex-col gap-0.5 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg p-1">
          <button
            onClick={() => {
              const g = globeRef.current;
              if (!g) return;
              const pov = g.pointOfView();
              g.pointOfView({ ...pov, altitude: Math.max(pov.altitude * 0.75, 0.3) }, 400);
            }}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const g = globeRef.current;
              if (!g) return;
              const pov = g.pointOfView();
              g.pointOfView({ ...pov, altitude: Math.min(pov.altitude * 1.35, 6) }, 400);
            }}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        {/* Directional pad */}
        <div className="bg-black/70 backdrop-blur-md border border-white/20 rounded-lg p-1">
          <div className="grid grid-cols-3 gap-0.5 w-[6.5rem]">
            {/* Row 1: rotate left, up, rotate right */}
            <button
              onClick={() => {
                const g = globeRef.current;
                if (!g) return;
                const pov = g.pointOfView();
                g.pointOfView({ ...pov, lng: pov.lng - 15 }, 400);
              }}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
              title="Rotate Left"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                const g = globeRef.current;
                if (!g) return;
                const pov = g.pointOfView();
                g.pointOfView({ ...pov, lat: Math.min(pov.lat + 15, 85) }, 400);
              }}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
              title="Move Up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const g = globeRef.current;
                if (!g) return;
                const pov = g.pointOfView();
                g.pointOfView({ ...pov, lng: pov.lng + 15 }, 400);
              }}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
              title="Rotate Right"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>

            {/* Row 2: left, down, right */}
            <button
              onClick={() => {
                const g = globeRef.current;
                if (!g) return;
                const pov = g.pointOfView();
                g.pointOfView({ ...pov, lng: pov.lng - 30 }, 400);
              }}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
              title="Pan Left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const g = globeRef.current;
                if (!g) return;
                const pov = g.pointOfView();
                g.pointOfView({ ...pov, lat: Math.max(pov.lat - 15, -85) }, 400);
              }}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
              title="Move Down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const g = globeRef.current;
                if (!g) return;
                const pov = g.pointOfView();
                g.pointOfView({ ...pov, lng: pov.lng + 30 }, 400);
              }}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded transition-all"
              title="Pan Right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom city presets */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[2002] pointer-events-auto">
        <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg px-2 py-1">
          {CITY_PRESETS.map((city) => (
            <button
              key={city.name}
              onClick={() => flyToCity(city)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold tracking-wide transition-all ${
                activeCity === city.name
                  ? "bg-white text-black shadow-md"
                  : "text-white/90 hover:text-white hover:bg-white/15 border border-transparent"
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>
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
