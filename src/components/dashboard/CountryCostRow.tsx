import { motion } from "framer-motion";
import { DollarSign, Info } from "lucide-react";
import { LiveCostCounter } from "./LiveCostCounter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Country code → flag emoji
const flagEmoji = (code: string) => {
  if (!code || code.length !== 2) return "🏳";
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
};

interface CountryCost {
  country: string;
  code: string;
  total_cost_billions: number;
  daily_cost_millions: number;
  breakdown: string;
}

interface CountryCostRowProps {
  countries: CountryCost[];
  timestamp: string;
  scenarioMultiplier: number;
  scenario: string;
}

export const CountryCostRow = ({ countries, timestamp, scenarioMultiplier, scenario }: CountryCostRowProps) => {
  if (!countries?.length) return null;

  return (
    <div className="border-t border-border/30 bg-card/20">
      <div className="px-3 py-0.5">
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Per-Country Live Cost</span>
      </div>
      <div className="grid gap-1 px-3 pb-1" style={{ gridTemplateColumns: `repeat(${Math.min(countries.length, 6)}, 1fr)` }}>
        {countries.map((c) => {
          const dailyM = c.daily_cost_millions * scenarioMultiplier;
          const totalB = c.total_cost_billions * scenarioMultiplier;
          const flag = flagEmoji(c.code);

          const card = (
            <motion.div
              key={c.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded-md"
            >
              <span className="text-sm flex-shrink-0">{flag}</span>
              <div className="flex-1 min-w-0">
                <LiveCostCounter
                  dailyCostMillions={dailyM}
                  startTimestamp={timestamp}
                  prefix="$"
                  suffix="B"
                  color="text-critical"
                  decimals={3}
                  isBillions
                  cumulativeBase={totalB}
                />
                <div className="text-[8px] text-muted-foreground uppercase tracking-wider truncate">{c.country}</div>
              </div>
              <Info className="h-2.5 w-2.5 text-muted-foreground/40 flex-shrink-0" />
            </motion.div>
          );

          return (
            <TooltipProvider key={c.code} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>{card}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[380px] max-h-[300px] overflow-y-auto text-[10px] font-mono leading-relaxed whitespace-pre-line bg-card border-border">
                  {`${flag} ${c.country} [${scenario.toUpperCase()}]\n\nTotal since Oct 2023: $${totalB.toFixed(1)}B\nDaily: $${dailyM.toFixed(0)}M/day\nPer second: $${(dailyM * 1e6 / 86400).toFixed(0)}/sec\n\n${c.breakdown}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      {countries.length > 6 && (
        <div className="grid gap-1 px-3 pb-1" style={{ gridTemplateColumns: `repeat(${Math.min(countries.length - 6, 6)}, 1fr)` }}>
          {countries.slice(6).map((c) => {
            const dailyM = c.daily_cost_millions * scenarioMultiplier;
            const totalB = c.total_cost_billions * scenarioMultiplier;
            const flag = flagEmoji(c.code);

            const card = (
              <motion.div
                key={c.code}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded-md"
              >
                <span className="text-sm flex-shrink-0">{flag}</span>
                <div className="flex-1 min-w-0">
                  <LiveCostCounter
                    dailyCostMillions={dailyM}
                    startTimestamp={timestamp}
                    prefix="$"
                    suffix="B"
                    color="text-critical"
                    decimals={3}
                    isBillions
                    cumulativeBase={totalB}
                  />
                  <div className="text-[8px] text-muted-foreground uppercase tracking-wider truncate">{c.country}</div>
                </div>
                <Info className="h-2.5 w-2.5 text-muted-foreground/40 flex-shrink-0" />
              </motion.div>
            );

            return (
              <TooltipProvider key={c.code} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>{card}</TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[380px] max-h-[300px] overflow-y-auto text-[10px] font-mono leading-relaxed whitespace-pre-line bg-card border-border">
                    {`${flag} ${c.country} [${scenario.toUpperCase()}]\n\nTotal since Oct 2023: $${totalB.toFixed(1)}B\nDaily: $${dailyM.toFixed(0)}M/day\nPer second: $${(dailyM * 1e6 / 86400).toFixed(0)}/sec\n\n${c.breakdown}`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}
    </div>
  );
};
