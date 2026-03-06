import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { RiskScore } from "@/data/mockData";

interface RiskScoreGaugeProps {
  score: RiskScore;
}

interface HistoryPoint {
  time: string;
  airspace: number;
  maritime: number;
  diplomatic: number;
  sentiment: number;
}

const MAX_HISTORY = 20;

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

const LINES = [
  { key: "airspace", color: "hsl(var(--warning))", label: "Airspace" },
  { key: "maritime", color: "hsl(var(--primary))", label: "Maritime" },
  { key: "diplomatic", color: "hsl(var(--critical))", label: "Diplomatic" },
  { key: "sentiment", color: "hsl(var(--success))", label: "Sentiment" },
] as const;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded p-2 shadow-lg text-[10px] font-mono">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-foreground">{entry.name}: {entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const RiskScoreGauge = ({ score }: RiskScoreGaugeProps) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const lastUpdated = useRef<string>("");

  useEffect(() => {
    if (score.lastUpdated === lastUpdated.current) return;
    lastUpdated.current = score.lastUpdated;

    const time = new Date(score.lastUpdated).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time,
          airspace: score.airspace,
          maritime: score.maritime,
          diplomatic: score.diplomatic,
          sentiment: score.sentiment,
        },
      ];
      return next.slice(-MAX_HISTORY);
    });
  }, [score]);

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

      <div className="flex items-center gap-3 mb-3">
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
            {score.overall >= 80 ? "CRITICAL" : score.overall >= 60 ? "ELEVATED" : score.overall >= 40 ? "MODERATE" : "LOW"}
          </span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>

      {/* Live chart */}
      {history.length >= 2 && (
        <div className="mb-3 -mx-1">
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} />
              {LINES.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-3 mt-1">
            {LINES.map((line) => (
              <div key={line.key} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} />
                <span className="text-[8px] font-mono text-muted-foreground uppercase">{line.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground font-mono">
          LAST UPDATE: {new Date(score.lastUpdated).toLocaleTimeString("en-US", { hour12: false })} UTC
        </span>
      </div>
    </div>
  );
};
