import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import warosLogo from "@/assets/waros-logo.png";

export const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"logo" | "text" | "out">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 800);
    const t2 = setTimeout(() => setPhase("out"), 2400);
    const t3 = setTimeout(onComplete, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "out" ? null : null}
      <motion.div
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === "out" ? 0 : 1 }}
        transition={{ duration: 0.6 }}
        onAnimationComplete={() => { if (phase === "out") onComplete(); }}
      >
        {/* Radar sweep background */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
          <motion.div
            className="h-[500px] w-[500px] rounded-full border border-primary/10"
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
          />
          <motion.div
            className="absolute h-[300px] w-[300px] rounded-full border border-primary/10"
            initial={{ scale: 0, opacity: 0.4 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeOut", delay: 0.3 }}
          />
        </div>

        {/* Scan line */}
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          initial={{ top: "30%" }}
          animate={{ top: "70%" }}
          transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
        />

        {/* Logo */}
        <motion.img
          src={warosLogo}
          alt="War OS"
          className="h-20 w-20 relative z-10"
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, duration: 0.8 }}
        />

        {/* Title */}
        <motion.div
          className="mt-4 text-center relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase === "text" || phase === "out" ? 1 : 0, y: phase === "text" || phase === "out" ? 0 : 20 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold tracking-widest text-foreground font-mono">
            WAR<span className="text-primary">OS</span>
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase mt-1">
            RamiZPanorma
          </p>
        </motion.div>

        {/* Loading bar */}
        <motion.div
          className="mt-8 w-40 h-0.5 bg-muted/30 rounded-full overflow-hidden relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.p
          className="mt-2 text-[8px] font-mono text-primary/50 tracking-widest uppercase relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Initializing Intelligence Systems...
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
};
