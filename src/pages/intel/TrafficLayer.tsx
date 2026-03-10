import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Route, RefreshCw, MapPin } from "lucide-react";

const CONGESTION_STYLE: Record<string, string> = {
  free_flow: "text-emerald-400 bg-emerald-400/10",
  light: "text-green-400 bg-green-400/10",
  moderate: "text-amber-400 bg-amber-400/10",
  heavy: "text-orange-400 bg-orange-400/10",
  standstill: "text-red-400 bg-red-400/10",
  unknown: "text-muted-foreground bg-secondary",
};

const TrafficLayer = () => {
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("traffic_segments").select("*").order("updated_at", { ascending: false }).limit(200);
    setSegments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Route className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-mono font-bold text-foreground">TRAFFIC INTELLIGENCE</h1>
          <span className="text-xs text-muted-foreground font-mono">{segments.length} segments</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={fetch} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : segments.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-8">No traffic segments. Connect a traffic API in Connectors to start ingesting data.</div>
          ) : segments.map(seg => (
            <div key={seg.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
              <div className={`px-2 py-1 rounded text-[10px] font-mono uppercase ${CONGESTION_STYLE[seg.congestion_level] || ""}`}>{seg.congestion_level.replace(/_/g, " ")}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{seg.road_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {seg.incident_type && <span>{seg.incident_type}</span>}
                  <span>{seg.source_provider}</span>
                  {seg.speed_index != null && <span>Speed: {seg.speed_index.toFixed(0)}</span>}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(seg.updated_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </IntelLayout>
  );
};

export default TrafficLayer;
