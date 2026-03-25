import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface LiveCostCounterProps {
  dailyCostMillions: number;
  startTimestamp: string;
  prefix?: string;
  suffix?: string;
  color?: string;
  decimals?: number;
  isBillions?: boolean;
  cumulativeBase?: number;
}

/**
 * Converts a daily cost rate into a real-time ticking counter.
 * - isBillions=true + cumulativeBase: ticks UP from cumulativeBase at daily rate (in billions)
 * - isBillions=false: shows static daily cost value (no ticking needed for daily rate display)
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

  useEffect(() => {
    startTimeRef.current = Date.now();

    if (!isBillions) {
      // For daily rate display, just show the static value
      setDisplayValue(dailyCostMillions);
      return;
    }

    // For cumulative display: tick up from cumulativeBase at dailyCostMillions rate
    // dailyCostMillions is in millions, convert to billions per millisecond
    const dailyBillions = dailyCostMillions / 1000;
    const billionsPerMs = dailyBillions / (24 * 60 * 60 * 1000);

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const added = elapsed * billionsPerMs;
      setDisplayValue(cumulativeBase + added);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dailyCostMillions, startTimestamp, isBillions, cumulativeBase]);

  const formatted = isBillions
    ? displayValue.toFixed(decimals)
    : displayValue.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <motion.div
      className={`text-[10px] font-mono font-bold ${color} tabular-nums leading-none`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {prefix}{formatted}{suffix && <span className="text-[7px] opacity-70 ml-0.5">{suffix}</span>}
    </motion.div>
  );
};
