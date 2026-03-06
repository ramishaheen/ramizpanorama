import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface LiveCostCounterProps {
  dailyCostMillions: number;
  startTimestamp: string; // when the war cost data was generated
  prefix?: string;
  suffix?: string;
  color?: string;
  decimals?: number;
  isBillions?: boolean;
  cumulativeBase?: number; // base cumulative value to tick up from
}

/**
 * Converts a daily cost rate into a real-time ticking counter.
 * Uses requestAnimationFrame for smooth 60fps updates.
 */
export const LiveCostCounter = ({
  dailyCostMillions,
  startTimestamp,
  prefix = "$",
  suffix = "M",
  color = "text-critical",
  decimals = 2,
  isBillions = false,
  cumulativeBase = 0,
}: LiveCostCounterProps) => {
  const [displayValue, setDisplayValue] = useState(isBillions ? cumulativeBase : dailyCostMillions);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  // Cost per millisecond
  const costPerMs = dailyCostMillions / (24 * 60 * 60 * 1000);
  // For billions mode: convert daily millions to daily billions rate
  const costPerMsBillions = dailyCostMillions / (24 * 60 * 60 * 1000) / 1000;

  useEffect(() => {
    const dataTime = new Date(startTimestamp).getTime();
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;

      if (isBillions) {
        // Accumulate from cumulative base in billions
        const added = elapsed * costPerMsBillions;
        setDisplayValue(cumulativeBase + added);
      } else {
        // Show daily cost ticking up from 0 at rate
        const added = elapsed * costPerMs;
        setDisplayValue(dailyCostMillions + added);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dailyCostMillions, startTimestamp, costPerMs, costPerMsBillions, isBillions, cumulativeBase]);

  const formatted = isBillions
    ? displayValue.toFixed(decimals)
    : displayValue.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <motion.div
      className={`text-sm font-mono font-bold ${color} tabular-nums`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {prefix}{formatted}{suffix && <span className="text-[9px] opacity-70 ml-0.5">{suffix}</span>}
    </motion.div>
  );
};
