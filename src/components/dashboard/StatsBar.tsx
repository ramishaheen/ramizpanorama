import { Plane, Ship, AlertTriangle, Activity, Fuel, CircleDollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { useCommodityPrices } from "@/hooks/useCommodityPrices";

interface StatsBarProps {
  airspaceCount: number;
  vesselCount: number;
  alertCount: number;
  riskScore: number;
  dataFresh?: boolean;
}

const StatCard = ({ icon: Icon, label, value, color, pulse }: { icon: any; label: string; value: number | string; color: string; pulse?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`flex items-center gap-2 px-3 py-2 bg-card border rounded-md transition-all duration-500 ${pulse ? "border-primary/50 glow-primary" : "border-border"}`}
  >
    <Icon className={`h-4 w-4 ${color} ${pulse ? "animate-pulse" : ""}`} />
    <div>
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  </motion.div>
);

const PriceTicker = ({ icon: Icon, label, price, change, changePercent, pulse }: {
  icon: any;
  label: string;
  price: number;
  change: number;
  changePercent: number;
  pulse?: boolean;
}) => {
  const isUp = change >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;
  const changeColor = isUp ? "text-success" : "text-critical";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-3 py-2 bg-card border rounded-md transition-all duration-500 ${pulse ? "border-primary/50 glow-primary" : "border-border"}`}
    >
      <Icon className={`h-4 w-4 text-warning ${pulse ? "animate-pulse" : ""}`} />
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-mono font-bold text-foreground">
            ${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          <TrendIcon className={`h-3 w-3 ${changeColor}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className={`text-[9px] font-mono font-semibold ${changeColor}`}>
            {isUp ? "+" : ""}{changePercent}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export const StatsBar = ({ airspaceCount, vesselCount, alertCount, riskScore, dataFresh }: StatsBarProps) => {
  const { oil, gold, loading } = useCommodityPrices();

  return (
    <div className={`grid grid-cols-6 gap-2 px-4 py-2 transition-shadow duration-500 ${dataFresh ? "shadow-[inset_0_0_20px_hsl(190_100%_50%/0.06)]" : ""}`}>
      <StatCard icon={Plane} label="Airspace Alerts" value={airspaceCount} color="text-primary" pulse={dataFresh} />
      <StatCard icon={Ship} label="Tracked Vessels" value={vesselCount} color="text-primary" pulse={dataFresh} />
      <StatCard icon={AlertTriangle} label="Active Alerts" value={alertCount} color="text-warning" pulse={dataFresh} />
      <StatCard icon={Activity} label="Risk Index" value={riskScore} color={riskScore >= 60 ? "text-warning" : "text-success"} pulse={dataFresh} />
      {!loading && (
        <>
          <PriceTicker icon={Fuel} label="Crude Oil (WTI)" price={oil.price} change={oil.change} changePercent={oil.changePercent} pulse={dataFresh} />
          <PriceTicker icon={CircleDollarSign} label="Gold (XAU)" price={gold.price} change={gold.change} changePercent={gold.changePercent} pulse={dataFresh} />
        </>
      )}
    </div>
  );
};
