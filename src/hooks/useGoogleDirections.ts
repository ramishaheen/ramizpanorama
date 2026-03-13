import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DirectionsResult {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  start_address: string;
  end_address: string;
  polyline: { lat: number; lng: number }[];
  steps: {
    instruction: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    start: { lat: number; lng: number };
    end: { lat: number; lng: number };
  }[];
  bounds?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
}

export function useGoogleDirections() {
  const [route, setRoute] = useState<DirectionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDirections = useCallback(async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: "driving" | "walking" | "transit" = "driving"
  ): Promise<DirectionsResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-directions", {
        body: { origin, destination, mode },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setRoute(data as DirectionsResult);
      return data as DirectionsResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Directions failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setError(null);
  }, []);

  return { route, loading, error, getDirections, clearRoute };
}
