import { useState, useEffect, useRef } from "react";
import { Rocket, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Rocket as RocketType } from "@/data/mockData";

interface MissileAlertBannerProps {
  rockets: RocketType[];
}

interface AlertItem {
  id: string;
  name: string;
  type: string;
  timestamp: number;
}

export const MissileAlertBanner = ({ rockets }: MissileAlertBannerProps) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    // On first render, just record existing rocket IDs without alerting
    if (!initializedRef.current) {
      rockets.forEach((r) => seenIdsRef.current.add(r.id));
      initializedRef.current = true;
      return;
    }

    // Detect newly launched rockets
    const newLaunches = rockets.filter(
      (r) =>
        (r.status === "launched" || r.status === "in_flight") &&
        !seenIdsRef.current.has(r.id)
    );

    if (newLaunches.length > 0) {
      const now = Date.now();
      const newAlerts = newLaunches.map((r) => ({
        id: r.id,
        name: r.name || "Unknown Missile",
        type: r.type || "BALLISTIC",
        timestamp: now,
      }));

      newLaunches.forEach((r) => seenIdsRef.current.add(r.id));
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
    }

    // Also track all current IDs
    rockets.forEach((r) => seenIdsRef.current.add(r.id));
  }, [rockets]);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setAlerts((prev) => prev.filter((a) => now - a.timestamp < 10000));
    }, 1000);
    return () => clearInterval(timer);
  }, [alerts.length]);

  const dismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] flex flex-col items-center gap-1 pt-1 pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-md border border-destructive/60 bg-destructive/20 backdrop-blur-md shadow-[0_0_30px_hsl(0_80%_50%/0.3)] animate-pulse"
          >
            <Rocket className="h-4 w-4 text-destructive animate-bounce" />
            <span className="font-mono text-xs font-bold text-destructive uppercase tracking-wider">
              ⚠ MISSILE LAUNCH DETECTED
            </span>
            <span className="font-mono text-[10px] text-foreground">
              {alert.name} ({alert.type})
            </span>
            <button
              onClick={() => dismiss(alert.id)}
              className="ml-2 p-0.5 rounded hover:bg-destructive/30 transition-colors"
            >
              <X className="h-3 w-3 text-destructive" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
