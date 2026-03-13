import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShooterAsset {
  id: string;
  asset_type: string;
  callsign: string;
  lat: number;
  lng: number;
  altitude_ft: number;
  heading: number;
  speed_kts: number;
  fuel_remaining_pct: number;
  fuel_range_nm: number;
  current_tasking: string;
  payload: any;
  command_link_status: string;
  roe_zone: string;
  parent_unit: string;
  last_updated: string;
}

export interface StrikeRecommendation {
  id: string;
  target_track_id: string;
  shooter_asset_id: string;
  kill_chain_task_id: string | null;
  recommended_weapon: string;
  time_to_target_min: number;
  probability_of_kill: number;
  collateral_risk: string;
  roe_status: string;
  decision: string;
  decided_by: string | null;
  decided_at: string | null;
  ai_reasoning: string;
  proximity_km: number;
  payload_match_score: number;
  created_at: string;
  target_tracks?: any;
  shooter_assets?: any;
}

export interface ActionLog {
  id: string;
  strike_recommendation_id: string | null;
  target_track_id: string | null;
  operator_id: string | null;
  decision_time_sec: number;
  effect: string;
  evidence_link: string;
  bda_image_url: string;
  bda_summary: string;
  lat: number;
  lng: number;
  created_at: string;
}

export function useSensorToShooter() {
  const [shooters, setShooters] = useState<ShooterAsset[]>([]);
  const [recommendations, setRecommendations] = useState<StrikeRecommendation[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [darkVesselResult, setDarkVesselResult] = useState<any>(null);

  const fetchShooters = useCallback(async () => {
    const { data } = await supabase.from("shooter_assets").select("*").order("callsign");
    if (data) setShooters(data as unknown as ShooterAsset[]);
  }, []);

  const fetchRecommendations = useCallback(async () => {
    const { data } = await supabase
      .from("strike_recommendations")
      .select("*, target_tracks(*), shooter_assets(*)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setRecommendations(data as unknown as StrikeRecommendation[]);
  }, []);

  const fetchActionLogs = useCallback(async () => {
    const { data } = await supabase.from("action_logs").select("*").order("created_at", { ascending: false }).limit(20);
    if (data) setActionLogs(data as unknown as ActionLog[]);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchShooters(), fetchRecommendations(), fetchActionLogs()]);
    setLoading(false);
  }, [fetchShooters, fetchRecommendations, fetchActionLogs]);

  useEffect(() => {
    fetchAll();
    const ch1 = supabase.channel("s2s_recs_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "strike_recommendations" }, () => fetchRecommendations())
      .subscribe();
    const ch2 = supabase.channel("s2s_shooters_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "shooter_assets" }, () => fetchShooters())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [fetchAll, fetchRecommendations, fetchShooters]);

  const matchShooters = useCallback(async (targetTrackId: string) => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensor-to-shooter", {
        body: { action: "match_shooters", target_track_id: targetTrackId },
      });
      if (!error && data) {
        await fetchRecommendations();
        return data;
      }
      return null;
    } finally {
      setMatching(false);
    }
  }, [fetchRecommendations]);

  const commitStrike = useCallback(async (recommendationId: string) => {
    const { data, error } = await supabase.functions.invoke("sensor-to-shooter", {
      body: { action: "commit_strike", recommendation_id: recommendationId },
    });
    if (!error) {
      await Promise.all([fetchRecommendations(), fetchShooters(), fetchActionLogs()]);
    }
    return data;
  }, [fetchRecommendations, fetchShooters, fetchActionLogs]);

  const discardStrike = useCallback(async (recommendationId: string, reason?: string) => {
    await supabase.functions.invoke("sensor-to-shooter", {
      body: { action: "discard_strike", recommendation_id: recommendationId, reason },
    });
    await fetchRecommendations();
  }, [fetchRecommendations]);

  const detectDarkVessel = useCallback(async (region: string = "bab_el_mandeb") => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensor-to-shooter", {
        body: { action: "dark_vessel_detect", region },
      });
      if (!error && data) {
        setDarkVesselResult(data);
        await fetchRecommendations();
        return data;
      }
      return null;
    } finally {
      setMatching(false);
    }
  }, [fetchRecommendations]);

  const pendingCount = recommendations.filter(r => r.decision === "pending").length;
  const committedCount = recommendations.filter(r => r.decision === "committed").length;
  const idleShooters = shooters.filter(s => s.current_tasking === "idle").length;

  return {
    shooters,
    recommendations,
    actionLogs,
    loading,
    matching,
    darkVesselResult,
    pendingCount,
    committedCount,
    idleShooters,
    fetchAll,
    matchShooters,
    commitStrike,
    discardStrike,
    detectDarkVessel,
  };
}
