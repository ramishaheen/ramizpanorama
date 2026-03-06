import { Plane, Ship, AlertTriangle, Activity } from "lucide-react";
import { motion } from "framer-motion";

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

export const StatsBar = ({ airspaceCount, vesselCount, alertCount, riskScore, dataFresh }: StatsBarProps) => (
  <div className={`grid grid-cols-4 gap-2 px-4 py-2 transition-shadow duration-500 ${dataFresh ? "shadow-[inset_0_0_20px_hsl(190_100%_50%/0.06)]" : ""}`}>
    <StatCard icon={Plane} label="Airspace Alerts" value={airspaceCount} color="text-primary" pulse={dataFresh} />
    <StatCard icon={Ship} label="Tracked Vessels" value={vesselCount} color="text-primary" pulse={dataFresh} />
    <StatCard icon={AlertTriangle} label="Active Alerts" value={alertCount} color="text-warning" pulse={dataFresh} />
    <StatCard icon={Activity} label="Risk Index" value={riskScore} color={riskScore >= 60 ? "text-warning" : "text-success"} pulse={dataFresh} />
  </div>
);
