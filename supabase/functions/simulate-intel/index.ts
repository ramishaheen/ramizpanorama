import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const regions = ["Eastern Mediterranean", "Red Sea", "Persian Gulf", "Strait of Hormuz", "Gulf of Aden", "Sinai Peninsula", "Golan Heights", "Southern Lebanon", "Gaza Strip", "West Bank", "Northern Iraq", "Syrian Desert", "Yemen Coast", "Saudi Border", "Iranian Plateau", "Bab el-Mandeb", "Suez Canal Zone", "Jordan Valley", "Negev Desert", "Khuzestan"];
const geoTypes = ["DIPLOMATIC", "MILITARY", "ECONOMIC", "HUMANITARIAN"] as const;
const severities = ["low", "medium", "high", "critical"] as const;
const vesselNames = ["USS EISENHOWER", "USS GERALD FORD", "USS BATAAN", "INS MAGEN", "IRGCN SHAHID SOLEIMANI", "HMS DIAMOND", "FS ALSACE", "HMAS HOBART", "COSCO SHIPPING ROSE", "EVER GIVEN II", "PACIFIC TRADER", "IRANIAN TANKER SUEZ", "HOUTHI PATROL 7", "SAUDI COAST GUARD 12"];
const titles: Record<string, string[]> = {
  MILITARY: [
    "IDF airstrikes reported in southern Lebanon",
    "IRGC naval drill detected near Strait of Hormuz",
    "Houthi anti-ship missile launch detected",
    "Iron Dome interceptions reported in northern Israel",
    "Hezbollah drone incursion detected",
    "US B-52 strategic patrol over Persian Gulf",
    "Israeli submarine movement near Iranian waters",
    "SAM battery activation detected in Syria",
    "Arrow-3 system test intercept confirmed",
    "Turkish military repositioning near Iraqi border",
  ],
  DIPLOMATIC: [
    "UN Security Council emergency session on Iran",
    "Qatar mediating ceasefire talks",
    "US envoy arrives in Riyadh for de-escalation",
    "EU sanctions package against IRGC entities",
    "Egyptian-brokered humanitarian corridor proposed",
    "Jordan recalls ambassador from Tehran",
    "Saudi-Iran back-channel talks reported",
    "Abraham Accords partner summit convened",
  ],
  ECONOMIC: [
    "Oil prices spike on Strait of Hormuz threat",
    "Red Sea shipping rerouting adds $1M per vessel",
    "Israeli shekel under pressure amid escalation",
    "Suez Canal traffic reduced 40%",
    "Gulf state sovereign funds reallocating",
    "Iranian rial hits record low",
    "Insurance premiums surge for Middle East shipping",
    "Tourism cancellations across Levant region",
  ],
  HUMANITARIAN: [
    "UNRWA reports mass displacement in Gaza",
    "Red Cross aid convoy blocked at Lebanese border",
    "WHO reports hospital capacity exceeded in Beirut",
    "Refugee flow detected toward Jordan border",
    "Water infrastructure damaged in northern Gaza",
    "Civilian evacuation ordered in southern Lebanon",
    "Medical supply shortage in Yemen's Hodeidah",
    "UNHCR emergency shelter deployment in Iraq",
  ],
};

const rocketNames = [
  "SCUD-B", "Iskander-M", "DF-21D", "Fateh-110", "Houthi Burkan-3",
  "KN-23", "Shahab-3", "BrahMos", "Tochka-U", "Qiam-1",
  "Zulfiqar", "Emad", "Ghadr-110", "Sejjil-2", "Musudan",
];

const rocketTypes = ["BALLISTIC", "CRUISE", "HYPERSONIC", "ICBM", "SAM"];

// Known conflict hotspot launch/target pairs
const rocketScenarios = [
  { origin: { lat: 15.4, lng: 44.2 }, target: { lat: 24.5, lng: 39.6 }, name: "Yemen → Saudi Arabia" },
  { origin: { lat: 33.3, lng: 44.4 }, target: { lat: 32.0, lng: 35.8 }, name: "Iraq → Levant" },
  { origin: { lat: 35.7, lng: 51.4 }, target: { lat: 25.3, lng: 55.3 }, name: "Iran → Gulf" },
  { origin: { lat: 39.0, lng: 125.7 }, target: { lat: 35.9, lng: 128.6 }, name: "DPRK → Korean Peninsula" },
  { origin: { lat: 48.5, lng: 37.5 }, target: { lat: 50.4, lng: 30.5 }, name: "Eastern Front → West" },
  { origin: { lat: 31.5, lng: 34.5 }, target: { lat: 33.8, lng: 35.8 }, name: "Levant → Lebanon" },
  { origin: { lat: 33.5, lng: 36.3 }, target: { lat: 32.0, lng: 35.8 }, name: "Syria → Levant" },
  { origin: { lat: 27.0, lng: 49.6 }, target: { lat: 24.7, lng: 46.7 }, name: "Gulf → Riyadh" },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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

  // 1. Drift a vessel slightly from its current position (realistic movement)
  const vesselId = `v-00${Math.ceil(Math.random() * 8)}`;
  const { data: currentVessel } = await supabase.from("vessels").select("lat,lng,heading,speed").eq("id", vesselId).single();
  if (currentVessel) {
    // Convert heading to radians and drift by ~0.05-0.15 degrees based on speed
    const headingRad = (currentVessel.heading || 0) * Math.PI / 180;
    const drift = 0.02 + Math.random() * 0.08; // small realistic drift
    let newLat = currentVessel.lat + drift * Math.cos(headingRad);
    let newLng = currentVessel.lng + drift * Math.sin(headingRad);
    // Keep within Middle East operational area (lat 12-42, lng 24-63)
    if (newLat < 12 || newLat > 42 || newLng < 24 || newLng > 63) {
      // Reverse heading if hitting bounds
      const newHeading = (currentVessel.heading + 180) % 360;
      newLat = currentVessel.lat - drift * Math.cos(headingRad);
      newLng = currentVessel.lng - drift * Math.sin(headingRad);
      await supabase.from("vessels").update({
        lat: Math.max(12, Math.min(42, newLat)),
        lng: Math.max(24, Math.min(63, newLng)),
        heading: newHeading,
        speed: rand(5, 22),
        timestamp: now,
      }).eq("id", vesselId);
    } else {
      // Small random heading adjustment (±5 degrees)
      const headingDrift = (Math.random() - 0.5) * 10;
      await supabase.from("vessels").update({
        lat: newLat,
        lng: newLng,
        heading: Math.round(((currentVessel.heading + headingDrift) % 360 + 360) % 360 * 10) / 10,
        speed: rand(5, 22),
        timestamp: now,
      }).eq("id", vesselId);
    }
  }
  actions.push(`Drifted vessel ${vesselId}`);

  // 2. Add a new geo alert
  const geoType = pick(geoTypes);
  const region = pick(regions);
  const alertId = `ga-live-${Date.now()}`;
  await supabase.from("geo_alerts").insert({
    id: alertId,
    type: geoType,
    region,
    title: pick(titles[geoType]),
    summary: `Live intelligence update for ${region}. Automated monitoring detected activity change.`,
    severity: pick(severities),
    source: "WarOS-RamiZPanorma Auto-Monitor",
    timestamp: now,
    lat: rand(12, 42),
    lng: rand(24, 63),
  });
  actions.push(`Inserted geo alert ${alertId}`);

  // 3. Add a timeline event
  const teId = `te-live-${Date.now()}`;
  const teTypes = ["airspace", "maritime", "alert", "diplomatic"] as const;
  await supabase.from("timeline_events").insert({
    id: teId,
    type: pick(teTypes),
    title: `${pick(titles[geoType])} — ${region}`,
    severity: pick(severities),
    timestamp: now,
  });
  actions.push(`Inserted timeline event ${teId}`);

  // 4. Update risk score
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

  if (oldAlerts && oldAlerts.length > 20) {
    const toDelete = oldAlerts.slice(20).map((a) => a.id);
    await supabase.from("geo_alerts").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old alerts`);
  }

  const { data: oldEvents } = await supabase
    .from("timeline_events")
    .select("id")
    .like("id", "te-live-%")
    .order("timestamp", { ascending: false });

  if (oldEvents && oldEvents.length > 30) {
    const toDelete = oldEvents.slice(30).map((e) => e.id);
    await supabase.from("timeline_events").delete().in("id", toDelete);
    actions.push(`Pruned ${toDelete.length} old timeline events`);
  }

  return new Response(JSON.stringify({ ok: true, actions }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
