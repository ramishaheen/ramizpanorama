import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, CheckCircle, Clock, Search as SearchIcon, MapPin, Shield } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  open: "text-red-400 bg-red-400/10",
  investigating: "text-amber-400 bg-amber-400/10",
  confirmed: "text-orange-400 bg-orange-400/10",
  resolved: "text-emerald-400 bg-emerald-400/10",
  dismissed: "text-muted-foreground bg-secondary",
};

const Incidents = () => {
  const { isAdmin, isAnalyst, user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("intel_incidents").select("*").order("created_at", { ascending: false }).limit(200);
    setIncidents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "resolved") { updates.resolved_by = user?.id; updates.resolved_at = new Date().toISOString(); }
    await supabase.from("intel_incidents").update(updates).eq("id", id);
    fetchIncidents();
  };

  if (!isAdmin && !isAnalyst) {
    return <IntelLayout><div className="flex items-center justify-center h-full"><Shield className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground ml-2">Admin/Analyst access required</p></div></IntelLayout>;
  }

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h1 className="text-lg font-mono font-bold text-foreground">INCIDENTS</h1>
          <span className="text-xs text-muted-foreground font-mono">{incidents.length}</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={fetchIncidents} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : incidents.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-8">No incidents recorded.</div>
          ) : incidents.map(inc => (
            <div key={inc.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-foreground">{inc.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{inc.city ? `${inc.city}, ` : ""}{inc.country}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_STYLE[inc.status] || ""}`}>{inc.status}</span>
                    <span className="text-[10px]">{inc.severity}</span>
                    {inc.correlation_rule && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{inc.correlation_rule}</span>}
                  </div>
                  {inc.summary && <p className="text-xs text-muted-foreground mt-1">{inc.summary}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {inc.status !== "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(inc.id, "resolved")} className="h-7 text-xs gap-1 text-emerald-400"><CheckCircle className="h-3 w-3" />Resolve</Button>
                  )}
                  {inc.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(inc.id, "investigating")} className="h-7 text-xs gap-1 text-amber-400"><Clock className="h-3 w-3" />Investigate</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </IntelLayout>
  );
};

export default Incidents;
