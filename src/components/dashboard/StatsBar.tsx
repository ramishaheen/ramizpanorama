import { Plane, Ship, AlertTriangle, Activity, Fuel, CircleDollarSign, Bitcoin, TrendingUp, TrendingDown, Rocket, Target, DollarSign, Building2, PlaneTakeoff, Anchor, HardHat, Shield, Info, Crosshair, Bomb } from "lucide-react";
import { motion, useSpring, useTransform } from "framer-motion";
import { useCommodityPrices } from "@/hooks/useCommodityPrices";
import { useWarCosts } from "@/hooks/useWarCosts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";
import { LiveCostCounter } from "./LiveCostCounter";
import { ScenarioToggle, type Scenario } from "./ScenarioToggle";
import { CountryCostRow } from "./CountryCostRow";
import type { Rocket as RocketType, GeoAlert, AirspaceAlert } from "@/data/mockData";

interface StatsBarProps {
  airspaceCount: number;
  vesselCount: number;
  alertCount: number;
  riskScore: number;
  rocketCount?: number;
  impactCount?: number;
  totalRockets?: number;
  rockets?: RocketType[];
  geoAlerts?: GeoAlert[];
  airspaceAlerts?: AirspaceAlert[];
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
      <Icon className="h-3.5 w-3.5 text-warning" />
      <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="text-[13px] font-mono font-bold text-foreground">
        ${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
      <TrendIcon className={`h-3.5 w-3.5 ${changeColor}`} />
      <span className={`text-xs font-mono font-semibold ${changeColor}`}>
        {isUp ? "+" : ""}{changePercent}%
      </span>
    </span>
  );
};

export const StatsBar = ({ airspaceCount, vesselCount, alertCount, riskScore, rocketCount = 0, impactCount = 0, totalRockets = 0, rockets = [], geoAlerts = [], airspaceAlerts = [], dataFresh }: StatsBarProps) => {
  const { oil, brent, gold, silver, gas, copper, wheat, usdils, usdsar, ita, btc, eth, loading } = useCommodityPrices();
  const warCosts = useWarCosts();
  const { t } = useLanguage();
  const [scenario, setScenario] = useState<Scenario>("base");

  // Build missile breakdown by type
  const missileBreakdown = useMemo(() => {
    const byType: Record<string, { active: number; intercepted: number; impact: number; total: number }> = {};
    for (const r of rockets) {
      if (!byType[r.type]) byType[r.type] = { active: 0, intercepted: 0, impact: 0, total: 0 };
      byType[r.type].total++;
      if (r.status === "launched" || r.status === "in_flight") byType[r.type].active++;
      else if (r.status === "intercepted") byType[r.type].intercepted++;
      else if (r.status === "impact") byType[r.type].impact++;
    }
    return byType;
  }, [rockets]);

  const missileTooltip = useMemo(() => {
    const lines = [`🚀 MISSILE TRACKER — ${totalRockets} Total Launches\n`];
    lines.push(`Active: ${rocketCount} | Intercepted: ${rockets.filter(r => r.status === "intercepted").length} | Impact: ${rockets.filter(r => r.status === "impact").length}\n`);
    lines.push("── By Type ──");
    for (const [type, counts] of Object.entries(missileBreakdown)) {
      lines.push(`• ${type}: ${counts.total} total (${counts.active} active, ${counts.intercepted} intercepted, ${counts.impact} impact)`);
    }
    return lines.join("\n");
  }, [missileBreakdown, totalRockets, rocketCount, rockets]);

  const impactTooltip = useMemo(() => {
    const intercepted = rockets.filter(r => r.status === "intercepted");
    const impacts = rockets.filter(r => r.status === "impact");
    const lines = [`💥 IMPACT & INTERCEPT REPORT\n`];
    lines.push(`Intercepted: ${intercepted.length} | Impact: ${impacts.length}\n`);
    lines.push("── Intercepts ──");
    for (const r of intercepted) lines.push(`✓ ${r.name || r.type} — intercepted`);
    lines.push("\n── Impacts ──");
    for (const r of impacts) lines.push(`✕ ${r.name || r.type} — impact`);
    return lines.join("\n");
  }, [rockets]);

  const alertTooltip = useMemo(() => {
    const geoByType: Record<string, number> = {};
    const geoBySev: Record<string, number> = {};
    for (const a of geoAlerts) {
      geoByType[a.type] = (geoByType[a.type] || 0) + 1;
      geoBySev[a.severity] = (geoBySev[a.severity] || 0) + 1;
    }
    const airByType: Record<string, number> = {};
    for (const a of airspaceAlerts.filter(x => x.active)) {
      airByType[a.type] = (airByType[a.type] || 0) + 1;
    }
    const lines = [`⚠ ACTIVE ALERTS — ${alertCount} Total\n`];
    lines.push(`Geo Alerts: ${geoAlerts.length} | Airspace: ${airspaceAlerts.filter(a => a.active).length}\n`);
    lines.push("── Geo Alerts by Type ──");
    for (const [type, count] of Object.entries(geoByType)) lines.push(`• ${type}: ${count}`);
    lines.push("\n── Geo Alerts by Severity ──");
    for (const [sev, count] of Object.entries(geoBySev)) lines.push(`• ${sev.toUpperCase()}: ${count}`);
    lines.push("\n── Airspace Alerts ──");
    for (const [type, count] of Object.entries(airByType)) lines.push(`• ${type}: ${count}`);
    return lines.join("\n");
  }, [geoAlerts, airspaceAlerts, alertCount]);

  const sectorIcons: Record<string, any> = {
    "Oil & Energy": Fuel,
    "Aviation & Airspace": PlaneTakeoff,
    "Tourism & Hospitality": Building2,
    "Shipping & Trade": Anchor,
    "Real Estate & Construction": HardHat,
    "Defense Spending": Shield,
  };

  const scenarioMultiplier = scenario === "conservative" ? 1 : scenario === "severe" ? 4 : 2;

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
      <div className={`grid grid-cols-3 sm:grid-cols-6 gap-1.5 px-2 sm:px-3 py-1 transition-shadow duration-500 ${dataFresh ? "shadow-[inset_0_0_20px_hsl(190_100%_50%/0.06)]" : ""}`}>
        <StatCard icon={Plane} label={t(tr["stat.airspace"].en, tr["stat.airspace"].ar)} value={airspaceCount} color="text-primary" pulse={dataFresh} />
        <StatCard icon={Ship} label={t(tr["stat.vessels"].en, tr["stat.vessels"].ar)} value={vesselCount} color="text-primary" pulse={dataFresh} />
        <StatCard
          icon={Rocket}
          label={t(tr["stat.missiles"].en, tr["stat.missiles"].ar)}
          value={rocketCount}
          color={rocketCount > 0 ? "text-critical" : "text-muted-foreground"}
          pulse={rocketCount > 0}
          tooltip={missileTooltip}
        />
        <StatCard
          icon={Target}
          label={t(tr["stat.impacts"].en, tr["stat.impacts"].ar)}
          value={impactCount}
          color="text-warning"
          pulse={dataFresh}
          tooltip={impactTooltip}
        />
        <StatCard
          icon={AlertTriangle}
          label={t(tr["stat.alerts"].en, tr["stat.alerts"].ar)}
          value={alertCount}
          color="text-warning"
          pulse={dataFresh}
          tooltip={alertTooltip}
        />
        <StatCard icon={Activity} label={t(tr["stat.risk"].en, tr["stat.risk"].ar)} value={riskScore} color={riskScore >= 60 ? "text-warning" : "text-success"} pulse={dataFresh} />
      </div>

      {/* War cost cards - LIVE TICKING */}
      {warCosts.data && !warCosts.error && (
        <div className="border-t border-border/50 bg-card/30">
          <div className="flex items-center justify-between px-3 py-0.5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">War Cost Estimate</span>
            <ScenarioToggle active={scenario} onChange={setScenario} />
          </div>
          <div className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 px-2 sm:px-3 py-1 transition-shadow duration-500`}>
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
          {warCosts.data.country_costs && warCosts.data.country_costs.length > 0 && (
            <CountryCostRow
              countries={warCosts.data.country_costs}
              timestamp={timestamp}
              scenarioMultiplier={scenarioMultiplier}
              scenario={scenario}
            />
          )}
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
            <div className="marquee-content flex animate-marquee-reverse">
              <MarqueeItem icon={Fuel} label="WTI Crude" price={oil.price} change={oil.change} changePercent={oil.changePercent} />
              <MarqueeItem icon={Fuel} label="Brent" price={brent.price} change={brent.change} changePercent={brent.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Gold XAU" price={gold.price} change={gold.change} changePercent={gold.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Silver" price={silver.price} change={silver.change} changePercent={silver.changePercent} />
              <MarqueeItem icon={Fuel} label="Nat Gas" price={gas.price} change={gas.change} changePercent={gas.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Copper" price={copper.price} change={copper.change} changePercent={copper.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Wheat" price={wheat.price} change={wheat.change} changePercent={wheat.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="USD/ILS" price={usdils.price} change={usdils.change} changePercent={usdils.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="USD/SAR" price={usdsar.price} change={usdsar.change} changePercent={usdsar.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="DEF ETF" price={ita.price} change={ita.change} changePercent={ita.changePercent} />
              <MarqueeItem icon={Bitcoin} label="BTC" price={btc.price} change={btc.change} changePercent={btc.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="ETH" price={eth.price} change={eth.change} changePercent={eth.changePercent} />
            </div>
            <div className="marquee-content flex animate-marquee-reverse" aria-hidden="true">
              <MarqueeItem icon={Fuel} label="WTI Crude" price={oil.price} change={oil.change} changePercent={oil.changePercent} />
              <MarqueeItem icon={Fuel} label="Brent" price={brent.price} change={brent.change} changePercent={brent.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Gold XAU" price={gold.price} change={gold.change} changePercent={gold.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Silver" price={silver.price} change={silver.change} changePercent={silver.changePercent} />
              <MarqueeItem icon={Fuel} label="Nat Gas" price={gas.price} change={gas.change} changePercent={gas.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Copper" price={copper.price} change={copper.change} changePercent={copper.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="Wheat" price={wheat.price} change={wheat.change} changePercent={wheat.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="USD/ILS" price={usdils.price} change={usdils.change} changePercent={usdils.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="USD/SAR" price={usdsar.price} change={usdsar.change} changePercent={usdsar.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="DEF ETF" price={ita.price} change={ita.change} changePercent={ita.changePercent} />
              <MarqueeItem icon={Bitcoin} label="BTC" price={btc.price} change={btc.change} changePercent={btc.changePercent} />
              <MarqueeItem icon={CircleDollarSign} label="ETH" price={eth.price} change={eth.change} changePercent={eth.changePercent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
