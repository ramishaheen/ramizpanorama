import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CCTVEvent {
  id: string;
  camera_id: string;
  event_type: string;
  confidence: number;
  detections: any[];
  summary: string;
  severity: string;
  thumbnail_url: string | null;
  lat: number;
  lng: number;
  created_at: string;
}

export interface AIAnalysis {
  detections: Array<{ type: string; count: number; confidence: number; description: string }>;
  crowd_density: string;
  traffic_level: string;
  visibility: string;
  abnormal_activity: boolean;
  abnormal_description: string;
  overall_severity: string;
  summary: string;
  event_type: string;
}

export interface AnalysisResult {
  analysis: AIAnalysis;
  camera: { id: string; name: string; city: string; country: string };
  thumbnail_url: string;
  stored_event: boolean;
}

export function useCCTVIntel() {
  const [events, setEvents] = useState<CCTVEvent[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [eventStats, setEventStats] = useState<any>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const analyzeCamera = useCallback(async (cameraId: string): Promise<AnalysisResult | null> => {
    setAnalyzing(cameraId);
    try {
      const { data, error } = await supabase.functions.invoke("cctv-ai-analyze", {
        body: { action: "analyze", camera_id: cameraId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastAnalysis(data as AnalysisResult);
      // Refresh events after analysis
      fetchEvents();
      return data as AnalysisResult;
    } catch (e) {
      console.error("AI analysis failed:", e);
      return null;
    } finally {
      setAnalyzing(null);
    }
  }, []);

  const fetchEvents = useCallback(async (cameraId?: string) => {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase.functions.invoke("cctv-ai-analyze", {
        body: { action: "events", camera_id: cameraId, limit: 100 },
      });
      if (!error && data?.events) {
        setEvents(data.events);
      }
    } catch (e) {
      console.error("Failed to fetch events:", e);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("cctv-ai-analyze", {
        body: { action: "stats" },
      });
      if (!error && data) setEventStats(data);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  // Subscribe to realtime events
  useEffect(() => {
    const channel = supabase
      .channel("camera-events-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "camera_events" }, (payload) => {
        setEvents(prev => [payload.new as CCTVEvent, ...prev].slice(0, 100));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Initial load
  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, [fetchEvents, fetchStats]);

  return {
    events,
    analyzing,
    lastAnalysis,
    eventStats,
    loadingEvents,
    analyzeCamera,
    fetchEvents,
    fetchStats,
    setLastAnalysis,
  };
}
