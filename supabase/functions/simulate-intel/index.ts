import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Maritime corridors — vessels must stay within these water zones
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

// All Arab capitals + conflict cities with coords
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
  Algiers: { lat: 36.75, lng: 3.06 },
  Tunis: { lat: 36.81, lng: 10.18 },
  Rabat: { lat: 34.02, lng: -6.83 },
  Tripoli: { lat: 32.90, lng: 13.18 },
  Sanaa: { lat: 15.37, lng: 44.21 },
  Aden: { lat: 12.79, lng: 45.04 },
  Khartoum: { lat: 15.60, lng: 32.53 },
  Mogadishu: { lat: 2.05, lng: 45.32 },
  Djibouti: { lat: 11.59, lng: 43.15 },
};

const cityNames = Object.keys(CITY_COORDS);

// Country lookup for cities
const CITY_COUNTRY: Record<string, string> = {
  Baghdad: "Iraq", Tehran: "Iran", Beirut: "Lebanon", Damascus: "Syria",
  Amman: "Jordan", Gaza: "Palestine", Jerusalem: "Israel", "Tel Aviv": "Israel",
  Mosul: "Iraq", Aleppo: "Syria", Erbil: "Iraq", Riyadh: "Saudi Arabia",
  Dubai: "UAE", "Abu Dhabi": "UAE", Doha: "Qatar", "Kuwait City": "Kuwait",
  Muscat: "Oman", Manama: "Bahrain", Cairo: "Egypt", Algiers: "Algeria",
  Tunis: "Tunisia", Rabat: "Morocco", Tripoli: "Libya", Sanaa: "Yemen",
  Aden: "Yemen", Khartoum: "Sudan", Mogadishu: "Somalia", Djibouti: "Djibouti",
};

const geoTypes = ["DIPLOMATIC", "MILITARY", "ECONOMIC", "HUMANITARIAN"] as const;
const severities = ["low", "medium", "high", "critical"] as const;
const airspaceTypes = ["NOTAM", "TFR", "CLOSURE"] as const;
const rocketTypes = ["Ballistic", "Cruise", "SRBM", "MRBM", "Drone"] as const;
const rocketStatuses = ["launched", "in_flight"] as const;

// Event types mapped to Kill Chain categories
const EVENT_TYPES_BY_GEO: Record<string, string[]> = {
  MILITARY: ["airstrike", "explosion", "missile_launch", "drone_incursion", "artillery_barrage"],
  DIPLOMATIC: ["diplomatic_incident", "sanctions_update", "ceasefire_violation", "embassy_alert"],
  ECONOMIC: ["naval_movement", "vessel_interdiction", "port_closure", "trade_disruption"],
  HUMANITARIAN: ["mass_gathering", "protest", "refugee_flow", "humanitarian_crisis"],
};

const CYBER_SIGINT_NUCLEAR_TYPES = [
  "cyber_intrusion", "network_breach", "gps_jamming", "sigint_intercept",
  "nuclear_activity", "centrifuge_anomaly", "electronic_warfare",
];

const verificationStatuses = ["unverified", "auto_detected", "verified"] as const;
const eventSeverities = ["info", "low", "medium", "high", "critical"] as const;

const titles: Record<string, string[]> = {
  MILITARY: [
    "Airstrikes reported near city center",
    "Military convoy movement detected",
    "Anti-aircraft system activated",
    "Drone incursion detected over restricted zone",
    "Explosion reported near military base",
    "SAM battery activation detected",
    "Artillery fire reported on outskirts",
    "Military helicopter activity above city",
    "Sniper fire reported in contested area",
    "IED detonation on main highway",
  ],
  DIPLOMATIC: [
    "Emergency diplomatic meeting convened",
    "Ambassador recalled amid tensions",
    "UN envoy arrives for de-escalation talks",
    "Sanctions announced against local entities",
    "Ceasefire negotiations underway",
    "Diplomatic corridor established",
    "Embassy staff evacuation ordered",
    "Peace talks stalled over key demands",
  ],
  ECONOMIC: [
    "Fuel prices surge amid supply disruption",
    "Currency under pressure from regional instability",
    "Port operations suspended due to threat",
    "Trade route rerouted adding significant costs",
    "Banking sector faces liquidity concerns",
    "Power grid disruption reported",
    "Food supply chain disrupted by conflict",
    "Insurance premiums spike for regional transit",
  ],
  HUMANITARIAN: [
    "Mass displacement reported from conflict zone",
    "Aid convoy blocked at checkpoint",
    "Hospital capacity exceeded in city center",
    "Refugee flow detected toward border crossing",
    "Water infrastructure damaged by shelling",
    "Civilian evacuation order issued",
    "Medical supply shortage critical",
    "Emergency shelter deployment underway",
  ],
};

const airspaceDescriptions = [
  "NOTAM issued — military exercise in progress",
  "Temporary flight restriction active",
  "Airspace closure due to security operations",
  "Restricted zone expanded — UAV activity detected",
  "Flight advisory — missile defense test",
  "Emergency airspace restriction — active threat",
  "No-fly zone enforced — ongoing hostilities",
  "Air traffic rerouted — military operations",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
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

  // 1. Drift a vessel — with water validation
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
        lat: newLat,
        lng: newLng,
        heading: Math.round(((currentVessel.heading + headingDrift) % 360 + 360) % 360 * 10) / 10,
        speed: rand(5, 22),
        timestamp: now,
      }).eq("id", vesselId);
      actions.push(`Drifted vessel ${vesselId} (in water)`);
    } else {
      const reversedHeading = (currentVessel.heading + 180) % 360;
      const revLat = currentVessel.lat + drift * Math.cos(reversedHeading * Math.PI / 180);
      const revLng = currentVessel.lng + drift * Math.sin(reversedHeading * Math.PI / 180);
      if (isInWater(revLat, revLng)) {
        await supabase.from("vessels").update({
          lat: revLat, lng: revLng, heading: reversedHeading,
          speed: rand(5, 22), timestamp: now,
        }).eq("id", vesselId);
        actions.push(`Reversed vessel ${vesselId} (hit land boundary)`);
      } else {
        await supabase.from("vessels").update({
          heading: reversedHeading, speed: rand(3, 10), timestamp: now,
        }).eq("id", vesselId);
        actions.push(`Vessel ${vesselId} stuck, reversed heading only`);
      }
    }
  }

  // 2. Generate geo alerts for 2-3 random cities
  const selectedCities = [];
  const shuffled = [...cityNames].sort(() => Math.random() - 0.5);
  const numCities = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numCities && i < shuffled.length; i++) {
    selectedCities.push(shuffled[i]);
  }

  for (const cityName of selectedCities) {
    const coords = CITY_COORDS[cityName];
    const geoType = pick(geoTypes);
    const severity = pick(severities);
    const alertId = `ga-live-${cityName.replace(/\s/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const lat = coords.lat + (Math.random() - 0.5) * 0.1;
    const lng = coords.lng + (Math.random() - 0.5) * 0.1;

    await supabase.from("geo_alerts").insert({
      id: alertId, type: geoType, region: cityName,
      title: `[${cityName}] ${pick(titles[geoType])}`,
      summary: `Live intelligence update for ${cityName}. Automated monitoring detected activity change.`,
      severity, source: "WarOS Auto-Monitor", timestamp: now, lat, lng,
    });
    actions.push(`Inserted geo alert for ${cityName}`);

    const teId = `te-live-${cityName.replace(/\s/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const teTypes = ["airspace", "maritime", "alert", "diplomatic"] as const;
    const teType = geoType === "MILITARY" ? "alert" : geoType === "DIPLOMATIC" ? "diplomatic" : geoType === "ECONOMIC" ? "maritime" : pick(teTypes);
    await supabase.from("timeline_events").insert({
      id: teId, type: teType, title: `[${cityName}] ${pick(titles[geoType])}`,
      severity, timestamp: now,
    });
    actions.push(`Inserted timeline event for ${cityName}`);
  }

  // 2b. Generate intel_events (2-3 per cycle) for Events Feed + Kill Chain
  const numIntelEvents = 2 + Math.floor(Math.random() * 2);
  const intelCities = [...cityNames].sort(() => Math.random() - 0.5).slice(0, numIntelEvents);

  for (const cityName of intelCities) {
    const coords = CITY_COORDS[cityName];
    const geoType = pick(geoTypes);
    const lat = coords.lat + (Math.random() - 0.5) * 0.15;
    const lng = coords.lng + (Math.random() - 0.5) * 0.15;

    // 80% use geo-mapped types, 20% use cyber/sigint/nuclear for Kill Chain variety
    const eventType = Math.random() < 0.8
      ? pick(EVENT_TYPES_BY_GEO[geoType])
      : pick(CYBER_SIGINT_NUCLEAR_TYPES);

    const title = `[${cityName}] ${pick(titles[geoType])}`;
    const confidence = Math.round((0.4 + Math.random() * 0.55) * 100) / 100;
    const severity = pick(eventSeverities);
    const verification = pick(verificationStatuses);

    await supabase.from("intel_events").insert({
      title,
      event_type: eventType,
      city: cityName,
      country: CITY_COUNTRY[cityName] || "Unknown",
      lat, lng,
      severity,
      confidence,
      verification_status: verification,
      summary: `Automated intel: ${eventType.replace(/_/g, " ")} activity detected near ${cityName}. Confidence ${Math.round(confidence * 100)}%.`,
      created_at: now,
      updated_at: now,
    });
    actions.push(`Inserted intel_event (${eventType}) for ${cityName}`);
  }


  const numAirspace = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numAirspace; i++) {
    const city = pick(cityNames);
    const coords = CITY_COORDS[city];
    const aaId = `aa-live-${city.replace(/\s/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await supabase.from("airspace_alerts").insert({
      id: aaId,
      type: pick(airspaceTypes),
      region: city,
      lat: coords.lat + (Math.random() - 0.5) * 0.2,
      lng: coords.lng + (Math.random() - 0.5) * 0.2,
      radius: rand(5, 50),
      severity: pick(severities),
      description: pick(airspaceDescriptions),
      timestamp: now,
      active: true,
    });
    actions.push(`Inserted airspace alert for ${city}`);
  }

  // 4. Rocket simulation — 40% chance to launch new, always transition existing active ones
  // Transition active rockets first
  const { data: activeRockets } = await supabase
    .from("rockets")
    .select("*")
    .like("id", "rk-live-%")
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
      actions.push(`Transitioned rocket ${rocket.id} to ${newStatus}`);
    }
  }

  // Launch new rocket (40% chance)
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
      origin_lat: oCoords.lat,
      origin_lng: oCoords.lng,
      target_lat: tCoords.lat,
      target_lng: tCoords.lng,
      current_lat: oCoords.lat + (tCoords.lat - oCoords.lat) * progress,
      current_lng: oCoords.lng + (tCoords.lng - oCoords.lng) * progress,
      status,
      severity: pick(["high", "critical"] as const),
      speed: rand(600, 2400),
      altitude: rand(30, 180),
      timestamp: now,
    });
    actions.push(`Launched new rocket ${rkId} from ${originCity} → ${targetCity}`);
  }

  // 5. Update risk score
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

  // 6. Prune old live data (keep reasonable amounts)
  // Geo alerts — keep last 100
  const { data: oldAlerts } = await supabase
    .from("geo_alerts").select("id").like("id", "ga-live-%")
    .order("timestamp", { ascending: false });
  if (oldAlerts && oldAlerts.length > 100) {
    const toDelete = oldAlerts.slice(100).map((a) => a.id);
    await supabase.from("geo_alerts").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old geo alerts`);
  }

  // Timeline events — keep last 80
  const { data: oldEvents } = await supabase
    .from("timeline_events").select("id").like("id", "te-live-%")
    .order("timestamp", { ascending: false });
  if (oldEvents && oldEvents.length > 80) {
    const toDelete = oldEvents.slice(80).map((e) => e.id);
    await supabase.from("timeline_events").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old timeline events`);
  }

  // Airspace alerts — keep last 30
  const { data: oldAirspace } = await supabase
    .from("airspace_alerts").select("id").like("id", "aa-live-%")
    .order("timestamp", { ascending: false });
  if (oldAirspace && oldAirspace.length > 30) {
    const toDelete = oldAirspace.slice(30).map((a) => a.id);
    await supabase.from("airspace_alerts").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old airspace alerts`);
  }

  // Rockets — keep last 15 live ones
  const { data: oldRockets } = await supabase
    .from("rockets").select("id").like("id", "rk-live-%")
    .order("timestamp", { ascending: false });
  if (oldRockets && oldRockets.length > 15) {
    const toDelete = oldRockets.slice(15).map((r) => r.id);
    await supabase.from("rockets").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old rockets`);
  }

  // Intel events — keep last 100
  const { data: oldIntelEvents } = await supabase
    .from("intel_events").select("id")
    .order("created_at", { ascending: false });
  if (oldIntelEvents && oldIntelEvents.length > 100) {
    const toDelete = oldIntelEvents.slice(100).map((e) => e.id);
    await supabase.from("intel_events").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old intel events`);
  }

  return new Response(JSON.stringify({ ok: true, actions }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
