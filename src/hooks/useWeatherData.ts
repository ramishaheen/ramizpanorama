import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CityWeather {
  city: string;
  country: string;
  code: string;
  lat: number;
  lng: number;
  temp: number;
  feels_like: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_deg: number;
  visibility: number;
  clouds: number;
  condition: string;
  description: string;
  icon: string;
}

export function useWeatherData() {
  const [weather, setWeather] = useState<CityWeather[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.functions.invoke("weather-data");
      if (!err && data?.weather) {
        setWeather(data.weather);
        setError(null);
      } else {
        setError(err?.message || "Failed to fetch weather");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchWeather]);

  return { weather, loading, error, refetch: fetchWeather };
}
