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

interface FourDMapProps { onClose: () => void; rockets?: RocketType[]; }
interface LayerConfig { id: string; label: string; icon: React.ReactNode; color: string; count?: number; }

function propagateSatellite(inclination: number, raan: number, meanAnomaly: number, meanMotion: number, eccentricity: number, epochYear: number, epochDay: number): { lat: number; lng: number } {
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

// Propagate at a specific mean anomaly (for orbit track visualization)
function propagateSatelliteAtMA(inclination: number, raan: number, meanAnomaly: number, meanMotion: number, eccentricity: number, epochYear: number, epochDay: number): { lat: number; lng: number } {
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

interface SatPoint { name: string; lat: number; lng: number; alt: number; category: string; inclination: number; raan: number; meanAnomaly: number; meanMotion: number; eccentricity: number; epochYear: number; epochDay: number; }

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

// TLE groups to fetch via the proxy
const TLE_GROUPS = ["active", "military", "resource", "weather", "gnss", "geo", "science", "stations", "last-30-days"];

const ALL_COUNTRY_CODES = ["IR", "IQ", "SY", "IL", "JO", "LB", "SA", "AE", "BH", "KW", "QA", "OM", "YE", "EG", "TR"];

const SEARCH_LOCATIONS = [
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
  { name: "Sanaa", lat: 15.35, lng: 44.21, type: "city" },
  { name: "Aden", lat: 12.79, lng: 45.04, type: "city" },
  { name: "Isfahan", lat: 32.65, lng: 51.68, type: "city" },
  { name: "Natanz", lat: 33.51, lng: 51.92, type: "facility" },
  { name: "Fordow", lat: 34.88, lng: 51.23, type: "facility" },
  { name: "Bushehr NPP", lat: 28.83, lng: 50.89, type: "facility" },
  { name: "Dimona", lat: 31.00, lng: 35.15, type: "facility" },
  { name: "Incirlik Air Base", lat: 37.00, lng: 35.43, type: "military" },
  { name: "Al Udeid Air Base", lat: 25.12, lng: 51.31, type: "military" },
  { name: "Strait of Hormuz", lat: 26.57, lng: 56.25, type: "chokepoint" },
  { name: "Suez Canal", lat: 30.46, lng: 32.35, type: "chokepoint" },
  { name: "Bab el-Mandeb", lat: 12.58, lng: 43.33, type: "chokepoint" },
  { name: "Gaza", lat: 31.50, lng: 34.47, type: "conflict" },
  { name: "Golan Heights", lat: 33.00, lng: 35.80, type: "conflict" },
  { name: "Mosul", lat: 36.34, lng: 43.13, type: "city" },
  { name: "Aleppo", lat: 36.20, lng: 37.15, type: "city" },
  { name: "Basra", lat: 30.51, lng: 47.81, type: "city" },
];

const KEY_ISR_SATS = ["WORLDVIEW", "WV-LEGION", "GAOFEN", "BARS-M", "COSMOS 2", "LACROSSE", "USA 224", "USA 245", "USA 314", "SENTINEL-2", "LANDSAT 9", "NROL"];

// ============= EMULATED FALLBACK DATA =============
// Rich emulated data ensures the globe always looks populated even when APIs haven't responded

const EMULATED_SATELLITES: SatPoint[] = [
  // ISR / Earth Observation — key intelligence assets
  { name: "WORLDVIEW-3", lat: 28.5, lng: 47.2, alt: 617, category: "Earth Observation", inclination: 97.9, raan: 200, meanAnomaly: 45, meanMotion: 15.2, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "WV-LEGION-2", lat: 33.1, lng: 38.5, alt: 524, category: "Earth Observation", inclination: 97.4, raan: 185, meanAnomaly: 120, meanMotion: 15.3, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "WORLDVIEW-2", lat: 36.0, lng: 52.0, alt: 770, category: "Earth Observation", inclination: 97.2, raan: 190, meanAnomaly: 88, meanMotion: 14.9, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "GAOFEN-7", lat: 25.3, lng: 55.1, alt: 505, category: "Earth Observation", inclination: 98.0, raan: 210, meanAnomaly: 200, meanMotion: 15.2, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "SENTINEL-2A", lat: 31.0, lng: 35.0, alt: 786, category: "Earth Observation", inclination: 98.6, raan: 205, meanAnomaly: 60, meanMotion: 14.9, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "LANDSAT 9", lat: 27.0, lng: 48.0, alt: 705, category: "Earth Observation", inclination: 98.2, raan: 195, meanAnomaly: 30, meanMotion: 14.95, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "PLEIADES NEO 4", lat: 38.2, lng: 42.0, alt: 620, category: "Earth Observation", inclination: 97.9, raan: 215, meanAnomaly: 140, meanMotion: 15.15, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  // Military / Intelligence
  { name: "BARS-M No.1", lat: 40.2, lng: 44.5, alt: 555, category: "Military", inclination: 97.6, raan: 175, meanAnomaly: 310, meanMotion: 15.1, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "USA 314 (KH-11)", lat: 30.0, lng: 50.0, alt: 260, category: "Military", inclination: 97.9, raan: 220, meanAnomaly: 150, meanMotion: 15.6, eccentricity: 0.002, epochYear: 2024, epochDay: 200 },
  { name: "COSMOS 2558", lat: 42.0, lng: 36.0, alt: 430, category: "Military", inclination: 97.3, raan: 160, meanAnomaly: 270, meanMotion: 15.3, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "NROL-82", lat: 35.5, lng: 42.0, alt: 310, category: "Military", inclination: 63.4, raan: 140, meanAnomaly: 90, meanMotion: 15.5, eccentricity: 0.002, epochYear: 2024, epochDay: 200 },
  { name: "LACROSSE 5", lat: 44.0, lng: 55.0, alt: 710, category: "Military", inclination: 68.0, raan: 130, meanAnomaly: 220, meanMotion: 14.85, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "USA 245 (TOPAZ)", lat: 22.0, lng: 58.0, alt: 360, category: "Military", inclination: 63.4, raan: 155, meanAnomaly: 180, meanMotion: 15.4, eccentricity: 0.002, epochYear: 2024, epochDay: 200 },
  // Early Warning
  { name: "SBIRS GEO-5", lat: 0.1, lng: 42.0, alt: 35786, category: "Early Warning", inclination: 0.1, raan: 0, meanAnomaly: 180, meanMotion: 1.0, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  { name: "SBIRS GEO-4", lat: 0.0, lng: 63.0, alt: 35786, category: "Early Warning", inclination: 0.05, raan: 0, meanAnomaly: 90, meanMotion: 1.0, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  { name: "DSP F-23", lat: 0.2, lng: 25.0, alt: 35786, category: "Early Warning", inclination: 0.1, raan: 10, meanAnomaly: 270, meanMotion: 1.0, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  // Navigation
  { name: "GPS IIF-12", lat: 55.0, lng: 30.0, alt: 20200, category: "Navigation", inclination: 55.0, raan: 100, meanAnomaly: 0, meanMotion: 2.0, eccentricity: 0.01, epochYear: 2024, epochDay: 200 },
  { name: "GLONASS-M 58", lat: 64.8, lng: 48.0, alt: 19130, category: "Navigation", inclination: 64.8, raan: 80, meanAnomaly: 120, meanMotion: 2.13, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "GALILEO 26", lat: 56.0, lng: 35.0, alt: 23222, category: "Navigation", inclination: 56.0, raan: 120, meanAnomaly: 60, meanMotion: 1.7, eccentricity: 0.0002, epochYear: 2024, epochDay: 200 },
  // Weather
  { name: "METEOSAT-12", lat: 0.0, lng: 41.5, alt: 35786, category: "Weather", inclination: 0.1, raan: 0, meanAnomaly: 90, meanMotion: 1.0, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  { name: "NOAA-20", lat: 50.0, lng: 60.0, alt: 824, category: "Weather", inclination: 98.7, raan: 230, meanAnomaly: 300, meanMotion: 14.2, eccentricity: 0.001, epochYear: 2024, epochDay: 200 },
  { name: "FENGYUN 4A", lat: 0.1, lng: 105.0, alt: 35786, category: "Weather", inclination: 0.05, raan: 0, meanAnomaly: 45, meanMotion: 1.0, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  // Comms / Starlink
  { name: "STARLINK-5001", lat: 22.0, lng: 40.0, alt: 550, category: "Starlink", inclination: 53.0, raan: 260, meanAnomaly: 100, meanMotion: 15.2, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  { name: "STARLINK-5233", lat: 38.0, lng: 55.0, alt: 550, category: "Starlink", inclination: 53.0, raan: 300, meanAnomaly: 200, meanMotion: 15.2, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  { name: "STARLINK-6100", lat: 15.0, lng: 32.0, alt: 550, category: "Starlink", inclination: 53.0, raan: 340, meanAnomaly: 50, meanMotion: 15.2, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  // Space Station
  { name: "ISS (ZARYA)", lat: 34.0, lng: 40.0, alt: 420, category: "Space Station", inclination: 51.6, raan: 250, meanAnomaly: 330, meanMotion: 15.5, eccentricity: 0.0005, epochYear: 2024, epochDay: 200 },
  { name: "TIANGONG", lat: 41.3, lng: 115.0, alt: 390, category: "Space Station", inclination: 41.5, raan: 200, meanAnomaly: 160, meanMotion: 15.6, eccentricity: 0.0003, epochYear: 2024, epochDay: 200 },
  // Communication
  { name: "INTELSAT 39", lat: 0.1, lng: 62.0, alt: 35786, category: "Communication", inclination: 0.05, raan: 0, meanAnomaly: 135, meanMotion: 1.0, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
  { name: "ARABSAT 6A", lat: 0.0, lng: 30.5, alt: 35786, category: "Communication", inclination: 0.05, raan: 5, meanAnomaly: 200, meanMotion: 1.0, eccentricity: 0.0001, epochYear: 2024, epochDay: 200 },
];

const EMULATED_FLIGHTS = [
  // Commercial airliners
  { callsign: "UAE321", lat: 25.25, lng: 55.36, velocity: 250, baro_altitude: 11000, origin_country: "UAE", military: false, type: "A380", airline: "Emirates", heading: 315, route: "DXB→LHR" },
  { callsign: "QTR804", lat: 25.27, lng: 51.61, velocity: 240, baro_altitude: 10500, origin_country: "Qatar", military: false, type: "B777", airline: "Qatar Airways", heading: 290, route: "DOH→CDG" },
  { callsign: "MEA322", lat: 33.82, lng: 35.49, velocity: 220, baro_altitude: 8500, origin_country: "Lebanon", military: false, type: "A321", airline: "MEA", heading: 180, route: "BEY→CAI" },
  { callsign: "THY761", lat: 40.98, lng: 29.00, velocity: 260, baro_altitude: 12000, origin_country: "Turkey", military: false, type: "B738", airline: "Turkish Airlines", heading: 120, route: "IST→DXB" },
  { callsign: "SVA114", lat: 24.75, lng: 46.70, velocity: 230, baro_altitude: 9800, origin_country: "Saudi Arabia", military: false, type: "B789", airline: "Saudia", heading: 340, route: "RUH→LHR" },
  { callsign: "IRA423", lat: 35.68, lng: 51.31, velocity: 210, baro_altitude: 7000, origin_country: "Iran", military: false, type: "A310", airline: "Iran Air", heading: 245, route: "IKA→IST" },
  { callsign: "MSR201", lat: 30.10, lng: 31.30, velocity: 240, baro_altitude: 10000, origin_country: "Egypt", military: false, type: "B738", airline: "EgyptAir", heading: 45, route: "CAI→AMM" },
  { callsign: "GFA231", lat: 26.10, lng: 50.60, velocity: 220, baro_altitude: 8800, origin_country: "Bahrain", military: false, type: "A320", airline: "Gulf Air", heading: 200, route: "BAH→MCT" },
  { callsign: "KAC155", lat: 29.20, lng: 47.95, velocity: 235, baro_altitude: 9500, origin_country: "Kuwait", military: false, type: "B777", airline: "Kuwait Airways", heading: 310, route: "KWI→LHR" },
  { callsign: "ETD403", lat: 24.45, lng: 54.65, velocity: 250, baro_altitude: 11500, origin_country: "UAE", military: false, type: "A350", airline: "Etihad", heading: 330, route: "AUH→JFK" },
  // Military — C-17, F-15, P-8, tanker, drone
  { callsign: "RCH871", lat: 25.05, lng: 51.28, velocity: 280, baro_altitude: 13000, origin_country: "USA", military: true, type: "C-17", airline: "USAF", heading: 270, route: "Al Udeid→Ramstein" },
  { callsign: "DUKE41", lat: 32.10, lng: 34.85, velocity: 190, baro_altitude: 6500, origin_country: "Israel", military: true, type: "F-15I", airline: "IAF", heading: 30, route: "CAP Patrol" },
  { callsign: "REAC22", lat: 37.05, lng: 35.50, velocity: 300, baro_altitude: 14000, origin_country: "USA", military: true, type: "KC-135", airline: "USAF", heading: 90, route: "Tanker Track" },
  { callsign: "NAVY6", lat: 26.50, lng: 56.10, velocity: 170, baro_altitude: 3000, origin_country: "USA", military: true, type: "P-8A", airline: "USN", heading: 180, route: "ASW Patrol — Hormuz" },
  { callsign: "FORTE12", lat: 34.00, lng: 40.00, velocity: 320, baro_altitude: 18000, origin_country: "USA", military: true, type: "RQ-4", airline: "USAF", heading: 60, route: "ISR — Syria" },
  { callsign: "VADER01", lat: 33.50, lng: 43.00, velocity: 150, baro_altitude: 5000, origin_country: "USA", military: true, type: "MQ-9", airline: "USAF", heading: 145, route: "ISR — Iraq" },
  { callsign: "IAM3101", lat: 41.80, lng: 12.50, velocity: 260, baro_altitude: 12000, origin_country: "Italy", military: true, type: "KC-767", airline: "AMI", heading: 100, route: "Tanker Orbit" },
];

const EMULATED_VESSELS = [
  { name: "USNS SUPPLY", lat: 26.4, lng: 56.1, type: "MILITARY", flag: "US", speed: 15, heading: 270, destination: "Bahrain" },
  { name: "USS EISENHOWER", lat: 25.8, lng: 57.2, type: "MILITARY", flag: "US", speed: 18, heading: 250, destination: "Persian Gulf" },
  { name: "IRGCN FAST-1", lat: 26.8, lng: 55.8, type: "MILITARY", flag: "IR", speed: 35, heading: 180, destination: "Patrol" },
  { name: "STENA IMPERO II", lat: 26.3, lng: 56.5, type: "TANKER", flag: "UK", speed: 12, heading: 310, destination: "Fujairah" },
  { name: "NORDIC GRACE", lat: 29.5, lng: 49.2, type: "TANKER", flag: "NO", speed: 11, heading: 180, destination: "Ras Tanura" },
  { name: "MINERVA HELEN", lat: 12.6, lng: 43.5, type: "TANKER", flag: "GR", speed: 13, heading: 350, destination: "Suez" },
  { name: "MAERSK EINDHOVEN", lat: 30.3, lng: 32.4, type: "CARGO", flag: "DK", speed: 14, heading: 0, destination: "Port Said" },
  { name: "COSCO SHIPPING", lat: 28.1, lng: 50.5, type: "CARGO", flag: "CN", speed: 16, heading: 160, destination: "Jebel Ali" },
  { name: "AL JASRA", lat: 25.5, lng: 50.3, type: "CARGO", flag: "BH", speed: 10, heading: 90, destination: "Dammam" },
  { name: "FISHER-1", lat: 14.5, lng: 42.8, type: "FISHING", flag: "YE", speed: 4, heading: 45, destination: "Hodeida" },
];

const EMULATED_EARTHQUAKES = [
  { id: "eq1", lat: 35.8, lng: 51.2, depth: 12, magnitude: 3.4, place: "15km NE of Tehran", time: Date.now() - 7200000, type: "earthquake", tsunami: false, alert: null, felt: 50, significance: 200, url: "" },
  { id: "eq2", lat: 38.1, lng: 46.3, depth: 8, magnitude: 4.1, place: "Tabriz Region", time: Date.now() - 14400000, type: "earthquake", tsunami: false, alert: null, felt: 120, significance: 350, url: "" },
  { id: "eq3", lat: 28.9, lng: 50.8, depth: 18, magnitude: 2.8, place: "Bushehr Province", time: Date.now() - 3600000, type: "earthquake", tsunami: false, alert: null, felt: 30, significance: 100, url: "" },
  { id: "eq4", lat: 37.2, lng: 37.0, depth: 5, magnitude: 5.2, place: "SE Turkey", time: Date.now() - 28800000, type: "earthquake", tsunami: false, alert: "yellow", felt: 500, significance: 800, url: "" },
  { id: "eq5", lat: 33.5, lng: 35.5, depth: 15, magnitude: 3.1, place: "Lebanon Coast", time: Date.now() - 43200000, type: "earthquake", tsunami: false, alert: null, felt: 40, significance: 150, url: "" },
  { id: "eq6", lat: 26.0, lng: 56.0, depth: 10, magnitude: 2.5, place: "Strait of Hormuz", time: Date.now() - 18000000, type: "earthquake", tsunami: false, alert: null, felt: 15, significance: 80, url: "" },
];

const EMULATED_WILDFIRES = [
  { id: "f1", lat: 36.5, lng: 36.8, brightness: 340, frp: 65, confidence: "high", date: "2026-03-10", time: "01:30", region: "Hatay, Turkey" },
  { id: "f2", lat: 33.8, lng: 35.8, brightness: 310, frp: 40, confidence: "medium", date: "2026-03-10", time: "02:15", region: "Bekaa, Lebanon" },
  { id: "f3", lat: 31.2, lng: 34.3, brightness: 380, frp: 85, confidence: "high", date: "2026-03-09", time: "23:45", region: "Gaza Border" },
  { id: "f4", lat: 35.2, lng: 44.8, brightness: 290, frp: 35, confidence: "medium", date: "2026-03-10", time: "00:20", region: "Kirkuk, Iraq" },
  { id: "f5", lat: 15.4, lng: 44.3, brightness: 350, frp: 55, confidence: "high", date: "2026-03-09", time: "22:00", region: "Sanaa, Yemen" },
  { id: "f6", lat: 29.0, lng: 50.9, brightness: 270, frp: 25, confidence: "low", date: "2026-03-10", time: "03:00", region: "Bushehr, Iran" },
];

export const FourDMap = ({ onClose, rockets = [] }: FourDMapProps) => {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    satellites: true, flights: true, maritime: true, earthquakes: true, wildfires: true,
    conflicts: true, rockets: true, nuclear: true, airQuality: false, geoFusion: true,
    borders: true, gpsJamming: true, militaryFlights: true, googlePOI: false,
  });
  const [satellites, setSatellites] = useState<SatPoint[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [emulatedTick, setEmulatedTick] = useState(0);
  const satIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const rafRef = useRef<number>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [cleanUI, setCleanUI] = useState(false);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [sharpenEnabled, setSharpenEnabled] = useState(false);
  const [sharpenValue, setSharpenValue] = useState(50);
  const [hudEnabled, setHudEnabled] = useState(true);
  const [layoutPreset, setLayoutPreset] = useState<"TACTICAL" | "STRATEGIC" | "MINIMAL">("TACTICAL");
  const [panopticDensity, setPanopticDensity] = useState(100);
  const [panopticFlights, setPanopticFlights] = useState(true);
  const [panopticSats, setPanopticSats] = useState(true);
  const [panopticMaritime, setPanopticMaritime] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);
  const [globeReady, setGlobeReady] = useState(false);

  const { data: earthquakesRaw } = useEarthquakes();
  const { data: wildfiresRaw } = useWildfires();
  const { data: conflictEvents } = useConflictEvents();
  const { stations: nuclearStations, facilities: nuclearFacilities } = useNuclearMonitors();
  const { data: aisVesselsRaw } = useAISVessels();
  const { data: geoFusionData } = useGeoFusion();
  const { data: airQualityData } = useAirQuality();
  const [googlePOIPoints, setGooglePOIPoints] = useState<any[]>([]);

  // Fetch Google POIs for the focused region
  useEffect(() => {
    if (!layers.googlePOI) { setGooglePOIPoints([]); return; }
    const fetchPOIs = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-places", {
          body: { lat: 30, lng: 45, radius: 50000, categories: ["airport", "military", "embassy"] },
        });
        if (!error && data?.results) {
          setGooglePOIPoints(data.results.map((p: any) => ({
            lat: p.lat, lng: p.lng, name: p.name, category: p.category,
          })));
        }
      } catch { /* silent */ }
    };
    fetchPOIs();
  }, [layers.googlePOI]);

  // Merge real + emulated data — emulated fills gaps when APIs haven't loaded
  const earthquakes = useMemo(() => earthquakesRaw.length > 0 ? earthquakesRaw : EMULATED_EARTHQUAKES, [earthquakesRaw]);
  const wildfires = useMemo(() => wildfiresRaw.length > 0 ? wildfiresRaw : EMULATED_WILDFIRES, [wildfiresRaw]);
  const aisVessels = useMemo(() => aisVesselsRaw.length > 0 ? aisVesselsRaw : EMULATED_VESSELS, [aisVesselsRaw]);
  const allFlights = useMemo(() => flights.length > 0 ? flights : EMULATED_FLIGHTS, [flights]);
  const allSatellites = useMemo(() => {
    if (satellites.length > 0) return satellites;
    // Propagate emulated positions based on tick
    return EMULATED_SATELLITES.map(s => {
      const pos = propagateSatellite(s.inclination, s.raan, s.meanAnomaly, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay);
      return { ...s, lat: pos.lat, lng: pos.lng };
    });
  }, [satellites, emulatedTick]);

  const toggleLayer = useCallback((id: string) => setLayers(prev => ({ ...prev, [id]: !prev[id] })), []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const locResults = SEARCH_LOCATIONS.filter(l => l.name.toLowerCase().includes(q)).map(l => ({ ...l, source: "location" as const }));
    const satResults = allSatellites.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5).map(s => ({ name: s.name, lat: s.lat, lng: s.lng, type: "satellite", source: "satellite" as const }));
    const conflictResults = conflictEvents.filter(e => e.location.toLowerCase().includes(q) || e.country.toLowerCase().includes(q)).slice(0, 5).map(e => ({ name: `${e.event_type} — ${e.location}`, lat: e.lat, lng: e.lng, type: "conflict", source: "event" as const }));
    const vesselResults = aisVessels.filter((v: any) => v.name.toLowerCase().includes(q)).slice(0, 5).map((v: any) => ({ name: `🚢 ${v.name}`, lat: v.lat, lng: v.lng, type: "vessel", source: "vessel" as const }));
    const coordMatch = q.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
    const coordResults = coordMatch ? [{ name: `📍 ${coordMatch[1]}, ${coordMatch[2]}`, lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]), type: "coordinate", source: "location" as const }] : [];
    return [...coordResults, ...locResults, ...satResults, ...conflictResults, ...vesselResults].slice(0, 12);
  }, [searchQuery, allSatellites, conflictEvents, aisVessels]);

  const handleSearchSelect = useCallback((result: { lat: number; lng: number }) => {
    const globe = globeRef.current;
    if (globe) globe.pointOfView({ lat: result.lat, lng: result.lng, altitude: 0.8 }, 1500);
    setSearchQuery(""); setSearchFocused(false);
  }, []);

  // Fetch TLEs via proxy — uses { data: { groupName: tleText } } response format
  useEffect(() => {
    async function fetchTLEs() {
      try {
        const { data: proxyData } = await supabase.functions.invoke("tle-proxy", { body: { groups: TLE_GROUPS } });
        if (!proxyData?.data) { console.warn("[4D] No TLE data returned"); return; }
        const allSats: SatPoint[] = [];
        for (const [, tleText] of Object.entries(proxyData.data)) {
          const lines = (tleText as string).split("\n").map((l: string) => l.trim()).filter(Boolean);
          for (let i = 0; i < lines.length - 2; i += 3) {
            if (lines[i + 1]?.startsWith("1 ") && lines[i + 2]?.startsWith("2 ")) {
              const sat = parseTLE(lines[i], lines[i + 1], lines[i + 2]);
              if (sat) allSats.push(sat);
            }
          }
        }
        // Deduplicate by name, keep first occurrence
        const seen = new Set<string>();
        const unique = allSats.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; });
        // Limit to ~1500 for performance
        const limited = unique.length > 1500 ? unique.filter((_, i) => i % Math.ceil(unique.length / 1500) === 0) : unique;
        if (limited.length > 0) { setSatellites(limited); console.log(`[4D] Loaded ${limited.length} real satellites from TLE data`); }
      } catch (e) { console.warn("[4D] TLE fetch failed, using emulated satellites", e); }
    }
    fetchTLEs();
  }, []);

  // Fetch flights
  useEffect(() => {
    async function fetchFlights() {
      try {
        const { data } = await supabase.functions.invoke("live-flights");
        if (data?.flights?.length) setFlights(data.flights.slice(0, 500));
      } catch (e) { console.warn("[4D] Flights fetch failed, using emulated"); }
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
        .htmlElementsData([]).htmlLat("lat").htmlLng("lng").htmlAltitude("alt").htmlElement("el")
        .objectsData([]).objectLat("lat").objectLng("lng").objectAltitude("alt").objectLabel("label")
        .arcsData([]).arcStartLat("startLat").arcStartLng("startLng").arcEndLat("endLat").arcEndLng("endLng").arcColor("colors").arcStroke(0.5).arcDashLength(0.6).arcDashGap(0.1).arcDashAnimateTime(2000).arcAltitudeAutoScale(0.25)
        .polygonsData([]).polygonCapColor(() => "rgba(0, 200, 180, 0.06)").polygonSideColor(() => "rgba(0, 200, 180, 0.15)").polygonStrokeColor(() => "rgba(0, 220, 200, 0.4)").polygonAltitude(0.006);
      globe.pointOfView({ lat: 30, lng: 45, altitude: 2.2 });
      const controls = globe.controls() as any;
      if (controls) { controls.autoRotate = false; controls.enableDamping = true; controls.dampingFactor = 0.15; }
      globeRef.current = globe;
      setGlobeReady(true);
      console.log("[4D] Globe initialized");
      const resizeObs = new ResizeObserver(() => {
        if (globeContainerRef.current && globe) { globe.width(globeContainerRef.current.clientWidth); globe.height(globeContainerRef.current.clientHeight); }
      });
      resizeObs.observe(globeContainerRef.current);
    });
    return () => { destroyed = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); if (satIntervalRef.current) clearInterval(satIntervalRef.current); };
  }, []);

  // Update satellite positions every second for visible orbital movement
  useEffect(() => {
    if (satellites.length === 0) return;
    const updateSats = () => {
      setSatellites(prev => prev.map(s => {
        const pos = propagateSatellite(s.inclination, s.raan, s.meanAnomaly, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay);
        return { ...s, lat: pos.lat, lng: pos.lng };
      }));
    };
    satIntervalRef.current = setInterval(updateSats, 1000);
    return () => clearInterval(satIntervalRef.current);
  }, [satellites.length]);

  // For emulated fallback: tick counter forces re-propagation
  useEffect(() => {
    if (satellites.length > 0) return;
    const iv = setInterval(() => setEmulatedTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [satellites.length]);

  const stats = useMemo(() => ({
    sats: allSatellites.length, aircraft: allFlights.length, vessels: aisVessels.length,
    quakes: earthquakes.length, fires: wildfires.length, conflicts: conflictEvents.length,
    rockets: rockets.length, nuclear: nuclearStations.length + (nuclearFacilities?.length || 0),
    fusion: geoFusionData?.events?.length || 0, airQ: airQualityData.length,
  }), [allSatellites, allFlights, aisVessels, earthquakes, wildfires, conflictEvents, rockets, nuclearStations, nuclearFacilities, geoFusionData, airQualityData]);

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
    { id: "googlePOI", label: "Google POIs", icon: <MapPin className="h-3.5 w-3.5" />, color: "#a855f7" },
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
      setTimelineValue(prev => { const next = prev + speedMultiplier; if (next >= 100) { setPlaying(false); return 100; } return next; });
    }, 100);
    return () => clearInterval(iv);
  }, [playing, speedMultiplier]);

  const timelineTimestamp = useMemo(() => Date.now() - 24 * 3600000 + (timelineValue / 100) * 24 * 3600000, [timelineValue]);
  const timelineLabel = useMemo(() => new Date(timelineTimestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC", [timelineTimestamp]);

  // Orbit camera control
  useEffect(() => {
    if (!globeReady) return;
    if (orbitMode === "OFF") {
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current);
      const controls = globeRef.current?.controls() as any;
      if (controls) controls.autoRotate = false;
      return;
    }
    const controls = globeRef.current?.controls() as any;
    if (!controls) return;
    if (orbitMode === "FLAT") {
      controls.autoRotate = true; controls.autoRotateSpeed = 1.5;
    } else {
      controls.autoRotate = true; controls.autoRotateSpeed = 2.0;
      const animate = () => {
        const globe = globeRef.current; if (!globe) return;
        const pov = globe.pointOfView();
        const dir = orbitMode === "SPIRAL IN" ? -0.003 : 0.003;
        const newAlt = Math.max(0.3, Math.min(5, pov.altitude + dir));
        globe.pointOfView({ ...pov, altitude: newAlt }, 0);
        if ((orbitMode === "SPIRAL IN" && newAlt <= 0.3) || (orbitMode === "SPIRAL OUT" && newAlt >= 5)) return;
        orbitRef.current = requestAnimationFrame(animate);
      };
      orbitRef.current = requestAnimationFrame(animate);
    }
    return () => { if (orbitRef.current) cancelAnimationFrame(orbitRef.current); if (controls) controls.autoRotate = false; };
  }, [orbitMode, globeReady]);

  // GPS jamming zones
  const gpsJammingZones = useMemo(() => [
    { lat: 35.5, lng: 44.4, label: "NW Iraq Corridor", severity: "high", radius: 0.5, ts: Date.now() - 3600000 * 4 },
    { lat: 33.8, lng: 35.9, label: "Eastern Med / Lebanon", severity: "critical", radius: 0.4, ts: Date.now() - 3600000 * 1 },
    { lat: 32.0, lng: 34.8, label: "Tel Aviv TMA", severity: "high", radius: 0.35, ts: Date.now() - 3600000 * 6 },
    { lat: 36.2, lng: 37.1, label: "Aleppo Corridor", severity: "medium", radius: 0.35, ts: Date.now() - 3600000 * 8 },
    { lat: 29.0, lng: 50.8, label: "Persian Gulf South", severity: "medium", radius: 0.5, ts: Date.now() - 3600000 * 12 },
    { lat: 26.5, lng: 56.3, label: "Strait of Hormuz", severity: "critical", radius: 0.45, ts: Date.now() - 3600000 * 2 },
    { lat: 15.5, lng: 44.2, label: "Yemen Highlands", severity: "high", radius: 0.4, ts: Date.now() - 3600000 * 10 },
    { lat: 34.0, lng: 43.5, label: "Central Iraq", severity: "medium", radius: 0.35, ts: Date.now() - 3600000 * 18 },
  ], []);

  // Emulated OSINT events with category-specific icons
  const emulatedEvents = useMemo(() => [
    { lat: 33.5, lng: 36.3, type: "Airstrike", icon: "💥", color: "#ef4444", ts: Date.now() - 3600000 * 2, label: "Airstrike — Damascus suburbs", severity: "critical" as const },
    { lat: 32.6, lng: 44.0, type: "IED", icon: "💣", color: "#f97316", ts: Date.now() - 3600000 * 5, label: "IED detonation — Karbala road", severity: "high" as const },
    { lat: 15.3, lng: 44.2, type: "Drone Strike", icon: "👁", color: "#ef4444", ts: Date.now() - 3600000 * 1, label: "UAV strike — Sanaa outskirts", severity: "critical" as const },
    { lat: 31.5, lng: 34.5, type: "Rocket Barrage", icon: "🚀", color: "#dc2626", ts: Date.now() - 3600000 * 3, label: "Rocket barrage — Gaza border", severity: "critical" as const },
    { lat: 36.3, lng: 43.1, type: "Recon Overflight", icon: "✈️", color: "#00d4ff", ts: Date.now() - 3600000 * 7, label: "ISR overflight — Mosul", severity: "low" as const },
    { lat: 34.9, lng: 51.3, type: "Centrifuge Activity", icon: "⚛️", color: "#a855f7", ts: Date.now() - 3600000 * 9, label: "Fordow — unusual centrifuge activity", severity: "high" as const },
    { lat: 29.2, lng: 50.3, type: "Naval Movement", icon: "⚓", color: "#22c55e", ts: Date.now() - 3600000 * 4, label: "IRGCN fast boats — Kharg Island", severity: "medium" as const },
    { lat: 25.3, lng: 55.3, type: "Cyber Incident", icon: "🖥", color: "#e879f9", ts: Date.now() - 3600000 * 11, label: "Cyber probe — Dubai infrastructure", severity: "medium" as const },
    { lat: 33.3, lng: 44.4, type: "Protest", icon: "✊", color: "#eab308", ts: Date.now() - 3600000 * 6, label: "Mass gathering — Baghdad", severity: "low" as const },
    { lat: 37.0, lng: 35.4, type: "Military Buildup", icon: "🪖", color: "#ef4444", ts: Date.now() - 3600000 * 14, label: "Armor movement — Incirlik", severity: "high" as const },
    { lat: 30.1, lng: 31.4, type: "Border Incident", icon: "🚧", color: "#f97316", ts: Date.now() - 3600000 * 16, label: "Sinai border clash", severity: "medium" as const },
    { lat: 12.8, lng: 45.0, type: "Maritime Interdiction", icon: "🚢", color: "#00d4ff", ts: Date.now() - 3600000 * 8, label: "Vessel seizure — Bab el-Mandeb", severity: "medium" as const },
    { lat: 35.7, lng: 51.4, type: "SIGINT Spike", icon: "📡", color: "#e879f9", ts: Date.now() - 3600000 * 13, label: "SIGINT spike — Tehran", severity: "high" as const },
    { lat: 24.7, lng: 46.7, type: "Air Defense Test", icon: "🛡", color: "#a855f7", ts: Date.now() - 3600000 * 20, label: "Patriot test fire — Riyadh", severity: "medium" as const },
    { lat: 32.1, lng: 34.8, type: "Iron Dome Activation", icon: "🛡", color: "#ef4444", ts: Date.now() - 3600000 * 0.5, label: "Iron Dome intercept — Tel Aviv", severity: "critical" as const },
    { lat: 27.0, lng: 49.5, type: "Oil Facility Alert", icon: "🛢", color: "#f97316", ts: Date.now() - 3600000 * 3.5, label: "Security alert — Ras Tanura", severity: "high" as const },
    { lat: 33.9, lng: 35.5, type: "Hezbollah Movement", icon: "🎯", color: "#dc2626", ts: Date.now() - 3600000 * 1.5, label: "Convoy movement — South Lebanon", severity: "critical" as const },
    { lat: 36.8, lng: 40.5, type: "Kurdish Clash", icon: "⚔️", color: "#f97316", ts: Date.now() - 3600000 * 10, label: "Border skirmish — NE Syria", severity: "high" as const },
  ], []);

  // Unified event feed with icons
  const getEventIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("airstrike") || t.includes("strike")) return "💥";
    if (t.includes("ied") || t.includes("bomb") || t.includes("explosion")) return "💣";
    if (t.includes("drone") || t.includes("uav")) return "👁";
    if (t.includes("rocket") || t.includes("missile")) return "🚀";
    if (t.includes("earthquake") || t.includes("seismic")) return "🌍";
    if (t.includes("fire") || t.includes("thermal") || t.includes("smoke")) return "💨";
    if (t.includes("naval") || t.includes("maritime") || t.includes("vessel")) return "⚓";
    if (t.includes("cyber")) return "🖥";
    if (t.includes("protest") || t.includes("gather")) return "✊";
    if (t.includes("military") || t.includes("buildup") || t.includes("armor")) return "🪖";
    if (t.includes("sigint") || t.includes("gps") || t.includes("jam")) return "📡";
    if (t.includes("nuclear") || t.includes("centrifuge")) return "⚛️";
    if (t.includes("iron dome") || t.includes("air defense") || t.includes("intercept")) return "🛡";
    if (t.includes("border")) return "🚧";
    if (t.includes("oil") || t.includes("tanker")) return "🛢";
    if (t.includes("hezbollah") || t.includes("convoy") || t.includes("movement")) return "🎯";
    if (t.includes("battle") || t.includes("clash") || t.includes("skirmish")) return "⚔️";
    if (t.includes("recon") || t.includes("overflight") || t.includes("isr")) return "✈️";
    return "📌";
  };

  const unifiedFeed = useMemo(() => {
    const cutoff = timelineTimestamp;
    const feed: { id: string; ts: number; type: string; label: string; lat: number; lng: number; severity: string; color: string; source: string; icon: string }[] = [];
    emulatedEvents.forEach((ev, i) => { if (ev.ts <= cutoff) feed.push({ id: `emu-${i}`, ts: ev.ts, type: ev.type, label: ev.label, lat: ev.lat, lng: ev.lng, severity: ev.severity, color: ev.color, source: "OSINT", icon: ev.icon }); });
    if (geoFusionData?.events) {
      geoFusionData.events.forEach((ev, i) => {
        const evTs = new Date(ev.timestamp).getTime();
        const sev = ev.severity >= 4 ? "critical" : ev.severity >= 3 ? "high" : ev.severity >= 2 ? "medium" : "low";
        const col = ev.severity >= 4 ? "#dc2626" : ev.severity >= 3 ? "#f97316" : "#eab308";
        feed.push({ id: `geo-${i}`, ts: isNaN(evTs) ? Date.now() - i * 600000 : evTs, type: ev.event_type, label: `${ev.event_type} — ${ev.location}, ${ev.country}`, lat: ev.lat, lng: ev.lng, severity: sev, color: col, source: "GEO-FUSION", icon: getEventIcon(ev.event_type) });
      });
    }
    conflictEvents.forEach((ev, i) => {
      const evTs = new Date(ev.event_date).getTime();
      const col = ev.severity === "critical" ? "#dc2626" : ev.severity === "high" ? "#f97316" : "#eab308";
      feed.push({ id: `con-${i}`, ts: isNaN(evTs) ? Date.now() - i * 300000 : evTs, type: ev.event_type, label: `${ev.event_type} — ${ev.location}`, lat: ev.lat, lng: ev.lng, severity: ev.severity, color: col, source: "ACLED", icon: getEventIcon(ev.event_type) });
    });
    earthquakes.forEach((eq, i) => {
      const eqTs = (eq as any).time || Date.now() - i * 600000;
      const sev = eq.magnitude >= 6 ? "critical" : eq.magnitude >= 5 ? "high" : eq.magnitude >= 3 ? "medium" : "low";
      feed.push({ id: `eq-${i}`, ts: eqTs, type: "Earthquake", label: `M${eq.magnitude} — ${eq.place}`, lat: eq.lat, lng: eq.lng, severity: sev, color: eq.magnitude >= 5 ? "#ef4444" : "#fbbf24", source: "USGS", icon: "🌍" });
    });
    gpsJammingZones.forEach((z, i) => {
      if (z.ts <= cutoff) feed.push({ id: `jam-${i}`, ts: z.ts, type: "GPS Jamming", label: z.label, lat: z.lat, lng: z.lng, severity: z.severity, color: "#e879f9", source: "SIGINT", icon: "📡" });
    });
    feed.sort((a, b) => b.ts - a.ts);
    return feed.slice(0, 60);
  }, [timelineTimestamp, emulatedEvents, geoFusionData, conflictEvents, earthquakes, gpsJammingZones]);

  useEffect(() => { if (feedRef.current && playing) feedRef.current.scrollTop = 0; }, [unifiedFeed.length, playing]);

  const timelineDots = useMemo(() => {
    const now = Date.now(); const h24 = 24 * 3600000;
    const dots: { position: number; color: string; label: string }[] = [];
    emulatedEvents.forEach(ev => { const pos = ((ev.ts - (now - h24)) / h24) * 100; if (pos >= 0 && pos <= 100) dots.push({ position: pos, color: ev.color, label: ev.label }); });
    gpsJammingZones.forEach(z => { const pos = ((z.ts - (now - h24)) / h24) * 100; if (pos >= 0 && pos <= 100) dots.push({ position: pos, color: "#e879f9", label: z.label }); });
    earthquakes.slice(0, 8).forEach(eq => {
      const t = (eq as any).time || now - Math.random() * h24;
      const pos = ((t - (now - h24)) / h24) * 100;
      dots.push({ position: Math.max(0, Math.min(100, pos)), color: eq.magnitude >= 5 ? "#ef4444" : "#fbbf24", label: `M${eq.magnitude}` });
    });
    return dots;
  }, [earthquakes, emulatedEvents, gpsJammingZones]);

  const densityMult = panopticDensity / 100;
  const isrSatellites = useMemo(() => allSatellites.filter(s => KEY_ISR_SATS.some(k => s.name.toUpperCase().includes(k))), [allSatellites]);

  // ============= MAIN GLOBE DATA UPDATE =============
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !globeReady) return;
    const points: any[] = [];
    const cutoff = timelineTimestamp;

    // EARTHQUAKES — seismic wave icon, scaled by magnitude
    if (layers.earthquakes) {
      earthquakes.forEach(eq => {
        const eqTime = (eq as any).time || Date.now();
        if (eqTime > cutoff) return;
        const col = eq.magnitude >= 5 ? "#ef4444" : eq.magnitude >= 3 ? "#ff6b00" : "#fbbf24";
        const sevIcon = eq.magnitude >= 5 ? "🔴" : eq.magnitude >= 3 ? "🟠" : "🟡";
        const alertStr = (eq as any).alert ? `<div style="color:#ef4444;font-size:8px;margin-top:1px">⚠ ALERT: ${(eq as any).alert.toUpperCase()}</div>` : "";
        points.push({ lat: eq.lat, lng: eq.lng, pointAlt: 0.01, color: col, radius: Math.max(0.3, eq.magnitude * 0.15) * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 10px ${col}20"><div style="color:${col};font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:13px">${sevIcon}</span> SEISMIC M${eq.magnitude}</div><div style="font-size:9px;margin-top:2px">📍 ${eq.place}</div><div style="color:#888;font-size:8px;margin-top:1px">${eq.lat.toFixed(2)}°, ${eq.lng.toFixed(2)}° • ${eq.depth}km deep${eq.felt ? ` • Felt: ${eq.felt}` : ""}</div>${alertStr}</div>` });
      });
    }

    // WILDFIRES — smoke icon, sized by FRP
    if (layers.wildfires) {
      wildfires.forEach(f => {
        const isIntense = f.frp > 50;
        const col = isIntense ? "#ff2200" : "#ff6600";
        points.push({ lat: f.lat, lng: f.lng, pointAlt: 0.008, color: col, radius: Math.max(0.25, f.brightness / 250) * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 10px rgba(255,69,0,0.2)"><div style="color:${col};font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:14px">💨</span> SMOKE / THERMAL</div><div style="font-size:9px;margin-top:2px">${(f as any).region || "Unknown"} • FRP: ${f.frp}MW</div><div style="color:#888;font-size:8px;margin-top:1px">Confidence: ${f.confidence} • Brightness: ${f.brightness}K</div><div style="color:#666;font-size:8px">FIRMS/VIIRS • ${f.date} ${f.time} UTC</div></div>` });
      });
    }

    // CONFLICTS — event-type specific icons
    if (layers.conflicts && conflictEvents.length) {
      conflictEvents.forEach(ev => {
        const col = ev.severity === "critical" ? "#dc2626" : ev.severity === "high" ? "#f97316" : "#eab308";
        const evType = (ev.event_type || "").toLowerCase();
        const cIcon = evType.includes("battle") ? "⚔️" : evType.includes("explosion") ? "💥" : evType.includes("protest") ? "✊" : evType.includes("riot") ? "🔥" : evType.includes("violence") ? "⚠️" : "🎯";
        points.push({ lat: ev.lat, lng: ev.lng, pointAlt: 0.02, color: col, radius: 0.35 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 10px ${col}20"><div style="color:${col};font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:13px">${cIcon}</span> ${ev.event_type.toUpperCase()}</div><div style="font-size:9px;margin-top:2px">📍 ${ev.location}, ${ev.country}</div><div style="color:#888;font-size:8px;margin-top:1px">${ev.fatalities > 0 ? `💀 ${ev.fatalities} fatalities • ` : ""}Source: ${ev.source}</div></div>` });
      });
    }

    // NUCLEAR — radiation symbol with facility details
    if (layers.nuclear) {
      nuclearStations.forEach(st => {
        points.push({ lat: st.lat, lng: st.lng, pointAlt: 0.02, color: "#a855f7", radius: 0.3 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid #a855f7;padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 12px rgba(168,85,247,0.2)"><div style="color:#a855f7;font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:13px">☢️</span> RADIATION MONITOR</div><div style="font-size:9px;margin-top:2px">${st.name}</div><div style="color:#888;font-size:8px;margin-top:1px">📊 ${st.dose_rate} ${st.unit} • ${st.country}</div></div>` });
      });
      nuclearFacilities.forEach(fac => {
        points.push({ lat: fac.lat, lng: fac.lng, pointAlt: 0.025, color: "#e879f9", radius: 0.35 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid #e879f9;padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 12px rgba(232,121,249,0.2)"><div style="color:#e879f9;font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:13px">⚛️</span> NUCLEAR FACILITY</div><div style="font-size:9px;margin-top:2px">${fac.name}</div><div style="color:#888;font-size:8px;margin-top:1px">${fac.country} • ${fac.type} • Status: ${fac.status}</div></div>` });
      });
    }

    // MARITIME — type-specific vessel icons
    if (layers.maritime && panopticMaritime) {
      aisVessels.forEach((v: any) => {
        const col = v.type === "MILITARY" ? "#ef4444" : v.type === "TANKER" ? "#f97316" : v.type === "FISHING" ? "#22d3ee" : "#22c55e";
        const vIcon = v.type === "MILITARY" ? "⚓" : v.type === "TANKER" ? "🛢" : v.type === "CARGO" ? "📦" : v.type === "FISHING" ? "🎣" : "🚢";
        const vLabel = v.type === "MILITARY" ? "WARSHIP" : v.type === "TANKER" ? "OIL TANKER" : v.type === "CARGO" ? "CARGO VESSEL" : v.type === "FISHING" ? "FISHING" : "VESSEL";
        points.push({ lat: v.lat, lng: v.lng, pointAlt: 0.005, color: col, radius: (v.type === "MILITARY" ? 0.25 : 0.18) * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 10px ${col}20"><div style="color:${col};font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:13px">${vIcon}</span> ${vLabel}</div><div style="font-size:10px;margin-top:2px">${v.name} <span style="color:#888">(${v.flag})</span></div><div style="color:#888;font-size:8px;margin-top:1px">${v.speed}kn • HDG ${v.heading}° → ${v.destination || "—"}</div></div>` });
      });
    }

    // FLIGHTS — type-specific icons and labels
    if (layers.flights && panopticFlights) {
      allFlights.forEach((f: any) => {
        const isMil = f.military || f.callsign?.match(/^(RCH|EVAC|DUKE|REAC|NAVY|JAKE|RRR|FORTE|VADER|IAM)/i);
        if (!layers.militaryFlights && isMil) return;
        const acType = (f.type || "").toUpperCase();
        // Determine icon based on aircraft type
        let icon = isMil ? "🎖" : "✈️";
        let typeLabel = isMil ? "MILITARY" : "AIRLINER";
        if (acType.includes("F-15") || acType.includes("F-16") || acType.includes("F-35") || acType.includes("F-22") || acType.includes("SU-") || acType.includes("MIG")) { icon = "🔴"; typeLabel = "FIGHTER"; }
        else if (acType.includes("C-17") || acType.includes("C-130") || acType.includes("C-5") || acType.includes("AN-")) { icon = "📦"; typeLabel = "TRANSPORT"; }
        else if (acType.includes("KC-") || acType.includes("TANKER")) { icon = "⛽"; typeLabel = "TANKER"; }
        else if (acType.includes("P-8") || acType.includes("P-3")) { icon = "🔍"; typeLabel = "MPA/ASW"; }
        else if (acType.includes("RQ-") || acType.includes("MQ-") || acType.includes("HERON") || acType.includes("HERMES")) { icon = "👁"; typeLabel = "UAV/DRONE"; }
        else if (acType.includes("E-3") || acType.includes("E-2") || acType.includes("E-8")) { icon = "📡"; typeLabel = "AWACS"; }
        else if (acType.includes("B7") || acType.includes("B73") || acType.includes("B77") || acType.includes("B78") || acType.includes("B787")) { icon = "✈️"; typeLabel = "BOEING"; }
        else if (acType.includes("A3") || acType.includes("A32") || acType.includes("A33") || acType.includes("A35") || acType.includes("A38")) { icon = "✈️"; typeLabel = "AIRBUS"; }
        else if (acType.includes("HELI") || acType.includes("H60") || acType.includes("AH-") || acType.includes("UH-") || acType.includes("CH-")) { icon = "🚁"; typeLabel = "HELICOPTER"; }
        const col = isMil ? "#ef4444" : "#00d4ff";
        const hdg = f.heading ? `HDG ${Math.round(f.heading)}°` : "";
        const route = f.route ? `<div style="color:#aaa;font-size:8px;margin-top:1px">📍 ${f.route}</div>` : "";
        points.push({ lat: f.lat || f.latitude, lng: f.lng || f.longitude, pointAlt: 0.05, color: col, radius: (isMil ? 0.18 : 0.1) * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 12px ${col}25"><div style="color:${col};font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:13px">${icon}</span> ${typeLabel} — ${f.callsign || "UNKNOWN"}</div><div style="font-size:9px;margin-top:2px">${acType || "—"} • ${f.airline || f.origin_country || ""}</div><div style="color:#888;font-size:8px;margin-top:1px">${f.velocity ? Math.round(f.velocity * 3.6) + " km/h" : ""} • FL${f.baro_altitude ? Math.round(f.baro_altitude / 30.48) : "?"} • ${hdg}</div>${route}</div>` });
      });
    }

    // AIR QUALITY
    if (layers.airQuality && airQualityData.length) {
      airQualityData.forEach(aq => {
        const aqi = aq.aqi || 0;
        const color = aqi > 150 ? "#dc2626" : aqi > 100 ? "#f97316" : aqi > 50 ? "#eab308" : "#22c55e";
        points.push({ lat: aq.lat, lng: aq.lng, pointAlt: 0.008, color, radius: 0.15 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.95);border:1px solid ${color};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${color};font-weight:bold">🌬 AQI ${aqi}</div><div>${aq.city} • ${aq.aqi_level}</div></div>` });
      });
    }

    // GEO-FUSION
    if (layers.geoFusion && geoFusionData?.events?.length) {
      geoFusionData.events.forEach(ev => {
        const col = ev.severity >= 4 ? "#dc2626" : ev.severity >= 3 ? "#f97316" : "#eab308";
        points.push({ lat: ev.lat, lng: ev.lng, pointAlt: 0.025, color: col, radius: 0.3 * densityMult,
          label: `<div style="font-family:monospace;font-size:11px;background:rgba(10,10,20,0.95);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0"><div style="color:${col};font-weight:bold">📡 ${ev.event_type.toUpperCase()}</div><div>${ev.location}, ${ev.country}</div><div style="color:#888;font-size:9px">${ev.source} • ${ev.confidence}</div></div>` });
      });
    }

    // GPS JAMMING — red tile zones with multiple coverage points
    if (layers.gpsJamming) {
      gpsJammingZones.forEach(z => {
        if (z.ts > cutoff) return;
        const col = z.severity === "critical" ? "#ff0033" : z.severity === "high" ? "#cc0022" : "#aa0033";
        // Render as a cluster of red tile-like points to simulate area coverage
        const offsets = [
          [0, 0], [0.15, 0.15], [-0.15, 0.15], [0.15, -0.15], [-0.15, -0.15],
          [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25],
        ];
        offsets.forEach(([dlat, dlng]) => {
          points.push({ lat: z.lat + dlat, lng: z.lng + dlng, pointAlt: 0.012, color: col, radius: 0.22 * densityMult,
            label: dlat === 0 && dlng === 0 ? `<div style="font-family:monospace;font-size:11px;background:rgba(40,0,0,0.96);border:1px solid ${col};padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 15px ${col}40"><div style="color:${col};font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:14px">🟥</span> GPS JAMMING ZONE</div><div style="font-size:9px;margin-top:2px">📡 ${z.label}</div><div style="color:#ff6666;font-size:8px;margin-top:1px">${z.severity.toUpperCase()} • ${new Date(z.ts).toISOString().slice(11,19)} UTC</div><div style="color:#cc4444;font-size:7px;margin-top:1px">⚠ GNSS DENIED — NAV UNRELIABLE</div></div>` : "" });
        });
      });
    }

    // EMULATED OSINT EVENTS — with category-specific icons, timeline filtered
    emulatedEvents.forEach(ev => {
      if (ev.ts > cutoff) return;
      points.push({ lat: ev.lat, lng: ev.lng, pointAlt: 0.022, color: ev.color, radius: 0.3 * densityMult,
        label: `<div style="font-family:monospace;font-size:11px;background:rgba(5,5,15,0.96);border:1px solid ${ev.color};padding:6px 10px;border-radius:4px;color:#f0f0f0;box-shadow:0 0 10px ${ev.color}20"><div style="color:${ev.color};font-weight:bold;display:flex;align-items:center;gap:4px"><span style="font-size:13px">${ev.icon}</span> ${ev.type.toUpperCase()}</div><div style="font-size:9px;margin-top:2px">${ev.label}</div><div style="color:#888;font-size:8px;margin-top:1px">${new Date(ev.ts).toISOString().replace("T"," ").slice(0,19)} UTC</div></div>` });
    });

    console.log(`[4D] Rendering ${points.length} points on globe`);
    globe.pointsData(points);

    // SATELLITES — render as HTML icon elements for visible satellite icons (not dots/lines)
    if (layers.satellites && panopticSats && allSatellites.length) {
      const satHtmlElements = allSatellites.slice(0, 200).map(s => {
        const isISR = KEY_ISR_SATS.some(k => s.name.toUpperCase().includes(k));
        const isMil = s.category === "Military" || s.category === "Early Warning";
        const satCol = isMil ? "#ef4444" : s.category === "Earth Observation" ? "#00d4ff" : s.category === "Navigation" ? "#22c55e" : s.category === "Weather" ? "#a855f7" : s.category === "Space Station" ? "#ffffff" : s.category === "Starlink" ? "#666" : "#555";
        const catIcon = isMil ? "🛰️" : s.category === "Earth Observation" ? "🛰️" : s.category === "Navigation" ? "📡" : s.category === "Weather" ? "🌤️" : s.category === "Space Station" ? "🏠" : s.category === "Starlink" ? "⭐" : "🛰️";
        const period = (1440 / s.meanMotion).toFixed(0);
        const size = isISR ? 22 : isMil ? 18 : s.category === "Space Station" ? 20 : s.category === "Starlink" ? 8 : 14;
        const showLabel = isISR || isMil || s.category === "Space Station" || s.category === "Early Warning";

        return {
          lat: s.lat,
          lng: s.lng,
          alt: Math.min(s.alt / 6371 * 0.15, 0.8),
          name: s.name,
          category: s.category,
          satCol,
          el: (() => {
            const wrapper = document.createElement("div");
            wrapper.style.cssText = `display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;transition:transform 0.3s ease;`;
            wrapper.onmouseenter = () => { wrapper.style.transform = "scale(1.5)"; wrapper.style.zIndex = "999"; };
            wrapper.onmouseleave = () => { wrapper.style.transform = "scale(1)"; wrapper.style.zIndex = "auto"; };

            // Icon element
            const icon = document.createElement("div");
            icon.style.cssText = `font-size:${size}px;filter:drop-shadow(0 0 ${isISR ? 8 : 4}px ${satCol});line-height:1;text-align:center;`;
            icon.textContent = catIcon;
            wrapper.appendChild(icon);

            // Pulse ring for ISR/Military
            if (isISR || isMil) {
              const ring = document.createElement("div");
              ring.style.cssText = `position:absolute;width:${size + 10}px;height:${size + 10}px;border-radius:50%;border:1px solid ${satCol};opacity:0.4;animation:satPulse 2s ease-out infinite;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;`;
              wrapper.appendChild(ring);
            }

            // Name label for important sats
            if (showLabel) {
              const label = document.createElement("div");
              label.style.cssText = `font-family:monospace;font-size:7px;color:${satCol};letter-spacing:1px;font-weight:bold;white-space:nowrap;margin-top:1px;text-shadow:0 0 4px rgba(0,0,0,0.9),0 0 8px ${satCol}40;text-align:center;max-width:80px;overflow:hidden;text-overflow:ellipsis;`;
              label.textContent = s.name.length > 12 ? s.name.slice(0, 12) : s.name;
              wrapper.appendChild(label);
            }

            // Tooltip on click
            wrapper.title = `${catIcon} ${s.name}\n${s.category} • ${Math.round(s.alt)}km\nInc ${s.inclination.toFixed(1)}° • Period ${period}min`;
            return wrapper;
          })(),
        };
      });
      globe.htmlElementsData(satHtmlElements);
      globe.objectsData([]);
    } else {
      globe.htmlElementsData([]);
      globe.objectsData([]);
    }

    // ARCS — rockets, threat corridors, scan cones
    const arcs: any[] = [];
    if (layers.rockets && rockets.length) {
      rockets.forEach(r => {
        arcs.push({ startLat: r.originLat, startLng: r.originLng, endLat: r.targetLat, endLng: r.targetLng,
          colors: [r.severity === "critical" ? "rgba(239,68,68,0.9)" : "rgba(255,107,0,0.9)", r.status === "intercepted" ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.6)"] });
      });
    }
    if (layers.geoFusion) {
      arcs.push(
        { startLat: 35.69, startLng: 51.39, endLat: 33.51, endLng: 36.29, colors: ["rgba(239,68,68,0.6)", "rgba(239,68,68,0.2)"] },
        { startLat: 15.35, startLng: 44.21, endLat: 12.58, endLng: 43.33, colors: ["rgba(249,115,22,0.5)", "rgba(249,115,22,0.2)"] },
        { startLat: 26.57, startLng: 56.25, endLat: 25.20, endLng: 55.27, colors: ["rgba(234,179,8,0.5)", "rgba(234,179,8,0.15)"] },
        { startLat: 33.31, startLng: 44.37, endLat: 36.34, endLng: 43.13, colors: ["rgba(168,85,247,0.5)", "rgba(168,85,247,0.15)"] },
        { startLat: 33.5, startLng: 36.3, endLat: 31.5, endLng: 34.5, colors: ["rgba(239,68,68,0.4)", "rgba(239,68,68,0.1)"] },
        { startLat: 35.69, startLng: 51.39, endLat: 15.35, endLng: 44.21, colors: ["rgba(168,85,247,0.3)", "rgba(168,85,247,0.1)"] },
      );
    }
    // Satellite orbital track arcs — trace partial orbit paths for top satellites
    if (layers.satellites && panopticSats) {
      // Orbital tracks: compute positions ±15° along mean anomaly for visible orbit segments
      const trackSats = allSatellites.filter(s => {
        const isISR = KEY_ISR_SATS.some(k => s.name.toUpperCase().includes(k));
        return isISR || s.category === "Military" || s.category === "Early Warning" || s.category === "Earth Observation";
      }).slice(0, 30);

      trackSats.forEach(s => {
        const isMil = s.category === "Military" || s.category === "Early Warning";
        const trackCol = isMil ? "rgba(239,68,68,0.35)" : s.category === "Earth Observation" ? "rgba(0,212,255,0.3)" : s.category === "Navigation" ? "rgba(34,197,94,0.25)" : "rgba(168,85,247,0.25)";
        const trackColFade = isMil ? "rgba(239,68,68,0.08)" : s.category === "Earth Observation" ? "rgba(0,212,255,0.06)" : "rgba(100,100,100,0.06)";

        // Generate 3 arc segments along the orbit: behind, at, ahead
        const offsets = [-12, -6, 6, 12]; // degrees offset on mean anomaly
        for (let i = 0; i < offsets.length - 1; i++) {
          const ma1 = s.meanAnomaly + offsets[i];
          const ma2 = s.meanAnomaly + offsets[i + 1];
          const pos1 = propagateSatelliteAtMA(s.inclination, s.raan, ma1, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay);
          const pos2 = propagateSatelliteAtMA(s.inclination, s.raan, ma2, s.meanMotion, s.eccentricity, s.epochYear, s.epochDay);
          arcs.push({
            startLat: pos1.lat, startLng: pos1.lng,
            endLat: pos2.lat, endLng: pos2.lng,
            colors: [trackCol, trackColFade],
          });
        }

        // Scan cone arc from satellite to ground footprint
        const isISR = KEY_ISR_SATS.some(k => s.name.toUpperCase().includes(k));
        if (isISR) {
          const coneCol = isMil ? "rgba(239,68,68,0.4)" : "rgba(0,212,255,0.35)";
          arcs.push({ startLat: s.lat, startLng: s.lng, endLat: s.lat + Math.sin(s.meanAnomaly * 0.05) * 3, endLng: s.lng + Math.cos(s.meanAnomaly * 0.05) * 3, colors: [coneCol, "rgba(255,255,255,0.05)"] });
        }
      });
    }
    globe.arcsData(arcs);

    if (layers.borders) {
      globe.polygonsData(getCountryGeoJSON(ALL_COUNTRY_CODES).features);
    } else {
      globe.polygonsData([]);
    }
  }, [layers, earthquakes, wildfires, conflictEvents, nuclearStations, nuclearFacilities, aisVessels, allFlights, airQualityData, geoFusionData, allSatellites, rockets, timelineTimestamp, gpsJammingZones, emulatedEvents, densityMult, panopticFlights, panopticSats, panopticMaritime, isrSatellites, globeReady]);

  const chipLayers = [
    { id: "flights", label: "Flights", icon: <Plane className="h-3 w-3" /> },
    { id: "militaryFlights", label: "Military", icon: <Shield className="h-3 w-3" /> },
    { id: "gpsJamming", label: "GPS Jam", icon: <Lock className="h-3 w-3" /> },
    { id: "satellites", label: "Satellites", icon: <Satellite className="h-3 w-3" /> },
    { id: "maritime", label: "Maritime", icon: <Anchor className="h-3 w-3" /> },
    { id: "borders", label: "Borders", icon: <MapPin className="h-3 w-3" /> },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) { case "city": return "🏙"; case "facility": return "⚛"; case "military": return "🎯"; case "chokepoint": return "⚓"; case "conflict": return "⚔"; case "satellite": return "🛰"; case "vessel": return "🚢"; default: return "📌"; }
  };

  const getSeverityBorder = (sev: string) => {
    switch (sev) { case "critical": return "border-l-[#dc2626]"; case "high": return "border-l-[#f97316]"; case "medium": return "border-l-[#eab308]"; default: return "border-l-[#00d4ff]"; }
  };

  const handleFeedClick = useCallback((lat: number, lng: number) => {
    const globe = globeRef.current;
    if (globe) globe.pointOfView({ lat, lng, altitude: 1.0 }, 1200);
  }, []);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-[9999] bg-[hsl(220,25%,5%)] flex flex-col" style={{ filter: bloomEnabled ? "brightness(1.05) contrast(1.08)" : undefined }}>
      {/* Satellite pulse animation */}
      <style>{`@keyframes satPulse { 0% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; } 100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; } }`}</style>
      <div className="fixed inset-0 pointer-events-none z-[10000] opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,210,255,0.1) 2px, rgba(0,210,255,0.1) 4px)" }} />

      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL — hidden on mobile by default, togglable */}
        {!cleanUI && (
          <div className={`${mobileSidebarOpen ? 'absolute inset-y-0 left-0 z-[10001]' : 'hidden'} md:relative md:block w-56 flex-shrink-0 bg-[hsl(220,20%,7%)] border-r border-[hsl(190,60%,20%)] flex flex-col overflow-hidden`}>
            <div className="px-3 py-2.5 border-b border-[hsl(190,60%,15%)] bg-[hsl(220,20%,6%)]">
              <div className="flex items-center gap-2">
                <div className="relative"><Radar className="h-4 w-4 text-primary" /><div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success animate-pulse" /></div>
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
                  { label: "INTEL", value: stats.fusion + emulatedEvents.length, color: "#eab308" },
                ].map(s => (
                  <div key={s.label} className="text-center py-1 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,15%)]">
                    <div className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[7px] font-mono text-muted-foreground tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
              <span className="text-[9px] text-muted-foreground font-mono tracking-wider">{totalActive}/{layerConfigs.length} LAYERS ACTIVE</span>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {layerConfigs.map(layer => (
                <button key={layer.id} onClick={() => toggleLayer(layer.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all duration-150 border-l-2 ${layers[layer.id] ? "bg-[hsl(190,30%,10%)] border-l-primary" : "bg-transparent border-l-transparent hover:bg-[hsl(220,15%,10%)]"}`}>
                  <Checkbox checked={layers[layer.id]} onCheckedChange={() => toggleLayer(layer.id)} className="h-3 w-3 pointer-events-none rounded-sm" />
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: layers[layer.id] ? layer.color : "#374151" }} />
                  <span className={`flex items-center gap-1 text-[10px] font-mono tracking-wide ${layers[layer.id] ? "text-foreground" : "text-muted-foreground"}`}>
                    {layer.icon} {layer.label}
                  </span>
                  {layer.count !== undefined && layer.count > 0 && (
                    <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded text-muted-foreground" style={{ backgroundColor: layers[layer.id] ? `${layer.color}15` : "transparent", color: layers[layer.id] ? layer.color : undefined }}>{layer.count}</span>
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

        {/* GLOBE */}
        <div className="flex-1 relative overflow-hidden" style={{ minWidth: 0, filter: sharpenEnabled ? `contrast(${1 + sharpenValue / 200})` : undefined }}>
          <div ref={globeContainerRef} className="absolute inset-0" />

          {/* Search */}
          {!cleanUI && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-64 sm:w-80">
              <div className="relative">
                <div className="flex items-center bg-[hsl(220,20%,7%)/0.92] backdrop-blur-md border border-[hsl(190,60%,20%)] rounded-md overflow-hidden">
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
                        <Target className="h-3 w-3 text-primary/50" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* X close button — always visible, prominent */}
          <button onClick={onClose} className="absolute top-3 right-3 z-[10002] w-10 h-10 flex items-center justify-center rounded-lg bg-destructive/90 backdrop-blur-md border-2 border-destructive text-destructive-foreground hover:bg-destructive hover:scale-110 transition-all shadow-[0_0_20px_hsl(0,80%,50%/0.4)] font-bold">
            <X className="h-5 w-5" strokeWidth={3} />
          </button>

          {/* Title + HUD */}
          {!cleanUI && hudEnabled && (
            <>
              <div className="absolute top-4 left-4 z-10">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[hsl(220,20%,7%)/0.85] backdrop-blur border border-[hsl(190,60%,18%)]">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold font-mono tracking-[0.15em] text-foreground">4D <span className="text-primary">MAP</span></span>
                  <div className="w-px h-3 bg-[hsl(190,60%,20%)] mx-1" />
                  <span className="text-[8px] font-mono text-muted-foreground tracking-[0.1em]">MULTI-INT FUSION</span>
                  <div className="flex items-center gap-1 ml-2"><div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /><span className="text-[8px] font-mono text-success">LIVE</span></div>
                </div>
              </div>
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
            </>
          )}
        </div>

        {/* RIGHT PANEL — Attributes + Feed */}
        {!cleanUI && (
          <div className="w-64 flex-shrink-0 relative z-[50] bg-[hsl(220,20%,7%)] border-l border-[hsl(190,60%,20%)] flex flex-col overflow-hidden pointer-events-auto" style={{ minWidth: 256 }}>
            <div className="px-3 py-2.5 border-b border-[hsl(190,60%,15%)] bg-[hsl(220,20%,6%)]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase">ATTRIBUTES</span>
                <div className="ml-auto flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /><span className="text-[7px] font-mono text-success">ACTIVE</span></div>
              </div>
            </div>

            <div className="px-3 py-2.5 border-b border-[hsl(190,60%,12%)] space-y-2.5">
              {[
                { label: "BLOOM", icon: <Sparkles className="h-3.5 w-3.5 text-[#eab308]" />, value: bloomEnabled, set: setBloomEnabled, color: "#eab308" },
                { label: "HUD OVERLAY", icon: <Monitor className="h-3.5 w-3.5 text-[#00d4ff]" />, value: hudEnabled, set: setHudEnabled, color: "#00d4ff" },
              ].map(ctrl => (
                <div key={ctrl.label} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2">{ctrl.icon}<span className="text-[10px] font-mono text-foreground tracking-wider font-medium">{ctrl.label}</span></div>
                  <button onClick={() => ctrl.set(!ctrl.value)} className="w-9 h-5 rounded-full transition-colors relative" style={{ backgroundColor: ctrl.value ? ctrl.color : "hsl(220,15%,20%)" }}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-foreground transition-transform absolute top-0.5 ${ctrl.value ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-mono text-foreground tracking-wider font-medium">SHARPEN</span></div>
                  <button onClick={() => setSharpenEnabled(!sharpenEnabled)} className="w-9 h-5 rounded-full transition-colors relative" style={{ backgroundColor: sharpenEnabled ? "hsl(190,80%,50%)" : "hsl(220,15%,20%)" }}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-foreground transition-transform absolute top-0.5 ${sharpenEnabled ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                {sharpenEnabled && (
                  <div className="pl-6">
                    <div className="flex items-center justify-between mb-1"><span className="text-[8px] font-mono text-muted-foreground">INTENSITY</span><span className="text-[8px] font-mono text-primary">{sharpenValue}%</span></div>
                    <input type="range" min={0} max={100} value={sharpenValue} onChange={e => setSharpenValue(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-[hsl(190,30%,18%)] rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary" />
                  </div>
                )}
              </div>
            </div>

            <div className="px-3 py-2.5 border-b border-[hsl(190,60%,12%)]">
              <span className="text-[9px] font-mono text-muted-foreground tracking-[0.15em] mb-1.5 block">LAYOUT PRESET</span>
              <div className="flex gap-1.5">
                {(["TACTICAL", "STRATEGIC", "MINIMAL"] as const).map(p => (
                  <button key={p} onClick={() => setLayoutPreset(p)} className={`flex-1 px-1.5 py-1.5 rounded text-[9px] font-mono font-bold border transition-colors ${layoutPreset === p ? "border-primary/50 bg-primary/15 text-primary" : "border-[hsl(220,15%,18%)] text-muted-foreground hover:text-foreground hover:border-[hsl(220,15%,25%)]"}`}>{p}</button>
                ))}
              </div>
            </div>

            <div className="px-3 py-2.5 border-b border-[hsl(190,60%,12%)]">
              <div className="flex items-center gap-1.5 mb-2"><div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" /><span className="text-[10px] font-mono text-[#22c55e] tracking-[0.15em] font-bold">PANOPTIC CONTROL</span></div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-mono text-muted-foreground">DENSITY</span><span className="text-[9px] font-mono text-primary font-bold">{panopticDensity}%</span></div>
                  <input type="range" min={10} max={100} value={panopticDensity} onChange={e => setPanopticDensity(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-[hsl(190,30%,18%)] rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#22c55e]" />
                </div>
                {[
                  { label: "Flights", value: panopticFlights, set: setPanopticFlights, icon: <Plane className="h-3 w-3" /> },
                  { label: "Satellites", value: panopticSats, set: setPanopticSats, icon: <Satellite className="h-3 w-3" /> },
                  { label: "Maritime", value: panopticMaritime, set: setPanopticMaritime, icon: <Ship className="h-3 w-3" /> },
                ].map(t => (
                  <div key={t.label} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5">{t.icon}<span className="text-[9px] font-mono text-muted-foreground">{t.label}</span></div>
                    <button onClick={() => t.set(!t.value)} className="w-8 h-4 rounded-full transition-colors relative" style={{ backgroundColor: t.value ? "#22c55e" : "hsl(220,15%,20%)" }}>
                      <div className={`w-3 h-3 rounded-full bg-foreground transition-transform absolute top-0.5 ${t.value ? "left-[14px]" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,12%)]">
              <button onClick={() => setCleanUI(true)} className="w-full px-2 py-1.5 rounded text-[9px] font-mono tracking-wider border border-[hsl(220,15%,18%)] text-muted-foreground hover:bg-[hsl(220,15%,12%)] hover:text-foreground transition-colors text-center">CLEAN UI</button>
            </div>

            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,12%)] bg-[hsl(220,20%,6%)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-[#f97316]" /><span className="text-[9px] font-bold tracking-[0.15em] text-foreground uppercase font-mono">EVENT FEED</span></div>
                <span className="text-[8px] font-mono text-primary">{unifiedFeed.length}</span>
              </div>
            </div>

            <div ref={feedRef} className="flex-1 overflow-y-auto">
              {unifiedFeed.map(ev => (
                <button key={ev.id} onClick={() => handleFeedClick(ev.lat, ev.lng)}
                  className={`w-full text-left px-2 py-1.5 border-b border-[hsl(220,15%,10%)] border-l-2 ${getSeverityBorder(ev.severity)} hover:bg-[hsl(190,20%,10%)] transition-colors`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono font-bold truncate flex items-center gap-1" style={{ color: ev.color }}>
                      <span className="text-[10px]">{ev.icon}</span> {ev.type.toUpperCase()}
                    </span>
                    <span className="text-[7px] font-mono text-muted-foreground flex-shrink-0 ml-1">{ev.source}</span>
                  </div>
                  <div className="text-[8px] font-mono text-foreground/80 truncate mt-0.5">{ev.label}</div>
                  <div className="text-[7px] font-mono text-muted-foreground mt-0.5">{new Date(ev.ts).toISOString().slice(11, 19)} UTC • {ev.lat.toFixed(2)}°, {ev.lng.toFixed(2)}°</div>
                </button>
              ))}
              {unifiedFeed.length === 0 && <div className="px-3 py-4 text-center text-[9px] font-mono text-muted-foreground">No events in window</div>}
            </div>
          </div>
        )}
      </div>

      {cleanUI && (
        <button onClick={() => setCleanUI(false)} className="fixed bottom-20 right-4 z-[10001] px-3 py-1.5 rounded bg-[hsl(220,20%,7%)/0.8] backdrop-blur border border-[hsl(190,60%,18%)] text-[9px] font-mono text-primary hover:bg-primary/10 transition-colors">RESTORE UI</button>
      )}

      {/* BOTTOM TIMELINE */}
      {!cleanUI && (
        <div className="flex-shrink-0 bg-[hsl(220,20%,6%)] border-t border-[hsl(190,60%,15%)]">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button onClick={() => setPlaying(!playing)} className="flex items-center justify-center h-6 w-6 rounded border border-[hsl(190,60%,20%)] text-primary hover:bg-primary/10 transition-colors">
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
              <button key={s} onClick={() => setSpeed(s)} className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${speed === s ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>{s}</button>
            ))}
            <div className="w-px h-3 bg-[hsl(220,15%,15%)] mx-1" />
            <span className="text-[8px] font-mono text-muted-foreground tracking-[0.15em]">ORBIT:</span>
            {orbitOptions.map(o => (
              <button key={o} onClick={() => setOrbitMode(o)} className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${orbitMode === o ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>{o}</button>
            ))}
            <div className="flex-1" />
            <span className="text-[8px] font-mono text-muted-foreground">{unifiedFeed.length} EVENTS</span>
          </div>

          <div className="flex items-center gap-1 px-3 py-1 border-t border-[hsl(220,15%,10%)] flex-wrap">
            {chipLayers.map(chip => (
              <button key={chip.id} onClick={() => toggleLayer(chip.id)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${layers[chip.id] ? "border-primary/40 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground hover:text-foreground"}`}>
                {chip.icon} {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
