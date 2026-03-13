import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeocodeResult {
  formatted_address: string;
  lat: number;
  lng: number;
  place_id: string;
  types: string[];
  address_components?: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
}

interface CacheEntry {
  data: GeocodeResult[];
  timestamp: number;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useGoogleGeocode() {
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<GeocodeResult | null> => {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResult(cached.data[0] || null);
      return cached.data[0] || null;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-geocode", {
        body: { lat, lng },
      });
      if (fnError) throw fnError;
      const results: GeocodeResult[] = data?.results || [];
      cacheRef.current.set(cacheKey, { data: results, timestamp: Date.now() });
      const first = results[0] || null;
      setResult(first);
      return first;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Geocode failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reverseGeocodeDebounced = useCallback((lat: number, lng: number, delayMs = 500) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reverseGeocode(lat, lng), delayMs);
  }, [reverseGeocode]);

  const forwardGeocode = useCallback(async (address: string): Promise<GeocodeResult | null> => {
    const cacheKey = `addr:${address}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResult(cached.data[0] || null);
      return cached.data[0] || null;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-geocode", {
        body: { address },
      });
      if (fnError) throw fnError;
      const results: GeocodeResult[] = data?.results || [];
      cacheRef.current.set(cacheKey, { data: results, timestamp: Date.now() });
      const first = results[0] || null;
      setResult(first);
      return first;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Geocode failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, reverseGeocode, reverseGeocodeDebounced, forwardGeocode };
}
