import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Capital cities of focus countries
const CITIES = [
  { name: "Tehran", country: "Iran", lat: 35.6892, lng: 51.389, code: "IR" },
  { name: "Isfahan", country: "Iran", lat: 32.6546, lng: 51.6680, code: "IR2" },
  { name: "Tel Aviv", country: "Israel", lat: 32.0853, lng: 34.7818, code: "IL" },
  { name: "Jerusalem", country: "Israel", lat: 31.7683, lng: 35.2137, code: "IL2" },
  { name: "Amman", country: "Jordan", lat: 31.9454, lng: 35.9284, code: "JO" },
  { name: "Baghdad", country: "Iraq", lat: 33.3152, lng: 44.3661, code: "IQ" },
  { name: "Basra", country: "Iraq", lat: 30.5085, lng: 47.7804, code: "IQ2" },
  { name: "Damascus", country: "Syria", lat: 33.5138, lng: 36.2765, code: "SY" },
  { name: "Aleppo", country: "Syria", lat: 36.2021, lng: 37.1343, code: "SY2" },
  { name: "Beirut", country: "Lebanon", lat: 33.8938, lng: 35.5018, code: "LB" },
  { name: "Abu Dhabi", country: "UAE", lat: 24.4539, lng: 54.3773, code: "AE" },
  { name: "Manama", country: "Bahrain", lat: 26.2285, lng: 50.5860, code: "BH" },
  { name: "Kuwait City", country: "Kuwait", lat: 29.3759, lng: 47.9774, code: "KW" },
  { name: "Doha", country: "Qatar", lat: 25.2854, lng: 51.5310, code: "QA" },
  { name: "Muscat", country: "Oman", lat: 23.5880, lng: 58.3829, code: "OM" },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lng: 46.6753, code: "SA" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OWM_KEY = Deno.env.get("OWM_API_KEY") || "b1b15e88fa797225412429c1c50c122a1";
    
    const results = await Promise.allSettled(
      CITIES.map(async (city) => {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lng}&units=metric&appid=${OWM_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return {
          city: city.name,
          country: city.country,
          code: city.code,
          lat: city.lat,
          lng: city.lng,
          temp: Math.round(data.main?.temp ?? 0),
          feels_like: Math.round(data.main?.feels_like ?? 0),
          humidity: data.main?.humidity ?? 0,
          pressure: data.main?.pressure ?? 0,
          wind_speed: Math.round((data.wind?.speed ?? 0) * 3.6), // m/s to km/h
          wind_deg: data.wind?.deg ?? 0,
          visibility: Math.round((data.visibility ?? 10000) / 1000), // meters to km
          clouds: data.clouds?.all ?? 0,
          condition: data.weather?.[0]?.main ?? "Clear",
          description: data.weather?.[0]?.description ?? "",
          icon: data.weather?.[0]?.icon ?? "01d",
        };
      })
    );

    const weather = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value);

    console.log(`Weather fetched for ${weather.length}/${CITIES.length} cities`);

    return new Response(JSON.stringify({ weather, timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Weather error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
