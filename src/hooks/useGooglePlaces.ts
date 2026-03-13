import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GooglePlace {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  types: string[];
  category: string;
  rating?: number;
  user_ratings_total?: number;
  open_now?: boolean;
  icon?: string;
  business_status?: string;
}

export type POICategory = "airport" | "embassy" | "hospital" | "military" | "government" | "port" | "police" | "fire_station";

const POI_COLORS: Record<string, string> = {
  airport: "#3b82f6",
  embassy: "#a855f7",
  hospital: "#ef4444",
  military: "#dc2626",
  military_base: "#dc2626",
  government: "#f59e0b",
  port: "#06b6d4",
  police: "#2563eb",
  fire_station: "#f97316",
};

const POI_ICONS: Record<string, string> = {
  airport: "✈️",
  embassy: "🏛️",
  hospital: "🏥",
  military: "🎖️",
  military_base: "🎖️",
  government: "🏢",
  port: "⚓",
  police: "🚔",
  fire_station: "🚒",
};

export function getPOIColor(category: string): string {
  return POI_COLORS[category] || "#6b7280";
}

export function getPOIIcon(category: string): string {
  return POI_ICONS[category] || "📍";
}

interface CacheEntry {
  data: GooglePlace[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useGooglePlaces() {
  const [places, setPlaces] = useState<GooglePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const fetchPlaces = useCallback(async (
    lat: number,
    lng: number,
    radius: number = 50000,
    categories: POICategory[] = ["airport", "embassy", "hospital", "military", "government"]
  ) => {
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${radius},${categories.join(",")}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setPlaces(cached.data);
      return cached.data;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-places", {
        body: { lat, lng, radius, categories },
      });
      if (fnError) throw fnError;
      const results: GooglePlace[] = data?.results || [];
      setPlaces(results);
      cacheRef.current.set(cacheKey, { data: results, timestamp: Date.now() });
      return results;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch places";
      setError(msg);
      console.error("useGooglePlaces error:", msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return { places, loading, error, fetchPlaces, clearCache };
}
