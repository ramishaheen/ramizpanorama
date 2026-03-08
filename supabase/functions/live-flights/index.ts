import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =====================================================================
// COMPREHENSIVE MILITARY DETECTION
// =====================================================================

const MILITARY_CALLSIGN_PREFIXES = [
  // US Military
  "RCH", "DOOM", "EVAC", "NAVY", "USAF", "REACH", "IRON", "STEEL",
  "VIPER", "HAWK", "EAGLE", "COBRA", "REAPER", "FORTE", "JAKE",
  "NCHO", "PAT", "DUKE", "KING", "TOPCT", "ORDER", "GHOST",
  "BULL", "HAVOC", "TEAL", "SNTRY", "ARROW", "ATLAS", "BISON",
  "BLADE", "BOXER", "BRASS", "CADDY", "DECOY", "FLASH", "GOFER",
  "GUARD", "HYPER", "LANCE", "MAGMA", "NOBLE", "OMEGA", "POLAR",
  "QUICK", "RACER", "SKULL", "TORCH", "VADER", "WOLF", "ZIPPY",
  "CRZR", "EPIC", "FURY", "RAMBO", "RAVEN", "RAZOR", "STORM",
  // NATO / Europe
  "RAF", "RFR", "FAF", "GAF", "CNV", "BAF", "HAF", "MMIL",
  "IAM", "SAF", "NAF", "RNO", "SWAF", "DNAF", "CZAF", "PLAF",
  "TUAF", "PGAF", "BLKH", "NATO",
  // Israel
  "IAF", "ASDF",
  // Russia / CIS
  "RFF", "RSD", "RUS",
  // Middle East
  "RSAF", "QAF", "UAEF", "KAAF", "IQAF", "IRAF",
  // Asia
  "JASDF", "ROKAF", "PAF", "PLAAF", "IAF", "SLAF",
  // Global patterns
  "MIL", "MLTR",
];

const MILITARY_REGISTRATIONS = /^(1[0-9]{4}|0[0-9]{4}|[0-9]{2}-[0-9]{4}|[A-Z]{2,3}-[0-9]{3,4}|ZK|XV|XR|XS|XW|XZ|ZA|ZD|ZE|ZF|ZG|ZH|ZJ|ZK|ZM)/;

const MILITARY_AIRCRAFT_TYPES = new Set([
  // Fighters
  "F16", "F15", "F18", "FA18", "F22", "F35", "F4", "F5",
  "EUFI", "EF2K", "RFAL", "GR4", "GR9", "M2KC", "SU27", "SU30",
  "SU34", "SU35", "MG29", "MG31", "J10", "J11", "J16", "J20",
  // Bombers
  "B1", "B2", "B52", "TU95", "TU160", "TU22M",
  // Transport Military
  "C130", "C17", "C5", "C2A", "A400", "C295", "KC10", "KC46",
  "KC135", "KC30", "KC767", "IL76", "AN12", "AN22", "AN124", "AN225",
  "Y20", "C2",
  // ISR / Surveillance
  "E3", "E8", "RC135", "U2", "RQ4", "MQ9", "MQ1", "GLBX", "P8",
  "P3", "E2", "E7", "G550",
  // Helicopters Military
  "H60", "H64", "AH1", "UH60", "CH47", "MH53", "V22", "MI24",
  "MI28", "KA52", "MI8", "MI17",
  // Tankers
  "MRTT", "A330",
  // Trainers
  "T38", "T6", "PC21", "M346", "L39", "YAK130", "T50",
]);

function isMilitaryCallsign(cs: string): boolean {
  if (!cs) return false;
  const upper = cs.toUpperCase().trim();
  for (const prefix of MILITARY_CALLSIGN_PREFIXES) {
    if (upper.startsWith(prefix)) return true;
  }
  // Numeric-heavy callsigns common in military (e.g., "60125")
  if (/^[0-9]{5,6}$/.test(upper)) return true;
  return false;
}

function isMilitaryAircraft(ac: { callsign?: string; type?: string; registration?: string; dbFlags?: number }): boolean {
  if (ac.dbFlags === 1) return true;
  if (ac.callsign && isMilitaryCallsign(ac.callsign)) return true;
  if (ac.type && MILITARY_AIRCRAFT_TYPES.has(ac.type.toUpperCase().replace(/[- ]/g, ""))) return true;
  if (ac.registration && MILITARY_REGISTRATIONS.test(ac.registration)) return true;
  return false;
}

// =====================================================================
// OSINT DATA SOURCES
// =====================================================================

interface RawAircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  registration: string;
  type: string;
  lat: number;
  lng: number;
  altitude: number;
  on_ground: boolean;
  velocity: number;
  heading: number;
  vertical_rate: number;
  squawk: string;
  is_military: boolean;
  source: string;
}

// 1) adsb.fi — Primary (best quality, includes military flag)
async function fetchAdsbFi(lamin: number, lamax: number, lomin: number, lomax: number): Promise<RawAircraft[]> {
  const centerLat = (lamin + lamax) / 2;
  const centerLon = (lomin + lomax) / 2;
  const latDiffKm = (lamax - lamin) * 111;
  const lonDiffKm = (lomax - lomin) * 111 * Math.cos(centerLat * Math.PI / 180);
  const radiusNm = Math.min(Math.round(Math.sqrt(latDiffKm ** 2 + lonDiffKm ** 2) / 2 / 1.852), 250);

  const url = `https://opendata.adsb.fi/api/v3/lat/${centerLat.toFixed(4)}/lon/${centerLon.toFixed(4)}/dist/${radiusNm}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`adsb.fi ${res.status}`);
  const data = await res.json();

  return (data.ac || []).map((ac: any) => ({
    icao24: (ac.hex || "").toLowerCase(),
    callsign: (ac.flight || "").trim(),
    origin_country: ac.r || "",
    registration: ac.r || "",
    type: ac.t || "",
    lat: ac.lat,
    lng: ac.lon,
    altitude: ac.alt_baro !== "ground" ? (ac.alt_baro || ac.alt_geom || 0) * 0.3048 : 0,
    on_ground: ac.alt_baro === "ground",
    velocity: ac.gs != null ? ac.gs * 0.514444 : 0,
    heading: ac.track || ac.true_heading || 0,
    vertical_rate: ac.baro_rate != null ? ac.baro_rate * 0.00508 : 0,
    squawk: ac.squawk || "",
    is_military: isMilitaryAircraft({ callsign: (ac.flight || "").trim(), type: ac.t, registration: ac.r, dbFlags: ac.dbFlags }),
    source: "adsb.fi",
  })).filter((a: RawAircraft) => a.lat != null && a.lng != null && !a.on_ground);
}

// 2) OpenSky Network — Secondary (academic, free)
async function fetchOpenSky(lamin: number, lamax: number, lomin: number, lomax: number): Promise<RawAircraft[]> {
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const data = await res.json();

  return (data.states || []).map((s: any[]) => ({
    icao24: (s[0] || "").toLowerCase(),
    callsign: (s[1] || "").trim(),
    origin_country: s[2] || "",
    registration: "",
    type: "",
    lat: s[6],
    lng: s[5],
    altitude: s[7] || s[13] || 0,
    on_ground: s[8],
    velocity: s[9] || 0,
    heading: s[10] || 0,
    vertical_rate: s[11] || 0,
    squawk: s[14] || "",
    is_military: isMilitaryCallsign((s[1] || "").trim()),
    source: "opensky",
  })).filter((a: RawAircraft) => a.lat != null && a.lng != null && !a.on_ground);
}

// 3) adsb.lol — Community-powered, unfiltered, ADS-B Exchange compatible
async function fetchAdsbLol(lamin: number, lamax: number, lomin: number, lomax: number): Promise<RawAircraft[]> {
  const centerLat = (lamin + lamax) / 2;
  const centerLon = (lomin + lomax) / 2;
  const latDiffKm = (lamax - lamin) * 111;
  const lonDiffKm = (lomax - lomin) * 111 * Math.cos(centerLat * Math.PI / 180);
  const radiusNm = Math.min(Math.round(Math.sqrt(latDiffKm ** 2 + lonDiffKm ** 2) / 2 / 1.852), 250);

  const url = `https://api.adsb.lol/v2/lat/${centerLat.toFixed(4)}/lon/${centerLon.toFixed(4)}/dist/${radiusNm}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const data = await res.json();

  return (data.ac || []).map((ac: any) => ({
    icao24: (ac.hex || "").toLowerCase(),
    callsign: (ac.flight || "").trim(),
    origin_country: ac.r || "",
    registration: ac.r || "",
    type: ac.t || "",
    lat: ac.lat,
    lng: ac.lon,
    altitude: ac.alt_baro !== "ground" ? (ac.alt_baro || ac.alt_geom || 0) * 0.3048 : 0,
    on_ground: ac.alt_baro === "ground",
    velocity: ac.gs != null ? ac.gs * 0.514444 : 0,
    heading: ac.track || ac.true_heading || 0,
    vertical_rate: ac.baro_rate != null ? ac.baro_rate * 0.00508 : 0,
    squawk: ac.squawk || "",
    is_military: isMilitaryAircraft({ callsign: (ac.flight || "").trim(), type: ac.t, registration: ac.r, dbFlags: ac.dbFlags }),
    source: "adsb.lol",
  })).filter((a: RawAircraft) => a.lat != null && a.lng != null && !a.on_ground);
}

// 4) Airplanes.live — Community-driven, unfiltered military data
async function fetchAirplanesLive(lamin: number, lamax: number, lomin: number, lomax: number): Promise<RawAircraft[]> {
  const centerLat = (lamin + lamax) / 2;
  const centerLon = (lomin + lomax) / 2;
  const latDiffKm = (lamax - lamin) * 111;
  const lonDiffKm = (lomax - lomin) * 111 * Math.cos(centerLat * Math.PI / 180);
  const radiusNm = Math.min(Math.round(Math.sqrt(latDiffKm ** 2 + lonDiffKm ** 2) / 2 / 1.852), 250);

  const url = `https://api.airplanes.live/v2/point/${centerLat.toFixed(4)}/${centerLon.toFixed(4)}/${radiusNm}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`airplanes.live ${res.status}`);
  const data = await res.json();

  return (data.ac || []).map((ac: any) => ({
    icao24: (ac.hex || "").toLowerCase(),
    callsign: (ac.flight || "").trim(),
    origin_country: ac.r || "",
    registration: ac.r || "",
    type: ac.t || "",
    lat: ac.lat,
    lng: ac.lon,
    altitude: ac.alt_baro !== "ground" ? (ac.alt_baro || ac.alt_geom || 0) * 0.3048 : 0,
    on_ground: ac.alt_baro === "ground",
    velocity: ac.gs != null ? ac.gs * 0.514444 : 0,
    heading: ac.track || ac.true_heading || 0,
    vertical_rate: ac.baro_rate != null ? ac.baro_rate * 0.00508 : 0,
    squawk: ac.squawk || "",
    is_military: isMilitaryAircraft({ callsign: (ac.flight || "").trim(), type: ac.t, registration: ac.r, dbFlags: ac.dbFlags }),
    source: "airplanes.live",
  })).filter((a: RawAircraft) => a.lat != null && a.lng != null && !a.on_ground);
}

// 5) Dedicated military-only fetch from adsb.fi
async function fetchAdsbFiMilitary(): Promise<RawAircraft[]> {
  const url = `https://opendata.adsb.fi/api/v3/mil`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`adsb.fi/mil ${res.status}`);
  const data = await res.json();

  return (data.ac || []).map((ac: any) => ({
    icao24: (ac.hex || "").toLowerCase(),
    callsign: (ac.flight || "").trim(),
    origin_country: ac.r || "",
    registration: ac.r || "",
    type: ac.t || "",
    lat: ac.lat,
    lng: ac.lon,
    altitude: ac.alt_baro !== "ground" ? (ac.alt_baro || ac.alt_geom || 0) * 0.3048 : 0,
    on_ground: ac.alt_baro === "ground",
    velocity: ac.gs != null ? ac.gs * 0.514444 : 0,
    heading: ac.track || ac.true_heading || 0,
    vertical_rate: ac.baro_rate != null ? ac.baro_rate * 0.00508 : 0,
    squawk: ac.squawk || "",
    is_military: true, // Dedicated military endpoint
    source: "adsb.fi/mil",
  })).filter((a: RawAircraft) => a.lat != null && a.lng != null && !a.on_ground);
}

// =====================================================================
// MERGE & DEDUPLICATE — Single source of truth
// =====================================================================

function mergeAircraft(sources: RawAircraft[][]): RawAircraft[] {
  const merged = new Map<string, RawAircraft>();
  
  // Priority order: adsb.fi > airplanes.live > adsb.lol > opensky
  // Later sources fill in gaps but don't overwrite richer data
  const priorityOrder = ["adsb.fi", "adsb.fi/mil", "airplanes.live", "adsb.lol", "opensky"];

  for (const source of sources) {
    for (const ac of source) {
      const key = ac.icao24;
      if (!key) continue;
      
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, ac);
      } else {
        // Keep higher priority source, but merge military flag (if ANY source says military, mark it)
        const existingPri = priorityOrder.indexOf(existing.source);
        const newPri = priorityOrder.indexOf(ac.source);
        
        if (ac.is_military && !existing.is_military) {
          existing.is_military = true;
        }

        // If new source has richer data (type/registration) and is higher/equal priority
        if (newPri <= existingPri) {
          if (ac.type && !existing.type) existing.type = ac.type;
          if (ac.registration && !existing.registration) existing.registration = ac.registration;
          if (ac.callsign && !existing.callsign) existing.callsign = ac.callsign;
        }
      }
    }
  }

  return Array.from(merged.values());
}

// =====================================================================
// MAIN HANDLER
// =====================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lamin, lamax, lomin, lomax } = await req.json();

    if (lamin == null || lamax == null || lomin == null || lomax == null) {
      return new Response(JSON.stringify({ error: "Missing bounding box parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire ALL sources in parallel — never block on one
    const results = await Promise.allSettled([
      fetchAdsbFi(lamin, lamax, lomin, lomax),
      fetchAirplanesLive(lamin, lamax, lomin, lomax),
      fetchAdsbLol(lamin, lamax, lomin, lomax),
      fetchOpenSky(lamin, lamax, lomin, lomax),
      fetchAdsbFiMilitary(), // Global military, no bbox filter needed
    ]);

    const sourceNames = ["adsb.fi", "airplanes.live", "adsb.lol", "opensky", "adsb.fi/mil"];
    const successSources: string[] = [];
    const allSources: RawAircraft[][] = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.length > 0) {
        allSources.push(r.value);
        successSources.push(`${sourceNames[i]}(${r.value.length})`);
        console.log(`✓ ${sourceNames[i]}: ${r.value.length} aircraft`);
      } else {
        const reason = r.status === "rejected" ? (r.reason?.message || "failed") : "0 results";
        console.log(`✗ ${sourceNames[i]}: ${reason}`);
      }
    });

    // For adsb.fi/mil, filter to bbox
    if (allSources.length > 4 && results[4].status === "fulfilled") {
      const milFiltered = (results[4] as PromiseFulfilledResult<RawAircraft[]>).value.filter(
        ac => ac.lat >= lamin && ac.lat <= lamax && ac.lng >= lomin && ac.lng <= lomax
      );
      // Replace the last source with filtered version
      if (allSources[allSources.length - 1]?.[0]?.source === "adsb.fi/mil") {
        allSources[allSources.length - 1] = milFiltered;
      }
    }

    // Merge & deduplicate into single unified feed
    const aircraft = mergeAircraft(allSources);
    const milCount = aircraft.filter(a => a.is_military).length;
    const civCount = aircraft.length - milCount;

    console.log(`=== UNIFIED: ${aircraft.length} total (${milCount} MIL, ${civCount} CIV) from [${successSources.join(", ")}] ===`);

    return new Response(JSON.stringify({
      aircraft,
      time: Date.now() / 1000,
      total: aircraft.length,
      military: milCount,
      civil: civCount,
      source: successSources.join("+"),
      sources_detail: successSources,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Live flights error:", e);
    return new Response(JSON.stringify({
      aircraft: [],
      time: Date.now() / 1000,
      total: 0,
      source: "error",
      error: e instanceof Error ? e.message : "Unknown",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
