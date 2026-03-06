import { useState } from "react";
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

const CountryCard = ({ country, isExpanded, onToggle }: {
  country: CountrySafety;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const scoreColor = getScoreColor(country.safety_score);
  const lvlColor = levelColors[country.level] || "hsl(215 15% 50%)";

  return (
    <div
      className={`border rounded flex-shrink-0 cursor-pointer transition-all duration-200 ${
        isExpanded ? "w-[220px]" : "w-[140px]"
      } ${levelBg[country.level] || "bg-muted/10 border-border"}`}
      onClick={onToggle}
    >
      <div className="px-2 py-1.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <span className="text-sm">{flagEmoji[country.code] || "🏳️"}</span>
            <span className="font-mono text-[10px] font-bold text-foreground">{country.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] font-bold" style={{ color: scoreColor }}>
              {country.safety_score}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="w-full h-1 bg-background/50 rounded-full mb-1">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${country.safety_score}%`,
              backgroundColor: scoreColor,
            }}
          />
        </div>

        <div
          className="font-mono text-[8px] font-semibold uppercase tracking-wider mb-0.5"
          style={{ color: lvlColor }}
        >
          {country.level}
        </div>

        <p className={`font-mono text-[8px] text-muted-foreground leading-tight ${
          isExpanded ? "" : "line-clamp-2"
        }`}>
          {country.status}
        </p>

        {isExpanded && country.threats?.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-border/50">
            <span className="font-mono text-[7px] uppercase tracking-wider text-muted-foreground/70 block mb-1">
              Active Threats
            </span>
            <ul className="space-y-0.5">
              {country.threats.map((threat, i) => (
                <li key={i} className="flex items-start gap-1">
                  <AlertTriangle className="h-2 w-2 mt-0.5 flex-shrink-0" style={{ color: lvlColor }} />
                  <span className="font-mono text-[7px] text-muted-foreground leading-tight">{threat}</span>
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

  const toggleExpand = (code: string) => {
    setExpandedCode(prev => prev === code ? null : code);
  };

  return (
    <div className="border-t border-border bg-card/50">
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Citizen Security Indicators
          </span>
          <span className="font-mono text-[9px] text-primary uppercase">AI-Powered</span>
        </div>
        <div className="flex items-center gap-1">
          {data?.overall_assessment && (
            <button
              onClick={() => setShowAssessment(prev => !prev)}
              className="px-1.5 py-0.5 text-muted-foreground hover:text-primary transition-colors font-mono text-[8px] uppercase border border-border rounded"
            >
              {showAssessment ? "Hide" : "Intel"}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-1.5 flex items-center gap-2 text-destructive font-mono text-[10px]">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="px-3 py-3 flex items-center justify-center gap-2">
          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
          <span className="font-mono text-[10px] text-muted-foreground">Analyzing regional security…</span>
        </div>
      ) : data?.countries?.length ? (
        <div className="px-3 py-2">
          {/* Horizontal scrollable cards */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {data.countries.map((country) => (
              <CountryCard
                key={country.code}
                country={country}
                isExpanded={expandedCode === country.code}
                onToggle={() => toggleExpand(country.code)}
              />
            ))}
          </div>

          {/* Collapsible overall assessment */}
          {showAssessment && data.overall_assessment && (
            <div className="mt-1.5 relative">
              <div className="font-mono text-[9px] text-muted-foreground leading-relaxed border-t border-border pt-1.5 pr-5">
                {data.overall_assessment}
              </div>
              <button
                onClick={() => setShowAssessment(false)}
                className="absolute top-1.5 right-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
