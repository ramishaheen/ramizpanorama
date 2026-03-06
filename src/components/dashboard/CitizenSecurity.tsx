import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, RefreshCw, AlertTriangle, X } from "lucide-react";
import type { SecurityData, CountrySafety } from "@/hooks/useCitizenSecurity";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

interface CitizenSecurityProps {
  data: SecurityData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const levelColors: Record<string, string> = {
  SAFE: "hsl(145 70% 45%)",
  CAUTION: "hsl(40 100% 50%)",
  ELEVATED: "hsl(25 100% 50%)",
  DANGER: "hsl(0 80% 55%)",
  CRITICAL: "hsl(0 80% 35%)",
};

const levelGlow: Record<string, string> = {
  SAFE: "shadow-[0_0_8px_hsl(145_70%_45%/0.15)]",
  CAUTION: "shadow-[0_0_8px_hsl(40_100%_50%/0.15)]",
  ELEVATED: "shadow-[0_0_8px_hsl(25_100%_50%/0.15)]",
  DANGER: "shadow-[0_0_8px_hsl(0_80%_55%/0.2)]",
  CRITICAL: "shadow-[0_0_12px_hsl(0_80%_35%/0.3)]",
};

const flagEmoji: Record<string, string> = {
  AE: "🇦🇪", JO: "🇯🇴", SA: "🇸🇦", BH: "🇧🇭",
  OM: "🇴🇲", KW: "🇰🇼", QA: "🇶🇦", YE: "🇾🇪",
  IQ: "🇮🇶", LB: "🇱🇧",
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "hsl(145 70% 45%)";
  if (score >= 60) return "hsl(40 100% 50%)";
  if (score >= 40) return "hsl(25 100% 50%)";
  if (score >= 20) return "hsl(0 80% 55%)";
  return "hsl(0 80% 35%)";
};

export const CitizenSecurity = ({ data, loading, error, onRefresh }: CitizenSecurityProps) => {
  const [detailCountry, setDetailCountry] = useState<CountrySafety | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailCountry(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-full flex flex-col bg-card/80 backdrop-blur-sm">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/50 bg-background/60">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t(tr["section.citizen_security"].en, tr["section.citizen_security"].ar)}
          </span>
          <span className="text-[8px] text-primary font-mono">
            {t(tr["section.ai_powered"].en, tr["section.ai_powered"].ar)}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-secondary/60 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-1.5 flex items-center gap-1.5 text-destructive font-mono text-[9px] bg-destructive/5 border-b border-destructive/20">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Country grid */}
      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : data?.countries?.length ? (
        <div className="flex-1 overflow-y-auto p-2 intel-feed-scroll">
          <div className="grid grid-cols-2 gap-1.5">
            {data.countries.map((country) => {
              const scoreColor = getScoreColor(country.safety_score);
              const lvlColor = levelColors[country.level] || "hsl(215 15% 50%)";
              return (
                <div
                  key={country.code}
                  className={`relative rounded border border-border/60 bg-background/40 p-2 cursor-pointer 
                    hover:bg-background/70 transition-all duration-200 group ${levelGlow[country.level] || ""}`}
                  style={{ borderLeftWidth: 3, borderLeftColor: lvlColor }}
                  onDoubleClick={() => setDetailCountry(country)}
                  title={country.status}
                >
                  {/* Top row: flag + name + score */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm flex-shrink-0">{flagEmoji[country.code] || "🏳️"}</span>
                      <span className="font-mono text-[10px] font-bold text-foreground truncate">{country.name}</span>
                    </div>
                    <span className="font-mono text-xs font-black tabular-nums flex-shrink-0" style={{ color: scoreColor }}>
                      {country.safety_score}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="w-full h-1 bg-background/60 rounded-full mb-1">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${country.safety_score}%`,
                        backgroundColor: scoreColor,
                        boxShadow: `0 0 6px ${scoreColor}`,
                      }}
                    />
                  </div>

                  {/* Level badge */}
                  <span
                    className="font-mono text-[8px] font-bold uppercase tracking-wider"
                    style={{ color: lvlColor }}
                  >
                    {country.level}
                  </span>

                  {/* Hover hint */}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="font-mono text-[8px] text-muted-foreground">{t("Double-click for details", "انقر مرتين للتفاصيل")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Country detail popup */}
      <AnimatePresence>
        {detailCountry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDetailCountry(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative w-[420px] max-w-[92vw] max-h-[70vh] bg-card border border-border/80 rounded-lg overflow-hidden"
              style={{
                borderLeftWidth: 3,
                borderLeftColor: levelColors[detailCountry.level] || "hsl(215 15% 50%)",
                boxShadow: `0 20px 60px -15px rgba(0,0,0,0.5), 0 0 20px ${levelColors[detailCountry.level] || "hsl(215 15% 50%)"}20`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popup header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-background/90">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{flagEmoji[detailCountry.code] || "🏳️"}</span>
                  <div>
                    <h2 className="font-mono text-xs font-bold text-foreground">{detailCountry.name}</h2>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: levelColors[detailCountry.level] }}
                      >
                        {detailCountry.level}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {t("Score", "الدرجة")}: <span className="font-bold" style={{ color: getScoreColor(detailCountry.safety_score) }}>{detailCountry.safety_score}</span>/100
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setDetailCountry(null)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Popup content */}
              <div className="px-4 py-3 space-y-3 overflow-y-auto max-h-[calc(70vh-52px)] intel-feed-scroll">
                {/* Score bar */}
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/70 block mb-1">{t(tr["citizen.safety_score"].en, tr["citizen.safety_score"].ar)}</span>
                  <div className="w-full h-2 bg-background/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${detailCountry.safety_score}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: getScoreColor(detailCountry.safety_score), boxShadow: `0 0 8px ${getScoreColor(detailCountry.safety_score)}40` }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/70 block mb-1">{t(tr["citizen.current_status"].en, tr["citizen.current_status"].ar)}</span>
                  <p className="text-[10px] text-foreground/90 leading-relaxed">{detailCountry.status}</p>
                </div>

                {/* Threats */}
                {detailCountry.threats?.length > 0 && (
                  <div>
                    <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/70 block mb-1.5">{t(tr["citizen.active_threats"].en, tr["citizen.active_threats"].ar)}</span>
                    <ul className="space-y-1">
                      {detailCountry.threats.map((threat, i) => (
                        <li key={i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-destructive/5 border border-destructive/10">
                          <AlertTriangle className="h-2.5 w-2.5 mt-0.5 flex-shrink-0 text-destructive/70" />
                          <span className="text-[9px] text-foreground/80 leading-snug">{threat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-[7px] text-muted-foreground/30 font-mono pt-2 border-t border-border/20">
                  {t("ESC to close • AI-powered analysis", "ESC للإغلاق • تحليل بالذكاء الاصطناعي")}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
