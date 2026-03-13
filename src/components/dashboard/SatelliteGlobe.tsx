import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, Satellite, Search, Tag, Tags, ZoomIn, ZoomOut, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCw, RotateCcw, Shield, Eye, Radio, Navigation, Cloud, Globe, HelpCircle, Bot, Send, Loader2, Crosshair, Clock, MapPin, Zap, Rocket, Cpu, Anchor, Plane } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { getCountryGeoJSON } from "@/data/countryBorders";
import militarySatSprite from "@/assets/military-sat-sprite.png";
import { FlightEmulationPanel } from "./FlightEmulationPanel";
import { useAISVessels, type AISVessel } from "@/hooks/useAISVessels";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface FlightAircraft {
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
  registration?: string;
  type?: string;
}

interface SatelliteGlobeProps {
  onClose: () => void;
  flights?: FlightAircraft[];
  trackedFlightId?: string | null;
  onTrackFlight?: (icao: string | null) => void;
  flightSource?: string;
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

// Compute full orbital path (one full revolution) as array of {lat, lng}
function computeOrbitPath(
  inclination: number, raan: number, meanAnomaly: number,
  meanMotion: number, eccentricity: number, epochYear: number,
  epochDay: number, alt: number, steps = 180
): { lat: number; lng: number }[] {
  const periodDays = 1 / meanMotion; // one revolution in days
  const points: { lat: number; lng: number }[] = [];
  const now = new Date();

  // Compute elapsed days from epoch to now using proper date math
  const epochDate = new Date(epochYear, 0, 1);
  epochDate.setTime(epochDate.getTime() + (epochDay - 1) * 86400000);
  const elapsedToNow = (now.getTime() - epochDate.getTime()) / 86400000;

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    // Show trail: 30% behind current position, 70% ahead
    const dayOffset = -periodDays * 0.3 + fraction * periodDays;
    const totalElapsed = elapsedToNow + dayOffset;
    const totalRevs = totalElapsed * meanMotion;
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

interface CityPreset {
  name: string;
  lat: number;
  lng: number;
  country: string;
  landmark: string;
  description: string;
  image: string;
  population?: string;
  timezone?: string;
}

const CITY_PRESETS: CityPreset[] = [
  // Iran
  { name: "Tehran", lat: 35.69, lng: 51.39, country: "Iran", landmark: "Azadi Tower", description: "45m marble-clad gateway tower (1971) combining Sassanid and Islamic architecture, symbol of modern Iran.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Azadi_Tower_2021.jpg/1280px-Azadi_Tower_2021.jpg", population: "9.1M", timezone: "UTC+3:30" },
  { name: "Isfahan", lat: 32.65, lng: 51.68, country: "Iran", landmark: "Naqsh-e Jahan Square", description: "UNESCO World Heritage Site (1598), one of the largest city squares in the world, surrounded by masterpieces of Safavid-era architecture.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Naghshe_Jahan_Square_Isfahan_modified.jpg/1280px-Naghshe_Jahan_Square_Isfahan_modified.jpg", population: "2.2M", timezone: "UTC+3:30" },
  { name: "Shiraz", lat: 29.59, lng: 52.58, country: "Iran", landmark: "Nasir al-Mulk Mosque", description: "The 'Pink Mosque' (1888) famous for its stained glass windows that create a kaleidoscope of color at sunrise.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Nasir_al-Mulk_Mosque_Shiraz.jpg/1280px-Nasir_al-Mulk_Mosque_Shiraz.jpg", population: "1.9M", timezone: "UTC+3:30" },
  { name: "Tabriz", lat: 38.08, lng: 46.29, country: "Iran", landmark: "Tabriz Grand Bazaar", description: "UNESCO-listed, one of the oldest and largest covered bazaars in the world, a key Silk Road trading hub since antiquity.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Tabriz_Bazaar.jpg/1280px-Tabriz_Bazaar.jpg", population: "1.8M", timezone: "UTC+3:30" },
  { name: "Mashhad", lat: 36.3, lng: 59.6, country: "Iran", landmark: "Imam Reza Shrine", description: "Largest mosque in the world by area, housing the tomb of Imam Reza, visited by over 30 million pilgrims annually.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Imam_Reza_shrine.jpg/1280px-Imam_Reza_shrine.jpg", population: "3.4M", timezone: "UTC+3:30" },
  { name: "Persepolis", lat: 29.93, lng: 52.89, country: "Iran", landmark: "Persepolis Ruins", description: "Ceremonial capital of the Achaemenid Empire (515 BCE), with the iconic Gate of All Nations and Apadana Palace.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Persepolis_T_Chipiez.jpg/1280px-Persepolis_T_Chipiez.jpg", population: "—", timezone: "UTC+3:30" },
  // Jordan
  { name: "Amman", lat: 31.95, lng: 35.93, country: "Jordan", landmark: "Roman Theatre", description: "Ancient 6,000-seat amphitheater built during the reign of Antoninus Pius (138–161 CE), carved into a hillside in downtown Amman.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Amman_Roman_Theatre.jpg/1280px-Amman_Roman_Theatre.jpg", population: "4.1M", timezone: "UTC+3" },
  { name: "Petra", lat: 30.33, lng: 35.44, country: "Jordan", landmark: "Al-Khazneh (The Treasury)", description: "Rose-red city carved into sandstone cliffs by the Nabataeans (312 BCE). One of the New Seven Wonders of the World.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Treasury_petra_crop.jpg/800px-Treasury_petra_crop.jpg", population: "—", timezone: "UTC+3" },
  { name: "Aqaba", lat: 29.53, lng: 35.01, country: "Jordan", landmark: "Aqaba Fort", description: "Strategic Red Sea port city with a 14th-century Mamluk fort, gateway to Wadi Rum and coral reef diving.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Aqaba_Castle.jpg/1280px-Aqaba_Castle.jpg", population: "188K", timezone: "UTC+3" },
  // Israel/Palestine
  { name: "Jerusalem", lat: 31.77, lng: 35.23, country: "Israel/Palestine", landmark: "Dome of the Rock", description: "Iconic 7th-century Islamic shrine on Temple Mount/Haram al-Sharif, one of the holiest sites in the world.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Dome_of_Rock%2C_Temple_Mount%2C_Jerusalem.jpg/1280px-Dome_of_Rock%2C_Temple_Mount%2C_Jerusalem.jpg", population: "936K", timezone: "UTC+2" },
  { name: "Tel Aviv", lat: 32.08, lng: 34.78, country: "Israel", landmark: "White City (Bauhaus)", description: "UNESCO-listed collection of over 4,000 Bauhaus/International Style buildings, the largest concentration in the world.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Tel_Aviv_Promenade.jpg/1280px-Tel_Aviv_Promenade.jpg", population: "460K", timezone: "UTC+2" },
  // UAE
  { name: "Dubai", lat: 25.2, lng: 55.27, country: "UAE", landmark: "Burj Khalifa", description: "World's tallest building at 828m (2,717 ft) with 163 floors.", image: "https://upload.wikimedia.org/wikipedia/en/thumb/9/93/Burj_Khalifa.jpg/800px-Burj_Khalifa.jpg", population: "3.5M", timezone: "UTC+4" },
  { name: "Abu Dhabi", lat: 24.45, lng: 54.65, country: "UAE", landmark: "Sheikh Zayed Grand Mosque", description: "One of the world's largest mosques, featuring 82 domes, 1,000+ columns, and the largest hand-knotted carpet.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Sheikh_Zayed_Mosque_view.jpg/1280px-Sheikh_Zayed_Mosque_view.jpg", population: "1.5M", timezone: "UTC+4" },
  // Bahrain
  { name: "Manama", lat: 26.07, lng: 50.55, country: "Bahrain", landmark: "Bahrain World Trade Center", description: "Twin 240m towers with integrated wind turbines — first skyscraper to do so.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Bahrain_World_Trade_Center_.jpg/800px-Bahrain_World_Trade_Center_.jpg", population: "411K", timezone: "UTC+3" },
  // Kuwait
  { name: "Kuwait City", lat: 29.38, lng: 47.99, country: "Kuwait", landmark: "Kuwait Towers", description: "Three iconic towers (1979) on the Arabian Gulf waterfront, the tallest reaching 187m with a revolving observation sphere.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Kuwait_towers.jpg/800px-Kuwait_towers.jpg", population: "3.1M", timezone: "UTC+3" },
  // Qatar
  { name: "Doha", lat: 25.29, lng: 51.53, country: "Qatar", landmark: "Museum of Islamic Art", description: "I.M. Pei-designed museum (2008) on its own island, housing 1,400 years of Islamic art and artifacts.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Museum_of_Islamic_Art%2C_Doha%2C_Qatar.jpg/1280px-Museum_of_Islamic_Art%2C_Doha%2C_Qatar.jpg", population: "1.2M", timezone: "UTC+3" },
  // Oman
  { name: "Muscat", lat: 23.59, lng: 58.59, country: "Oman", landmark: "Sultan Qaboos Grand Mosque", description: "Stunning mosque (2001) with a 50m-high dome, a 14m Swarovski crystal chandelier, and the world's second-largest hand-woven carpet.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Sultan_Qaboos_Grand_Mosque_RB.jpg/1280px-Sultan_Qaboos_Grand_Mosque_RB.jpg", population: "1.4M", timezone: "UTC+4" },
  // Iraq
  { name: "Baghdad", lat: 33.31, lng: 44.37, country: "Iraq", landmark: "Al-Shaheed Monument", description: "Split turquoise dome war memorial (1983) honoring Iraqi soldiers.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Al-Shaheed_Monument_in_Baghdad.jpg/1280px-Al-Shaheed_Monument_in_Baghdad.jpg", population: "8.1M", timezone: "UTC+3" },
  { name: "Erbil", lat: 36.19, lng: 44.01, country: "Iraq", landmark: "Erbil Citadel", description: "UNESCO-listed ancient tell settlement, continuously inhabited for over 6,000 years — one of the oldest in the world.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Erbil_Citadel.jpg/1280px-Erbil_Citadel.jpg", population: "880K", timezone: "UTC+3" },
  // Saudi Arabia
  { name: "Riyadh", lat: 24.71, lng: 46.67, country: "Saudi Arabia", landmark: "Kingdom Centre Tower", description: "302m skyscraper with a distinctive inverted parabolic arch at the top.", image: "https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Kingdom_Centre%2C_Riyadh%2C_Saudi_Arabia.jpg/800px-Kingdom_Centre%2C_Riyadh%2C_Saudi_Arabia.jpg", population: "7.6M", timezone: "UTC+3" },
  { name: "Mecca", lat: 21.43, lng: 39.83, country: "Saudi Arabia", landmark: "Masjid al-Haram", description: "The holiest site in Islam, surrounding the Kaaba. The mosque can accommodate up to 4 million worshippers during Hajj.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Masjid_al-Haram_-_panoramio.jpg/1280px-Masjid_al-Haram_-_panoramio.jpg", population: "2.4M", timezone: "UTC+3" },
  { name: "Medina", lat: 24.47, lng: 39.61, country: "Saudi Arabia", landmark: "Al-Masjid an-Nabawi", description: "The Prophet's Mosque, second holiest site in Islam, featuring the distinctive Green Dome over the Prophet Muhammad's tomb.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Al-Masjid_AL-Nabawi_in_Madinah_-_Saudi_Arabia.jpg/1280px-Al-Masjid_AL-Nabawi_in_Madinah_-_Saudi_Arabia.jpg", population: "1.5M", timezone: "UTC+3" },
  // Lebanon
  { name: "Beirut", lat: 33.89, lng: 35.5, country: "Lebanon", landmark: "Pigeon Rocks", description: "Iconic natural limestone arches rising from the Mediterranean Sea off the Raouché coast.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Raouche.jpg/1280px-Raouche.jpg", population: "2.4M", timezone: "UTC+2" },
  // Syria
  { name: "Damascus", lat: 33.51, lng: 36.29, country: "Syria", landmark: "Umayyad Mosque", description: "One of the oldest and largest mosques in the world (715 CE), built on the site of an Aramaean temple.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Omayyad_Mosque%2C_Damascus.jpg/1280px-Omayyad_Mosque%2C_Damascus.jpg", population: "2.5M", timezone: "UTC+3" },
  // Egypt
  { name: "Cairo", lat: 30.04, lng: 31.24, country: "Egypt", landmark: "Great Pyramids of Giza", description: "Last surviving Wonder of the Ancient World. The Great Pyramid (2560 BCE) stood as the tallest man-made structure for 3,800 years.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/1280px-Kheops-Pyramid.jpg", population: "21M", timezone: "UTC+2" },
  // Turkey
  { name: "Istanbul", lat: 41.01, lng: 28.98, country: "Turkey", landmark: "Hagia Sophia", description: "Built 537 CE as a cathedral, later a mosque. Its massive dome was an architectural marvel for nearly a millennium.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Hagia_Sophia_Mars_2013.jpg/1280px-Hagia_Sophia_Mars_2013.jpg", population: "15.8M", timezone: "UTC+3" },
  // Yemen
  { name: "Sana'a", lat: 15.37, lng: 44.19, country: "Yemen", landmark: "Old City of Sana'a", description: "UNESCO-listed walled city with distinctive multi-story tower houses of rammed earth decorated with geometric patterns.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Sanaa_HDR_%288325802494%29.jpg/1280px-Sanaa_HDR_%288325802494%29.jpg", population: "4M", timezone: "UTC+3" },
  // Global
  { name: "Moscow", lat: 55.75, lng: 37.62, country: "Russia", landmark: "St. Basil's Cathedral", description: "Colorful onion-domed cathedral (1561) on Red Square.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Moscow_July_2011-16.jpg/800px-Moscow_July_2011-16.jpg", population: "12.6M", timezone: "UTC+3" },
  { name: "Washington DC", lat: 38.9, lng: -77.04, country: "USA", landmark: "The Pentagon", description: "World's largest office building by floor area, headquarters of the US Department of Defense.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/The_Pentagon_January_2008.jpg/1280px-The_Pentagon_January_2008.jpg", population: "689K", timezone: "UTC-5" },
  { name: "Beijing", lat: 39.9, lng: 116.4, country: "China", landmark: "Forbidden City", description: "Imperial palace complex (1420) with 980 buildings over 72 hectares.", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Beijing-Forbidden_City1.jpg/1280px-Beijing-Forbidden_City1.jpg", population: "21.5M", timezone: "UTC+8" },
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

export const SatelliteGlobe = ({ onClose, flights = [], trackedFlightId = null, onTrackFlight, flightSource = "" }: SatelliteGlobeProps) => {
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
  const [countrySats, setCountrySats] = useState<{ category: string; count: number; color: string }[]>([]);
  const [satTypesExpanded, setSatTypesExpanded] = useState(false);
  const [flightsPanelExpanded, setFlightsPanelExpanded] = useState(false);
  const [vesselsPanelExpanded, setVesselsPanelExpanded] = useState(false);
  const [vesselFilter, setVesselFilter] = useState<string>("ALL");
  const [vesselTypeVisible, setVesselTypeVisible] = useState<Record<string, boolean>>({
    CARGO: true, TANKER: true, MILITARY: true, FISHING: true, UNKNOWN: false,
  });
  const aisVessels = useAISVessels();
  const prevVesselPosRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const vesselInterpRef = useRef<number>(0);
  const [countrySatNames, setCountrySatNames] = useState<Set<string>>(new Set());
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
  const pulseFrameRef = useRef<number>(0);
  const countrySatNamesRef = useRef<Set<string>>(new Set());
  const satsRef = useRef<SatelliteData[]>([]);
  const orbitRefreshCounter = useRef<number>(0);
  const [countryBadges, setCountryBadges] = useState<Record<string, { total: number; breakdown: { category: string; count: number; color: string }[] }>>({});
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictionData, setPredictionData] = useState<{
    positions?: { time: string; lat: number; lng: number; alt: number }[];
    passes?: { startTime: string; closestTime: string; endTime: string; minDistKm: number; maxElevation: number }[];
    ai_analysis?: string;
    satellite_name?: string;
  } | null>(null);
  const [predictionTrack, setPredictionTrack] = useState<{ lat: number; lng: number }[] | null>(null);
  const [globeStyle, setGlobeStyle] = useState<string>("normal");
  const [selectedCity, setSelectedCity] = useState<CityPreset | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Globe style presets — change texture, atmosphere, lighting
  const GLOBE_STYLES = [
    { id: "normal", label: "Normal", icon: "🌍", desc: "Blue marble" },
    { id: "crt", label: "CRT", icon: "🌙", desc: "Retro green CRT" },
    { id: "nvg", label: "NVG", icon: "👁", desc: "Night vision" },
    { id: "flir", label: "FLIR", icon: "🔥", desc: "Thermal infrared" },
    { id: "noir", label: "Noir", icon: "🖤", desc: "Dark monochrome" },
    { id: "snow", label: "Snow", icon: "❄️", desc: "Arctic white" },
  ] as const;

  const applyGlobeStyle = useCallback((styleId: string) => {
    const globe = globeRef.current;
    if (!globe) return;
    setGlobeStyle(styleId);

    const scene = globe.scene();
    if (!scene) return;

    // Remove existing CSS filters on the canvas
    const canvas = globeElRef.current?.querySelector("canvas");

    // Style definitions: globe texture + atmosphere + scene background + CSS filter
    const styles: Record<string, {
      texture: string; bump: string; bg: string;
      atmosphere: string; atmosphereAlt: number;
      filter: string; ambientColor: number; ambientIntensity: number;
      dirColor: number; dirIntensity: number;
    }> = {
      normal: {
        texture: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
        bump: "https://unpkg.com/three-globe/example/img/earth-topology.png",
        bg: "https://unpkg.com/three-globe/example/img/night-sky.png",
        atmosphere: "#1a6b8a", atmosphereAlt: 0.18,
        filter: "none",
        ambientColor: 0xffffff, ambientIntensity: 0.7,
        dirColor: 0xffffff, dirIntensity: 0.9,
      },
      crt: {
        texture: "https://unpkg.com/three-globe/example/img/earth-night.jpg",
        bump: "https://unpkg.com/three-globe/example/img/earth-topology.png",
        bg: "https://unpkg.com/three-globe/example/img/night-sky.png",
        atmosphere: "#00ff88", atmosphereAlt: 0.22,
        filter: "saturate(0.3) brightness(0.7) contrast(1.4) sepia(0.3) hue-rotate(90deg)",
        ambientColor: 0x00ff66, ambientIntensity: 0.4,
        dirColor: 0x00ff88, dirIntensity: 0.6,
      },
      nvg: {
        texture: "https://unpkg.com/three-globe/example/img/earth-night.jpg",
        bump: "https://unpkg.com/three-globe/example/img/earth-topology.png",
        bg: "https://unpkg.com/three-globe/example/img/night-sky.png",
        atmosphere: "#22ff44", atmosphereAlt: 0.25,
        filter: "saturate(0) brightness(0.6) contrast(1.5) sepia(1) hue-rotate(70deg)",
        ambientColor: 0x44ff44, ambientIntensity: 0.5,
        dirColor: 0x22ff22, dirIntensity: 0.4,
      },
      flir: {
        texture: "https://unpkg.com/three-globe/example/img/earth-night.jpg",
        bump: "https://unpkg.com/three-globe/example/img/earth-topology.png",
        bg: "https://unpkg.com/three-globe/example/img/night-sky.png",
        atmosphere: "#ff4400", atmosphereAlt: 0.2,
        filter: "saturate(1.5) brightness(0.8) contrast(1.6) hue-rotate(-30deg)",
        ambientColor: 0xff6600, ambientIntensity: 0.5,
        dirColor: 0xff4400, dirIntensity: 0.7,
      },
      noir: {
        texture: "https://unpkg.com/three-globe/example/img/earth-dark.jpg",
        bump: "https://unpkg.com/three-globe/example/img/earth-topology.png",
        bg: "https://unpkg.com/three-globe/example/img/night-sky.png",
        atmosphere: "#666666", atmosphereAlt: 0.15,
        filter: "saturate(0) brightness(0.5) contrast(1.8)",
        ambientColor: 0xaaaaaa, ambientIntensity: 0.3,
        dirColor: 0xffffff, dirIntensity: 0.5,
      },
      snow: {
        texture: "https://unpkg.com/three-globe/example/img/earth-water.png",
        bump: "https://unpkg.com/three-globe/example/img/earth-topology.png",
        bg: "https://unpkg.com/three-globe/example/img/night-sky.png",
        atmosphere: "#aaddff", atmosphereAlt: 0.22,
        filter: "saturate(0.2) brightness(1.3) contrast(0.9) sepia(0.1) hue-rotate(190deg)",
        ambientColor: 0xccddff, ambientIntensity: 0.9,
        dirColor: 0xffffff, dirIntensity: 1.0,
      },
    };

    const s = styles[styleId] || styles.normal;

    // Apply globe textures
    globe.globeImageUrl(s.texture);
    globe.bumpImageUrl(s.bump);
    globe.backgroundImageUrl(s.bg);
    globe.atmosphereColor(s.atmosphere);
    globe.atmosphereAltitude(s.atmosphereAlt);

    // Apply CSS filter to canvas for color grading
    if (canvas) {
      canvas.style.filter = s.filter;
      canvas.style.transition = "filter 0.5s ease";
    }

    // Update scene lighting
    scene.children.forEach((child: any) => {
      if (child.isAmbientLight) {
        child.color.setHex(s.ambientColor);
        child.intensity = s.ambientIntensity;
      }
      if (child.isDirectionalLight) {
        child.color.setHex(s.dirColor);
        child.intensity = s.dirIntensity;
      }
    });
  }, []);

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

    const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/war-chat`;
    fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ role: "user", content: initialQ }] }),
    }).then(async (resp) => {
      if (!resp.ok) {
        const status = resp.status;
        setAiLoading(false);
        // Check if the response is JSON (error) vs SSE stream
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const errData = await resp.json();
            const errMsg = errData.error || (status === 429
              ? "⚠️ High demand — AI rate limited. Try again shortly."
              : status === 402
              ? "⚠️ AI credits exhausted. Refresh later."
              : "⚠️ Unable to reach AI. Try again later.");
            setAiMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${errMsg}` }]);
          } catch {
            setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ Unable to reach AI. Try again later." }]);
          }
          return;
        }
        const errMsg = status === 429
          ? "⚠️ High demand — AI rate limited. Try again shortly."
          : status === 402
          ? "⚠️ AI credits exhausted. Refresh later."
          : "⚠️ Unable to reach AI. Try again later.";
        setAiMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
        return;
      }
      if (!resp.body) {
        setAiLoading(false);
        setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ No response body." }]);
        return;
      }
      // Stream SSE
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              const cleaned = fullText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
              setAiMessages(prev => {
                const copy = [...prev];
                if (copy.length > 0 && copy[copy.length - 1].role === "assistant") {
                  copy[copy.length - 1] = { role: "assistant", content: cleaned || "..." };
                } else {
                  copy.push({ role: "assistant", content: cleaned || "..." });
                }
                return copy;
              });
            }
          } catch { /* partial chunk */ }
        }
      }
      setAiLoading(false);
      if (!fullText) {
        setAiMessages(prev => [...prev, { role: "assistant", content: "No response received." }]);
      }
    }).catch(() => {
      setAiLoading(false);
      setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection failed. Try again." }]);
    });
  }, []);

  const sendAiMessage = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const newMsgs = [...aiMessages, { role: "user", content: text }];
    setAiMessages(newMsgs);
    setAiInput("");
    setAiLoading(true);

    const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/war-chat`;
    try {
      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMsgs }),
      });

      if (!resp.ok) {
        setAiLoading(false);
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const errData = await resp.json();
            setAiMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${errData.error || "Error connecting to AI."}` }]);
          } catch {
            setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error connecting to AI." }]);
          }
          return;
        }
        const errMsg = resp.status === 429
          ? "⚠️ Rate limited. Try again shortly."
          : resp.status === 402
          ? "⚠️ AI credits exhausted."
          : "⚠️ Error connecting to AI.";
        setAiMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
        return;
      }

      if (!resp.body) {
        setAiLoading(false);
        setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ No response." }]);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              const cleaned = fullText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
              setAiMessages(prev => {
                const copy = [...prev];
                if (copy.length > 0 && copy[copy.length - 1].role === "assistant") {
                  copy[copy.length - 1] = { role: "assistant", content: cleaned || "..." };
                } else {
                  copy.push({ role: "assistant", content: cleaned || "..." });
                }
                return copy;
              });
            }
          } catch { /* partial chunk */ }
        }
      }
      setAiLoading(false);
      if (!fullText) {
        setAiMessages(prev => [...prev, { role: "assistant", content: "No response received." }]);
      }
    } catch {
      setAiLoading(false);
      setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection failed." }]);
    }
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
      // Always show positions/passes even if AI analysis unavailable
      const result = data || {};
      if (result.ai_status === "unavailable" || result.ai_status === "rate_limited") {
        result.ai_analysis = result.ai_analysis || `⚠️ AI narrative analysis is temporarily unavailable (${result.ai_error || "rate limited"}). Orbital mechanics data (passes & track) is shown below.`;
      }
      setPredictionData(result);
      if (result?.positions) {
        setPredictionTrack(result.positions.map((p: any) => ({ lat: p.lat, lng: p.lng })));
      }
    } catch (err) {
      console.error("Prediction failed:", err);
      setPredictionData({ ai_analysis: "⚠️ Prediction request failed. Try again." });
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
    setPredictionData(null);
    setPredictionTrack(null);
    // Compute orbit path for selected satellite
    if (
      sat.inclination != null && sat.raan != null && sat.meanAnomaly != null &&
      sat.meanMotion != null && sat.eccentricity != null &&
      sat.epochYear != null && sat.epochDay != null
    ) {
      const path = computeOrbitPath(
        sat.inclination, sat.raan, sat.meanAnomaly,
        sat.meanMotion, sat.eccentricity, sat.epochYear,
        sat.epochDay, sat.alt, 180
      );
      setOrbitPath(path);
      setOrbitColor(CATEGORY_COLORS[sat.category] || "#d4a843");
    }
    if (globeRef.current) {
      const zoomAlt = sat.alt < 2000 ? 0.6 : sat.alt < 25000 ? 0.9 : 1.2;
      globeRef.current.pointOfView(
        { lat: sat.lat, lng: sat.lng, altitude: zoomAlt },
        1000
      );
    }
  }, []);

  // Real-time badge updates every 10 seconds
  useEffect(() => {
    const computeBadges = () => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const result: Record<string, { total: number; breakdown: { category: string; count: number; color: string }[] }> = {};
      CITY_PRESETS.forEach((city) => {
        const nearby = satsRef.current.filter((s) => {
          const dLat = toRad(s.lat - city.lat);
          const dLng = toRad(s.lng - city.lng);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(city.lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLng / 2) ** 2;
          const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return dist < 2500;
        });
        const catMap = new Map<string, number>();
        nearby.forEach((s) => catMap.set(s.category, (catMap.get(s.category) || 0) + 1));
        const breakdown = Array.from(catMap.entries())
          .map(([category, count]) => ({ category, count, color: CATEGORY_COLORS[category] || "#d4a843" }))
          .sort((a, b) => b.count - a.count);
        result[city.name] = { total: nearby.length, breakdown };
      });
      setCountryBadges(result);
    };
    computeBadges();
    const interval = setInterval(computeBadges, 10000);
    return () => clearInterval(interval);
  }, [satellites]);

  const flyToCity = useCallback((city: CityPreset) => {
    setActiveCity(city.name);
    setSelectedSat(null);
    setOrbitPath(null);
    setSelectedCity(city);

    // Find satellites within ~2500km radius of the country center
    const R = 2500; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const nearbySats = satsRef.current.filter((s) => {
      const dLat = toRad(s.lat - city.lat);
      const dLng = toRad(s.lng - city.lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(city.lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLng / 2) ** 2;
      const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return dist < R;
    });

    // Group by category
    const catMap = new Map<string, number>();
    const nameSet = new Set<string>();
    nearbySats.forEach((s) => {
      catMap.set(s.category, (catMap.get(s.category) || 0) + 1);
      nameSet.add(s.noradId || s.name);
    });

    const breakdown = Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count, color: CATEGORY_COLORS[category] || "#d4a843" }))
      .sort((a, b) => b.count - a.count);

    setCountrySats(breakdown);
    setCountrySatNames(nameSet);
    countrySatNamesRef.current = nameSet;

    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: city.lat, lng: city.lng, altitude: 2.0 },
        1500
      );
    }
  }, []);

  // Listen for city clicks from globe HTML elements
  useEffect(() => {
    const handler = (e: Event) => {
      const city = (e as CustomEvent).detail as CityPreset;
      if (city) flyToCity(city);
    };
    window.addEventListener("globe-city-click", handler);
    return () => window.removeEventListener("globe-city-click", handler);
  }, [flyToCity]);

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

      // Fetch TLE data via backend proxy to avoid CORS issues
      let tleData: Record<string, string> = {};
      try {
        const { data, error } = await supabase.functions.invoke("tle-proxy", {
          body: {},
        });
        if (error) throw error;
        tleData = data?.data || {};
      } catch (proxyErr) {
        console.warn("[ORBITAL INTEL] Proxy failed, trying direct fetch:", proxyErr);
        // Fallback: try direct fetch (may work outside iframe)
        const directGroups = ["active", "military", "gnss", "geo", "weather", "stations"];
        const directResults = await Promise.allSettled(
          directGroups.map(async (group) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 9000);
            try {
              const resp = await fetch(
                `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`,
                { signal: controller.signal, cache: "no-store" }
              );
              if (!resp.ok) return { group, text: "" };
              const text = await resp.text();
              return { group, text };
            } catch {
              return { group, text: "" };
            } finally {
              clearTimeout(timeout);
            }
          })
        );
        for (const result of directResults) {
          if (result.status === "fulfilled" && result.value.text) {
            tleData[result.value.group] = result.value.text;
          }
        }
      }

      const allSats: SatelliteData[] = [];
      const rawByKey = new Map<string, RawSatTLE>();
      const seen = new Set<string>();

      for (const [group, text] of Object.entries(tleData)) {
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
        `[ORBITAL INTEL] Loaded ${limited.length} satellites from ${Object.keys(tleData).length} CelesTrak groups`
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

  // Re-propagate positions every 500ms for smooth orbital motion + rAF interpolation
  const prevPositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const nextPositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const lastPropTimeRef = useRef<number>(performance.now());
  const interpFrameRef = useRef<number>(0);

  useEffect(() => {
    if (rawTLERef.current.length === 0) return;

    const propagateAll = () => {
      const raws = rawTLERef.current;
      const catFilter = selectedCat;

      // Move current "next" to "prev" for interpolation
      prevPositionsRef.current = new Map(nextPositionsRef.current);
      lastPropTimeRef.current = performance.now();

      const newNext = new Map<string, { lat: number; lng: number }>();
      const updated: SatelliteData[] = raws.map((r) => {
        const pos = propagateSatellite(
          r.inclination, r.raan, r.meanAnomaly, r.meanMotion,
          r.eccentricity, r.epochYear, r.epochDay, r.alt
        );
        const key = r.noradId || r.name;
        newNext.set(key, { lat: pos.lat, lng: pos.lng });
        return {
          name: r.name, lat: pos.lat, lng: pos.lng, alt: r.alt,
          category: r.category, noradId: r.noradId, inclination: r.inclination,
          meanMotion: r.meanMotion, eccentricity: r.eccentricity, period: r.period,
          epochYear: r.epochYear, epochDay: r.epochDay, launchYear: r.launchYear,
          intlDesignator: r.intlDesignator, velocity: r.velocity, raan: r.raan,
          meanAnomaly: r.meanAnomaly, country: r.country, operator: r.operator, source: r.source,
        };
      });
      nextPositionsRef.current = newNext;
      satsRef.current = updated;
      // Throttle UI update: only every 5th tick (~2.5s)
      if (Math.random() < 0.2) {
        setLastPropagated(new Date());
      }

      // Update orbit path for selected satellite — every 5th tick (~2.5s) for accurate trail
      if (selectedSat && orbitPath) {
        const sel = updated.find(s => s.noradId === selectedSat.noradId || s.name === selectedSat.name);
        if (sel && sel.inclination != null && sel.raan != null && sel.meanAnomaly != null &&
            sel.meanMotion != null && sel.eccentricity != null && sel.epochYear != null && sel.epochDay != null) {
          orbitRefreshCounter.current = (orbitRefreshCounter.current + 1) % 5;
          if (orbitRefreshCounter.current === 0) {
            const newPath = computeOrbitPath(sel.inclination, sel.raan, sel.meanAnomaly, sel.meanMotion, sel.eccentricity, sel.epochYear, sel.epochDay, sel.alt, 180);
            setOrbitPath(newPath);
            setSelectedSat(prev => prev ? { ...prev, lat: sel.lat, lng: sel.lng } : null);
          }
        }
      }

      const globe = globeRef.current;
      if (globe) {
        const filtered = catFilter ? updated.filter((s) => s.category === catFilter) : updated;
        globe.objectsData(filtered.slice(0, catFilter ? 5000 : 3200));
      }
    };

    propagateAll();
    const interval = setInterval(propagateAll, 500);

    // rAF interpolation between propagation ticks for ultra-smooth motion
    const PROP_INTERVAL = 500;
    const interpolate = () => {
      const globe = globeRef.current;
      if (!globe) { interpFrameRef.current = requestAnimationFrame(interpolate); return; }

      const t = Math.min((performance.now() - lastPropTimeRef.current) / PROP_INTERVAL, 1);
      const objectsData = globe.objectsData() as SatelliteData[];
      if (objectsData.length > 0 && prevPositionsRef.current.size > 0 && t < 1) {
        const interpolated = objectsData.map((s: SatelliteData) => {
          const key = s.noradId || s.name;
          const prev = prevPositionsRef.current.get(key);
          const next = nextPositionsRef.current.get(key);
          if (prev && next) {
            // Linear interpolation
            let dLng = next.lng - prev.lng;
            // Handle antimeridian wrap
            if (dLng > 180) dLng -= 360;
            if (dLng < -180) dLng += 360;
            return {
              ...s,
              lat: prev.lat + (next.lat - prev.lat) * t,
              lng: prev.lng + dLng * t,
            };
          }
          return s;
        });
        globe.objectsData(interpolated);
      }
      interpFrameRef.current = requestAnimationFrame(interpolate);
    };
    interpFrameRef.current = requestAnimationFrame(interpolate);

    return () => {
      clearInterval(interval);
      if (interpFrameRef.current) cancelAnimationFrame(interpFrameRef.current);
    };
  }, [satellites.length, selectedCat]);

  // Init globe once, then update data/layers in separate effects (prevents WebGL context churn/black screen)
  useEffect(() => {
    if (!wrapperRef.current) return;

    if (!globeElRef.current) {
      globeElRef.current = document.createElement("div");
      globeElRef.current.style.cssText = "width:100%;height:100%;position:absolute;inset:0;";
      wrapperRef.current.appendChild(globeElRef.current);
    }

    let cancelled = false;

    const initGlobe = async () => {
      try {
        const [mod, THREE] = await Promise.all([import("globe.gl"), import("three")]);
        const Globe = mod.default;
        if (cancelled || !globeElRef.current || globeRef.current) return;

        const el = globeElRef.current;

        // Load military satellite sprite texture once
        const milSatTexture = new THREE.TextureLoader().load(militarySatSprite);

        const createSatMesh = (sat: SatelliteData) => {
          const color = new THREE.Color(CATEGORY_COLORS[sat.category] || "#d4a843");
          const group = new THREE.Group();

          const isMilOrISR = sat.category === "Military" || sat.category === "ISR" || sat.category === "Early Warning" || sat.category === "SIGINT/ELINT";
          const isNav = sat.category === "Navigation";
          const isStation = sat.category === "Space Station";
          const baseSize = isStation ? 6.4 : isMilOrISR ? 5.6 : isNav ? 4.0 : 3.4;

          if (isMilOrISR) {
            // Use sprite image for military/ISR satellites
            const spriteMat = new THREE.SpriteMaterial({
              map: milSatTexture,
              transparent: true,
              opacity: 0.95,
              sizeAttenuation: true,
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(baseSize * 0.8, baseSize * 0.8, 1);
            group.add(sprite);

            // Red glow sphere behind
            const glowGeo = new THREE.SphereGeometry(baseSize * 0.5, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({
              color: 0xff2222,
              transparent: true,
              opacity: 0.15,
              side: THREE.BackSide,
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            group.add(glow);

            // Red halo ring
            const haloGeo = new THREE.RingGeometry(baseSize * 0.35, baseSize * 0.45, 24);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.rotation.x = Math.PI / 2;
            group.add(halo);

            group.rotation.y = Math.random() * Math.PI * 2;
            const spinSpeed = 0.3 + Math.random() * 0.4;
            group.userData = { glow, glowMat, baseScale: 1, time: Math.random() * Math.PI * 2, spinSpeed, isSatGroup: true, satId: sat.noradId || sat.name };
            return group;
          }

          // Non-military satellites: keep original mesh
          const panelW = baseSize * 0.5;
          const panelH = baseSize * 0.15;

          const panelGeo = new THREE.PlaneGeometry(panelW, panelH);
          const panelMat = new THREE.MeshPhongMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            shininess: 120,
          });

          const panel1 = new THREE.Mesh(panelGeo, panelMat);
          group.add(panel1);

          const panel2 = new THREE.Mesh(panelGeo, panelMat.clone());
          panel2.rotation.y = Math.PI / 2;
          group.add(panel2);

          const hubGeo = new THREE.SphereGeometry(baseSize * 0.12, 8, 8);
          const hubMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.95,
            shininess: 100,
          });
          const hub = new THREE.Mesh(hubGeo, hubMat);
          group.add(hub);

          // Outer glow sphere
          const glowGeo = new THREE.SphereGeometry(baseSize * 0.4, 16, 16);
          const glowMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide,
          });
          const glow = new THREE.Mesh(glowGeo, glowMat);
          group.add(glow);

          // Halo ring
          const haloGeo = new THREE.RingGeometry(baseSize * 0.28, baseSize * 0.38, 24);
          const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
          const halo = new THREE.Mesh(haloGeo, haloMat);
          halo.rotation.x = Math.PI / 2;
          group.add(halo);

          group.rotation.y = Math.random() * Math.PI * 2;
          group.rotation.x = Math.random() * 0.3;

          const spinSpeed = 0.3 + Math.random() * 0.4;
          group.userData = { glow, glowMat, baseScale: 1, time: Math.random() * Math.PI * 2, spinSpeed, isSatGroup: true, satId: sat.noradId || sat.name };

          return group;
        };

        // Animate satellite glow pulse + spin
        let lastFrameTime = performance.now();
        const animatePulse = () => {
          const globe = globeRef.current;
          if (!globe) return;
          const scene = globe.scene();
          if (!scene) return;
          const now = performance.now();
          const dt = (now - lastFrameTime) / 1000; // seconds
          lastFrameTime = now;
          const t = now * 0.003;
          const highlightSet = countrySatNamesRef.current;
          scene.traverse((obj: any) => {
            if (obj.userData?.isSatGroup) {
              const phase = t + (obj.userData.time || 0);
              const pulse = 0.85 + Math.sin(phase) * 0.25;
              obj.userData.glow.scale.set(pulse, pulse, pulse);
              obj.userData.glowMat.opacity = 0.1 + Math.sin(phase) * 0.12;
              // Slow spin
              obj.rotation.y += (obj.userData.spinSpeed || 0.3) * dt;
              // Blink effect for country-highlighted satellites
              if (highlightSet.size > 0 && obj.userData.satId && highlightSet.has(obj.userData.satId)) {
                const blink = (Math.sin(t * 4 + (obj.userData.time || 0)) + 1) * 0.5; // 0-1 fast blink
                const scale = 1.0 + blink * 0.5; // pulse between 1x and 1.5x
                obj.scale.set(scale, scale, scale);
                obj.userData.glowMat.opacity = 0.15 + blink * 0.35;
              } else {
                obj.scale.set(1, 1, 1);
              }
            }
          });
          pulseFrameRef.current = requestAnimationFrame(animatePulse);
        };

        const globe = new Globe(el)
          .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
          .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
          .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
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
            if (
              s.inclination != null &&
              s.raan != null &&
              s.meanAnomaly != null &&
              s.meanMotion != null &&
              s.eccentricity != null &&
              s.epochYear != null &&
              s.epochDay != null
            ) {
              const path = computeOrbitPath(
                s.inclination,
                s.raan,
                s.meanAnomaly,
                s.meanMotion,
                s.eccentricity,
                s.epochYear,
                s.epochDay,
                s.alt,
                180
              );
              setOrbitPath(path);
              setOrbitColor(CATEGORY_COLORS[s.category] || "#d4a843");
            }
            // Zoom closer: LEO ~0.6, MEO ~0.9, GEO ~1.2
            const zoomAlt = s.alt < 2000 ? 0.6 : s.alt < 25000 ? 0.9 : 1.2;
            globe.pointOfView({ lat: s.lat, lng: s.lng, altitude: zoomAlt }, 1000);
          })
          .onObjectHover((d: any) => setHoveredSat(d ? (d as SatelliteData) : null))
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
            if (
              s.inclination != null &&
              s.raan != null &&
              s.meanAnomaly != null &&
              s.meanMotion != null &&
              s.eccentricity != null &&
              s.epochYear != null &&
              s.epochDay != null
            ) {
              const path = computeOrbitPath(
                s.inclination,
                s.raan,
                s.meanAnomaly,
                s.meanMotion,
                s.eccentricity,
                s.epochYear,
                s.epochDay,
                s.alt,
                180
              );
              setOrbitPath(path);
              setOrbitColor(CATEGORY_COLORS[s.category] || "#d4a843");
            }
            const zoomAlt2 = s.alt < 2000 ? 0.6 : s.alt < 25000 ? 0.9 : 1.2;
            globe.pointOfView({ lat: s.lat, lng: s.lng, altitude: zoomAlt2 }, 1000);
          })
          .ringsData(OSINT_MARKERS)
          .ringLat((d: any) => d.lat)
          .ringLng((d: any) => d.lng)
          .ringAltitude(0.002)
          .ringMaxRadius((d: any) => (d.type === "conflict" ? 3 : d.type === "naval" ? 2.5 : 1.5))
          .ringPropagationSpeed((d: any) => (d.severity === "critical" ? 4 : d.severity === "high" ? 2.5 : 1.5))
          .ringRepeatPeriod((d: any) => (d.severity === "critical" ? 600 : d.severity === "high" ? 900 : 1200))
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
          .arcColor((d: any) => [d.color + "cc", d.color + "44"])
          .arcAltitudeAutoScale(0.3)
          .arcStroke(0.6)
          .arcDashLength(0.4)
          .arcDashGap(0.15)
          .arcDashAnimateTime(3000)
          .htmlElementsData([
            ...OSINT_MARKERS,
            ...CITY_PRESETS.map(c => ({ lat: c.lat, lng: c.lng, label: c.name, type: "city", severity: "info", info: `${c.landmark} — ${c.country}`, cityData: c })),
          ])
          .htmlLat((d: any) => d.lat)
          .htmlLng((d: any) => d.lng)
          .htmlAltitude(0.005)
          .htmlElement((d: any) => {
            const el = document.createElement("div");

            if (d.type === "city") {
              el.style.cssText =
                "cursor:pointer;font-family:monospace;font-size:8px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 8px rgba(0,0,0,0.9);padding:2px 5px;border-radius:4px;display:flex;align-items:center;gap:3px;transition:all 0.2s;";
              el.style.color = "#00dcff";
              el.style.backgroundColor = "rgba(0,20,40,0.7)";
              el.style.border = "1px solid rgba(0,220,255,0.3)";
              el.innerHTML = `<span style="width:5px;height:5px;border-radius:50%;background:#00dcff;display:inline-block;box-shadow:0 0 6px #00dcff;"></span> ${d.label}`;
              el.addEventListener("mouseenter", () => {
                el.style.backgroundColor = "rgba(0,220,255,0.2)";
                el.style.borderColor = "rgba(0,220,255,0.6)";
                el.style.transform = "scale(1.15)";
              });
              el.addEventListener("mouseleave", () => {
                el.style.backgroundColor = "rgba(0,20,40,0.7)";
                el.style.borderColor = "rgba(0,220,255,0.3)";
                el.style.transform = "scale(1)";
              });
              el.addEventListener("click", () => {
                window.dispatchEvent(new CustomEvent("globe-city-click", { detail: d.cityData }));
              });
              return el;
            }

            el.style.cssText =
              "pointer-events:none;font-family:monospace;font-size:7px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 6px rgba(0,0,0,0.9);padding:1px 3px;border-radius:2px;";
            const colors: Record<string, string> = {
              conflict: "#ef4444",
              military: "#fb923c",
              naval: "#38bdf8",
              radar: "#a855f7",
            };
            const c = colors[d.type] || "#fb923c";
            el.style.color = c;
            el.style.backgroundColor = "rgba(0,0,0,0.5)";
            el.style.borderLeft = `2px solid ${c}`;
            el.innerHTML = `<span style="opacity:0.7">▸</span> ${d.label}`;
            return el;
          })
          // City markers as rings on the globe surface
          .ringsData(CITY_PRESETS.map(c => ({ ...c, maxR: 2, propagationSpeed: 1.5 })))
          .ringLat((d: any) => d.lat)
          .ringLng((d: any) => d.lng)
          .ringAltitude(0.001)
          .ringColor(() => (t: number) => `rgba(0,220,255,${0.6 - t * 0.6})`)
          .ringMaxRadius((d: any) => d.maxR)
          .ringPropagationSpeed((d: any) => d.propagationSpeed)
          .ringRepeatPeriod(2000)
          // Country polygon layer for click-to-zoom
          .polygonsData(getCountryGeoJSON(["IR","IQ","SA","AE","JO","IL","SY","LB","KW","QA","BH","OM","YE","EG","TR"]).features)
          .polygonCapColor(() => "rgba(0,220,255,0.08)")
          .polygonSideColor(() => "rgba(0,220,255,0.15)")
          .polygonStrokeColor(() => "rgba(0,220,255,0.4)")
          .polygonAltitude(0.002)
          .onPolygonClick((polygon: any) => {
            const code = polygon?.properties?.code;
            if (!code) return;
            // Compute center of polygon for zoom
            const coords = polygon.geometry.coordinates[0]; // [[lng,lat],...]
            let sumLat = 0, sumLng = 0;
            coords.forEach(([ln, la]: [number, number]) => { sumLat += la; sumLng += ln; });
            const centerLat = sumLat / coords.length;
            const centerLng = sumLng / coords.length;

            setSelectedCountry(code);
            setSelectedSat(null);
            setOrbitPath(null);

            // Find satellites within bounding box of the country
            const lats = coords.map(([, la]: [number, number]) => la);
            const lngs = coords.map(([ln]: [number, number]) => ln);
            const minLat = Math.min(...lats) - 5;
            const maxLat = Math.max(...lats) + 5;
            const minLng = Math.min(...lngs) - 5;
            const maxLng = Math.max(...lngs) + 5;

            const nearbySats = satsRef.current.filter(s =>
              s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng
            );

            const catMap = new Map<string, number>();
            const nameSet = new Set<string>();
            nearbySats.forEach(s => {
              catMap.set(s.category, (catMap.get(s.category) || 0) + 1);
              nameSet.add(s.noradId || s.name);
            });

            const breakdown = Array.from(catMap.entries())
              .map(([category, count]) => ({ category, count, color: CATEGORY_COLORS[category] || "#d4a843" }))
              .sort((a, b) => b.count - a.count);

            setCountrySats(breakdown);
            setCountrySatNames(nameSet);
            countrySatNamesRef.current = nameSet;
            setActiveCity(code);

            globe.pointOfView({ lat: centerLat, lng: centerLng, altitude: 0.6 }, 1500);
          })
          .onPolygonHover((polygon: any) => {
            const code = polygon?.properties?.code;
            setHoveredCountry(code || null);
            // Highlight hovered polygon
            globe.polygonCapColor((p: any) =>
              p?.properties?.code === code ? "rgba(0,220,255,0.2)" : "rgba(0,220,255,0.08)"
            );
          });

        const scene = globe.scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(5, 3, 5);
        scene.add(dirLight);

        globe.pointOfView({ lat: 30, lng: 44, altitude: 1.05 }, 1500);
        globe.controls().autoRotate = false;
        globe.controls().enableDamping = true;
        globe.controls().dampingFactor = 0.15;

        globeRef.current = globe;
        animatePulse();
        setGlobeInitError(null);
      } catch (error) {
        console.error("[ORBITAL INTEL] Globe initialization failed:", error);
        setGlobeInitError("Unable to initialize 3D globe renderer");
      }
    };

    initGlobe();

    return () => {
      cancelled = true;
      if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current);
    };
  }, []);

  // Update visible satellites without reinitializing Globe
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const filtered = selectedCat
      ? satellites.filter((s) => s.category === selectedCat)
      : satellites;

    globe.objectsData(filtered.slice(0, selectedCat ? 5000 : 3200));

    // Set orbit color to category color when filtering
    if (selectedCat) {
      setOrbitColor(CATEGORY_COLORS[selectedCat] || "#d4a843");
    }
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
          .filter((s) =>
            [
              "Military",
              "ISR",
              "Early Warning",
              "SIGINT/ELINT",
              "Navigation",
              "SAR Imaging",
              "Space Station",
              "Scientific",
            ].includes(s.category)
          )
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

    // Only show orbit trail for the clicked/selected satellite
    if (orbitPath && orbitPath.length > 1 && selectedSat) {
      pushSegmentedPath(orbitPath, "orbit");
    }

    if (predictionTrack && predictionTrack.length > 1) {
      pushSegmentedPath(predictionTrack, "predict");
    }

    if (allSegments.length > 0) {
      const altitude = selectedSat ? Math.min((selectedSat.alt / 6371) * 0.3 + 0.01, 0.7) : 0.055;

      globe
        .pathsData(allSegments)
        .pathPoints("coords")
        .pathPointLat((p: any) => p.lat)
        .pathPointLng((p: any) => p.lng)
        .pathPointAlt(() => altitude)
        .pathColor((seg: any) =>
          seg.type === "predict"
            ? ["#22c55ecc", "#22c55e33"]
            : [orbitColor + "cc", orbitColor + "33"]
        )
        .pathStroke((seg: any) => (seg.type === "predict" ? 2.8 : 2.5))
        .pathDashLength(0.02)
        .pathDashGap(0.01)
        .pathDashAnimateTime((seg: any) => (seg.type === "predict" ? 6000 : 3500))
        .pathTransitionDuration(250);
    } else {
      globe.pathsData([]);
    }
  }, [orbitPath, selectedSat, orbitColor, predictionTrack, selectedCat, satellites.length]);

  // Camera follow: continuously track selected satellite every 500ms
  useEffect(() => {
    if (!selectedSat) return;
    const interval = setInterval(() => {
      const globe = globeRef.current;
      if (!globe) return;
      const key = selectedSat.noradId || selectedSat.name;
      const pos = nextPositionsRef.current.get(key);
      if (pos) {
        const zoomAlt = selectedSat.alt < 2000 ? 0.6 : selectedSat.alt < 25000 ? 0.9 : 1.2;
        globe.pointOfView({ lat: pos.lat, lng: pos.lng, altitude: zoomAlt }, 600);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [selectedSat]);

  // Render AIS vessels on the globe as HTML elements with heading indicators + movement emulation
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const VESSEL_COLORS: Record<string, string> = {
      CARGO: "#3b82f6", TANKER: "#f97316", MILITARY: "#ef4444", FISHING: "#22c55e", UNKNOWN: "#9ca3af",
    };
    const VESSEL_ICONS: Record<string, string> = {
      CARGO: "🚢", TANKER: "⛽", MILITARY: "⚓", FISHING: "🎣", UNKNOWN: "🔹",
    };

    const visibleVessels = aisVessels.data.filter(v => vesselTypeVisible[v.type]);

    // Store positions for interpolation
    const newPositions = new Map<string, { lat: number; lng: number }>();
    visibleVessels.forEach(v => newPositions.set(v.mmsi, { lat: v.lat, lng: v.lng }));

    // Merge vessels with OSINT markers + cities for htmlElementsData
    const osintAndCities = [
      ...OSINT_MARKERS,
      ...CITY_PRESETS.map(c => ({ lat: c.lat, lng: c.lng, label: c.name, type: "city", severity: "info", info: `${c.landmark} — ${c.country}`, cityData: c })),
    ];

    const vesselElements = visibleVessels.map(v => ({
      lat: v.lat,
      lng: v.lng,
      label: v.name,
      type: "vessel",
      vesselType: v.type,
      heading: v.heading,
      speed: v.speed,
      flag: v.flag,
      destination: v.destination,
      mmsi: v.mmsi,
      color: VESSEL_COLORS[v.type] || VESSEL_COLORS.UNKNOWN,
      icon: VESSEL_ICONS[v.type] || VESSEL_ICONS.UNKNOWN,
    }));

    globe.htmlElementsData([...osintAndCities, ...vesselElements]);

    // Re-set the html element factory to handle vessels
    globe.htmlElement((d: any) => {
      const el = document.createElement("div");

      if (d.type === "vessel") {
        const color = d.color;
        const headingRad = (d.heading || 0) * Math.PI / 180;
        el.style.cssText = `
          cursor:pointer;font-family:monospace;font-size:7px;font-weight:700;
          white-space:nowrap;display:flex;align-items:center;gap:2px;
          transition:all 0.3s ease;pointer-events:auto;
        `;
        // Holographic vessel marker
        el.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;gap:3px;">
            <div style="
              width:10px;height:10px;border-radius:50%;
              background:${color};
              box-shadow:0 0 8px ${color}88, 0 0 16px ${color}44, inset 0 0 4px rgba(255,255,255,0.3);
              border:1px solid ${color}cc;
              animation:vesselPulse 2s ease-in-out infinite;
            "></div>
            <div style="
              position:absolute;left:5px;top:5px;
              width:12px;height:2px;
              background:linear-gradient(90deg, ${color}cc, ${color}00);
              transform-origin:0 50%;
              transform:rotate(${d.heading - 90}deg);
              box-shadow:0 0 4px ${color}66;
            "></div>
            <span style="
              color:${color};font-size:7px;font-weight:bold;
              text-shadow:0 0 6px ${color}66, 0 0 2px rgba(0,0,0,0.9);
              padding:1px 3px;border-radius:2px;
              background:rgba(0,0,0,0.6);
              border-left:2px solid ${color}88;
              margin-left:8px;
            ">${d.label || d.mmsi}</span>
            <span style="color:${color}88;font-size:6px;">${d.speed?.toFixed(1) || 0}kn</span>
          </div>
        `;
        el.addEventListener("click", () => {
          const g = globeRef.current;
          if (g) g.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.3 }, 800);
        });
        return el;
      }

      if (d.type === "city") {
        el.style.cssText =
          "cursor:pointer;font-family:monospace;font-size:8px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 8px rgba(0,0,0,0.9);padding:2px 5px;border-radius:4px;display:flex;align-items:center;gap:3px;transition:all 0.2s;";
        el.style.color = "#00dcff";
        el.style.backgroundColor = "rgba(0,20,40,0.7)";
        el.style.border = "1px solid rgba(0,220,255,0.3)";
        el.innerHTML = `<span style="width:5px;height:5px;border-radius:50%;background:#00dcff;display:inline-block;box-shadow:0 0 6px #00dcff;"></span> ${d.label}`;
        el.addEventListener("mouseenter", () => {
          el.style.backgroundColor = "rgba(0,220,255,0.2)";
          el.style.borderColor = "rgba(0,220,255,0.6)";
          el.style.transform = "scale(1.15)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.backgroundColor = "rgba(0,20,40,0.7)";
          el.style.borderColor = "rgba(0,220,255,0.3)";
          el.style.transform = "scale(1)";
        });
        el.addEventListener("click", () => {
          window.dispatchEvent(new CustomEvent("globe-city-click", { detail: d.cityData }));
        });
        return el;
      }

      // OSINT markers
      el.style.cssText =
        "pointer-events:none;font-family:monospace;font-size:7px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 6px rgba(0,0,0,0.9);padding:1px 3px;border-radius:2px;";
      const colors: Record<string, string> = {
        conflict: "#ef4444", military: "#fb923c", naval: "#38bdf8", radar: "#a855f7",
      };
      const c = colors[d.type] || "#fb923c";
      el.style.color = c;
      el.style.backgroundColor = "rgba(0,0,0,0.5)";
      el.style.borderLeft = `2px solid ${c}`;
      el.innerHTML = `<span style="opacity:0.7">▸</span> ${d.label}`;
      return el;
    });

    prevVesselPosRef.current = newPositions;
  }, [aisVessels.data, vesselTypeVisible]);

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

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-[#050a12] flex flex-col overflow-hidden">

      {/* Gotham scanline overlay */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(190 100% 50% / 0.012) 3px, hsl(190 100% 50% / 0.012) 4px)",
          mixBlendMode: "screen",
        }}
      />
      {/* Gotham sweep beam */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none"
        style={{
          background: "linear-gradient(180deg, transparent 0%, transparent 46%, hsl(190 100% 50% / 0.04) 50%, transparent 54%, transparent 100%)",
          animation: "holoSweep 10s linear infinite",
        }}
      />
      {/* Corner brackets — Gotham frame */}
      <div className="absolute inset-0 z-[2001] pointer-events-none">
        {[
          { pos: "top-2 left-2", d: "M1 14V1H14" },
          { pos: "top-2 right-2", d: "M23 14V1H10" },
          { pos: "bottom-2 left-2", d: "M1 10V23H14" },
          { pos: "bottom-2 right-2", d: "M23 10V23H10" },
        ].map(({ pos, d }) => (
          <div key={pos} className={`absolute ${pos}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d={d} stroke="hsl(var(--primary))" strokeWidth="0.75" strokeOpacity="0.2" />
            </svg>
          </div>
        ))}
      </div>
      {/* Vignette */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none"
        style={{
          boxShadow: "inset 0 0 120px 40px hsl(220 30% 4% / 0.5)",
        }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 z-[2001] pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: "linear-gradient(hsl(190 60% 50% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(190 60% 50% / 0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top-left HUD — Gotham */}
      <div className="absolute top-3 left-3 z-[2002] pointer-events-none space-y-1">
        <div className="font-mono text-[11px] font-bold tracking-[0.2em] text-primary">
          ◈ ORBITAL INTELLIGENCE
        </div>
        <div className="text-[8px] font-mono tracking-wider text-primary/50">
          REAL-TIME SATELLITE TRACKING • OSINT FUSION
        </div>
        <div className="mt-2 space-y-0.5 text-[8px] font-mono text-primary/55">
          <div className="text-destructive/70">⬤ TOP SECRET // SI-TK // NOFORN</div>
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
          <div className="text-muted-foreground/45">
            ▸ LAST PROPAGATION: {lastPropagated.toISOString().replace('T', ' ').slice(0, 19)}Z
          </div>
        </div>
        {/* OSINT Legend */}
        <div className="mt-2 pt-2 space-y-1 border-t border-primary/10">
          <div className="text-[7px] font-mono uppercase tracking-widest text-primary/40">OSINT LAYER</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-[7px] font-mono flex items-center gap-1 text-destructive"><span className="w-1.5 h-1.5 rounded-full bg-destructive" /> CONFLICT</span>
            <span className="text-[7px] font-mono flex items-center gap-1" style={{ color: "#fb923c" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#fb923c" }} /> MILITARY</span>
            <span className="text-[7px] font-mono flex items-center gap-1 text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> NAVAL</span>
            <span className="text-[7px] font-mono flex items-center gap-1" style={{ color: "#a855f7" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#a855f7" }} /> RADAR</span>
          </div>
        </div>
      </div>

      {/* Top-right timestamp — Gotham */}
      <div className="absolute top-3 right-3 z-[2002] pointer-events-none text-right space-y-0.5">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-[9px] font-mono text-destructive">
            {timestamp}
          </span>
        </div>
        <div className="text-[8px] font-mono text-primary/40">
          CELESTRAK NORAD TLE • LIVE OSINT
        </div>
      </div>

      {/* UNIFIED BOTTOM BAR */}
      <div className="absolute bottom-3 left-3 right-3 z-[2002] pointer-events-auto space-y-1.5">
        {/* Row 1: SAT TYPES + Style Presets + Nav Controls */}
        <div className="flex items-end gap-2">
          {/* SAT TYPES — collapsible */}
          <div className="relative" style={{ width: 150 }}>
            <button
              onClick={() => setSatTypesExpanded(!satTypesExpanded)}
              className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 gotham-orbital-btn ${satTypesExpanded ? 'gotham-orbital-btn-active' : ''}`}
            >
              <Satellite className="h-3 w-3 text-primary" />
              <span className="flex-1 text-left">SAT Types</span>
              <span className="gotham-orbital-badge">{satellites.length}</span>
              {satTypesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
            {satTypesExpanded && (
              <div className="absolute bottom-full mb-1 left-0 w-[160px] max-h-[50vh] overflow-y-auto gotham-orbital-dropdown px-2 py-2 space-y-0.5">
                <button
                  onClick={() => setSelectedCat(null)}
                  className={`gotham-orbital-dropdown-item ${!selectedCat ? 'gotham-orbital-dropdown-item-active' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full bg-foreground flex-shrink-0" />
                  <span className="truncate flex-1">ALL</span>
                  <span className="text-[8px] opacity-70">{satellites.length}</span>
                </button>
                {categories.map(([cat, color]) => {
                  const count = satellites.filter((s) => s.category === cat).length;
                  const isDisabled = count === 0;
                  return (
                    <button
                      key={cat}
                      disabled={isDisabled}
                      onClick={() => !isDisabled && setSelectedCat(selectedCat === cat ? null : cat)}
                      className={`gotham-orbital-dropdown-item ${
                        selectedCat === cat ? 'gotham-orbital-dropdown-item-active' : ''
                      } ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate flex-1">{cat}</span>
                      <span className="text-[8px] opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* FLIGHTS — collapsible, same style as SAT Types */}
          {flights.length > 0 && onTrackFlight && (
            <div className="relative" style={{ width: 150 }}>
              <button
                onClick={() => setFlightsPanelExpanded(!flightsPanelExpanded)}
                className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 gotham-orbital-btn ${flightsPanelExpanded ? 'gotham-orbital-btn-active' : ''}`}
              >
                <Plane className="h-3 w-3 text-primary" />
                <span className="flex-1 text-left">Flights</span>
                <span className="gotham-orbital-badge">{flights.length}</span>
                {flightsPanelExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              </button>
              {flightsPanelExpanded && (
                <div className="absolute bottom-full mb-1 left-0 w-[220px] max-h-[60vh] overflow-hidden gotham-orbital-dropdown">
                  <FlightEmulationPanel
                    flights={flights}
                    trackedFlightId={trackedFlightId ?? null}
                    onTrackFlight={onTrackFlight}
                    flightSource={flightSource}
                  />
                </div>
              )}
            </div>
          )}

          {/* VESSELS — collapsible, same style as Flights */}
          <div className="relative" style={{ width: 150 }}>
            <button
              onClick={() => setVesselsPanelExpanded(!vesselsPanelExpanded)}
              className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 gotham-orbital-btn ${vesselsPanelExpanded ? 'gotham-orbital-btn-active' : ''}`}
            >
              <Anchor className="h-3 w-3 text-primary" />
              <span className="flex-1 text-left">Vessels</span>
              <span className="gotham-orbital-badge">{aisVessels.data.length}</span>
              {vesselsPanelExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
            {vesselsPanelExpanded && (
              <div className="absolute bottom-full mb-1 left-0 w-[240px] max-h-[60vh] overflow-hidden gotham-orbital-dropdown">
                <div className="w-full pointer-events-auto">
                  {/* Vessel type checkboxes */}
                  <div className="px-3 py-2 space-y-1 border-b border-white/10">
                    <div className="text-[7px] font-mono text-primary/40 uppercase tracking-widest mb-1">Globe Visibility</div>
                    {(["CARGO", "TANKER", "MILITARY", "FISHING", "UNKNOWN"] as const).map(t => {
                      const typeColors: Record<string, string> = { CARGO: "#3b82f6", TANKER: "#f97316", MILITARY: "#ef4444", FISHING: "#22c55e", UNKNOWN: "#9ca3af" };
                      const count = aisVessels.data.filter(v => v.type === t).length;
                      return (
                        <label key={t} className="flex items-center gap-2 cursor-pointer group">
                          <div
                            onClick={() => setVesselTypeVisible(prev => ({ ...prev, [t]: !prev[t] }))}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                              vesselTypeVisible[t]
                                ? "border-white/50"
                                : "border-white/20 bg-transparent"
                            }`}
                            style={vesselTypeVisible[t] ? { backgroundColor: typeColors[t], borderColor: typeColors[t] } : {}}
                          >
                            {vesselTypeVisible[t] && <span className="text-[8px] text-white font-bold">✓</span>}
                          </div>
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: typeColors[t], boxShadow: `0 0 6px ${typeColors[t]}66` }}
                          />
                          <span className="text-[9px] font-mono text-white/80 font-semibold flex-1">{t}</span>
                          <span className="text-[8px] font-mono text-white/40 tabular-nums">{count}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Filter chips for list */}
                  <div className="px-3 py-1 flex items-center gap-1 flex-wrap">
                    {["ALL", "CARGO", "TANKER", "MILITARY", "FISHING"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setVesselFilter(f)}
                        className={`gotham-orbital-btn text-[8px] h-5 px-2 ${
                          vesselFilter === f ? 'gotham-orbital-btn-active' : ''
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Vessel list */}
                  <ScrollArea className="h-48 border-t border-white/10">
                    <div className="divide-y divide-white/5">
                      {(() => {
                        const filtered = vesselFilter === "ALL" ? aisVessels.data : aisVessels.data.filter(v => v.type === vesselFilter);
                        const sorted = [...filtered].sort((a, b) => b.speed - a.speed).slice(0, 50);
                        if (sorted.length === 0) return (
                          <div className="px-3 py-4 text-center">
                            <span className="text-[9px] font-mono text-white/40">
                              {aisVessels.loading ? "Loading vessels…" : "No vessels in range"}
                            </span>
                          </div>
                        );
                        return sorted.map((v) => {
                          const typeColor: Record<string, string> = { CARGO: "bg-blue-400", TANKER: "bg-orange-400", FISHING: "bg-green-400", MILITARY: "bg-red-500", UNKNOWN: "bg-gray-400" };
                          return (
                            <button
                              key={v.mmsi}
                              onClick={() => {
                                const globe = globeRef.current;
                                if (globe) globe.pointOfView({ lat: v.lat, lng: v.lng, altitude: 0.3 }, 800);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-white/5 transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeColor[v.type] || "bg-gray-400"}`}
                                  style={{ boxShadow: `0 0 4px ${typeColor[v.type]?.replace('bg-', '') || ''}` }}
                                />
                                <span className="text-[9px] font-mono font-bold text-white/80 truncate flex-1">
                                  {v.name}
                                </span>
                                {v.flag && (
                                  <span className="text-[7px] font-mono text-white/30">{v.flag}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 pl-3.5">
                                <span className="text-[8px] font-mono text-white/40 tabular-nums">
                                  {v.speed.toFixed(1)}kn
                                </span>
                                <span className="text-[8px] font-mono text-white/40 tabular-nums">
                                  HDG {Math.round(v.heading)}°
                                </span>
                                <span className="text-[7px] font-mono text-white/25 truncate">
                                  {v.destination || v.type}
                                </span>
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </ScrollArea>

                  {/* Source indicator */}
                  {aisVessels.source && (
                    <div className="px-3 py-1 border-t border-white/10 flex items-center gap-1">
                      <Radio className="h-2.5 w-2.5 text-green-500 animate-pulse" />
                      <span className="text-[8px] font-mono text-white/30 uppercase">LIVE AIS • {aisVessels.source}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>


          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1 gotham-orbital-panel px-2 py-1.5">
              {GLOBE_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => applyGlobeStyle(style.id)}
                  className={`flex flex-col items-center gap-0.5 px-2.5 py-1 transition-all ${
                    globeStyle === style.id
                      ? "bg-primary/15 border border-primary/40"
                      : "hover:bg-primary/5 border border-transparent"
                  }`}
                  title={style.desc}
                >
                  <span className="text-sm">{style.icon}</span>
                  <span className={`text-[8px] font-mono tracking-wide ${
                    globeStyle === style.id ? "text-primary font-bold" : "text-muted-foreground"
                  }`}>{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nav & Zoom controls — right */}
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5 gotham-orbital-panel p-1">
              <button
                onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, altitude: Math.max(pov.altitude * 0.75, 0.3) }, 400); }}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, altitude: Math.min(pov.altitude * 1.35, 6) }, 400); }}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="gotham-orbital-panel p-1">
              <div className="grid grid-cols-3 gap-0.5">
                <button onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, lng: pov.lng - 15 }, 400); }} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Rotate Left"><RotateCcw className="h-3 w-3" /></button>
                <button onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, lat: Math.min(pov.lat + 15, 85) }, 400); }} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Move Up"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, lng: pov.lng + 15 }, 400); }} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Rotate Right"><RotateCw className="h-3 w-3" /></button>
                <button onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, lng: pov.lng - 30 }, 400); }} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Pan Left"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <button onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, lat: Math.max(pov.lat - 15, -85) }, 400); }} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Move Down"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => { const g = globeRef.current; if (!g) return; const pov = g.pointOfView(); g.pointOfView({ ...pov, lng: pov.lng + 30 }, 400); }} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Pan Right"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: City presets */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1 gotham-orbital-panel px-2 py-1 overflow-x-auto scrollbar-hide max-w-[90vw]" style={{ scrollbarWidth: "none" }}>
            {CITY_PRESETS.map((city) => {
              const badge = countryBadges[city.name];
              const overhead = badge?.total || 0;
              return (
                <button
                  key={city.name}
                  onClick={() => flyToCity(city)}
                  className={`relative flex-shrink-0 px-2 py-1 text-[9px] font-mono font-semibold tracking-wide transition-all whitespace-nowrap ${
                    activeCity === city.name
                      ? "bg-primary/15 text-primary border border-primary/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-primary/5 border border-transparent"
                  }`}
                  title={`${city.landmark} — ${city.country}`}
                >
                  {city.name}
                  {overhead > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[7px] font-bold leading-none px-0.5 animate-pulse">
                      {overhead}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right sidebar controls */}
      <div className="absolute top-20 right-3 z-[2002] space-y-1.5 pointer-events-auto w-28">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`w-full gotham-orbital-btn ${showLabels ? 'gotham-orbital-btn-active' : ''}`}
        >
          {showLabels ? <Tag className="h-2.5 w-2.5" /> : <Tags className="h-2.5 w-2.5" />} Labels
        </button>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`w-full gotham-orbital-btn ${showSearch ? 'gotham-orbital-btn-active' : ''}`}
        >
          <Search className="h-2.5 w-2.5" /> Search
        </button>
        <button
          onClick={fetchSatellites}
          className="w-full gotham-orbital-btn"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        <button
          onClick={onClose}
          className="w-full gotham-orbital-btn border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <X className="h-2.5 w-2.5" /> Close
        </button>

        {/* Country satellite type breakdown */}
        {activeCity && countrySats.length > 0 && (
          <div className="gotham-orbital-panel px-2 py-2 w-full">
            <div className="text-[7px] font-mono uppercase tracking-widest text-center mb-1.5 text-primary/50">
              {activeCity} SATELLITES
            </div>
            <div className="text-[8px] font-mono text-muted-foreground text-center mb-1.5">
              {countrySats.reduce((s, c) => s + c.count, 0)} objects overhead
            </div>
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto scrollbar-none">
              {countrySats.map(({ category, count, color }) => (
                <button
                  key={category}
                  onClick={() => setSelectedCat(selectedCat === category ? null : category)}
                  className={`gotham-orbital-dropdown-item ${
                    selectedCat === category ? 'gotham-orbital-dropdown-item-active' : ''
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: color }} />
                  <span className="truncate text-left flex-1">{category}</span>
                  <span className="text-[7px] opacity-70">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[2003] w-80 pointer-events-auto">
          <div className="gotham-orbital-panel p-2 space-y-1.5"
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
            className="absolute top-20 left-36 z-[2003] w-64 border backdrop-blur-md pointer-events-auto animate-fade-in gotham-orbital-panel"
            style={{
              borderColor: CATEGORY_COLORS[selectedSat.category] + "40",
              boxShadow: `0 0 25px ${CATEGORY_COLORS[selectedSat.category]}18`,
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
                  className="flex-1 gotham-orbital-btn justify-center"
                >
                  {predicting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
                  {predicting ? "PREDICTING..." : "AI PREDICT"}
                </button>
                <button
                  onClick={() => openAiChat(selectedSat)}
                  className="gotham-orbital-btn justify-center"
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
            className="absolute top-20 left-[340px] z-[2004] w-80 border backdrop-blur-md pointer-events-auto animate-fade-in gotham-orbital-panel"
            style={{ borderColor: "#22c55e40", boxShadow: "0 0 25px #22c55e15" }}
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
          className="fixed z-[2010] pointer-events-none"
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 260),
            top: Math.max(hoverPos.y - 40, 10),
          }}
        >
          <div className="gotham-orbital-panel px-3 py-2 min-w-[200px]">
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
            <div className="text-[7px] font-mono text-white/40 mt-1.5 pt-1 border-t border-white/10">
              CLICK TO VIEW DETAILS & AI ANALYSIS
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Panel */}
      {aiChatSat && (
        <div className="absolute top-16 right-36 z-[2005] w-80 pointer-events-auto animate-fade-in">
          <div
            className="gotham-orbital-panel flex flex-col"
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



      {/* City Landmark Tooltip */}
      {selectedCity && (
        <div className="absolute top-16 right-3 z-[2003] pointer-events-auto w-[280px]">
          <div className="bg-black/85 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden shadow-2xl">
            {/* Landmark Image */}
            <div className="relative h-[140px] overflow-hidden">
              <img
                src={selectedCity.image}
                alt={selectedCity.landmark}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <div className="text-white text-sm font-bold leading-tight">{selectedCity.landmark}</div>
                <div className="text-white/60 text-[10px] font-mono">{selectedCity.name}, {selectedCity.country}</div>
              </div>
              <button
                onClick={() => setSelectedCity(null)}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white/70 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Info */}
            <div className="p-3 space-y-2">
              <p className="text-[10px] font-mono text-white/70 leading-relaxed">{selectedCity.description}</p>
              <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                {selectedCity.population && (
                  <div className="flex flex-col">
                    <span className="text-[7px] font-mono text-white/30 uppercase tracking-widest">Pop.</span>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{selectedCity.population}</span>
                  </div>
                )}
                {selectedCity.timezone && (
                  <div className="flex flex-col">
                    <span className="text-[7px] font-mono text-white/30 uppercase tracking-widest">Time</span>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{selectedCity.timezone}</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[7px] font-mono text-white/30 uppercase tracking-widest">Coords</span>
                  <span className="text-[10px] font-mono text-white/60">{selectedCity.lat.toFixed(2)}°, {selectedCity.lng.toFixed(2)}°</span>
                </div>
              </div>
              {/* Satellite count for this city */}
              {countryBadges[selectedCity.name] && (
                <div className="pt-1 border-t border-white/10">
                  <div className="text-[8px] font-mono text-white/40 uppercase tracking-widest mb-1">
                    {countryBadges[selectedCity.name].total} Satellites Overhead
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {countryBadges[selectedCity.name].breakdown.slice(0, 6).map(({ category, count, color }) => (
                      <span key={category} className="inline-flex items-center gap-1 text-[8px] font-mono text-white/70 bg-white/5 rounded px-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        {category}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>,
    document.body
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
