import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Traffic Intelligence Edge Function
 * Fetches weather data from open-meteo and computes weather impact factor
 * for the Traffic Density Index (TDI) calculation.
 */

interface WeatherImpact {
  temperature: number;
  windSpeed: number;
  precipitation: number;
  visibility: number;
  weatherCode: number;
  weatherImpactFactor: number;
  description: string;
}

interface TimeFactors {
  hour: number;
  dayOfWeek: number;
  isRushHour: boolean;
  isWeekend: boolean;
  timeOfDayFactor: number;
  period: string;
}

function getWeatherImpactFactor(weatherCode: number, precipitation: number, windSpeed: number, visibility: number): number {
  let factor = 1.0;

  // Precipitation impact
  if (precipitation > 10) factor += 0.5;        // heavy rain
  else if (precipitation > 5) factor += 0.3;    // moderate rain
  else if (precipitation > 1) factor += 0.15;   // light rain
  else if (precipitation > 0) factor += 0.05;   // drizzle

  // Wind impact
  if (windSpeed > 60) factor += 0.4;            // storm
  else if (windSpeed > 40) factor += 0.25;
  else if (windSpeed > 20) factor += 0.1;

  // Visibility impact
  if (visibility < 200) factor += 0.6;          // dense fog
  else if (visibility < 1000) factor += 0.3;    // fog
  else if (visibility < 5000) factor += 0.1;    // haze

  // Weather code impact (WMO codes)
  if (weatherCode >= 95) factor += 0.5;         // thunderstorm
  else if (weatherCode >= 71) factor += 0.4;    // snow
  else if (weatherCode >= 61) factor += 0.2;    // rain
  else if (weatherCode >= 51) factor += 0.1;    // drizzle
  else if (weatherCode >= 45) factor += 0.25;   // fog

  return Math.min(2.5, factor);
}

function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
}

function getTimeFactors(lat: number, lng: number): TimeFactors {
  // Estimate local time from longitude
  const utcHour = new Date().getUTCHours();
  const tzOffset = Math.round(lng / 15);
  const localHour = (utcHour + tzOffset + 24) % 24;
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Friday/Sat/Sun for Middle East

  let timeOfDayFactor: number;
  let period: string;

  if (localHour >= 7 && localHour < 9) {
    timeOfDayFactor = 1.0; period = "MORNING RUSH";
  } else if (localHour >= 16 && localHour < 19) {
    timeOfDayFactor = 0.95; period = "EVENING RUSH";
  } else if (localHour >= 12 && localHour < 14) {
    timeOfDayFactor = 0.8; period = "MIDDAY PEAK";
  } else if (localHour >= 9 && localHour < 16) {
    timeOfDayFactor = 0.65; period = "MIDDAY";
  } else if (localHour >= 19 && localHour < 23) {
    timeOfDayFactor = 0.45; period = "EVENING";
  } else if (localHour >= 23 || localHour < 5) {
    timeOfDayFactor = 0.15; period = "NIGHT";
  } else {
    timeOfDayFactor = 0.35; period = "EARLY MORNING";
  }

  // Weekend reduction for Middle East (Friday/Saturday)
  if (isWeekend) {
    timeOfDayFactor *= 0.6;
    period += " (WEEKEND)";
  }

  return { hour: localHour, dayOfWeek, isRushHour: timeOfDayFactor >= 0.9, isWeekend, timeOfDayFactor, period };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lat, lng } = await req.json();

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "lat and lng required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current weather from Open-Meteo (free, no key needed)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,precipitation,weather_code,visibility&timezone=auto`;

    let weather: WeatherImpact;
    try {
      const resp = await fetch(weatherUrl);
      if (!resp.ok) throw new Error(`Weather API ${resp.status}`);
      const data = await resp.json();
      const c = data.current;

      const weatherImpactFactor = getWeatherImpactFactor(
        c.weather_code ?? 0,
        c.precipitation ?? 0,
        c.wind_speed_10m ?? 0,
        c.visibility ?? 50000
      );

      weather = {
        temperature: c.temperature_2m ?? 25,
        windSpeed: c.wind_speed_10m ?? 0,
        precipitation: c.precipitation ?? 0,
        visibility: c.visibility ?? 50000,
        weatherCode: c.weather_code ?? 0,
        weatherImpactFactor,
        description: getWeatherDescription(c.weather_code ?? 0),
      };
    } catch (e) {
      console.warn("Weather fetch failed, using defaults:", e);
      weather = {
        temperature: 30, windSpeed: 5, precipitation: 0,
        visibility: 50000, weatherCode: 0,
        weatherImpactFactor: 1.0, description: "Clear (fallback)",
      };
    }

    const timeFactors = getTimeFactors(lat, lng);

    return new Response(JSON.stringify({
      weather,
      timeFactors,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("traffic-intel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
