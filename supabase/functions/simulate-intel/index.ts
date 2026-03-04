import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const regions = ["Eastern Mediterranean", "South China Sea", "Baltic Sea", "Red Sea", "Persian Gulf", "Black Sea", "Indo-Pacific", "Arctic"];
const geoTypes = ["DIPLOMATIC", "MILITARY", "ECONOMIC", "HUMANITARIAN"] as const;
const severities = ["low", "medium", "high", "critical"] as const;
const vesselNames = ["USS EISENHOWER", "LIAONING", "ADMIRAL KUZNETSOV", "EVER GIVEN II", "PACIFIC TRADER", "HAIYANG SHIYOU", "HMS QUEEN ELIZABETH", "JS IZUMO"];
const titles: Record<string, string[]> = {
  MILITARY: ["Troop movements detected", "Naval formation change observed", "Airborne assets repositioned", "Submarine activity detected"],
  DIPLOMATIC: ["Emergency talks initiated", "Ambassador recalled", "Sanctions announced", "Treaty negotiations resumed"],
  ECONOMIC: ["Trade route disruption reported", "Oil price spike warning", "Supply chain alert issued", "Energy corridor threat detected"],
  HUMANITARIAN: ["Aid convoy delayed", "Refugee movement detected", "Medical supply shortage reported", "Evacuation corridor requested"],
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

  // 1. Randomly update a vessel position
  const vesselId = `v-00${Math.ceil(Math.random() * 8)}`;
  await supabase.from("vessels").update({
    lat: rand(-60, 60),
    lng: rand(-180, 180),
    heading: rand(0, 360),
    speed: rand(5, 25),
    timestamp: now,
  }).eq("id", vesselId);
  actions.push(`Updated vessel ${vesselId}`);

  // 2. Add a new geo alert (rotate IDs to avoid unbounded growth)
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
    source: "SentinelOS Auto-Monitor",
    timestamp: now,
    lat: rand(-50, 60),
    lng: rand(-150, 150),
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

  // 4. Update risk score with small fluctuations
  const { data: currentRisk } = await supabase
    .from("risk_scores")
    .select("*")
    .order("last_updated", { ascending: false })
    .limit(1)
    .single();

  if (currentRisk) {
    const nudge = () => Math.max(0, Math.min(100, currentRisk.overall + Math.floor(Math.random() * 11) - 5));
    const newOverall = nudge();
    const trends = ["rising", "falling", "stable"] as const;
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

