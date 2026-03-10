import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Zap, AlertTriangle, Info, CheckCircle, XCircle, RefreshCw, MapPin } from "lucide-react";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  info: "text-muted-foreground bg-secondary border-border",
};

const EventsFeed = () => {
  const { isAnalyst } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("intel_events").select("*").order("created_at", { ascending: false }).limit(200);
    setEvents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-mono font-bold text-foreground">EVENTS FEED</h1>
          <span className="text-xs text-muted-foreground font-mono">{events.length} events</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={fetchEvents} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-8">No events recorded yet.</div>
          ) : events.map(ev => (
            <div key={ev.id} className={`border rounded-lg p-3 ${SEVERITY_STYLE[ev.severity] || SEVERITY_STYLE.info}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium truncate">{ev.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs opacity-70 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.city ? `${ev.city}, ` : ""}{ev.country}</span>
                    <span>{ev.event_type}</span>
                    <span>{new Date(ev.created_at).toLocaleString()}</span>
                  </div>
                  {ev.summary && <p className="text-xs mt-1 opacity-80">{ev.summary}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/20">{ev.verification_status}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/20">{ev.severity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </IntelLayout>
  );
};

export default EventsFeed;
