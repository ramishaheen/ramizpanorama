import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, RefreshCw, AlertTriangle } from "lucide-react";

interface CountrySafety {
  code: string;
  name: string;
  safety_score: number;
  level: "SAFE" | "CAUTION" | "ELEVATED" | "DANGER" | "CRITICAL";
  status: string;
  threats: string[];
}

interface SecurityData {
  countries: CountrySafety[];
  overall_assessment: string;
  last_analyzed: string;
  error?: string;
}

const levelColors: Record<string, string> = {
  SAFE: "hsl(var(--success))",
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

export const CitizenSecurity = () => {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSecurity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("citizen-security");
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData);
    } catch (e) {
      console.error("Citizen security fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurity();
    const interval = setInterval(fetchSecurity, 60000);
    return () => clearInterval(interval);
  }, [fetchSecurity]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "hsl(var(--success))";
    if (score >= 60) return "hsl(40 100% 50%)";
    if (score >= 40) return "hsl(25 100% 50%)";
    if (score >= 20) return "hsl(0 80% 55%)";
    return "hsl(0 80% 35%)";
  };

  return (
    <div className="border-t border-border bg-card/50">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Citizen Security Indicators
          </span>
          <span className="font-mono text-[9px] text-primary uppercase">AI-Powered</span>
        </div>
        <button
          onClick={fetchSecurity}
          disabled={loading}
          className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 flex items-center gap-2 text-destructive font-mono text-[10px]">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="px-3 py-4 flex items-center justify-center gap-2">
          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
          <span className="font-mono text-[10px] text-muted-foreground">Analyzing regional security…</span>
        </div>
      ) : data?.countries?.length ? (
        <div className="px-3 py-2">
          <div className="grid grid-cols-5 gap-1.5">
            {data.countries.map((country) => (
              <div
                key={country.code}
                className={`border rounded px-2 py-1.5 ${levelBg[country.level] || "bg-muted/10 border-border"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{flagEmoji[country.code] || "🏳️"}</span>
                    <span className="font-mono text-[10px] font-bold text-foreground">{country.name}</span>
                  </div>
                  <span
                    className="font-mono text-[10px] font-bold"
                    style={{ color: getScoreColor(country.safety_score) }}
                  >
                    {country.safety_score}
                  </span>
                </div>
                <div
                  className="font-mono text-[8px] font-semibold uppercase tracking-wider mb-0.5"
                  style={{ color: levelColors[country.level] || "hsl(var(--muted-foreground))" }}
                >
                  {country.level}
                </div>
                <p className="font-mono text-[8px] text-muted-foreground leading-tight line-clamp-2">
                  {country.status}
                </p>
              </div>
            ))}
          </div>
          {data.overall_assessment && (
            <p className="mt-2 font-mono text-[9px] text-muted-foreground leading-relaxed border-t border-border pt-2">
              {data.overall_assessment}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
};
