import { useState, useEffect } from "react";
import { RotateCcw, X } from "lucide-react";

export function RotateDeviceOverlay() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    // Detect actual mobile device (not just small window)
    const checkMobile = () => {
      const ua = navigator.userAgent || "";
      return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(ua) ||
        ("ontouchstart" in window && window.innerWidth < 1024);
    };
    setIsMobileDevice(checkMobile());

    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
      setIsPortrait(portrait);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", () => setTimeout(checkOrientation, 100));

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  if (!isPortrait || !isMobileDevice || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 p-2 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Animated phone rotation icon */}
      <div className="relative mb-8">
        <div className="w-20 h-32 border-2 border-primary/60 rounded-xl relative animate-rotate-phone">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-1 bg-primary/40 rounded-full" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 border border-primary/40 rounded-full" />
          {/* Screen content indicator */}
          <div className="absolute inset-3 top-5 bottom-8 bg-primary/10 rounded-md flex items-center justify-center">
            <div className="w-full h-0.5 bg-primary/30" />
          </div>
        </div>
        {/* Rotation arrow */}
        <RotateCcw className="absolute -right-8 top-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
      </div>

      {/* Text */}
      <h2 className="text-lg font-bold text-foreground font-mono uppercase tracking-wider mb-2">
        Rotate Your Device
      </h2>
      <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mb-1">
        For the best intelligence dashboard experience, please rotate your device to <span className="text-primary font-semibold">landscape mode</span>.
      </p>
      <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest mt-4">
        WAROS • Tactical Command Center
      </p>

      {/* Continue anyway */}
      <button
        onClick={() => setDismissed(true)}
        className="mt-6 px-4 py-2 rounded-md border border-border bg-secondary/30 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
      >
        Continue in Portrait
      </button>
    </div>
  );
}
