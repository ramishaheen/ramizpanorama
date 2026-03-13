import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Maritime corridors — vessels must stay within these water zones
const MARITIME_CORRIDORS = [
  { latMin: 23.5, latMax: 30.8, lngMin: 47.5, lngMax: 56.8 },  // Persian Gulf
  { latMin: 22.0, latMax: 27.8, lngMin: 55.8, lngMax: 62.8 },  // Gulf of Oman / Arabian Sea
  { latMin: 12.0, latMax: 30.8, lngMin: 32.0, lngMax: 43.8 },  // Red Sea
  { latMin: 30.0, latMax: 33.6, lngMin: 31.8, lngMax: 33.2 },  // Suez Canal
  { latMin: 31.0, latMax: 37.2, lngMin: 33.2, lngMax: 36.8 },  // Eastern Mediterranean
  { latMin: 36.3, latMax: 47.2, lngMin: 47.0, lngMax: 54.8 },  // Caspian Sea
  { latMin: 10.0, latMax: 15.0, lngMin: 42.0, lngMax: 52.0 },  // Gulf of Aden
  { latMin: 33.0, latMax: 41.0, lngMin: 24.0, lngMax: 36.0 },  // Mediterranean (wider)
  { latMin: 20.0, latMax: 30.0, lngMin: 58.0, lngMax: 68.0 },  // Arabian Sea (wider)
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

const geoTypes = ["DIPLOMATIC", "MILITARY", "ECONOMIC", "HUMANITARIAN"] as const;
const severities = ["low", "medium", "high", "critical"] as const;

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
      // New position is still in water — commit
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
      // New position is on land — reverse heading and stay put
      const reversedHeading = (currentVessel.heading + 180) % 360;
      // Try reversed direction
      const revLat = currentVessel.lat + drift * Math.cos(reversedHeading * Math.PI / 180);
      const revLng = currentVessel.lng + drift * Math.sin(reversedHeading * Math.PI / 180);
      if (isInWater(revLat, revLng)) {
        await supabase.from("vessels").update({
          lat: revLat,
          lng: revLng,
          heading: reversedHeading,
          speed: rand(5, 22),
          timestamp: now,
        }).eq("id", vesselId);
        actions.push(`Reversed vessel ${vesselId} (hit land boundary)`);
      } else {
        // Both directions lead to land — just update heading, don't move
        await supabase.from("vessels").update({
          heading: reversedHeading,
          speed: rand(3, 10),
          timestamp: now,
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
      id: alertId,
      type: geoType,
      region: cityName,
      title: `[${cityName}] ${pick(titles[geoType])}`,
      summary: `Live intelligence update for ${cityName}. Automated monitoring detected activity change.`,
      severity,
      source: "WarOS Auto-Monitor",
      timestamp: now,
      lat,
      lng,
    });
    actions.push(`Inserted geo alert for ${cityName}`);

    const teId = `te-live-${cityName.replace(/\s/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const teTypes = ["airspace", "maritime", "alert", "diplomatic"] as const;
    const teType = geoType === "MILITARY" ? "alert" : geoType === "DIPLOMATIC" ? "diplomatic" : geoType === "ECONOMIC" ? "maritime" : pick(teTypes);
    await supabase.from("timeline_events").insert({
      id: teId,
      type: teType,
      title: `[${cityName}] ${pick(titles[geoType])}`,
      severity,
      timestamp: now,
    });
    actions.push(`Inserted timeline event for ${cityName}`);
  }

  // 3. Update risk score
  const { data: currentRisk } = await supabase
    .from("risk_scores")
    .select("*")
    .order("last_updated", { ascending: false })
    .limit(1)
    .single();

  if (currentRisk) {
    const nudge = () => Math.max(0, Math.min(100, currentRisk.overall + Math.floor(Math.random() * 11) - 5));
    const newOverall = nudge();
    await supabase.from("risk_scores").update({
      overall: newOverall,
      airspace: Math.max(0, Math.min(100, currentRisk.airspace + Math.floor(Math.random() * 9) - 4)),
      maritime: Math.max(0, Math.min(100, currentRisk.maritime + Math.floor(Math.random() * 9) - 4)),
      diplomatic: Math.max(0, Math.min(100, currentRisk.diplomatic + Math.floor(Math.random() * 9) - 4)),
      sentiment: Math.max(0, Math.min(100, currentRisk.sentiment + Math.floor(Math.random() * 9) - 4)),
      trend: newOverall > currentRisk.overall ? "rising" : newOverall < currentRisk.overall ? "falling" : "stable",
      last_updated: now,
    }).eq("id", currentRisk.id);
    actions.push("Updated risk scores");
  }

  // 5. Prune old live alerts (keep last 20)
  const { data: oldAlerts } = await supabase
    .from("geo_alerts")
    .select("id")
    .like("id", "ga-live-%")
    .order("timestamp", { ascending: false });

  if (oldAlerts && oldAlerts.length > 50) {
    const toDelete = oldAlerts.slice(50).map((a) => a.id);
    await supabase.from("geo_alerts").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old alerts`);
  }

  const { data: oldEvents } = await supabase
    .from("timeline_events")
    .select("id")
    .like("id", "te-live-%")
    .order("timestamp", { ascending: false });

  if (oldEvents && oldEvents.length > 80) {
    const toDelete = oldEvents.slice(80).map((e) => e.id);
    await supabase.from("timeline_events").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old timeline events`);
  }

  return new Response(JSON.stringify({ ok: true, actions }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
