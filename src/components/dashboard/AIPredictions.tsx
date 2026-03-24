import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Activity, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { handleAIError } from "@/lib/ai-error-handler";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

interface Prediction {
  sector: string;
  ticker: string | null;
  direction: "UP" | "DOWN" | "VOLATILE";
  recommendation: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  timeframe: "SHORT" | "MEDIUM";
  rationale: string;
}

interface PredictionData {
  timestamp?: string;
  overall_market_sentiment?: "BEARISH" | "BULLISH" | "MIXED";
  predictions?: Prediction[];
  key_insight?: string;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  error?: string;
}

const directionIcon = {
  UP: <TrendingUp className="h-3 w-3 text-success" />,
  DOWN: <TrendingDown className="h-3 w-3 text-critical" />,
  VOLATILE: <Activity className="h-3 w-3 text-warning" />,
};

const confidenceColor = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-warning",
  HIGH: "text-success",
};

const sentimentColor = {
  BEARISH: "text-critical",
  BULLISH: "text-success",
  MIXED: "text-warning",
};

const riskColor = {
  LOW: "bg-success/20 text-success",
  MEDIUM: "bg-warning/20 text-warning",
  HIGH: "bg-critical/20 text-critical",
  EXTREME: "bg-critical/30 text-critical animate-pulse",
};



export const AIPredictions = () => {
  const [data, setData] = useState<PredictionData | null>(() => {
    try {
      const cached = localStorage.getItem("waros_ai_predictions_cache");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { t, isArabic } = useLanguage();

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-predictions");
      if (error) throw error;
      setData(result);
      setLastUpdated(new Date());
      try { localStorage.setItem("waros_ai_predictions_cache", JSON.stringify(result)); } catch {}
    } catch (err) {
      console.error("Failed to fetch predictions:", err);
      if (!handleAIError(err, "AI Predictions")) {
        // Only show error if we don't have cached data
        if (!data) {
          setData({ error: t("Failed to load predictions", "فشل تحميل التوقعات") });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [t, data]);

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, 180_000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  return (
    <div className="maven-glass border-l-2 border-l-primary/40 p-3 relative overflow-hidden">
      {/* Neural network background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 20% 30%, hsl(192 95% 48% / 0.15) 1px, transparent 1px), radial-gradient(circle at 80% 70%, hsl(192 95% 48% / 0.1) 1px, transparent 1px)',
        backgroundSize: '24px 24px, 32px 32px'
      }} />
      <div className="relative z-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <div className="relative">
            <Activity className="h-3 w-3 text-primary" />
            <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-ping opacity-40" />
          </div>
          {t(tr["section.predictions"].en, tr["section.predictions"].ar)}
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-mono uppercase tracking-wider text-primary/60 px-1.5 py-0.5 border border-primary/15 bg-primary/5">AI ENGINE</span>
          <button
            onClick={fetchPredictions}
            disabled={loading}
            className="p-1 rounded-sm hover:bg-primary/10 transition-all duration-150"
            title={t("Refresh predictions", "تحديث التوقعات")}
          >
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="relative">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <div className="absolute inset-0 h-5 w-5 border border-primary/20 rounded-full animate-ping" />
          </div>
          <span className="text-[10px] text-primary/80 font-mono uppercase tracking-wider">{t(tr["pred.analyzing"].en, tr["pred.analyzing"].ar)}</span>
          <div className="flex gap-1">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="h-1 w-6 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: `${i * 150}ms`, width: `${60 + Math.random() * 40}%` }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.error && (
        <div className="flex items-center gap-2 py-3 px-2 rounded bg-critical/10 border border-critical/20">
          <AlertTriangle className="h-3 w-3 text-critical" />
          <span className="text-[10px] text-critical">{data.error}</span>
        </div>
      )}

      {data && !data.error && (
        <div className="space-y-2">
          {/* Sentiment & Risk — styled as tactical badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {data.overall_market_sentiment && (
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border ${
                data.overall_market_sentiment === 'BULLISH' ? 'border-success/30 bg-success/8' :
                data.overall_market_sentiment === 'BEARISH' ? 'border-critical/30 bg-critical/8' :
                'border-warning/30 bg-warning/8'
              } ${sentimentColor[data.overall_market_sentiment]}`}>
                ◆ {data.overall_market_sentiment}
              </span>
            )}
            {data.risk_level && (
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border ${riskColor[data.risk_level]}`}>
                ▲ {t("RISK", "المخاطر")}: {data.risk_level}
              </span>
            )}
            {data.predictions && (
              <span className="text-[8px] font-mono text-muted-foreground/60 ml-auto">
                {data.predictions.length} SIGNALS
              </span>
            )}
          </div>

          {/* Key Insight — neural highlight */}
          {data.key_insight && (
            <div className="px-2.5 py-2 border-l-2 border-l-primary bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-xl" />
              <p className="text-[10px] text-primary font-mono leading-relaxed relative z-10">{data.key_insight}</p>
            </div>
          )}

          {/* Predictions — attack chain flow cards */}
          <div className="space-y-1 max-h-48 overflow-y-auto intel-feed-scroll">
            {data.predictions?.map((pred, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 px-2.5 py-2 border-l-2 transition-all duration-150 hover:bg-secondary/20 maven-hover ${
                  pred.direction === 'UP' ? 'border-l-success/50 bg-success/3' :
                  pred.direction === 'DOWN' ? 'border-l-critical/50 bg-critical/3' :
                  'border-l-warning/50 bg-warning/3'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {directionIcon[pred.direction]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-semibold text-foreground truncate">
                      {pred.ticker ? `${pred.sector} (${pred.ticker})` : pred.sector}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {/* Confidence bar */}
                      <div className="flex gap-px">
                        {[1,2,3].map(level => (
                          <div key={level} className={`h-1.5 w-1 ${
                            (pred.confidence === 'HIGH' || (pred.confidence === 'MEDIUM' && level <= 2) || level === 1)
                              ? (pred.confidence === 'HIGH' ? 'bg-success' : pred.confidence === 'MEDIUM' ? 'bg-warning' : 'bg-muted-foreground')
                              : 'bg-muted/30'
                          }`} />
                        ))}
                      </div>
                      <span className={`text-[7px] font-mono ${confidenceColor[pred.confidence]}`}>
                        {pred.confidence}
                      </span>
                    </div>
                    <span className="text-[7px] font-mono text-muted-foreground/50 border border-border/30 px-1">
                      {pred.timeframe === "SHORT" ? "24-48h" : "1-2w"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {pred.recommendation && (
                      <span className={`text-[7px] font-mono font-bold px-1 py-0.5 ${
                        pred.recommendation === "STRONG BUY" ? "bg-success/15 text-success border border-success/20" :
                        pred.recommendation === "BUY" ? "bg-success/8 text-success/80 border border-success/15" :
                        pred.recommendation === "HOLD" ? "bg-warning/10 text-warning border border-warning/15" :
                        pred.recommendation === "SELL" ? "bg-critical/8 text-critical/80 border border-critical/15" :
                        "bg-critical/15 text-critical border border-critical/20"
                      }`}>
                        {pred.recommendation}
                      </span>
                    )}
                    <p className="text-[8px] text-muted-foreground leading-snug line-clamp-2 flex-1">
                      {pred.rationale}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Last updated */}
          {lastUpdated && (
            <div className="flex items-center justify-between pt-1.5 border-t border-border/20">
              <span className="text-[8px] font-mono text-muted-foreground/60">
                {t(tr["pred.updated"].en, tr["pred.updated"].ar)}: {lastUpdated.toLocaleTimeString(isArabic ? "ar-SA" : "en-US", { hour12: false })}
              </span>
              <span className="text-[7px] font-mono text-primary/40 uppercase">
                {t(tr["pred.auto_refresh"].en, tr["pred.auto_refresh"].ar)}
              </span>
            </div>
          )}

          {/* Legal Disclaimer */}
          <p className="text-[7px] text-muted-foreground/40 leading-tight">
            {t(tr["pred.disclaimer"].en, tr["pred.disclaimer"].ar)}
          </p>
        </div>
      )}
      </div>
    </div>
  );
};
