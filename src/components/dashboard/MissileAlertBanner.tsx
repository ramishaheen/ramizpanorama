import { useState, useEffect, useRef, useCallback } from "react";
import { Rocket, X, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Rocket as RocketType } from "@/data/mockData";

interface MissileAlertBannerProps {
  rockets: RocketType[];
}

interface AlertItem {
  id: string;
  name: string;
  type: string;
  origin: string;
  target: string;
  timestamp: number;
}

// Realistic air-raid siren using Web Audio API
function playMissileAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Main siren oscillator — sweeps between two frequencies
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, ctx.currentTime);

    // Siren sweep pattern (3 cycles over ~3 seconds)
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 1.0;
      osc.frequency.linearRampToValueAtTime(880, t + 0.5);
      osc.frequency.linearRampToValueAtTime(440, t + 1.0);
    }

    // Pulsing volume envelope
    gain.gain.setValueAtTime(0, ctx.currentTime);
    for (let i = 0; i < 6; i++) {
      const t = ctx.currentTime + i * 0.5;
      gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.25);
    }
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.0);

    // Secondary alarm beep for urgency
    const beepOsc = ctx.createOscillator();
    const beepGain = ctx.createGain();
    beepOsc.type = "square";
    beepOsc.frequency.setValueAtTime(1200, ctx.currentTime);
    beepGain.gain.setValueAtTime(0, ctx.currentTime);

    for (let i = 0; i < 10; i++) {
      const t = ctx.currentTime + i * 0.3;
      beepGain.gain.setValueAtTime(0.06, t);
      beepGain.gain.setValueAtTime(0, t + 0.1);
    }

    osc.connect(gain).connect(ctx.destination);
    beepOsc.connect(beepGain).connect(ctx.destination);

    osc.start();
    beepOsc.start();
    osc.stop(ctx.currentTime + 3.2);
    beepOsc.stop(ctx.currentTime + 3.2);

    setTimeout(() => ctx.close(), 4000);
  } catch (e) {
    console.warn("Could not play alert sound:", e);
  }
}

// Approximate region name from lat/lng
function getRegionName(lat: number, lng: number): string {
  if (lat > 29 && lat < 38 && lng > 35 && lng < 46) return "Levant / Iraq";
  if (lat > 24 && lat < 32 && lng > 46 && lng < 56) return "Persian Gulf";
  if (lat > 20 && lat < 28 && lng > 36 && lng < 46) return "Arabian Peninsula";
  if (lat > 32 && lat < 40 && lng > 44 && lng < 62) return "Iran";
  if (lat > 12 && lat < 20 && lng > 42 && lng < 55) return "Yemen / Red Sea";
  if (lat > 30 && lat < 36 && lng > 33 && lng < 37) return "Eastern Mediterranean";
  return `${lat.toFixed(1)}°N ${lng.toFixed(1)}°E`;
}

export const MissileAlertBanner = ({ rockets }: MissileAlertBannerProps) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const triggerAlert = useCallback((newRockets: RocketType[]) => {
    const now = Date.now();
    const newAlerts = newRockets.map((r) => ({
      id: r.id,
      name: r.name || "Unknown Missile",
      type: r.type || "BALLISTIC",
      origin: getRegionName(r.originLat, r.originLng),
      target: getRegionName(r.targetLat, r.targetLng),
      timestamp: now,
    }));

    newRockets.forEach((r) => seenIdsRef.current.add(r.id));
    setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));

    if (soundEnabled) {
      playMissileAlertSound();
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (!initializedRef.current) {
      rockets.forEach((r) => seenIdsRef.current.add(r.id));
      initializedRef.current = true;
      return;
    }

    const newLaunches = rockets.filter(
      (r) =>
        (r.status === "launched" || r.status === "in_flight") &&
        !seenIdsRef.current.has(r.id)
    );

    if (newLaunches.length > 0) {
      triggerAlert(newLaunches);
    }

    rockets.forEach((r) => seenIdsRef.current.add(r.id));
  }, [rockets, triggerAlert]);

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
    <div className="absolute top-0 left-0 right-0 z-[1000] flex flex-col items-center gap-1.5 pt-1 pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -60, scale: 0.8 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              boxShadow: [
                "0 0 20px hsl(0 80% 50% / 0.3)",
                "0 0 60px hsl(0 80% 50% / 0.5)",
                "0 0 20px hsl(0 80% 50% / 0.3)",
              ],
            }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              boxShadow: { duration: 1.5, repeat: Infinity },
            }}
            className="pointer-events-auto w-[600px] max-w-[90vw] border border-destructive/70 bg-destructive/15 backdrop-blur-xl rounded-lg overflow-hidden"
          >
            {/* Red flashing top bar */}
            <motion.div
              className="h-1 bg-destructive"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />

            <div className="px-4 py-2.5">
              {/* Header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <Rocket className="h-5 w-5 text-destructive" />
                  </motion.div>
                  <motion.span
                    className="font-mono text-sm font-black text-destructive uppercase tracking-widest"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    ⚠ MISSILE LAUNCH DETECTED
                  </motion.span>
                </div>
                <div className="flex items-center gap-1">
                  {i === 0 && (
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="p-1 rounded hover:bg-destructive/20 transition-colors"
                      title={soundEnabled ? "Mute alerts" : "Enable alert sounds"}
                    >
                      {soundEnabled ? (
                        <Volume2 className="h-3.5 w-3.5 text-destructive/70" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="p-1 rounded hover:bg-destructive/20 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-destructive/70" />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-3 gap-3 font-mono text-[10px]">
                <div>
                  <span className="text-muted-foreground/60 uppercase block mb-0.5">Designation</span>
                  <span className="text-foreground font-bold text-xs">{alert.name}</span>
                  <span className="text-destructive/80 ml-1">({alert.type})</span>
                </div>
                <div>
                  <span className="text-muted-foreground/60 uppercase block mb-0.5">Origin</span>
                  <span className="text-foreground font-semibold">{alert.origin}</span>
                </div>
                <div>
                  <span className="text-muted-foreground/60 uppercase block mb-0.5">Target Region</span>
                  <span className="text-warning font-semibold">{alert.target}</span>
                </div>
              </div>

              {/* Progress bar (auto-dismiss countdown) */}
              <motion.div
                className="mt-2 h-0.5 bg-destructive/40 rounded-full origin-left"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 10, ease: "linear" }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
