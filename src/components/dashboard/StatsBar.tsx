import { Plane, Ship, AlertTriangle, Activity, Fuel, CircleDollarSign, Bitcoin, TrendingUp, TrendingDown, Rocket, Target, DollarSign, Building2, PlaneTakeoff, Anchor, HardHat, Shield, Info } from "lucide-react";
import { motion, useSpring, useTransform } from "framer-motion";
import { useCommodityPrices } from "@/hooks/useCommodityPrices";
import { useWarCosts } from "@/hooks/useWarCosts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";
import { LiveCostCounter } from "./LiveCostCounter";
import { ScenarioToggle, type Scenario } from "./ScenarioToggle";

interface StatsBarProps {
  airspaceCount: number;
  vesselCount: number;
  alertCount: number;
  riskScore: number;
  rocketCount?: number;
  impactCount?: number;
  dataFresh?: boolean;
}

const AnimatedNumber = ({ value, color }: { value: number | string; color: string }) => {
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  const spring = useSpring(num, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  const [displayVal, setDisplayVal] = useState(num);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(num);

  useEffect(() => {
    if (prevRef.current !== num) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      prevRef.current = num;
    }
    spring.set(num);
  }, [num, spring]);

  useEffect(() => {
    const unsub = display.on("change", (v) => setDisplayVal(v));
    return unsub;
  }, [display]);

  return (
    <motion.div
      className={`text-sm font-mono font-bold ${color} transition-colors duration-300`}
      animate={flash ? { scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.4 }}
    >
      {displayVal}
    </motion.div>
  );
};

const StatusDot = ({ status }: { status?: "normal" | "elevated" | "critical" }) => {
  if (!status || status === "normal") return null;
  const dotColor = status === "critical" ? "bg-red-500" : "bg-amber-500";
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color, pulse, prefix, tooltip, liveContent, liveModifier }: { icon: any; label: string; value?: number | string; color: string; pulse?: boolean; prefix?: string; tooltip?: string; liveContent?: React.ReactNode; liveModifier?: "normal" | "elevated" | "critical" }) => {
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-1.5 px-2 py-1 bg-card border rounded-md transition-all duration-500 relative ${pulse ? "border-primary/50 glow-primary" : "border-border"}`}
    >
      <Icon className={`h-3 w-3 ${color} ${pulse ? "animate-pulse" : ""}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5">
          {liveContent ? liveContent : (
            <>
              {prefix && <span className={`text-sm font-mono font-bold ${color}`}>{prefix}</span>}
              {value !== undefined && <AnimatedNumber value={value} color={color} />}
            </>
          )}
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
      <StatusDot status={liveModifier} />
      {tooltip && <Info className="h-2.5 w-2.5 text-muted-foreground/40 flex-shrink-0" />}
    </motion.div>
  );

  if (!tooltip) return card;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[420px] max-h-[400px] overflow-y-auto text-[10px] font-mono leading-relaxed whitespace-pre-line bg-card border-border">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const MarqueeItem = ({ icon: Icon, label, price, change, changePercent }: {
  icon: any;
  label: string;
  price: number;
  change: number;
  changePercent: number;
}) => {
  const isUp = change >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;
  const changeColor = isUp ? "text-success" : "text-critical";

  return (
    <span className="inline-flex items-center gap-1.5 mx-6 whitespace-nowrap">
      <Icon className="h-3 w-3 text-warning" />
      <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="text-[11px] font-mono font-bold text-foreground">
        ${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
      <TrendIcon className={`h-3 w-3 ${changeColor}`} />
      <span className={`text-[10px] font-mono font-semibold ${changeColor}`}>
        {isUp ? "+" : ""}{changePercent}%
      </span>
    </span>
  );
};

export const StatsBar = ({ airspaceCount, vesselCount, alertCount, riskScore, rocketCount = 0, impactCount = 0, dataFresh }: StatsBarProps) => {
  const { oil, gold, btc, eth, loading } = useCommodityPrices();
  const warCosts = useWarCosts();
  const { t } = useLanguage();
  const [scenario, setScenario] = useState<Scenario>("base");

  const sectorIcons: Record<string, any> = {
    "Oil & Energy": Fuel,
    "Aviation & Airspace": PlaneTakeoff,
    "Tourism & Hospitality": Building2,
    "Shipping & Trade": Anchor,
    "Real Estate & Construction": HardHat,
    "Defense Spending": Shield,
  };

  // Scenario multipliers: conservative=0.7, base=1.0, severe=1.4
  const scenarioMultiplier = scenario === "conservative" ? 0.7 : scenario === "severe" ? 1.4 : 1.0;

  const scenarioCumulative = useMemo(() => {
    if (!warCosts.data) return 0;
    const scenarios = warCosts.data.scenarios;
    if (scenarios) {
      if (scenario === "conservative") return scenarios.conservative_billions;
      if (scenario === "severe") return scenarios.severe_billions;
      return scenarios.base_billions;
    }
    return warCosts.data.cumulative_estimate_billions * scenarioMultiplier;
  }, [warCosts.data, scenario, scenarioMultiplier]);

  const timestamp = warCosts.data?.timestamp || new Date().toISOString();

  return (
    <div className="space-y-0">
      {/* Stats cards */}
      <div className={`grid grid-cols-6 gap-1.5 px-3 py-1 transition-shadow duration-500 ${dataFresh ? "shadow-[inset_0_0_20px_hsl(190_100%_50%/0.06)]" : ""}`}>
        <StatCard icon={Plane} label={t(tr["stat.airspace"].en, tr["stat.airspace"].ar)} value={airspaceCount} color="text-primary" pulse={dataFresh} />
        <StatCard icon={Ship} label={t(tr["stat.vessels"].en, tr["stat.vessels"].ar)} value={vesselCount} color="text-primary" pulse={dataFresh} />
        <StatCard icon={Rocket} label={t(tr["stat.missiles"].en, tr["stat.missiles"].ar)} value={rocketCount} color={rocketCount > 0 ? "text-critical" : "text-muted-foreground"} pulse={rocketCount > 0} />
        <StatCard icon={Target} label={t(tr["stat.impacts"].en, tr["stat.impacts"].ar)} value={impactCount} color="text-warning" pulse={dataFresh} />
        <StatCard icon={AlertTriangle} label={t(tr["stat.alerts"].en, tr["stat.alerts"].ar)} value={alertCount} color="text-warning" pulse={dataFresh} />
        <StatCard icon={Activity} label={t(tr["stat.risk"].en, tr["stat.risk"].ar)} value={riskScore} color={riskScore >= 60 ? "text-warning" : "text-success"} pulse={dataFresh} />
      </div>

      {/* War cost cards - LIVE TICKING */}
      {warCosts.data && !warCosts.error && (
        <div className="border-t border-border/50 bg-card/30">
          <div className="flex items-center justify-between px-3 py-0.5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">War Cost Estimate</span>
            <ScenarioToggle active={scenario} onChange={setScenario} />
          </div>
          <div className={`grid grid-cols-8 gap-1.5 px-3 py-1 transition-shadow duration-500`}>
            <StatCard
              icon={DollarSign}
              label={t(tr["stat.daily_cost"].en, tr["stat.daily_cost"].ar)}
              color="text-critical"
              pulse
              liveContent={
                <LiveCostCounter
                  dailyCostMillions={warCosts.data.total_daily_cost_billions * 1000 * scenarioMultiplier}
                  startTimestamp={timestamp}
                  prefix="$"
                  suffix="B/day"
                  color="text-critical"
                  decimals={3}
                  isBillions
                  cumulativeBase={warCosts.data.total_daily_cost_billions * scenarioMultiplier}
                />
              }
              tooltip={`🔴 LIVE [${scenario.toUpperCase()}] — Daily cost: $${(warCosts.data.total_daily_cost_billions * scenarioMultiplier).toFixed(2)}B/day\nScenario: ${scenario} (${scenarioMultiplier}x)\n\n── Per-Sector Daily Rate ──\n${warCosts.data.sectors.map(s => `• ${s.name}: $${(s.daily_cost_millions * scenarioMultiplier).toFixed(0)}M/day`).join("\n")}${warCosts.data.country_costs?.length ? `\n\n── Per-Country Daily Cost ──\n${warCosts.data.country_costs.map(c => `🏳 ${c.country}: $${(c.daily_cost_millions * scenarioMultiplier).toFixed(0)}M/day`).join("\n")}` : ""}${warCosts.data.methodology ? `\n\nMethodology: ${warCosts.data.methodology}` : ""}`}
            />
            <StatCard
              icon={DollarSign}
              label={t(tr["stat.total_cost"].en, tr["stat.total_cost"].ar)}
              color="text-critical"
              liveContent={
                <LiveCostCounter
                  dailyCostMillions={warCosts.data.total_daily_cost_billions * 1000 * scenarioMultiplier}
                  startTimestamp={timestamp}
                  prefix="$"
                  suffix="B"
                  color="text-critical"
                  decimals={4}
                  isBillions
                  cumulativeBase={scenarioCumulative}
                />
              }
              tooltip={`🔴 LIVE [${scenario.toUpperCase()}] — Cumulative since Oct 2023: $${scenarioCumulative.toFixed(2)}B\n${warCosts.data.scenarios ? `Conservative: $${warCosts.data.scenarios.conservative_billions}B | Base: $${warCosts.data.scenarios.base_billions}B | Severe: $${warCosts.data.scenarios.severe_billions}B` : ""}\nTicking at $${(warCosts.data.total_daily_cost_billions * scenarioMultiplier * 1e9 / 86400).toFixed(0)}/sec\n\n── Per-Country Total Cost ──\n${warCosts.data.country_costs?.map(c => `🏳 ${c.country}: $${(c.total_cost_billions * scenarioMultiplier).toFixed(1)}B\n   ${c.breakdown}`).join("\n\n") || "Loading..."}\n\n── Sector Breakdown ──\n${warCosts.data.sectors.map(s => `• ${s.name}: $${(s.daily_cost_millions * scenarioMultiplier).toFixed(0)}M/day — ${s.description}`).join("\n")}${warCosts.data.methodology ? `\n\nMethodology: ${warCosts.data.methodology}` : ""}\n\nLast analyzed: ${new Date(warCosts.data.timestamp).toLocaleString()}`}
            />
            {warCosts.data.sectors.map((sector) => {
              const SectorIcon = sectorIcons[sector.name] || DollarSign;
              const sectorBillions = (sector.daily_cost_millions * scenarioMultiplier) / 1000;
              return (
                <StatCard
                  key={sector.name}
                  icon={SectorIcon}
                  label={sector.name}
                  color="text-warning"
                  liveContent={
                    <LiveCostCounter
                      dailyCostMillions={sector.daily_cost_millions * scenarioMultiplier}
                      startTimestamp={timestamp}
                      prefix="$"
                      suffix="B/day"
                      color="text-warning"
                      decimals={3}
                      isBillions
                      cumulativeBase={sectorBillions}
                    />
                  }
                  liveModifier={sector.live_modifier}
                  tooltip={`🔴 LIVE [${scenario.toUpperCase()}] — ${sector.name}${sector.live_modifier && sector.live_modifier !== "normal" ? ` [${sector.live_modifier.toUpperCase()}]` : ""}\nDaily: $${sectorBillions.toFixed(2)}B/day ($${(sector.daily_cost_millions * scenarioMultiplier).toFixed(0)}M)\nPer second: $${(sector.daily_cost_millions * scenarioMultiplier * 1e6 / 86400).toFixed(0)}/sec\n\n${sector.description}${warCosts.data?.country_costs?.length ? `\n\n── Country Impact ──\n${warCosts.data.country_costs.filter(c => c.daily_cost_millions > 0).map(c => `• ${c.country}: $${(c.daily_cost_millions * scenarioMultiplier / 1000).toFixed(2)}B/day`).join("\n")}` : ""}`}
                />
              );
            })}
          </div>
        </div>
      )}
      {warCosts.loading && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border/50">
          <div className="h-3 w-3 border border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[9px] text-muted-foreground font-mono uppercase">{t(tr["stat.calculating"].en, tr["stat.calculating"].ar)}</span>
        </div>
      )}

      {/* Marquee ticker */}
      {!loading && (
        <div className="relative overflow-hidden bg-card/60 border-y border-border py-1">
          <div className="marquee-track flex">
            <div className="marquee-content flex animate-marquee">
              <MarqueeItem icon={Fuel} label="WTI Crude" price={oil.price} change={oil.change} changePercent={oil.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Gold XAU" price={gold.price} change={gold.change} changePercent={gold.changePercent} />
              <MarqueeItem icon={Bitcoin} label="BTC" price={btc.price} change={btc.change} changePercent={btc.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="ETH" price={eth.price} change={eth.change} changePercent={eth.changePercent} />
              <MarqueeItem icon={Fuel} label="WTI Crude" price={oil.price} change={oil.change} changePercent={oil.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Gold XAU" price={gold.price} change={gold.change} changePercent={gold.changePercent} />
              <MarqueeItem icon={Bitcoin} label="BTC" price={btc.price} change={btc.change} changePercent={btc.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="ETH" price={eth.price} change={eth.change} changePercent={eth.changePercent} />
            </div>
            <div className="marquee-content flex animate-marquee" aria-hidden="true">
              <MarqueeItem icon={Fuel} label="WTI Crude" price={oil.price} change={oil.change} changePercent={oil.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Gold XAU" price={gold.price} change={gold.change} changePercent={gold.changePercent} />
              <MarqueeItem icon={Bitcoin} label="BTC" price={btc.price} change={btc.change} changePercent={btc.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="ETH" price={eth.price} change={eth.change} changePercent={eth.changePercent} />
              <MarqueeItem icon={Fuel} label="WTI Crude" price={oil.price} change={oil.change} changePercent={oil.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Gold XAU" price={gold.price} change={gold.change} changePercent={gold.changePercent} />
              <MarqueeItem icon={Bitcoin} label="BTC" price={btc.price} change={btc.change} changePercent={btc.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="ETH" price={eth.price} change={eth.change} changePercent={eth.changePercent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
