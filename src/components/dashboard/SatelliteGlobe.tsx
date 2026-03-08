import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, Satellite, Search, Tag, Tags, ZoomIn, ZoomOut, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCw, RotateCcw, Shield, Eye, Radio, Navigation, Cloud, Globe, HelpCircle, Bot, Send, Loader2, Crosshair, Clock, MapPin, Zap, Rocket, Cpu, Anchor } from "lucide-react";
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
  "Early Warning": "#ff3366",
  "SIGINT/ELINT": "#e879f9",
  Communication: "#ffd54f",
  "Data Relay": "#fbbf24",
  Navigation: "#22c55e",
  Weather: "#a855f7",
  "Earth Observation": "#ffb800",
  "SAR Imaging": "#f97316",
  Scientific: "#06b6d4",
  "Space Station": "#f0f0f0",
  "Technology Demo": "#14b8a6",
  "Amateur/Ham": "#84cc16",
  "Search & Rescue": "#fb7185",
  Debris: "#6b7280",
  "Launch Vehicle": "#78716c",
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
  if (sourceGroup === "stations") return "Space Station";
  if (sourceGroup === "science") return "Scientific";
  if (sourceGroup === "amateur") return "Amateur/Ham";
  // Name-based — most specific first
  // Space stations
  if (n.includes("ISS (ZARYA)") || n.includes("TIANGONG") || n.includes("CSS ") || n === "ISS") return "Space Station";
  // Early warning / missile defense
  if (n.includes("SBIRS") || n.includes("DSP") || n.includes("STSS") || n.includes("MIDAS") || n.includes("OPIR")) return "Early Warning";
  // SIGINT / ELINT
  if (n.includes("MENTOR") || n.includes("TRUMPET") || n.includes("ORION") || n.includes("INTRUDER") || n.includes("PROWLER") || n.includes("MERCURY") || n.includes("NEMESIS") || n.includes("SHARP") || n.includes("NOSS") || n.includes("POPPY") || n.includes("PARCAE") || n.includes("LUCH") || n.includes("OLYMP")) return "SIGINT/ELINT";
  // ISR / Reconnaissance
  if (n.includes("KEYHOLE") || n.includes("KH-") || n.includes("CRYSTAL") || n.includes("MISTY") || n.includes("TOPAZ") || n.includes("SAPPHIRE") || n.includes("YAOGAN") || n.includes("OFEK") || n.includes("EROS") || n.includes("SHIJIAN") || n.includes("COSMOS 2") || n.includes("GSSAP") || n.includes("GOKTURK") || n.includes("FALCON EYE") || n.includes("CARTOSAT") || n.includes("KONDOR") || n.includes("PERSONA") || n.includes("BARS-M") || n.includes("IGS")) return "ISR";
  // Military comms / C2
  if (n.includes("USA ") || n.includes("LACROSSE") || n.includes("ONYX") || n.includes("WGS") || n.includes("AEHF") || n.includes("MUOS") || n.includes("MILSTAR") || n.includes("NROL") || n.includes("SKYNET") || n.includes("SICRAL") || n.includes("ANASIS") || n.includes("XTAR") || n.includes("UFO ") || n.includes("FLTSATCOM") || n.includes("DSCS") || n.includes("MERIDIAN") || n.includes("RODNIK") || n.includes("GONETS") || n.includes("STRELA")) return "Military";
  // SAR imaging
  if (n.includes("RADARSAT") || n.includes("COSMO-SKYMED") || n.includes("ICEYE") || n.includes("CAPELLA") || n.includes("SAR") || n.includes("SAOCOM") || n.includes("TANDEM") || n.includes("PAZ ") || n.includes("RISAT") || n.includes("KONDOR")) return "SAR Imaging";
  // Data relay
  if (n.includes("TDRS") || n.includes("TIANLIAN") || n.includes("EDRS") || n.includes("LUCH")) return "Data Relay";
  // Communication
  if (n.includes("STARLINK") || n.includes("IRIDIUM") || n.includes("INTELSAT") || n.includes("SES") || n.includes("VIASAT") || n.includes("ONEWEB") || n.includes("THURAYA") || n.includes("ARABSAT") || n.includes("BADR") || n.includes("ASTRA") || n.includes("EUTELSAT") || n.includes("TELSTAR") || n.includes("GLOBALSTAR") || n.includes("O3B") || n.includes("ORBCOMM") || n.includes("TURKSAT") || n.includes("NILESAT") || n.includes("MEASAT") || n.includes("JCSAT") || n.includes("APSTAR") || n.includes("CHINASAT") || n.includes("ZHONGXING") || n.includes("PAKSAT") || n.includes("EXPRESS") || n.includes("YAMAL") || n.includes("BANGABANDHU") || n.includes("AMOS") || n.includes("KOREASAT") || n.includes("ECHOSTAR") || n.includes("DIRECTV") || n.includes("SIRIUS") || n.includes("XM ") || n.includes("NIGCOMSAT") || n.includes("RASCOM")) return "Communication";
  // Navigation
  if (n.includes("GPS") || n.includes("NAVSTAR") || n.includes("GLONASS") || n.includes("GALILEO") || n.includes("BEIDOU") || n.includes("IRNSS") || n.includes("QZSS") || n.includes("NAVIC")) return "Navigation";
  // Weather
  if (n.includes("NOAA") || n.includes("GOES") || n.includes("METEOSAT") || n.includes("HIMAWARI") || n.includes("DMSP") || n.includes("METEOR-M") || n.includes("FENGYUN") || n.includes("INSAT") || n.includes("METOP") || n.includes("SUOMI") || n.includes("JPSS") || n.includes("ELEKTRO") || n.includes("KALPANA") || n.includes("COMS") || n.includes("GEO-KOMPSAT") || n.includes("FY-")) return "Weather";
  // Earth Observation
  if (n.includes("LANDSAT") || n.includes("SENTINEL") || n.includes("WORLDVIEW") || n.includes("PLEIADES") || n.includes("SPOT") || n.includes("TERRA") || n.includes("AQUA") || n.includes("RESOURCESAT") || n.includes("KOMPSAT") || n.includes("ALOS") || n.includes("GAOFEN") || n.includes("CBERS") || n.includes("DEIMOS") || n.includes("RAPIDEYE") || n.includes("PLANET") || n.includes("DOVE") || n.includes("SUPERVIEW") || n.includes("TRIPLESAT") || n.includes("JILIN") || n.includes("ZIYUAN") || n.includes("KHALIFASAT") || n.includes("DUBAISAT") || n.includes("SAUDISAT")) return "Earth Observation";
  // Search & Rescue
  if (sourceGroup === "sarsat" || n.includes("COSPAS") || n.includes("SARSAT")) return "Search & Rescue";
  // Scientific
  if (n.includes("HUBBLE") || n.includes("CHANDRA") || n.includes("FERMI") || n.includes("SWIFT") || n.includes("NUSTAR") || n.includes("WISE") || n.includes("TESS") || n.includes("JWST") || n.includes("GAIA") || n.includes("PLANCK") || n.includes("CLUSTER") || n.includes("INTEGRAL") || n.includes("XMM") || n.includes("SPEKTR") || n.includes("ASTROSAT") || n.includes("DAMPE") || n.includes("HXMT") || n.includes("EINSTEIN") || n.includes("DSCOVR") || n.includes("ACE ") || n.includes("SOHO") || n.includes("SDO ") || n.includes("STEREO") || n.includes("WIND ") || n.includes("SWARM") || n.includes("GRACE") || n.includes("GOCE") || n.includes("LISA") || n.includes("PROBA")) return "Scientific";
  // Technology demo
  if (n.includes("CUBESAT") || n.includes("NANOSAT") || n.includes("MICROSAT") || n.includes("LEMUR") || n.includes("FLOCK") || n.includes("SPIRE") || n.includes("AISSAT") || n.includes("TET-") || n.includes("BRITE") || n.includes("OPS-SAT") || n.includes("RANGE")) return "Technology Demo";
  // Amateur
  if (n.includes("AMSAT") || n.includes("OSCAR") || n.includes("FUNCUBE") || n.includes("HAMSAT") || n.includes("CUBESAT") || sourceGroup === "amateur") return "Amateur/Ham";
  // Debris / rocket bodies
  if (n.includes(" DEB") || n.includes("DEBRIS") || n.includes(" R/B") || n.includes("ROCKET BODY")) return "Debris";
  if (n.includes("ATLAS") || n.includes("DELTA") || n.includes("FALCON") || n.includes("CENTAUR") || n.includes("BREEZE") || n.includes("FREGAT") || n.includes("BLOCK D")) return "Launch Vehicle";
  // Fallback by source group
  if (sourceGroup === "geo") return "Communication";
  if (sourceGroup === "gnss") return "Navigation";
  if (sourceGroup === "weather") return "Weather";
  if (sourceGroup === "resource") return "Earth Observation";
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

function getOrbitType(alt: number, inc?: number, ecc?: number): string {
  const i = inc || 0;
  const e = ecc || 0;
  if (e > 0.5) return "HEO (Highly Elliptical)";
  if (e > 0.1 && alt > 20000) return "Molniya";
  if (alt >= 35000 && alt <= 36500) {
    if (i < 5) return "GEO (Geostationary)";
    return "GSO (Geosynchronous)";
  }
  if (alt < 450) return "VLEO (Very Low)";
  if (alt < 2000) {
    if (i > 95 && i < 100) return "SSO (Sun-Synch)";
    if (i > 50 && i < 55) return "LEO (ISS-type)";
    if (i > 85) return "LEO (Polar)";
    if (i > 60 && i < 70) return "LEO (Mid-Inc)";
    return "LEO";
  }
  if (alt >= 2000 && alt < 20200) return "MEO";
  if (alt >= 20200 && alt < 24000) return "MEO (Nav)";
  if (alt >= 24000 && alt < 35000) return "MEO (High)";
  if (alt > 36500) return "Super-GEO";
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

// OSINT Intelligence Markers — conflict zones, military bases, naval choke points, radar sites
const OSINT_MARKERS = [
  // Active conflict zones
  { lat: 31.5, lng: 34.47, label: "GAZA", type: "conflict", severity: "critical", info: "Active combat zone • IDF operations" },
  { lat: 33.27, lng: 35.2, label: "S. LEBANON", type: "conflict", severity: "high", info: "Hezbollah front line • Artillery exchanges" },
  { lat: 15.35, lng: 44.2, label: "YEMEN/HOUTHI", type: "conflict", severity: "high", info: "Houthi launch sites • Anti-ship ops" },
  { lat: 36.2, lng: 37.16, label: "ALEPPO", type: "conflict", severity: "medium", info: "Syrian conflict zone • Russian presence" },
  // Military bases
  { lat: 32.4, lng: 34.88, label: "PALMACHIM AFB", type: "military", severity: "high", info: "🇮🇱 Arrow/Iron Dome • Ofek launch site" },
  { lat: 30.12, lng: 35.24, label: "NEVATIM AFB", type: "military", severity: "high", info: "🇮🇱 F-35I Adir • Main strike base" },
  { lat: 32.57, lng: 51.68, label: "ISFAHAN NUC", type: "military", severity: "critical", info: "🇮🇷 Nuclear facility • Natanz nearby" },
  { lat: 35.23, lng: 53.94, label: "SEMNAN SPACE", type: "military", severity: "high", info: "🇮🇷 IRGC space launch center" },
  { lat: 27.18, lng: 56.17, label: "BANDAR ABBAS", type: "military", severity: "high", info: "🇮🇷 IRIN naval HQ • Strait of Hormuz" },
  { lat: 25.61, lng: 55.09, label: "AL DHAFRA AFB", type: "military", severity: "medium", info: "🇺🇸 USAF base • F-22/KC-135" },
  { lat: 25.38, lng: 51.3, label: "AL UDEID AB", type: "military", severity: "medium", info: "🇺🇸 CENTCOM forward HQ • Qatar" },
  { lat: 35.4, lng: 35.95, label: "HMEIMIM AFB", type: "military", severity: "medium", info: "🇷🇺 Russian air base • Syria" },
  { lat: 34.89, lng: 35.89, label: "TARTUS NAVAL", type: "military", severity: "medium", info: "🇷🇺 Naval facility • Mediterranean" },
  { lat: 39.82, lng: 32.69, label: "AKINCI AFB", type: "military", severity: "low", info: "🇹🇷 TAI drone base • TB2 ops" },
  // Naval choke points
  { lat: 26.57, lng: 56.25, label: "STRAIT OF HORMUZ", type: "naval", severity: "critical", info: "21M bbl/day oil transit • IRGC patrols" },
  { lat: 12.6, lng: 43.26, label: "BAB EL-MANDEB", type: "naval", severity: "critical", info: "Red Sea chokepoint • Houthi threat" },
  { lat: 30.46, lng: 32.34, label: "SUEZ CANAL", type: "naval", severity: "high", info: "12% global trade • Diversion risk" },
  // Radar / SIGINT sites
  { lat: 30.97, lng: 34.78, label: "DIMONA RADAR", type: "radar", severity: "high", info: "🇮🇱 AN/TPY-2 X-band • BMD radar" },
  { lat: 21.42, lng: 39.83, label: "KHAMIS MUSHAIT", type: "military", severity: "medium", info: "🇸🇦 RSAF base • Patriot battery" },
  { lat: 36.14, lng: 32.99, label: "KÜRECIK RADAR", type: "radar", severity: "high", info: "🇺🇸/🇹🇷 NATO BMD radar • AN/TPY-2" },
];

// Arc connections (supply lines, threat vectors)
const OSINT_ARCS = [
  { startLat: 27.18, startLng: 56.17, endLat: 12.6, endLng: 43.26, color: "#ef4444", label: "IRGC-Houthi corridor" },
  { startLat: 35.69, startLng: 51.39, endLat: 33.85, endLng: 35.86, color: "#ef4444", label: "Iran-Hezbollah supply" },
  { startLat: 35.69, startLng: 51.39, endLat: 36.2, endLng: 37.16, color: "#ff6b00", label: "Iran-Syria axis" },
  { startLat: 25.61, startLng: 55.09, endLat: 26.57, endLng: 56.25, color: "#22c55e", label: "USAF patrol route" },
  { startLat: 34.89, startLng: 35.89, endLat: 35.4, endLng: 35.95, color: "#a855f7", label: "RU naval-air link" },
  { startLat: 15.35, startLng: 44.2, endLat: 12.6, endLng: 43.26, color: "#ef4444", label: "Houthi ASM threat" },
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

const SATELLITE_CACHE_KEY = "waros-orbital-cache-v1";

export const SatelliteGlobe = ({ onClose }: SatelliteGlobeProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const globeElRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<any>(null);
  const rawTLERef = useRef<RawSatTLE[]>([]);
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [globeInitError, setGlobeInitError] = useState<string | null>(null);
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

  const loadSatelliteCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(SATELLITE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { satellites: SatelliteData[]; rawTLE: RawSatTLE[] };
      if (!parsed?.satellites?.length || !parsed?.rawTLE?.length) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const saveSatelliteCache = useCallback((data: { satellites: SatelliteData[]; rawTLE: RawSatTLE[] }) => {
    try {
      localStorage.setItem(SATELLITE_CACHE_KEY, JSON.stringify(data));
    } catch {
      // Ignore cache write failures
    }
  }, []);

  const fetchSatellites = useCallback(async () => {
    setLoading(true);
    setGlobeInitError(null);
    try {
      const fetchTextWithTimeout = async (url: string, timeoutMs = 9000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch(url, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!resp.ok) return "";
          return await resp.text();
        } catch {
          return "";
        } finally {
          clearTimeout(timeout);
        }
      };

      const parseTLEBatch = (text: string) => {
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        const rows: { name: string; tle1: string; tle2: string }[] = [];
        for (let i = 0; i < lines.length; i++) {
          const tle1 = lines[i];
          if (!tle1.startsWith("1 ")) continue;

          const tle2 = lines[i + 1];
          if (!tle2?.startsWith("2 ")) continue;

          let name = lines[i - 1] ?? "";
          if (name.startsWith("0 ")) name = name.slice(2).trim();
          if (!name || name.startsWith("1 ") || name.startsWith("2 ")) {
            name = `SAT-${tle1.substring(2, 7).trim()}`;
          }

          rows.push({ name, tle1, tle2 });
        }
        return rows;
      };

      // Fetch from multiple specialized CelesTrak groups for comprehensive OSINT coverage
      const TLE_SOURCES: { url: string; group: string }[] = [
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle", group: "active" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=tle", group: "military" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle", group: "resource" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle", group: "weather" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gnss&FORMAT=tle", group: "gnss" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle", group: "geo" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=sarsat&FORMAT=tle", group: "sarsat" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle", group: "stations" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=science&FORMAT=tle", group: "science" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle", group: "amateur" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=engineering&FORMAT=tle", group: "engineering" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=radar&FORMAT=tle", group: "radar" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=cubesat&FORMAT=tle", group: "cubesat" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=other-comm&FORMAT=tle", group: "other-comm" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=molniya&FORMAT=tle", group: "molniya" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium&FORMAT=tle", group: "iridium" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=globalstar&FORMAT=tle", group: "globalstar" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=orbcomm&FORMAT=tle", group: "orbcomm" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle", group: "starlink" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=tle", group: "oneweb" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=planet&FORMAT=tle", group: "planet" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=spire&FORMAT=tle", group: "spire" },
        { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=tle", group: "recent" },
      ];

      const responses = await Promise.allSettled(
        TLE_SOURCES.map(async (src) => {
          const resp = await fetchTextWithTimeout(src.url);
          return { text: resp, group: src.group };
        })
      );

      const allSats: SatelliteData[] = [];
      const rawByKey = new Map<string, RawSatTLE>();
      const seen = new Set<string>();

      for (const result of responses) {
        if (result.status !== "fulfilled") continue;
        const { text, group } = result.value;
        if (!text.trim()) continue;

        const tleRows = parseTLEBatch(text);
        for (const row of tleRows) {
          const sat = parseTLEFull(row.name, row.tle1, row.tle2);
          if (!sat) continue;

          sat.category = categorizeSatellite(sat.name, group);
          const key = sat.noradId || sat.name;
          if (seen.has(key)) continue;
          seen.add(key);

          const { country, operator } = detectCountry(sat.name, sat.intlDesignator);
          sat.country = country;
          sat.operator = operator;
          sat.source = group;
          allSats.push(sat);

          rawByKey.set(key, {
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

      if (allSats.length === 0) {
        const cached = loadSatelliteCache();
        if (cached) {
          rawTLERef.current = cached.rawTLE;
          setSatellites(cached.satellites);
          console.log(`[ORBITAL INTEL] Live feeds unavailable, using cached dataset (${cached.satellites.length} satellites)`);
          return;
        }
        throw new Error("No valid TLE entries returned from feeds");
      }

      const prioritized = [
        ...allSats.filter((s) => s.category === "Military" || s.category === "ISR" || s.category === "Early Warning" || s.category === "SIGINT/ELINT"),
        ...allSats.filter((s) => s.category === "Navigation"),
        ...allSats.filter((s) => s.category === "SAR Imaging"),
        ...allSats.filter((s) => s.category === "Weather" || s.category === "Earth Observation"),
        ...allSats.filter((s) => s.category === "Data Relay" || s.category === "Search & Rescue"),
        ...allSats.filter((s) => s.category === "Scientific" || s.category === "Space Station"),
        ...allSats.filter((s) => s.category === "Communication").slice(0, 800),
        ...allSats.filter((s) => s.category === "Technology Demo" || s.category === "Amateur/Ham").slice(0, 200),
        ...allSats.filter((s) => s.category === "Debris" || s.category === "Launch Vehicle").slice(0, 100),
        ...allSats.filter((s) => s.category === "Unknown").slice(0, 200),
      ];

      const finalSeen = new Set<string>();
      const deduped = prioritized.filter((s) => {
        const key = s.noradId || s.name;
        if (finalSeen.has(key)) return false;
        finalSeen.add(key);
        return true;
      });

      const limited = deduped.slice(0, 5000);
      const rawTLE = limited
        .map((s) => rawByKey.get(s.noradId || s.name))
        .filter((r): r is RawSatTLE => Boolean(r));

      rawTLERef.current = rawTLE;
      setSatellites(limited);
      saveSatelliteCache({ satellites: limited, rawTLE });
      console.log(
        `[ORBITAL INTEL] Loaded ${limited.length} satellites from ${responses.filter((r) => r.status === "fulfilled").length} CelesTrak groups`
      );
    } catch (err) {
      console.error("Failed to fetch satellites:", err);
      const cached = loadSatelliteCache();
      if (cached) {
        rawTLERef.current = cached.rawTLE;
        setSatellites(cached.satellites);
        console.log(`[ORBITAL INTEL] Using cached dataset (${cached.satellites.length} satellites)`);
      } else {
        setSatellites([]);
        rawTLERef.current = [];
      }
    } finally {
      setLoading(false);
    }
  }, [loadSatelliteCache, saveSatelliteCache]);

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

  // Init globe once, then update data/layers in separate effects (prevents WebGL context churn/black screen)
  useEffect(() => {
    if (!wrapperRef.current) return;

    if (!globeElRef.current) {
      globeElRef.current = document.createElement("div");
      globeElRef.current.style.cssText =
        "width:100%;height:100%;position:absolute;inset:0;";
      wrapperRef.current.appendChild(globeElRef.current);
    }

    let cancelled = false;

    const initGlobe = async () => {
      try {
        const [mod, THREE] = await Promise.all([
          import("globe.gl"),
          import("three"),
        ]);
        const Globe = mod.default;
        if (cancelled || !globeElRef.current) return;

        if (globeRef.current) return;

        const el = globeElRef.current;

        const createSatMesh = (sat: SatelliteData) => {
          const color = new THREE.Color(CATEGORY_COLORS[sat.category] || "#d4a843");
          const group = new THREE.Group();

          const isMilOrISR = sat.category === "Military" || sat.category === "ISR" || sat.category === "Early Warning" || sat.category === "SIGINT/ELINT";
          const isNav = sat.category === "Navigation";
          const isStation = sat.category === "Space Station";
          const bodySize = isStation ? 0.7 : isMilOrISR ? 0.45 : isNav ? 0.35 : 0.25;

          const bodyGeo = new THREE.BoxGeometry(bodySize, bodySize * 0.5, bodySize * 0.7);
          const bodyMat = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.45,
            transparent: true,
            opacity: 0.9,
            shininess: 80,
          });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          group.add(body);

          const glowGeo = new THREE.SphereGeometry(bodySize * 0.18, 6, 6);
          const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.75,
          });
          const glow = new THREE.Mesh(glowGeo, glowMat);
          group.add(glow);

          group.rotation.y = Math.random() * Math.PI * 2;
          return group;
        };

        const globe = new Globe(el)
          .globeImageUrl(
            "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          )
          .bumpImageUrl(
            "https://unpkg.com/three-globe/example/img/earth-topology.png"
          )
          .backgroundImageUrl(
            "https://unpkg.com/three-globe/example/img/night-sky.png"
          )
          .width(el.clientWidth)
          .height(el.clientHeight)
          .atmosphereColor("#1a6b8a")
          .atmosphereAltitude(0.18)
          .objectsData([])
          .objectLat("lat")
          .objectLng("lng")
          .objectAltitude((d: any) => {
            const s = d as SatelliteData;
            return Math.min((s.alt / 6371) * 0.3 + 0.01, 0.7);
          })
          .objectThreeObject((d: any) => createSatMesh(d as SatelliteData))
          .onObjectClick((d: any) => {
            const s = d as SatelliteData;
            setSelectedSat(s);
            if (s.inclination != null && s.raan != null && s.meanAnomaly != null && s.meanMotion != null && s.eccentricity != null && s.epochYear != null && s.epochDay != null) {
              const path = computeOrbitPath(s.inclination, s.raan, s.meanAnomaly, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay, s.alt, 180);
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
          .labelsData([])
          .labelLat("lat")
          .labelLng("lng")
          .labelAltitude((d: any) => {
            const s = d as SatelliteData;
            return Math.min((s.alt / 6371) * 0.3 + 0.02, 0.72);
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
              const path = computeOrbitPath(s.inclination, s.raan, s.meanAnomaly, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay, s.alt, 180);
              setOrbitPath(path);
              setOrbitColor(CATEGORY_COLORS[s.category] || "#d4a843");
            }
            globe.pointOfView(
              { lat: s.lat, lng: s.lng, altitude: 1.5 },
              1000
            );
          })
          .ringsData(OSINT_MARKERS)
          .ringLat((d: any) => d.lat)
          .ringLng((d: any) => d.lng)
          .ringAltitude(0.002)
          .ringMaxRadius((d: any) => d.type === "conflict" ? 3 : d.type === "naval" ? 2.5 : 1.5)
          .ringPropagationSpeed((d: any) => d.severity === "critical" ? 4 : d.severity === "high" ? 2.5 : 1.5)
          .ringRepeatPeriod((d: any) => d.severity === "critical" ? 600 : d.severity === "high" ? 900 : 1200)
          .ringColor((d: any) => {
            const colors: Record<string, (t: number) => string> = {
              conflict: (t: number) => `rgba(239,68,68,${1 - t})`,
              military: (t: number) => `rgba(251,146,60,${0.8 - t * 0.8})`,
              naval: (t: number) => `rgba(56,189,248,${0.9 - t * 0.9})`,
              radar: (t: number) => `rgba(168,85,247,${0.8 - t * 0.8})`,
            };
            return colors[d.type] || colors.military;
          })
          .arcsData(OSINT_ARCS)
          .arcStartLat((d: any) => d.startLat)
          .arcStartLng((d: any) => d.startLng)
          .arcEndLat((d: any) => d.endLat)
          .arcEndLng((d: any) => d.endLng)
          .arcColor((d: any) => [d.color + 'cc', d.color + '44'])
          .arcAltitudeAutoScale(0.3)
          .arcStroke(0.6)
          .arcDashLength(0.4)
          .arcDashGap(0.15)
          .arcDashAnimateTime(3000)
          .htmlElementsData(OSINT_MARKERS)
          .htmlLat((d: any) => d.lat)
          .htmlLng((d: any) => d.lng)
          .htmlAltitude(0.005)
          .htmlElement((d: any) => {
            const el = document.createElement('div');
            el.style.cssText = `pointer-events:none;font-family:monospace;font-size:7px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 6px rgba(0,0,0,0.9);padding:1px 3px;border-radius:2px;`;
            const colors: Record<string, string> = { conflict: '#ef4444', military: '#fb923c', naval: '#38bdf8', radar: '#a855f7' };
            el.style.color = colors[d.type] || '#fb923c';
            el.style.backgroundColor = 'rgba(0,0,0,0.5)';
            el.style.borderLeft = `2px solid ${colors[d.type] || '#fb923c'}`;
            el.innerHTML = `<span style="opacity:0.7">▸</span> ${d.label}`;
            return el;
          });

        const scene = globe.scene();
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(5, 3, 5);
        scene.add(dirLight);

        globe.pointOfView({ lat: 30, lng: 44, altitude: 1.05 }, 1500);
        globe.controls().autoRotate = false;
        globe.controls().enableDamping = true;
        globe.controls().dampingFactor = 0.15;

        globeRef.current = globe;
        setGlobeInitError(null);
      } catch (error) {
        console.error("[ORBITAL INTEL] Globe initialization failed:", error);
        setGlobeInitError("Unable to initialize 3D globe renderer");
      }
    };

    initGlobe();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update visible satellites without reinitializing Globe
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const filtered = selectedCat
      ? satellites.filter((s) => s.category === selectedCat)
      : satellites;

    const maxRenderable = 1800;
    globe.objectsData(filtered.slice(0, maxRenderable));
  }, [satellites, selectedCat]);

  // Update label layer independently
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const filtered = selectedCat
      ? satellites.filter((s) => s.category === selectedCat)
      : satellites;

    const labels = showLabels
      ? filtered
          .filter((s) => ["Military", "ISR", "Early Warning", "SIGINT/ELINT", "Navigation", "SAR Imaging", "Space Station", "Scientific"].includes(s.category))
          .slice(0, 220)
      : [];

    globe.labelsData(labels);
  }, [satellites, selectedCat, showLabels]);

  // Render orbit trails (selected satellite + baseline orbital tracks for precise visual context)
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const allSegments: { coords: { lat: number; lng: number }[]; type: string }[] = [];

    const pushSegmentedPath = (path: { lat: number; lng: number }[], type: string) => {
      if (!path || path.length < 2) return;
      let currentSegment: { lat: number; lng: number }[] = [path[0]];

      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        if (Math.abs(curr.lng - prev.lng) > 90) {
          if (currentSegment.length > 1) allSegments.push({ coords: currentSegment, type });
          currentSegment = [curr];
        } else {
          currentSegment.push(curr);
        }
      }

      if (currentSegment.length > 1) allSegments.push({ coords: currentSegment, type });
    };

    // Selected satellite precise trail
    if (orbitPath && orbitPath.length > 1 && selectedSat) {
      pushSegmentedPath(orbitPath, "orbit");
    }

    // Baseline orbital context (shown when no satellite selected)
    if (!selectedSat && rawTLERef.current.length > 0) {
      const source = selectedCat
        ? rawTLERef.current.filter((r) => r.category === selectedCat)
        : rawTLERef.current;

      source.slice(0, 140).forEach((r) => {
        const baselinePath = computeOrbitPath(
          r.inclination,
          r.raan,
          r.meanAnomaly,
          r.meanMotion,
          r.eccentricity,
          r.epochYear,
          r.epochDay,
          r.alt,
          72
        );
        pushSegmentedPath(baselinePath, "baseline");
      });
    }

    // Predicted future track (green dashed)
    if (predictionTrack && predictionTrack.length > 1) {
      pushSegmentedPath(predictionTrack, "predict");
    }

    if (allSegments.length > 0) {
      const altitude = selectedSat ? Math.min((selectedSat.alt / 6371) * 0.3 + 0.01, 0.7) : 0.055;

      globe
        .pathsData(allSegments)
        .pathPoints('coords')
        .pathPointLat((p: any) => p.lat)
        .pathPointLng((p: any) => p.lng)
        .pathPointAlt(() => altitude)
        .pathColor((seg: any) =>
          seg.type === "predict"
            ? ['#22c55ecc', '#22c55e33']
            : seg.type === "baseline"
              ? ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.05)']
              : [orbitColor + 'cc', orbitColor + '33']
        )
        .pathStroke((seg: any) => seg.type === "predict" ? 2 : seg.type === "baseline" ? 0.65 : 1.5)
        .pathDashLength((seg: any) => seg.type === "baseline" ? 0.008 : 0.02)
        .pathDashGap((seg: any) => seg.type === "baseline" ? 0.01 : 0.01)
        .pathDashAnimateTime((seg: any) => seg.type === "predict" ? 6000 : seg.type === "baseline" ? 0 : 4000)
        .pathTransitionDuration(250);
    } else {
      globe.pathsData([]);
    }
  }, [orbitPath, selectedSat, orbitColor, predictionTrack, selectedCat, satellites.length]);

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
      {/* Holographic scanline overlay */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.015) 2px, rgba(0,255,200,0.015) 4px)",
          mixBlendMode: "screen",
        }}
      />
      {/* Holographic sweep line */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none"
        style={{
          background: "linear-gradient(180deg, transparent 0%, transparent 45%, rgba(0,255,200,0.06) 50%, transparent 55%, transparent 100%)",
          animation: "holoSweep 8s linear infinite",
        }}
      />
      {/* Corner brackets — holographic frame */}
      <div className="absolute inset-0 z-[2001] pointer-events-none">
        {/* Top-left */}
        <div className="absolute top-2 left-2 w-12 h-12 border-t border-l" style={{ borderColor: "rgba(0,255,200,0.25)" }} />
        {/* Top-right */}
        <div className="absolute top-2 right-2 w-12 h-12 border-t border-r" style={{ borderColor: "rgba(0,255,200,0.25)" }} />
        {/* Bottom-left */}
        <div className="absolute bottom-2 left-2 w-12 h-12 border-b border-l" style={{ borderColor: "rgba(0,255,200,0.25)" }} />
        {/* Bottom-right */}
        <div className="absolute bottom-2 right-2 w-12 h-12 border-b border-r" style={{ borderColor: "rgba(0,255,200,0.25)" }} />
      </div>
      {/* Holographic vignette glow */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,20,30,0.6) 100%)",
        }}
      />
      {/* Holographic grid overlay (subtle) */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,255,200,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top-left HUD — holographic */}
      <div className="absolute top-3 left-3 z-[2002] pointer-events-none space-y-1 holo-flicker">
        <div
          className="font-mono text-[11px] font-bold tracking-[0.2em] holo-text"
        >
          ◈ ORBITAL INTELLIGENCE
        </div>
        <div className="text-[8px] font-mono tracking-wider" style={{ color: "rgba(0,255,200,0.5)" }}>
          REAL-TIME SATELLITE TRACKING • OSINT FUSION
        </div>
        <div className="mt-2 space-y-0.5 text-[8px] font-mono" style={{ color: "rgba(0,255,200,0.55)" }}>
          <div style={{ color: "rgba(239,68,68,0.7)" }}>⬤ TOP SECRET // SI-TK // NOFORN</div>
          <div>
            ▸ TRACKING {satellites.length} OBJECTS across {Object.keys(CATEGORY_COLORS).length} TYPES
          </div>
          <div>
            ▸ MIL: {satellites.filter((s) => s.category === "Military").length} • ISR: {satellites.filter((s) => s.category === "ISR").length} • EW: {satellites.filter((s) => s.category === "Early Warning").length} • SIGINT: {satellites.filter((s) => s.category === "SIGINT/ELINT").length}
          </div>
          <div>
            ▸ NAV: {satellites.filter((s) => s.category === "Navigation").length} • COMM: {satellites.filter((s) => s.category === "Communication").length} • WX: {satellites.filter((s) => s.category === "Weather").length} • EO: {satellites.filter((s) => s.category === "Earth Observation").length}
          </div>
          <div>
            ▸ SAR: {satellites.filter((s) => s.category === "SAR Imaging").length} • SCI: {satellites.filter((s) => s.category === "Scientific").length} • RELAY: {satellites.filter((s) => s.category === "Data Relay").length} • S&R: {satellites.filter((s) => s.category === "Search & Rescue").length}
          </div>
          <div>
            ▸ VLEO: {satellites.filter((s) => s.alt < 450).length} • LEO: {satellites.filter((s) => s.alt >= 450 && s.alt < 2000).length} • MEO: {satellites.filter((s) => s.alt >= 2000 && s.alt < 35000).length} • GEO: {satellites.filter((s) => s.alt >= 35000 && s.alt <= 36500).length}
          </div>
          <div>
            ▸ OSINT: {OSINT_MARKERS.length} INTEL MARKERS • {OSINT_ARCS.length} THREAT VECTORS
          </div>
          <div>
            ▸ SOURCES: CELESTRAK × 23 GROUPS • NORAD TLE
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)" }}>
            ▸ LAST PROPAGATION: {lastPropagated.toISOString().replace('T', ' ').slice(0, 19)}Z
          </div>
        </div>
        {/* OSINT Legend */}
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px solid rgba(0,255,200,0.1)" }}>
          <div className="text-[7px] font-mono uppercase tracking-widest" style={{ color: "rgba(0,255,200,0.4)" }}>OSINT LAYER</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-[7px] font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> CONFLICT</span>
            <span className="text-[7px] font-mono flex items-center gap-1" style={{ color: "#fb923c" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#fb923c" }} /> MILITARY</span>
            <span className="text-[7px] font-mono flex items-center gap-1" style={{ color: "#38bdf8" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#38bdf8" }} /> NAVAL</span>
            <span className="text-[7px] font-mono flex items-center gap-1" style={{ color: "#a855f7" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#a855f7" }} /> RADAR</span>
          </div>
        </div>
      </div>

      {/* Top-right timestamp — holographic */}
      <div className="absolute top-3 right-3 z-[2002] pointer-events-none text-right space-y-0.5">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-mono text-red-400">
            {timestamp}
          </span>
        </div>
        <div className="text-[8px] font-mono" style={{ color: "rgba(0,255,200,0.4)" }}>
          CELESTRAK NORAD TLE • LIVE OSINT
        </div>
      </div>

      {/* Category filters - centered and wrapped for readability */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[2002] pointer-events-auto w-[min(96vw,1400px)] px-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg px-2 py-1.5">
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
            const CatIcon = cat === "Military" ? Shield
              : cat === "ISR" ? Eye
              : cat === "Early Warning" ? Zap
              : cat === "SIGINT/ELINT" ? Eye
              : cat === "Communication" ? Radio
              : cat === "Data Relay" ? Radio
              : cat === "Navigation" ? Navigation
              : cat === "Weather" ? Cloud
              : cat === "Earth Observation" ? Globe
              : cat === "SAR Imaging" ? Satellite
              : cat === "Scientific" ? Crosshair
              : cat === "Space Station" ? Globe
              : cat === "Technology Demo" ? Cpu
              : cat === "Amateur/Ham" ? Radio
              : cat === "Search & Rescue" ? Anchor
              : cat === "Debris" ? HelpCircle
              : cat === "Launch Vehicle" ? Rocket
              : HelpCircle;
            const isDisabled = count === 0;

            return (
              <button
                key={cat}
                disabled={isDisabled}
                onClick={() => !isDisabled && setSelectedCat(selectedCat === cat ? null : cat)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-mono font-semibold transition-all ${
                  selectedCat === cat
                    ? "bg-white text-black shadow-md"
                    : isDisabled
                      ? "text-white/30 cursor-not-allowed"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <CatIcon className="h-3 w-3" style={{ color }} />
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

        {!loading && globeInitError && (
          <div className="absolute inset-0 z-[2002] flex items-center justify-center pointer-events-none">
            <div className="rounded-md border border-destructive/30 bg-card/90 px-4 py-3 text-center max-w-sm">
              <p className="text-xs font-mono text-destructive">3D renderer failed to initialize.</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">Refresh Orbital Intel to retry.</p>
            </div>
          </div>
        )}

        {!loading && !globeInitError && satellites.length === 0 && (
          <div className="absolute inset-0 z-[2002] flex items-center justify-center pointer-events-none">
            <div className="rounded-md border border-border bg-card/90 px-4 py-3 text-center max-w-sm">
              <p className="text-xs font-mono text-foreground">No orbital objects available right now.</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">Try refresh to reacquire TLE feeds.</p>
            </div>
          </div>
        )}

        {/* Selected satellite detail panel */}
        {selectedSat && (
          <div
            className="absolute top-20 left-36 z-[2003] w-64 rounded border backdrop-blur-md pointer-events-auto animate-fade-in holo-flicker"
            style={{
              borderColor: CATEGORY_COLORS[selectedSat.category] + "40",
              background: "rgba(0,15,20,0.92)",
              boxShadow: `0 0 25px ${CATEGORY_COLORS[selectedSat.category]}18, inset 0 0 40px rgba(0,255,200,0.02)`,
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
