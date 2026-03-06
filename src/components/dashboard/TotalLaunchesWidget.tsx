import { useMemo } from "react";
import { Bomb, Rocket, Crosshair, Target } from "lucide-react";
import { motion } from "framer-motion";
import type { Rocket as RocketType } from "@/data/mockData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TotalLaunchesWidgetProps {
  rockets: RocketType[];
}

export const TotalLaunchesWidget = ({ rockets }: TotalLaunchesWidgetProps) => {
  const total = rockets.length;
  const active = rockets.filter(r => r.status === "launched" || r.status === "in_flight").length;
  const intercepted = rockets.filter(r => r.status === "intercepted").length;
  const impact = rockets.filter(r => r.status === "impact").length;

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rockets) map[r.type] = (map[r.type] || 0) + 1;
    return map;
  }, [rockets]);

  const tooltip = `🚀 TOTAL WAR LAUNCHES: ${total}\n\n── By Type ──\n${Object.entries(byType).map(([t, c]) => `• ${t}: ${c}`).join("\n")}\n\n── By Status ──\n• Active: ${active}\n• Intercepted: ${intercepted}\n• Impact: ${impact}`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed bottom-4 left-4 z-[900] flex items-center gap-3 px-4 py-3 rounded-lg border border-destructive/40 bg-card/95 backdrop-blur-md cursor-default"
            style={{ boxShadow: "0 0 25px hsl(0 80% 55% / 0.2), inset 0 0 15px hsl(0 80% 55% / 0.05)" }}
          >
            {/* Pulsing icon */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-10 h-10 rounded-full bg-destructive/20 animate-ping" />
              <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 border border-destructive/30">
                <Bomb className="w-5 h-5 text-destructive" />
              </div>
            </div>

            {/* Main count */}
            <div>
              <div className="text-2xl font-mono font-bold text-destructive leading-none">
                {total.toLocaleString()}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">
                Total Launches
              </div>
            </div>

            {/* Mini breakdown */}
            <div className="flex flex-col gap-0.5 border-l border-border/50 pl-3 ml-1">
              <div className="flex items-center gap-1.5">
                <Rocket className="w-3 h-3 text-destructive/80" />
                <span className="text-[10px] font-mono text-destructive/80 font-semibold">{active}</span>
                <span className="text-[9px] font-mono text-muted-foreground">active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-3 h-3 text-success/80" />
                <span className="text-[10px] font-mono text-success/80 font-semibold">{intercepted}</span>
                <span className="text-[9px] font-mono text-muted-foreground">intercepted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-warning/80" />
                <span className="text-[10px] font-mono text-warning/80 font-semibold">{impact}</span>
                <span className="text-[9px] font-mono text-muted-foreground">impact</span>
              </div>
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[360px] text-[10px] font-mono leading-relaxed whitespace-pre-line bg-card border-border">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
