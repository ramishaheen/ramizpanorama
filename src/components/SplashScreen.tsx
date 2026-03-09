import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import warosLogo from "@/assets/waros-logo.png";

/** Generates a sci-fi radar boot-up sound using Web Audio API */
function playSplashSFX() {
  try {
    const ctx = new AudioContext();

    // Low rumble sweep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(60, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1.5);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.8);
    gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(); osc1.stop(ctx.currentTime + 2.5);

    // High-pitched radar ping
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = "sine";
    ping.frequency.setValueAtTime(1200, ctx.currentTime + 0.6);
    ping.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.2);
    pingGain.gain.setValueAtTime(0, ctx.currentTime);
    pingGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.65);
    pingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
    ping.connect(pingGain).connect(ctx.destination);
    ping.start(ctx.currentTime + 0.6); ping.stop(ctx.currentTime + 1.5);

    // Second ping (echo)
    const ping2 = ctx.createOscillator();
    const ping2Gain = ctx.createGain();
    ping2.type = "sine";
    ping2.frequency.setValueAtTime(900, ctx.currentTime + 1.4);
    ping2.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 2.0);
    ping2Gain.gain.setValueAtTime(0, ctx.currentTime);
    ping2Gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.45);
    ping2Gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
    ping2.connect(ping2Gain).connect(ctx.destination);
    ping2.start(ctx.currentTime + 1.4); ping2.stop(ctx.currentTime + 2.3);

    // Digital noise burst at start
    const bufferSize = ctx.sampleRate * 0.3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.08;
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 2;
    noise.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
    noise.start(); noise.stop(ctx.currentTime + 0.3);

    // Cleanup
    setTimeout(() => ctx.close(), 3500);
  } catch (e) {
    // Silent fail — audio not critical
  }
}

export const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"logo" | "text" | "out">("logo");
  const played = useRef(false);

  useEffect(() => {
    if (!played.current) {
      played.current = true;
      playSplashSFX();
    }
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
          className="h-60 w-60 relative z-10"
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
