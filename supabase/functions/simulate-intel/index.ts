import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MARITIME_CORRIDORS = [
  { latMin: 23.5, latMax: 30.8, lngMin: 47.5, lngMax: 56.8 },
  { latMin: 22.0, latMax: 27.8, lngMin: 55.8, lngMax: 62.8 },
  { latMin: 12.0, latMax: 30.8, lngMin: 32.0, lngMax: 43.8 },
  { latMin: 30.0, latMax: 33.6, lngMin: 31.8, lngMax: 33.2 },
  { latMin: 31.0, latMax: 37.2, lngMin: 33.2, lngMax: 36.8 },
  { latMin: 36.3, latMax: 47.2, lngMin: 47.0, lngMax: 54.8 },
  { latMin: 10.0, latMax: 15.0, lngMin: 42.0, lngMax: 52.0 },
  { latMin: 33.0, latMax: 41.0, lngMin: 24.0, lngMax: 36.0 },
  { latMin: 20.0, latMax: 30.0, lngMin: 58.0, lngMax: 68.0 },
];

function isInWater(lat: number, lng: number): boolean {
  return MARITIME_CORRIDORS.some(
    (c) => lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax
  );
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Baghdad: { lat: 33.31, lng: 44.37 },
  Tehran: { lat: 35.69, lng: 51.39 },
  Beirut: { lat: 33.89, lng: 35.50 },
  Damascus: { lat: 33.51, lng: 36.29 },
  Amman: { lat: 31.95, lng: 35.93 },
  Gaza: { lat: 31.50, lng: 34.47 },
  Jerusalem: { lat: 31.77, lng: 35.23 },
  "Tel Aviv": { lat: 32.07, lng: 34.78 },
  Mosul: { lat: 36.34, lng: 43.13 },
  Aleppo: { lat: 36.20, lng: 37.15 },
  Erbil: { lat: 36.19, lng: 44.01 },
  Riyadh: { lat: 24.71, lng: 46.67 },
  Dubai: { lat: 25.20, lng: 55.27 },
  "Abu Dhabi": { lat: 24.45, lng: 54.65 },
  Doha: { lat: 25.29, lng: 51.53 },
  "Kuwait City": { lat: 29.38, lng: 47.99 },
  Muscat: { lat: 23.59, lng: 58.54 },
  Manama: { lat: 26.23, lng: 50.59 },
  Cairo: { lat: 30.04, lng: 31.24 },
  Sanaa: { lat: 15.37, lng: 44.21 },
  Aden: { lat: 12.79, lng: 45.04 },
  Khartoum: { lat: 15.60, lng: 32.53 },
  Djibouti: { lat: 11.59, lng: 43.15 },
  Idlib: { lat: 35.93, lng: 36.63 },
  Homs: { lat: 34.73, lng: 36.72 },
  Basra: { lat: 30.51, lng: 47.81 },
  Kirkuk: { lat: 35.47, lng: 44.39 },
  Rafah: { lat: 31.28, lng: 34.25 },
  "Khan Younis": { lat: 31.34, lng: 34.30 },
  Hodeidah: { lat: 14.80, lng: 42.95 },
  Marib: { lat: 15.46, lng: 45.32 },
  "Deir ez-Zor": { lat: 35.34, lng: 40.14 },
  Haifa: { lat: 32.79, lng: 34.99 },
  Tabriz: { lat: 38.08, lng: 46.29 },
  Isfahan: { lat: 32.65, lng: 51.68 },
};

const cityNames = Object.keys(CITY_COORDS);

const CITY_COUNTRY: Record<string, string> = {
  Baghdad: "Iraq", Tehran: "Iran", Beirut: "Lebanon", Damascus: "Syria",
  Amman: "Jordan", Gaza: "Palestine", Jerusalem: "Israel", "Tel Aviv": "Israel",
  Mosul: "Iraq", Aleppo: "Syria", Erbil: "Iraq", Riyadh: "Saudi Arabia",
  Dubai: "UAE", "Abu Dhabi": "UAE", Doha: "Qatar", "Kuwait City": "Kuwait",
  Muscat: "Oman", Manama: "Bahrain", Cairo: "Egypt",
  Sanaa: "Yemen", Aden: "Yemen", Khartoum: "Sudan", Djibouti: "Djibouti",
  Idlib: "Syria", Homs: "Syria", Basra: "Iraq", Kirkuk: "Iraq",
  Rafah: "Palestine", "Khan Younis": "Palestine", Hodeidah: "Yemen",
  Marib: "Yemen", "Deir ez-Zor": "Syria", Haifa: "Israel",
  Tabriz: "Iran", Isfahan: "Iran",
};

const geoTypes = ["DIPLOMATIC", "MILITARY", "ECONOMIC", "HUMANITARIAN"] as const;
const severities = ["low", "medium", "high", "critical"] as const;
const airspaceTypes = ["NOTAM", "TFR", "CLOSURE"] as const;
const rocketTypes = ["Ballistic", "Cruise", "SRBM", "MRBM", "Drone"] as const;
const rocketStatuses = ["launched", "in_flight"] as const;

const EVENT_TYPES_BY_GEO: Record<string, string[]> = {
  MILITARY: ["airstrike", "explosion", "missile_launch", "drone_incursion", "artillery_barrage", "ground_offensive", "naval_engagement"],
  DIPLOMATIC: ["diplomatic_incident", "sanctions_update", "ceasefire_violation", "embassy_alert", "peace_talks"],
  ECONOMIC: ["naval_movement", "vessel_interdiction", "port_closure", "trade_disruption", "oil_price_impact"],
  HUMANITARIAN: ["mass_gathering", "protest", "refugee_flow", "humanitarian_crisis", "medical_emergency"],
};

const CYBER_SIGINT_NUCLEAR_TYPES = [
  "cyber_intrusion", "network_breach", "gps_jamming", "sigint_intercept",
  "nuclear_activity", "centrifuge_anomaly", "electronic_warfare",
];

const verificationStatuses = ["unverified", "auto_detected", "verified"] as const;
const eventSeverities = ["info", "low", "medium", "high", "critical"] as const;

// Dynamic, contextual title templates — use %CITY%, %REGION%, %TIME% placeholders
const dynamicTitles: Record<string, string[]> = {
  MILITARY: [
    "Multiple airstrikes reported in %CITY% targeting military positions",
    "UAV incursion detected over %CITY% airspace at %TIME%",
    "Anti-aircraft systems activated near %CITY% military base",
    "Ground forces movement detected %CITY% — %REGION% axis",
    "Incoming fire reported at %CITY% outskirts, IDF/militia response underway",
    "SAM battery activated near %CITY% — threat assessment underway",
    "Artillery exchange reported along %CITY%-%REGION% front line",
    "Military helicopter operations observed above %CITY%",
    "Suspected IED detonation on highway near %CITY%",
    "Sniper activity reported in %CITY% contested zone",
    "Forward operating base shelled near %CITY%",
    "Armored vehicle convoy spotted moving toward %CITY%",
    "Drone swarm activity detected over %CITY% at %TIME%",
    "Counter-battery fire directed at positions near %CITY%",
    "Special forces operation reported in %CITY% urban area",
  ],
  DIPLOMATIC: [
    "Emergency diplomatic consultations convened regarding %CITY% crisis",
    "Ambassador recalled from %REGION% amid escalating tensions",
    "UN envoy dispatched to %CITY% for de-escalation talks",
    "New sanctions package announced targeting %REGION% entities",
    "Ceasefire negotiations in %CITY% stall over key demands",
    "Diplomatic corridor established between %CITY% and %REGION%",
    "Emergency evacuation order for embassy staff in %CITY%",
    "International mediation effort launched for %REGION% conflict",
  ],
  ECONOMIC: [
    "Fuel supply disruption reported at %CITY% distribution hub",
    "%REGION% currency drops amid regional security concerns",
    "Port operations at %CITY% suspended — threat assessment ongoing",
    "Trade routes through %REGION% rerouted — costs surge 40%",
    "Power grid disruption reported in %CITY% metropolitan area",
    "Food supply chain disrupted along %CITY%-%REGION% corridor",
    "Insurance premiums spike for %REGION% maritime transit",
    "Banking system disruption reported in %CITY%",
  ],
  HUMANITARIAN: [
    "Mass displacement from %CITY% — %REGION% conflict zone reported",
    "Aid convoy blocked at %CITY% checkpoint — urgent intervention needed",
    "Hospital capacity exceeded in %CITY% — casualties mounting",
    "Refugee flow detected toward %CITY% border crossing at %TIME%",
    "Water infrastructure damaged by shelling in %CITY%",
    "Civilian evacuation underway from %CITY% neighborhoods",
    "Medical supply shortage reaches critical level in %CITY%",
    "Emergency shelter deployment activated in %CITY%",
    "UNRWA reports deteriorating conditions in %CITY% camps",
    "Humanitarian corridor requested for %CITY% civilian population",
  ],
};

const airspaceDescriptions = [
  "NOTAM issued — active military operations near %CITY%",
  "Temporary flight restriction in effect — %CITY% sector",
  "Airspace closure — security operations ongoing near %CITY%",
  "Restricted zone expanded — UAV threat detected over %CITY%",
  "Flight advisory — missile defense activation near %CITY%",
  "Emergency airspace restriction — active threat assessment %CITY%",
  "No-fly zone enforced — hostile drone activity near %CITY%",
  "Air traffic rerouted — %CITY% area military operations",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function generateTitle(geoType: string, city: string): string {
  const templates = dynamicTitles[geoType] || dynamicTitles.MILITARY;
  const template = pick(templates);
  const otherCity = pick(cityNames.filter(c => c !== city));
  const now = new Date();
  const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}Z`;
  return template
    .replace(/%CITY%/g, city)
    .replace(/%REGION%/g, CITY_COUNTRY[city] || otherCity)
    .replace(/%TIME%/g, timeStr);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();
  const actions: string[] = [];

  // 1. Drift a vessel
  const vesselId = `v-00${Math.ceil(Math.random() * 8)}`;
  const { data: currentVessel } = await supabase.from("vessels").select("lat,lng,heading,speed").eq("id", vesselId).single();
  if (currentVessel) {
    const headingRad = (currentVessel.heading || 0) * Math.PI / 180;
    const drift = 0.02 + Math.random() * 0.08;
    const newLat = currentVessel.lat + drift * Math.cos(headingRad);
    const newLng = currentVessel.lng + drift * Math.sin(headingRad);

    if (isInWater(newLat, newLng)) {
      const headingDrift = (Math.random() - 0.5) * 10;
      await supabase.from("vessels").update({
        lat: newLat, lng: newLng,
        heading: Math.round(((currentVessel.heading + headingDrift) % 360 + 360) % 360 * 10) / 10,
        speed: rand(5, 22), timestamp: now,
      }).eq("id", vesselId);
      actions.push(`Drifted vessel ${vesselId}`);
    } else {
      const reversedHeading = (currentVessel.heading + 180) % 360;
      const revLat = currentVessel.lat + drift * Math.cos(reversedHeading * Math.PI / 180);
      const revLng = currentVessel.lng + drift * Math.sin(reversedHeading * Math.PI / 180);
      if (isInWater(revLat, revLng)) {
        await supabase.from("vessels").update({
          lat: revLat, lng: revLng, heading: reversedHeading,
          speed: rand(5, 22), timestamp: now,
        }).eq("id", vesselId);
      } else {
        await supabase.from("vessels").update({
          heading: reversedHeading, speed: rand(3, 10), timestamp: now,
        }).eq("id", vesselId);
      }
      actions.push(`Vessel ${vesselId} course corrected`);
    }
  }

  // 2. Geo alerts — 2-3 cities with dynamic titles
  const shuffled = [...cityNames].sort(() => Math.random() - 0.5);
  const numCities = 2 + Math.floor(Math.random() * 2);
  const selectedCities = shuffled.slice(0, numCities);

  for (const cityName of selectedCities) {
    const coords = CITY_COORDS[cityName];
    const geoType = pick(geoTypes);
    const severity = pick(severities);
    const alertId = `ga-live-${cityName.replace(/\s/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const lat = coords.lat + (Math.random() - 0.5) * 0.1;
    const lng = coords.lng + (Math.random() - 0.5) * 0.1;
    const title = generateTitle(geoType, cityName);

    await supabase.from("geo_alerts").insert({
      id: alertId, type: geoType, region: cityName,
      title: `[${cityName}] ${title}`,
      summary: `Live monitoring — ${CITY_COUNTRY[cityName] || "Unknown"} sector. ${title}`,
      severity, source: "WarOS Auto-Monitor", timestamp: now, lat, lng,
    });

    const teId = `te-live-${cityName.replace(/\s/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const teTypes = ["airspace", "maritime", "alert", "diplomatic"] as const;
    const teType = geoType === "MILITARY" ? "alert" : geoType === "DIPLOMATIC" ? "diplomatic" : geoType === "ECONOMIC" ? "maritime" : pick(teTypes);
    await supabase.from("timeline_events").insert({
      id: teId, type: teType, title: `[${cityName}] ${title}`,
      severity, timestamp: now,
    });
    actions.push(`Alert: ${cityName} (${geoType})`);
  }

  // 3. Intel events — 2-3 per cycle with diverse types
  const numIntelEvents = 2 + Math.floor(Math.random() * 2);
  const intelCities = [...cityNames].sort(() => Math.random() - 0.5).slice(0, numIntelEvents);

  for (const cityName of intelCities) {
    const coords = CITY_COORDS[cityName];
    const geoType = pick(geoTypes);
    const lat = coords.lat + (Math.random() - 0.5) * 0.15;
    const lng = coords.lng + (Math.random() - 0.5) * 0.15;

    const eventType = Math.random() < 0.8
      ? pick(EVENT_TYPES_BY_GEO[geoType])
      : pick(CYBER_SIGINT_NUCLEAR_TYPES);

    const title = generateTitle(geoType, cityName);
    const confidence = Math.round((0.4 + Math.random() * 0.55) * 100) / 100;
    const severity = pick(eventSeverities);
    const verification = pick(verificationStatuses);

    await supabase.from("intel_events").insert({
      title,
      event_type: eventType,
      city: cityName,
      country: CITY_COUNTRY[cityName] || "Unknown",
      lat, lng, severity, confidence,
      verification_status: verification,
      summary: `Intel: ${eventType.replace(/_/g, " ")} — ${cityName}, ${CITY_COUNTRY[cityName] || ""}. Confidence ${Math.round(confidence * 100)}%. ${title}`,
      created_at: now, updated_at: now,
    });
    actions.push(`Intel event: ${cityName} (${eventType})`);
  }

  // 4. Airspace alerts
  const numAirspace = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numAirspace; i++) {
    const city = pick(cityNames);
    const coords = CITY_COORDS[city];
    const aaId = `aa-live-${city.replace(/\s/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const desc = pick(airspaceDescriptions).replace(/%CITY%/g, city);
    await supabase.from("airspace_alerts").insert({
      id: aaId,
      type: pick(airspaceTypes), region: city,
      lat: coords.lat + (Math.random() - 0.5) * 0.2,
      lng: coords.lng + (Math.random() - 0.5) * 0.2,
      radius: rand(5, 50), severity: pick(severities),
      description: desc, timestamp: now, active: true,
    });
    actions.push(`Airspace: ${city}`);
  }

  // 5. Rockets — transition active, 40% chance new launch
  const { data: activeRockets } = await supabase
    .from("rockets").select("*").like("id", "rk-live-%")
    .in("status", ["launched", "in_flight"]);

  if (activeRockets) {
    for (const rocket of activeRockets) {
      const newStatus = Math.random() < 0.5 ? "intercepted" : (rocket.status === "launched" ? "in_flight" : "impact");
      const progress = newStatus === "in_flight" ? 0.5 : 1.0;
      await supabase.from("rockets").update({
        status: newStatus,
        current_lat: rocket.origin_lat + (rocket.target_lat - rocket.origin_lat) * progress,
        current_lng: rocket.origin_lng + (rocket.target_lng - rocket.origin_lng) * progress,
        altitude: newStatus === "in_flight" ? rand(50, 200) : 0,
        speed: newStatus === "in_flight" ? rand(800, 2400) : 0,
        timestamp: now,
      }).eq("id", rocket.id);
      actions.push(`Rocket ${rocket.id} → ${newStatus}`);
    }
  }

  if (Math.random() < 0.4) {
    const originCity = pick(cityNames);
    const targetCity = pick(cityNames.filter(c => c !== originCity));
    const oCoords = CITY_COORDS[originCity];
    const tCoords = CITY_COORDS[targetCity];
    const rkId = `rk-live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const status = pick(rocketStatuses);
    const progress = status === "launched" ? 0.1 : 0.4;
    await supabase.from("rockets").insert({
      id: rkId,
      name: `${pick(rocketTypes)}-${Math.floor(Math.random() * 900 + 100)}`,
      type: pick(rocketTypes),
      origin_lat: oCoords.lat, origin_lng: oCoords.lng,
      target_lat: tCoords.lat, target_lng: tCoords.lng,
      current_lat: oCoords.lat + (tCoords.lat - oCoords.lat) * progress,
      current_lng: oCoords.lng + (tCoords.lng - oCoords.lng) * progress,
      status,
      severity: pick(["high", "critical"] as const),
      speed: rand(600, 2400), altitude: rand(30, 180), timestamp: now,
    });
    actions.push(`Launched rocket from ${originCity} → ${targetCity}`);
  }

  // 6. Risk scores
  const { data: currentRisk } = await supabase
    .from("risk_scores").select("*")
    .order("last_updated", { ascending: false }).limit(1).single();

  if (currentRisk) {
    const nudge = (v: number) => Math.max(0, Math.min(100, v + Math.floor(Math.random() * 11) - 5));
    const newOverall = nudge(currentRisk.overall);
    await supabase.from("risk_scores").update({
      overall: newOverall,
      airspace: nudge(currentRisk.airspace),
      maritime: nudge(currentRisk.maritime),
      diplomatic: nudge(currentRisk.diplomatic),
      sentiment: nudge(currentRisk.sentiment),
      trend: newOverall > currentRisk.overall ? "rising" : newOverall < currentRisk.overall ? "falling" : "stable",
      last_updated: now,
    }).eq("id", currentRisk.id);
    actions.push("Updated risk scores");
  }

  // 7. Pruning — keep data fresh
  const pruneTargets = [
    { table: "geo_alerts", prefix: "ga-live-%", limit: 100, orderCol: "timestamp" },
    { table: "timeline_events", prefix: "te-live-%", limit: 80, orderCol: "timestamp" },
    { table: "airspace_alerts", prefix: "aa-live-%", limit: 30, orderCol: "timestamp" },
    { table: "rockets", prefix: "rk-live-%", limit: 15, orderCol: "timestamp" },
    { table: "intel_events", prefix: null, limit: 100, orderCol: "created_at" },
  ];

  for (const target of pruneTargets) {
    let query = supabase.from(target.table).select("id");
    if (target.prefix) query = query.like("id", target.prefix);
    const { data: rows } = await query.order(target.orderCol, { ascending: false });
    if (rows && rows.length > target.limit) {
      const toDelete = rows.slice(target.limit).map((r: any) => r.id);
      await supabase.from(target.table).delete().in("id", toDelete);
      actions.push(`Pruned ${toDelete.length} from ${target.table}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, actions, ts: now }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
