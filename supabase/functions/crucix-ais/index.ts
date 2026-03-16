import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHOKEPOINTS = [
  { name: "Strait of Hormuz", lat: 26.5, lng: 56.3, radius: 1.5 },
  { name: "Suez Canal", lat: 30.5, lng: 32.3, radius: 0.8 },
  { name: "Bab el-Mandeb", lat: 12.6, lng: 43.3, radius: 1.0 },
  { name: "Strait of Malacca", lat: 2.5, lng: 101.5, radius: 2.0 },
  { name: "Taiwan Strait", lat: 24.5, lng: 119.5, radius: 2.0 },
  { name: "Bosphorus", lat: 41.1, lng: 29.1, radius: 0.5 },
];

let cache: { data: any; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

function generateSimulatedVessels() {
  return CHOKEPOINTS.map(cp => ({
    chokepoint: cp.name,
    lat: cp.lat,
    lng: cp.lng,
    vesselCount: 15 + Math.floor(Math.random() * 40),
    vessels: Array.from({ length: 8 + Math.floor(Math.random() * 12) }, (_, i) => ({
      mmsi: `${200000000 + Math.floor(Math.random() * 99999999)}`,
      lat: cp.lat + (Math.random() - 0.5) * cp.radius * 2,
      lng: cp.lng + (Math.random() - 0.5) * cp.radius * 2,
      heading: Math.floor(Math.random() * 360),
      speed: Math.random() * 18,
      type: ["Tanker", "Cargo", "Container", "Naval", "Fishing"][Math.floor(Math.random() * 5)],
      name: `VESSEL-${cp.name.substring(0, 3).toUpperCase()}-${i}`,
    })),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (cache && Date.now() - cache.ts < TTL) {
    return new Response(JSON.stringify({ ...cache.data, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("AISSTREAM_API_KEY");

  // AISStream uses WebSocket — for REST snapshot we simulate with realistic data
  // In production this would maintain a WS connection and cache positions
  try {
    const chokepoints = generateSimulatedVessels();
    const totalVessels = chokepoints.reduce((sum, cp) => sum + cp.vessels.length, 0);

    const data = {
      chokepoints,
      totalVessels,
      timestamp: new Date().toISOString(),
      source: apiKey ? "AISStream (simulated snapshot)" : "simulated",
      apiConfigured: !!apiKey,
    };
    cache = { data, ts: Date.now() };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AIS error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown", chokepoints: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
