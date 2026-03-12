import { TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  trend?: "rising" | "falling" | "stable";
}

interface CountryCostRowProps {
  countries: CountryCost[];
  timestamp: string;
  scenarioMultiplier: number;
  scenario: string;
}

const TrendBadge = ({ trend }: { trend?: "rising" | "falling" | "stable" }) => {
  if (!trend || trend === "stable") {
    return <Minus className="h-2 w-2 text-muted-foreground" />;
  }
  if (trend === "rising") {
    return <TrendingUp className="h-2 w-2 text-critical" />;
  }
  return <TrendingDown className="h-2 w-2 text-success" />;
};

export const CountryCostRow = ({ countries, timestamp, scenarioMultiplier }: CountryCostRowProps) => {
  if (!countries?.length) return null;

  const items = countries.filter(c => c.daily_cost_millions > 0);

  const renderItem = (c: CountryCost, i: number, suffix: string) => {
    const dailyM = c.daily_cost_millions * scenarioMultiplier;
    const totalB = c.total_cost_billions * scenarioMultiplier;
    const flag = flagEmoji(c.code);
    return (
      <span key={`${c.code}-${suffix}-${i}`} className="inline-flex items-center gap-1 mx-3 whitespace-nowrap">
        <span className="text-[10px]">{flag}</span>
        <span className="text-[8px] font-mono font-semibold text-muted-foreground uppercase">{c.country}</span>
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
        <TrendBadge trend={c.trend} />
      </span>
    );
  };

  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-t border-border/30 bg-card/20 py-1">
      <div className="marquee-track flex">
        <div className="marquee-content flex animate-marquee">
          {doubled.map((c, i) => renderItem(c, i, "a"))}
        </div>
        <div className="marquee-content flex animate-marquee" aria-hidden="true">
          {doubled.map((c, i) => renderItem(c, i, "b"))}
        </div>
      </div>
    </div>
  );
};
