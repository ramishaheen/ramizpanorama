import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import type { SecurityData, CountrySafety } from "@/hooks/useCitizenSecurity";

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

const levelBg: Record<string, string> = {
  SAFE: "bg-success/15 border-success/30",
  CAUTION: "bg-accent/15 border-accent/30",
  ELEVATED: "bg-orange-500/15 border-orange-500/30",
  DANGER: "bg-destructive/15 border-destructive/30",
  CRITICAL: "bg-red-900/20 border-red-900/40",
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

const CountryCard = ({ country, isExpanded, onToggle, onDoubleClick }: {
  country: CountrySafety;
  isExpanded: boolean;
  onToggle: () => void;
  onDoubleClick: () => void;
}) => {
  const scoreColor = getScoreColor(country.safety_score);
  const lvlColor = levelColors[country.level] || "hsl(215 15% 50%)";

  return (
    <div
      className={`border rounded-lg flex-shrink-0 cursor-pointer transition-all duration-200 ${
        isExpanded ? "w-[280px]" : "w-[180px]"
      } ${levelBg[country.level] || "bg-muted/10 border-border"}`}
      onClick={onToggle}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{flagEmoji[country.code] || "🏳️"}</span>
            <span className="font-mono text-xs font-bold text-foreground">{country.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold" style={{ color: scoreColor }}>
              {country.safety_score}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="w-full h-1.5 bg-background/50 rounded-full mb-1.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${country.safety_score}%`,
              backgroundColor: scoreColor,
            }}
          />
        </div>

        <div
          className="font-mono text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: lvlColor }}
        >
          {country.level}
        </div>

        <p className={`font-mono text-[10px] text-muted-foreground leading-snug ${
          isExpanded ? "" : "line-clamp-2"
        }`}>
          {country.status}
        </p>

        {isExpanded && country.threats?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 block mb-1.5">
              Active Threats
            </span>
            <ul className="space-y-1">
              {country.threats.map((threat, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: lvlColor }} />
                  <span className="font-mono text-[9px] text-muted-foreground leading-snug">{threat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export const CitizenSecurity = ({ data, loading, error, onRefresh }: CitizenSecurityProps) => {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [detailCountry, setDetailCountry] = useState<CountrySafety | null>(null);

  const toggleExpand = (code: string) => {
    setExpandedCode(prev => prev === code ? null : code);
  };

  return (
    <div className="border-t border-border bg-card/50">
      <div className="px-4 py-2 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2.5">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            Citizen Security Indicators
          </span>
          <span className="font-mono text-[10px] text-primary uppercase">AI-Powered</span>
        </div>
        <div className="flex items-center gap-2">
          {data?.overall_assessment && (
            <button
              onClick={() => setShowAssessment(prev => !prev)}
              className="px-2 py-0.5 text-muted-foreground hover:text-primary transition-colors font-mono text-[10px] uppercase border border-border rounded"
            >
              {showAssessment ? "Hide" : "Intel"}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 flex items-center gap-2 text-destructive font-mono text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="px-4 py-4 flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="font-mono text-[11px] text-muted-foreground">Analyzing regional security…</span>
        </div>
      ) : data?.countries?.length ? (
        <div className="px-4 py-3">
          {/* Horizontal scrollable cards */}
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {data.countries.map((country) => (
              <CountryCard
                key={country.code}
                country={country}
                isExpanded={expandedCode === country.code}
                onToggle={() => toggleExpand(country.code)}
                onDoubleClick={() => setDetailCountry(country)}
              />
            ))}
          </div>

          {/* Collapsible overall assessment */}
          {showAssessment && data.overall_assessment && (
            <div className="mt-2 relative">
              <div className="font-mono text-[10px] text-muted-foreground leading-relaxed border-t border-border pt-2 pr-6">
                {data.overall_assessment}
              </div>
              <button
                onClick={() => setShowAssessment(false)}
                className="absolute top-2 right-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : null}
      {/* Country detail popup on double-click */}
      <AnimatePresence>
        {detailCountry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDetailCountry(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative w-[440px] max-w-[90vw] bg-card border border-border rounded-lg shadow-2xl overflow-hidden border-l-4`}
              style={{ borderLeftColor: levelColors[detailCountry.level] || "hsl(215 15% 50%)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{flagEmoji[detailCountry.code] || "🏳️"}</span>
                  <div>
                    <h2 className="font-mono text-sm font-bold text-foreground">{detailCountry.name}</h2>
                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: levelColors[detailCountry.level] }}
                    >
                      {detailCountry.level} — Score: {detailCountry.safety_score}/100
                    </span>
                  </div>
                </div>
                <button onClick={() => setDetailCountry(null)} className="p-1 rounded hover:bg-destructive/20">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
                {/* Safety score bar */}
                <div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block mb-1">Safety Score</span>
                  <div className="w-full h-2.5 bg-background/50 rounded-full">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${detailCountry.safety_score}%`, backgroundColor: getScoreColor(detailCountry.safety_score) }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block mb-1">Current Status</span>
                  <p className="text-[11px] text-foreground leading-relaxed">{detailCountry.status}</p>
                </div>

                {/* Threats */}
                {detailCountry.threats?.length > 0 && (
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block mb-1.5">Active Threats</span>
                    <ul className="space-y-1.5">
                      {detailCountry.threats.map((threat, i) => (
                        <li key={i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-destructive/5 border border-destructive/10">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-critical" />
                          <span className="text-[10px] text-foreground leading-snug">{threat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}


                <div className="text-[8px] text-muted-foreground/40 font-mono pt-2 border-t border-border/30">
                  Double-click country card to open • AI-powered analysis
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
