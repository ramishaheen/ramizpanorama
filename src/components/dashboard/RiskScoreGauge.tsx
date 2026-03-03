import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { RiskScore } from "@/data/mockData";

interface RiskScoreGaugeProps {
  score: RiskScore;
}

const getSeverityColor = (value: number) => {
  if (value >= 80) return "text-critical";
  if (value >= 60) return "text-warning";
  if (value >= 40) return "text-primary";
  return "text-success";
};

const getSeverityBg = (value: number) => {
  if (value >= 80) return "bg-critical/20 border-critical/40";
  if (value >= 60) return "bg-warning/20 border-warning/40";
  if (value >= 40) return "bg-primary/20 border-primary/40";
  return "bg-success/20 border-success/40";
};

const getSeverityGlow = (value: number) => {
  if (value >= 80) return "glow-critical";
  if (value >= 60) return "glow-warning";
  if (value >= 40) return "glow-primary";
  return "glow-success";
};

const TrendIcon = ({ trend }: { trend: RiskScore["trend"] }) => {
  if (trend === "rising") return <TrendingUp className="h-4 w-4 text-critical" />;
  if (trend === "falling") return <TrendingDown className="h-4 w-4 text-success" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const SubScore = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${value >= 80 ? 'bg-critical' : value >= 60 ? 'bg-warning' : value >= 40 ? 'bg-primary' : 'bg-success'}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-7 text-right ${getSeverityColor(value)}`}>{value}</span>
    </div>
  </div>
);

export const RiskScoreGauge = ({ score }: RiskScoreGaugeProps) => {
  return (
    <div className={`rounded-lg border p-4 ${getSeverityBg(score.overall)} ${getSeverityGlow(score.overall)}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          AI Risk Index
        </h3>
        <div className="flex items-center gap-1">
          <TrendIcon trend={score.trend} />
          <span className="text-xs text-muted-foreground capitalize">{score.trend}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <motion.span
          className={`text-5xl font-mono font-bold ${getSeverityColor(score.overall)}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
        >
          {score.overall}
        </motion.span>
        <div className="flex flex-col">
          <span className={`text-xs font-semibold uppercase ${getSeverityColor(score.overall)}`}>
            {score.overall >= 80 ? 'CRITICAL' : score.overall >= 60 ? 'ELEVATED' : score.overall >= 40 ? 'MODERATE' : 'LOW'}
          </span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className="space-y-0.5 border-t border-border/50 pt-3">
        <SubScore label="Airspace" value={score.airspace} />
        <SubScore label="Maritime" value={score.maritime} />
        <SubScore label="Diplomatic" value={score.diplomatic} />
        <SubScore label="Sentiment" value={score.sentiment} />
      </div>

      <div className="mt-3 pt-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground font-mono">
          LAST UPDATE: {new Date(score.lastUpdated).toLocaleTimeString('en-US', { hour12: false })} UTC
        </span>
      </div>
    </div>
  );
};
