import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UP42Feature {
  id: string;
  type: "Feature";
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    datetime?: string;
    "eo:cloud_cover"?: number;
    constellation?: string;
    "up42-system:asset_id"?: string;
    title?: string;
    collection?: string;
    [key: string]: any;
  };
  bbox?: number[];
}

export interface UP42SearchParams {
  bbox?: [number, number, number, number];
  dateFrom?: string;
  dateTo?: string;
  maxCloudCover?: number;
  collections?: string[];
  limit?: number;
}

export function useUP42Catalog() {
  const [features, setFeatures] = useState<UP42Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: UP42SearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("up42-catalog", {
        body: { action: "search", ...params },
      });

      if (fnError) throw fnError;
      
      const featureList = data?.features || [];
      setFeatures(featureList);
      return featureList;
    } catch (err: any) {
      const msg = err?.message || "UP42 search failed";
      setError(msg);
      setFeatures([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setFeatures([]);
    setError(null);
  }, []);

  return { features, loading, error, search, clear };
}
