import { useState, useEffect, useCallback } from "react";
import { IntelLayout } from "@/components/intel/IntelLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const HEALTH_STYLE: Record<string, string> = {
  online: "text-emerald-400 bg-emerald-400/10",
  intermittent: "text-amber-400 bg-amber-400/10",
  offline: "text-red-400 bg-red-400/10",
  unknown: "text-muted-foreground bg-secondary",
};

const SourceHealth = () => {
  const { isAdmin, isAnalyst } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("source_health").select("*, intel_sources(source_name, country, city)").order("checked_at", { ascending: false }).limit(200);
    setRecords(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (!isAdmin && !isAnalyst) {
    return <IntelLayout><div className="flex items-center justify-center h-full"><Shield className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground ml-2">Admin/Analyst access required</p></div></IntelLayout>;
  }

  return (
    <IntelLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-mono font-bold text-foreground">SOURCE HEALTH</h1>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={fetch} className="h-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : records.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm mt-8">No health checks recorded yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-left text-muted-foreground font-mono uppercase">
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Response</th>
                  <th className="px-3 py-2">Failures</th>
                  <th className="px-3 py-2">Checked</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-2 text-foreground">{(r.intel_sources as any)?.source_name || "—"}</td>
                    <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${HEALTH_STYLE[r.status] || ""}`}>{r.status}</span></td>
                    <td className="px-3 py-2 font-mono">{r.response_time_ms ?? "—"}ms</td>
                    <td className="px-3 py-2 font-mono">{r.failure_count}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(r.checked_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{r.error_message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </IntelLayout>
  );
};

export default SourceHealth;
