import { Plane, Ship, AlertTriangle, Activity } from "lucide-react";
import { motion } from "framer-motion";

interface StatsBarProps {
  airspaceCount: number;
  vesselCount: number;
  alertCount: number;
  riskScore: number;
}

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md"
  >
    <Icon className={`h-4 w-4 ${color}`} />
    <div>
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  </motion.div>
);

export const StatsBar = ({ airspaceCount, vesselCount, alertCount, riskScore }: StatsBarProps) => (
  <div className="grid grid-cols-4 gap-2 px-4 py-2">
    <StatCard icon={Plane} label="Airspace Alerts" value={airspaceCount} color="text-primary" />
    <StatCard icon={Ship} label="Tracked Vessels" value={vesselCount} color="text-primary" />
    <StatCard icon={AlertTriangle} label="Active Alerts" value={alertCount} color="text-warning" />
    <StatCard icon={Activity} label="Risk Index" value={riskScore} color={riskScore >= 60 ? "text-warning" : "text-success"} />
  </div>
);
