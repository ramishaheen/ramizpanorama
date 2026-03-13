import { useState, useRef, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmSliderProps {
  onConfirm: () => void;
  label?: string;
  disabled?: boolean;
}

export const ConfirmSlider = ({ onConfirm, label = "SLIDE TO ENGAGE", disabled = false }: ConfirmSliderProps) => {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const confirmedRef = useRef(false);

  const getProgress = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const thumbW = 36;
    const x = clientX - rect.left - thumbW / 2;
    const maxX = rect.width - thumbW;
    return Math.max(0, Math.min(1, x / maxX));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    confirmedRef.current = false;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setProgress(getProgress(e.clientX));
  }, [disabled, getProgress]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || disabled) return;
    const p = getProgress(e.clientX);
    setProgress(p);
    if (p >= 0.98 && !confirmedRef.current) {
      confirmedRef.current = true;
      setDragging(false);
      onConfirm();
      setTimeout(() => setProgress(0), 600);
    }
  }, [dragging, disabled, getProgress, onConfirm]);

  const handlePointerUp = useCallback(() => {
    if (!confirmedRef.current) {
      setProgress(0);
    }
    setDragging(false);
  }, []);

  const pct = progress * 100;
  const confirmed = confirmedRef.current;

  return (
    <div
      ref={trackRef}
      className={`relative h-9 rounded-md overflow-hidden select-none touch-none ${disabled ? "opacity-30 pointer-events-none" : "cursor-pointer"}`}
      style={{
        background: confirmed
          ? "linear-gradient(90deg, hsl(142,70%,20%), hsl(142,60%,30%))"
          : `linear-gradient(90deg, hsl(0,70%,15%) ${pct}%, hsl(0,50%,10%) ${pct}%)`,
        border: `1px solid ${confirmed ? "hsl(142,60%,40%)" : dragging ? "hsl(0,70%,45%)" : "hsl(0,50%,25%)"}`,
        transition: dragging ? "none" : "all 0.3s ease",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Fill glow */}
      <div
        className="absolute inset-y-0 left-0 pointer-events-none"
        style={{
          width: `${pct}%`,
          background: confirmed
            ? "linear-gradient(90deg, rgba(34,197,94,0.3), rgba(34,197,94,0.15))"
            : "linear-gradient(90deg, rgba(239,68,68,0.35), rgba(239,68,68,0.1))",
          transition: dragging ? "none" : "width 0.3s ease",
        }}
      />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[9px] font-mono font-bold tracking-[0.2em] uppercase" style={{ color: confirmed ? "#22c55e" : "hsl(0,60%,55%)" }}>
          {confirmed ? "✓ STRIKE COMMITTED" : label}
        </span>
      </div>

      {/* Thumb */}
      {!confirmed && (
        <div
          className="absolute top-0.5 bottom-0.5 w-9 rounded flex items-center justify-center"
          style={{
            left: 0,
            transform: `translateX(${progress * ((trackRef.current?.clientWidth || 200) - 36)}px)`,
            background: dragging ? "hsl(0,70%,45%)" : "hsl(0,60%,35%)",
            boxShadow: dragging ? "0 0 12px rgba(239,68,68,0.5)" : "0 0 6px rgba(239,68,68,0.3)",
            transition: dragging ? "none" : "all 0.3s ease",
          }}
        >
          <AlertTriangle className="h-4 w-4 text-[#fbbf24]" />
        </div>
      )}
    </div>
  );
};
