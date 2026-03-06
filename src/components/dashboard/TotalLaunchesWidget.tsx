import { useMemo, useState } from "react";
import { Bomb, Rocket, Crosshair, Target, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Rocket as RocketType } from "@/data/mockData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, Cell } from "recharts";

// Generate historical launch data from Oct 7 2023 to present
function generateHistoricalData() {
  const data: { date: string; launches: number; intercepted: number; impact: number; month: string }[] = [];
  const start = new Date("2023-10-07");
  const end = new Date();
  const cur = new Date(start);

  // Seed for deterministic-ish data
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807 + 11) % 2147483647;
    return (seed % 1000) / 1000;
  };

  while (cur <= end) {
    const daysSinceStart = Math.floor((cur.getTime() - start.getTime()) / 86400000);
    const month = cur.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    // Escalation phases
    let baseLaunches: number;
    if (daysSinceStart < 30) baseLaunches = 80 + rand() * 120; // Initial surge
    else if (daysSinceStart < 120) baseLaunches = 40 + rand() * 60;
    else if (daysSinceStart < 300) baseLaunches = 20 + rand() * 50;
    else if (daysSinceStart < 500) baseLaunches = 30 + rand() * 70; // Escalation
    else if (daysSinceStart < 700) baseLaunches = 15 + rand() * 45;
    else baseLaunches = 25 + rand() * 55; // Recent uptick

    // Spike days (major events)
    if (rand() < 0.04) baseLaunches *= 2 + rand();

    const launches = Math.round(baseLaunches);
    const interceptRate = 0.6 + rand() * 0.25;
    const intercepted = Math.round(launches * interceptRate);
    const impact = launches - intercepted;

    data.push({
      date: cur.toISOString().slice(0, 10),
      launches,
      intercepted,
      impact,
      month,
    });

    cur.setDate(cur.getDate() + 1);
  }
  return data;
}

const historicalData = generateHistoricalData();

// Aggregate to weekly for chart readability
function aggregateWeekly(data: typeof historicalData) {
  const weeks: { week: string; launches: number; intercepted: number; impact: number }[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const slice = data.slice(i, i + 7);
    const launches = slice.reduce((s, d) => s + d.launches, 0);
    const intercepted = slice.reduce((s, d) => s + d.intercepted, 0);
    const impact = slice.reduce((s, d) => s + d.impact, 0);
    const weekLabel = slice[0].date.slice(5); // MM-DD
    weeks.push({ week: weekLabel, launches, intercepted, impact });
  }
  return weeks;
}

// Aggregate to monthly for bar chart
function aggregateMonthly(data: typeof historicalData) {
  const months: Record<string, { month: string; launches: number; intercepted: number; impact: number }> = {};
  for (const d of data) {
    const key = d.date.slice(0, 7);
    const label = new Date(d.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
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
  const total = rockets.length;
  const active = rockets.filter(r => r.status === "launched" || r.status === "in_flight").length;
  const intercepted = rockets.filter(r => r.status === "intercepted").length;
  const impact = rockets.filter(r => r.status === "impact").length;

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rockets) map[r.type] = (map[r.type] || 0) + 1;
    return map;
  }, [rockets]);

  // Merge live "today" data into historical, replacing mock for today
  const mergedHistorical = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const withoutToday = historicalData.filter(d => d.date !== todayStr);
    const todayEntry = {
      date: todayStr,
      launches: total,
      intercepted,
      impact,
      month: new Date().toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    };
    return [...withoutToday, todayEntry];
  }, [total, intercepted, impact]);

  const weeklyData = useMemo(() => aggregateWeekly(mergedHistorical), [mergedHistorical]);
  const monthlyData = useMemo(() => aggregateMonthly(mergedHistorical), [mergedHistorical]);
  const grandTotal = useMemo(() => mergedHistorical.reduce((s, d) => s + d.launches, 0), [mergedHistorical]);
  const grandIntercepted = useMemo(() => mergedHistorical.reduce((s, d) => s + d.intercepted, 0), [mergedHistorical]);
  const grandImpact = useMemo(() => mergedHistorical.reduce((s, d) => s + d.impact, 0), [mergedHistorical]);
  const interceptRate = grandTotal > 0 ? ((grandIntercepted / grandTotal) * 100).toFixed(1) : "0";

  const tooltip = `🚀 TOTAL WAR LAUNCHES: ${grandTotal.toLocaleString()}\n\n── Today (LIVE) — ${total} launches ──\n${Object.entries(byType).map(([t, c]) => `• ${t}: ${c}`).join("\n")}\nActive: ${active} | Intercepted: ${intercepted} | Impact: ${impact}\n\n── Historical (Oct 7 2023 – present) ──\n• Total: ${grandTotal.toLocaleString()}\n• Intercepted: ${grandIntercepted.toLocaleString()} (${interceptRate}%)\n• Impact: ${grandImpact.toLocaleString()}`;

  const ExpandIcon = expanded ? ChevronDown : ChevronUp;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[900] flex flex-col rounded-lg border border-destructive/40 bg-card/95 backdrop-blur-md"
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
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  Weekly Launches — Oct 2023 to Present
                </span>
                <span className="text-[10px] font-mono text-destructive/70">
                  {grandTotal.toLocaleString()} total
                </span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
                    dataKey="week"
                    tick={{ fontSize: 8, fill: "hsl(215 15% 50%)", fontFamily: "JetBrains Mono" }}
                    interval={12}
                    axisLine={{ stroke: "hsl(220 15% 18%)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 8, fill: "hsl(215 15% 50%)", fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<CustomTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="launches"
                    name="Launches"
                    stroke="hsl(0 80% 55%)"
                    strokeWidth={1.5}
                    fill="url(#launchGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="intercepted"
                    name="Intercepted"
                    stroke="hsl(145 70% 45%)"
                    strokeWidth={1}
                    fill="url(#interceptGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly bar chart */}
            <div className="px-3 pb-3 pt-1">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
                Monthly Impact vs Intercepted
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={monthlyData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 7, fill: "hsl(215 15% 50%)", fontFamily: "JetBrains Mono" }}
                    interval={2}
                    axisLine={{ stroke: "hsl(220 15% 18%)" }}
                    tickLine={false}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 7, fill: "hsl(215 15% 50%)" }} />
                  <RechartsTooltip content={<CustomTooltipContent />} />
                  <Bar dataKey="intercepted" name="Intercepted" stackId="a" fill="hsl(145 70% 45%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="impact" name="Impact" stackId="a" fill="hsl(0 80% 55%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Summary stats */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                <div className="text-[9px] font-mono text-muted-foreground">
                  Intercept Rate: <span className="text-success font-bold">{interceptRate}%</span>
                </div>
                <div className="text-[9px] font-mono text-muted-foreground">
                  Avg/day: <span className="text-destructive font-bold">{Math.round(grandTotal / historicalData.length)}</span>
                </div>
                <div className="text-[9px] font-mono text-muted-foreground">
                  Peak week: <span className="text-warning font-bold">{Math.max(...weeklyData.map(w => w.launches)).toLocaleString()}</span>
                </div>
              </div>
            </div>
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
                  {grandTotal.toLocaleString()}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">
                  Total Launches
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
            <span className="text-[10px] font-mono text-success/80 font-semibold">{grandIntercepted.toLocaleString()}</span>
            <span className="text-[9px] font-mono text-muted-foreground">intercepted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-warning/80" />
            <span className="text-[10px] font-mono text-warning/80 font-semibold">{grandImpact.toLocaleString()}</span>
            <span className="text-[9px] font-mono text-muted-foreground">impact</span>
          </div>
        </div>

        {/* Expand toggle */}
        <ExpandIcon className="w-4 h-4 text-muted-foreground ml-auto" />
      </div>
    </motion.div>
  );
};
