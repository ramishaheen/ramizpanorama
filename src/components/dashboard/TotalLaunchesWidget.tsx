import { useMemo, useState, useEffect } from "react";
import { Bomb, Rocket, Crosshair, Target, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Rocket as RocketType } from "@/data/mockData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface LaunchDay {
  date: string;
  launches: number;
  intercepted: number;
  impact: number;
}

function aggregateWeekly(data: LaunchDay[]) {
  const weeks: { week: string; launches: number; intercepted: number; impact: number }[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const slice = data.slice(i, i + 7);
    weeks.push({
      week: slice[0].date.slice(5),
      launches: slice.reduce((s, d) => s + d.launches, 0),
      intercepted: slice.reduce((s, d) => s + d.intercepted, 0),
      impact: slice.reduce((s, d) => s + d.impact, 0),
    });
  }
  return weeks;
}

function aggregateMonthly(data: LaunchDay[]) {
  const months: Record<string, { month: string; launches: number; intercepted: number; impact: number }> = {};
  for (const d of data) {
    const key = d.date.slice(0, 7);
    const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    if (!months[key]) months[key] = { month: label, launches: 0, intercepted: 0, impact: 0 };
    months[key].launches += d.launches;
    months[key].intercepted += d.intercepted;
    months[key].impact += d.impact;
  }
  return Object.values(months);
}

interface TotalLaunchesWidgetProps {
  rockets: RocketType[];
}

const CustomTooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border bg-card/95 backdrop-blur px-2.5 py-1.5 text-[10px] font-mono shadow-lg">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground">{p.name}: <b>{p.value.toLocaleString()}</b></span>
        </div>
      ))}
    </div>
  );
};

export const TotalLaunchesWidget = ({ rockets }: TotalLaunchesWidgetProps) => {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<LaunchDay[]>([]);
  const [loading, setLoading] = useState(true);

  // Live rocket stats
  const active = rockets.filter(r => r.status === "launched" || r.status === "in_flight").length;
  const todayIntercepted = rockets.filter(r => r.status === "intercepted").length;
  const todayImpact = rockets.filter(r => r.status === "impact").length;

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rockets) map[r.type] = (map[r.type] || 0) + 1;
    return map;
  }, [rockets]);

  // Fetch launch history from DB
  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from("launch_history")
        .select("date, launches, intercepted, impact")
        .order("date", { ascending: true });

      if (data) {
        setHistory(data.map(d => ({
          date: String(d.date),
          launches: d.launches,
          intercepted: d.intercepted,
          impact: d.impact,
        })));
      }
      setLoading(false);
    };

    fetchHistory();

    // Realtime subscription
    const channel = supabase
      .channel("launch_history_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "launch_history" }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Merge today's live rocket data into history
  const mergedHistory = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const existing = history.find(h => h.date === todayStr);

    // If we have a DB record for today, use it (it's already tracked by edge fn)
    // But augment with current in-memory rocket counts for real-time accuracy
    const todayLaunches = existing ? Math.max(existing.launches, rockets.length) : rockets.length;
    const todayIntercepts = existing ? Math.max(existing.intercepted, todayIntercepted) : todayIntercepted;
    const todayImpacts = existing ? Math.max(existing.impact, todayImpact) : todayImpact;

    const withoutToday = history.filter(h => h.date !== todayStr);
    return [
      ...withoutToday,
      { date: todayStr, launches: todayLaunches, intercepted: todayIntercepts, impact: todayImpacts },
    ];
  }, [history, rockets.length, todayIntercepted, todayImpact]);

  const weeklyData = useMemo(() => aggregateWeekly(mergedHistory), [mergedHistory]);
  const monthlyData = useMemo(() => aggregateMonthly(mergedHistory), [mergedHistory]);
  const grandTotal = useMemo(() => mergedHistory.reduce((s, d) => s + d.launches, 0), [mergedHistory]);
  const grandIntercepted = useMemo(() => mergedHistory.reduce((s, d) => s + d.intercepted, 0), [mergedHistory]);
  const grandImpact = useMemo(() => mergedHistory.reduce((s, d) => s + d.impact, 0), [mergedHistory]);
  const interceptRate = grandTotal > 0 ? ((grandIntercepted / grandTotal) * 100).toFixed(1) : "0";
  const daysTracked = mergedHistory.length;

  const tooltip = `🚀 TOTAL WAR LAUNCHES: ${grandTotal.toLocaleString()}\n\n── Today (LIVE) — ${rockets.length} rockets tracked ──\n${Object.entries(byType).map(([t, c]) => `• ${t}: ${c}`).join("\n")}\nActive: ${active} | Intercepted: ${todayIntercepted} | Impact: ${todayImpact}\n\n── Historical (${daysTracked} days tracked) ──\n• Total: ${grandTotal.toLocaleString()}\n• Intercepted: ${grandIntercepted.toLocaleString()} (${interceptRate}%)\n• Impact: ${grandImpact.toLocaleString()}`;

  const ExpandIcon = expanded ? ChevronDown : ChevronUp;
  const hasData = mergedHistory.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-3 left-[40%] -translate-x-1/2 z-[900] flex flex-col rounded-lg border border-destructive/40 bg-card/95 backdrop-blur-md"
      style={{
        boxShadow: "0 0 25px hsl(0 80% 55% / 0.2), inset 0 0 15px hsl(0 80% 55% / 0.05)",
        width: expanded ? 420 : "auto",
      }}
    >
      {/* Expanded chart */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-b border-border/30"
          >
            {!hasData || loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {loading ? "Loading launch history..." : "No historical data yet — launches will be recorded as they occur"}
                </span>
              </div>
            ) : (
              <>
                <div className="px-3 pt-3 pb-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      {weeklyData.length > 4 ? "Weekly" : "Daily"} Launches — Live Data
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                      <span className="text-[9px] font-mono text-success/70">LIVE</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={weeklyData.length > 4 ? weeklyData : mergedHistory.map(d => ({ ...d, week: d.date.slice(5) }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="launchGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0 80% 55%)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(0 80% 55%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="interceptGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(145 70% 45%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(145 70% 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                      <XAxis
                        dataKey={weeklyData.length > 4 ? "week" : "week"}
                        tick={{ fontSize: 8, fill: "hsl(215 15% 50%)", fontFamily: "JetBrains Mono" }}
                        interval={Math.max(0, Math.floor((weeklyData.length > 4 ? weeklyData.length : mergedHistory.length) / 8))}
                        axisLine={{ stroke: "hsl(220 15% 18%)" }}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 8, fill: "hsl(215 15% 50%)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                      <RechartsTooltip content={<CustomTooltipContent />} />
                      <Area type="monotone" dataKey="launches" name="Launches" stroke="hsl(0 80% 55%)" strokeWidth={1.5} fill="url(#launchGrad)" />
                      <Area type="monotone" dataKey="intercepted" name="Intercepted" stroke="hsl(145 70% 45%)" strokeWidth={1} fill="url(#interceptGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {monthlyData.length > 1 && (
                  <div className="px-3 pb-3 pt-1">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
                      Monthly Impact vs Intercepted
                    </div>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={monthlyData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                        <XAxis dataKey="month" tick={{ fontSize: 7, fill: "hsl(215 15% 50%)", fontFamily: "JetBrains Mono" }} interval={Math.max(0, Math.floor(monthlyData.length / 6))} axisLine={{ stroke: "hsl(220 15% 18%)" }} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 7, fill: "hsl(215 15% 50%)" }} />
                        <RechartsTooltip content={<CustomTooltipContent />} />
                        <Bar dataKey="intercepted" name="Intercepted" stackId="a" fill="hsl(145 70% 45%)" />
                        <Bar dataKey="impact" name="Impact" stackId="a" fill="hsl(0 80% 55%)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Summary stats */}
                <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-border/30">
                  <div className="text-[9px] font-mono text-muted-foreground">
                    Intercept Rate: <span className="text-success font-bold">{interceptRate}%</span>
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground">
                    Days tracked: <span className="text-primary font-bold">{daysTracked}</span>
                  </div>
                  {daysTracked > 0 && (
                    <div className="text-[9px] font-mono text-muted-foreground">
                      Avg/day: <span className="text-destructive font-bold">{Math.round(grandTotal / daysTracked)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Pulsing icon */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-10 h-10 rounded-full bg-destructive/20 animate-ping" />
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 border border-destructive/30">
            <Bomb className="w-5 h-5 text-destructive" />
          </div>
        </div>

        {/* Main count */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <div className="text-2xl font-mono font-bold text-destructive leading-none">
                  {grandTotal > 0 ? grandTotal.toLocaleString() : rockets.length.toLocaleString()}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                  Total Launches
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[360px] text-[10px] font-mono leading-relaxed whitespace-pre-line bg-card border-border">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Mini breakdown */}
        <div className="flex flex-col gap-0.5 border-l border-border/50 pl-3 ml-1">
          <div className="flex items-center gap-1.5">
            <Rocket className="w-3 h-3 text-destructive/80" />
            <span className="text-[10px] font-mono text-destructive/80 font-semibold">{active}</span>
            <span className="text-[9px] font-mono text-muted-foreground">active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3 h-3 text-success/80" />
            <span className="text-[10px] font-mono text-success/80 font-semibold">{grandIntercepted > 0 ? grandIntercepted.toLocaleString() : todayIntercepted}</span>
            <span className="text-[9px] font-mono text-muted-foreground">intercepted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-warning/80" />
            <span className="text-[10px] font-mono text-warning/80 font-semibold">{grandImpact > 0 ? grandImpact.toLocaleString() : todayImpact}</span>
            <span className="text-[9px] font-mono text-muted-foreground">impact</span>
          </div>
        </div>

        {/* Expand toggle */}
        <ExpandIcon className="w-4 h-4 text-muted-foreground ml-auto" />
      </div>
    </motion.div>
  );
};
