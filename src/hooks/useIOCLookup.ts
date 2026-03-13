import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAIError } from "@/lib/ai-error-handler";

export interface IOCResult {
  ioc: string;
  type: string;
  timestamp: string;
  threatScore: number;
  geolocation: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    lat: number;
    lon: number;
    isp: string;
    org: string;
    as: string;
    asName: string;
    isProxy: boolean;
    isHosting: boolean;
    isMobile: boolean;
  } | null;
  shodan: {
    ports: number[];
    hostnames: string[];
    cpes: string[];
    vulns: string[];
    tags: string[];
  } | null;
  threatfox: {
    found: boolean;
    matches: Array<{
      malware: string;
      threat_type: string;
      confidence: number;
      first_seen: string;
      last_seen: string;
      tags: string[];
    }>;
  };
  feodoTracker: {
    found: boolean;
    matches: Array<{
      malware: string;
      port: number;
      first_seen: string;
      last_online: string;
      status: string;
    }>;
  };
  aiAnalysis: string | null;
}

export function useIOCLookup() {
  const [data, setData] = useState<IOCResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (ioc: string) => {
    if (!ioc || ioc.trim().length < 3) {
      setError("Enter a valid IP, domain, or hash");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ioc-lookup", {
        body: { ioc: ioc.trim() },
      });

      if (fnError) {
        if (handleAIError(fnError)) return;
        throw fnError;
      }
      if (fnData?.error) {
        setError(fnData.error);
        return;
      }
      setData(fnData as IOCResult);
    } catch (e) {
      if (handleAIError(e)) return;
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, scan, reset };
}
