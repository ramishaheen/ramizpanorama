import { motion } from "framer-motion";
import { LiveCostCounter } from "./LiveCostCounter";

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

export const CountryCostRow = ({ countries, timestamp, scenarioMultiplier }: CountryCostRowProps) => {
  if (!countries?.length) return null;

  const items = countries.filter(c => c.daily_cost_millions > 0);

  return (
    <div className="relative overflow-hidden border-t border-border/30 bg-card/20 py-1">
      <div className="marquee-track flex">
        <div className="marquee-content flex animate-marquee">
          {[...items, ...items].map((c, i) => {
            const dailyM = c.daily_cost_millions * scenarioMultiplier;
            const totalB = c.total_cost_billions * scenarioMultiplier;
            const flag = flagEmoji(c.code);
            return (
              <span key={`${c.code}-${i}`} className="inline-flex items-center gap-1.5 mx-5 whitespace-nowrap">
                <span className="text-sm">{flag}</span>
                <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">{c.country}</span>
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
              </span>
            );
          })}
        </div>
        <div className="marquee-content flex animate-marquee" aria-hidden="true">
          {[...items, ...items].map((c, i) => {
            const dailyM = c.daily_cost_millions * scenarioMultiplier;
            const totalB = c.total_cost_billions * scenarioMultiplier;
            const flag = flagEmoji(c.code);
            return (
              <span key={`${c.code}-dup-${i}`} className="inline-flex items-center gap-1.5 mx-5 whitespace-nowrap">
                <span className="text-sm">{flag}</span>
                <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">{c.country}</span>
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
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
