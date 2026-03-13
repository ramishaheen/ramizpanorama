import { useState, useCallback, useEffect } from "react";
import { Lock, RefreshCw, Skull, ChevronRight, Clock, AlertTriangle, Globe, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface RansomwareLeak {
  id: string;
  group: string;
  victim: string;
  sector: string;
  country: string;
  flag: string;
  dataSize: string;
  deadline: string;
  status: string;
  leakSiteOnion: string;
}

interface RansomwareGroupStat {
  name: string;
  activeLeaks: number;
}

interface RansomwareData {
  leaks: RansomwareLeak[];
  groups: RansomwareGroupStat[];
  totalVictims: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-destructive/20 text-destructive border-destructive/30",
  countdown: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  published: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  negotiating: "bg-primary/20 text-primary border-primary/30",
};

export function RansomwareTracker() {
  const [data, setData] = useState<RansomwareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("dark-web-intel", {
        body: { threatContext: [], mode: "ransomware-summary" },
      });
      if (fnError) throw new Error(fnError.message);
      setData({
        leaks: result?.ransomwareLeaks || [],
        groups: result?.dashboardStats?.activeRansomwareGroups || [],
        totalVictims: (result?.ransomwareLeaks || []).length,
      });
    } catch (err) {
      console.error("Ransomware tracker error:", err);
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetch, 30000);
    return () => clearTimeout(timer);
  }, [fetch]);

  const deadlineCountdown = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return "EXPIRED";
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  return (
    <div className="rounded-lg border border-destructive/20 bg-card/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-destructive/5">
        <Lock className="h-3.5 w-3.5 text-destructive" />
        <span className="text-[10px] font-mono font-bold text-destructive uppercase tracking-wider flex-1">
          Ransomware Tracker
        </span>
        {data && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
            {data.totalVictims} victims
          </span>
        )}
        <button
          onClick={fetch}
          disabled={loading}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="p-4 text-center">
          <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[9px] font-mono text-muted-foreground">Loading dark web intelligence...</p>
        </div>
      )}

      {error && !data && (
        <div className="p-3 text-center">
          <AlertTriangle className="h-4 w-4 text-destructive mx-auto mb-1" />
          <p className="text-[9px] font-mono text-destructive">{error}</p>
          <button onClick={fetch} className="mt-1 text-[8px] font-mono text-primary hover:underline">Retry</button>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="p-4 text-center">
          <Skull className="h-5 w-5 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-[9px] font-mono text-muted-foreground mb-2">Dark web CTI feed not loaded</p>
          <button
            onClick={fetch}
            className="text-[9px] font-mono px-3 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
          >
            Load Ransomware Intel
          </button>
        </div>
      )}

      {data && (
        <ScrollArea className="max-h-[280px]">
          {/* Active Groups Bar */}
          {data.groups.length > 0 && (
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Active Groups</div>
              <div className="flex flex-wrap gap-1">
                {data.groups.slice(0, 6).map(g => (
                  <span
                    key={g.name}
                    className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-destructive/25 bg-destructive/10 text-destructive"
                  >
                    {g.name} · {g.activeLeaks}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Leak entries */}
          <div className="p-2 space-y-1.5">
            {data.leaks.length === 0 ? (
              <div className="text-center text-[9px] font-mono text-muted-foreground py-3">
                <Shield className="h-4 w-4 mx-auto mb-1 text-green-500" />
                No active ransomware leaks detected
              </div>
            ) : (
              data.leaks.slice(0, 8).map(leak => (
                <div
                  key={leak.id}
                  className="p-2 rounded border border-border bg-background/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Skull className="h-3 w-3 text-destructive flex-shrink-0" />
                    <span className="text-[9px] font-bold text-foreground truncate flex-1">{leak.group}</span>
                    <span className={`text-[7px] px-1 py-0.5 rounded border font-mono uppercase ${STATUS_COLORS[leak.status] || STATUS_COLORS.active}`}>
                      {leak.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[8px]">
                    <ChevronRight className="h-2.5 w-2.5 text-destructive flex-shrink-0" />
                    <span className="text-foreground font-medium truncate">{leak.victim}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{leak.sector}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[7px] font-mono">
                    <span className="flex items-center gap-0.5">
                      <Globe className="h-2.5 w-2.5 text-muted-foreground" />
                      <span>{leak.flag}</span>
                      <span className="text-muted-foreground">{leak.country}</span>
                    </span>
                    <span className="text-muted-foreground">{leak.dataSize}</span>
                    <span className="ml-auto flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      <span className={`font-bold ${deadlineCountdown(leak.deadline) === "EXPIRED" ? "text-destructive" : "text-orange-400"}`}>
                        {deadlineCountdown(leak.deadline)}
                      </span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
