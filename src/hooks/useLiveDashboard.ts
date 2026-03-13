import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AirspaceAlert, MaritimeVessel, GeoAlert, RiskScore, TimelineEvent, Rocket } from "@/data/mockData";

export function useLiveDashboard() {
  const [dataFresh, setDataFresh] = useState(false);
  const freshTimer = useRef<ReturnType<typeof setTimeout>>();

  const flashFresh = useCallback(() => {
    setDataFresh(true);
    clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setDataFresh(false), 1200);
  }, []);
  const [airspaceAlerts, setAirspaceAlerts] = useState<AirspaceAlert[]>([]);
  const [vessels, setVessels] = useState<MaritimeVessel[]>([]);
  const [geoAlerts, setGeoAlerts] = useState<GeoAlert[]>([]);
  const [riskScore, setRiskScore] = useState<RiskScore>({
    overall: 0, airspace: 0, maritime: 0, diplomatic: 0, sentiment: 0,
    trend: "stable", lastUpdated: new Date().toISOString(),
  });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [rockets, setRockets] = useState<Rocket[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    async function fetchAll() {
      const [aRes, vRes, gRes, rRes, tRes, rkRes] = await Promise.all([
        supabase.from("airspace_alerts").select("*"),
        supabase.from("vessels").select("*"),
        supabase.from("geo_alerts").select("*"),
        supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
        supabase.from("timeline_events").select("*").order("timestamp", { ascending: true }),
        supabase.from("rockets").select("*"),
      ]);

      if (aRes.data) setAirspaceAlerts(aRes.data.map(mapAirspace));
      if (vRes.data) setVessels(vRes.data.map(mapVessel));
      if (gRes.data) setGeoAlerts(gRes.data.map(mapGeoAlert));
      if (rRes.data?.[0]) setRiskScore(mapRisk(rRes.data[0]));
      if (tRes.data) setTimeline(tRes.data.map(mapTimeline));
      if (rkRes.data) setRockets(rkRes.data.map(mapRocket));
      setLoading(false);
    }
    fetchAll();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "airspace_alerts" }, () => {
        supabase.from("airspace_alerts").select("*").then(({ data }) => {
          if (data) { setAirspaceAlerts(data.map(mapAirspace)); flashFresh(); }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vessels" }, () => {
        supabase.from("vessels").select("*").then(({ data }) => {
          if (data) { setVessels(data.map(mapVessel)); flashFresh(); }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "geo_alerts" }, (payload) => {
        supabase.from("geo_alerts").select("*").then(({ data }) => {
          if (data) { setGeoAlerts(data.map(mapGeoAlert)); flashFresh(); }
        });
        if (payload.eventType === "INSERT" && payload.new?.severity === "critical") {
          toast({
            variant: "destructive",
            title: "⚠ CRITICAL ALERT",
            description: `${payload.new.title} — ${payload.new.region}`,
          });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "risk_scores" }, () => {
        supabase.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1).then(({ data }) => {
          if (data?.[0]) { setRiskScore(mapRisk(data[0])); flashFresh(); }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_events" }, () => {
        supabase.from("timeline_events").select("*").order("timestamp", { ascending: true }).then(({ data }) => {
          if (data) { setTimeline(data.map(mapTimeline)); flashFresh(); }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rockets" }, () => {
        supabase.from("rockets").select("*").then(({ data }) => {
          if (data) { setRockets(data.map(mapRocket)); flashFresh(); }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [flashFresh]);

  // Track last poll timestamp
  const [lastPollAt, setLastPollAt] = useState<string | null>(null);

  // Live simulation polling — triggers DB writes that feed realtime subscriptions
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        await supabase.functions.invoke('simulate-intel');
        setLastPollAt(new Date().toISOString());
      } catch (err) {
        console.warn('simulate-intel poll error:', err);
      }
    };
    const initialDelay = setTimeout(poll, 5000);
    const interval = setInterval(poll, 45000);
    return () => {
      active = false;
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  // Daily filtered counts
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [airspaceAlerts, vessels, geoAlerts, rockets]);

  const dailyCounts = useMemo(() => {
    const todayAirspace = airspaceAlerts.filter(a => a.active && a.timestamp >= todayStart);
    const todayGeoAlerts = geoAlerts.filter(g => g.timestamp >= todayStart);
    const todayRockets = rockets.filter(r => r.timestamp >= todayStart);
    return {
      airspaceCount: todayAirspace.length,
      vesselCount: vessels.length, // all tracked vessels (persistent entities)
      alertCount: todayGeoAlerts.length + todayAirspace.length,
      rocketCount: todayRockets.filter(r => r.status === 'launched' || r.status === 'in_flight').length,
      impactCount: todayRockets.filter(r => r.status === 'impact' || r.status === 'intercepted').length,
      totalRockets: todayRockets.length,
      todayRockets,
      todayGeoAlerts,
      todayAirspace: todayAirspace as AirspaceAlert[],
    };
  }, [airspaceAlerts, vessels, geoAlerts, rockets, todayStart]);

  return { airspaceAlerts, vessels, geoAlerts, riskScore, timeline, rockets, loading, dataFresh, dailyCounts };
}

// Mappers from DB rows to app types
function mapAirspace(row: any): AirspaceAlert {
  return {
    id: row.id,
    type: row.type,
    region: row.region,
    lat: row.lat,
    lng: row.lng,
    radius: row.radius,
    severity: row.severity,
    description: row.description,
    timestamp: row.timestamp,
    active: row.active,
  };
}

function mapVessel(row: any): MaritimeVessel {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    flag: row.flag,
    lat: row.lat,
    lng: row.lng,
    heading: row.heading,
    speed: row.speed,
    destination: row.destination ?? undefined,
    timestamp: row.timestamp,
  };
}

function mapGeoAlert(row: any): GeoAlert {
  return {
    id: row.id,
    type: row.type,
    region: row.region,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    source: row.source,
    timestamp: row.timestamp,
    lat: row.lat,
    lng: row.lng,
  };
}

function mapRisk(row: any): RiskScore {
  return {
    overall: row.overall,
    airspace: row.airspace,
    maritime: row.maritime,
    diplomatic: row.diplomatic,
    sentiment: row.sentiment,
    trend: row.trend,
    lastUpdated: row.last_updated,
  };
}

function mapTimeline(row: any): TimelineEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    title: row.title,
    severity: row.severity,
  };
}

function mapRocket(row: any): Rocket {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    originLat: row.origin_lat,
    originLng: row.origin_lng,
    currentLat: row.current_lat,
    currentLng: row.current_lng,
    targetLat: row.target_lat,
    targetLng: row.target_lng,
    status: row.status,
    severity: row.severity,
    speed: row.speed,
    altitude: row.altitude,
    timestamp: row.timestamp,
  };
}
