import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Activity, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

interface Prediction {
  sector: string;
  ticker: string | null;
  direction: "UP" | "DOWN" | "VOLATILE";
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

const AUTO_REFRESH_MS = 120_000; // 2 minutes

export const AIPredictions = () => {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-predictions");
      if (error) throw error;
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch predictions:", err);
      setData({ error: "Failed to load predictions" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-primary" />
          AI Trade Predictions
        </h3>
        <button
          onClick={fetchPredictions}
          disabled={loading}
          className="p-1 rounded hover:bg-secondary/60 transition-colors"
          title="Refresh predictions"
        >
          <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <span className="text-[10px] text-muted-foreground ml-2 font-mono">Analyzing intel…</span>
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
          {/* Sentiment & Risk */}
          <div className="flex items-center gap-2">
            {data.overall_market_sentiment && (
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${sentimentColor[data.overall_market_sentiment]}`}>
                {data.overall_market_sentiment}
              </span>
            )}
            {data.risk_level && (
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${riskColor[data.risk_level]}`}>
                RISK: {data.risk_level}
              </span>
            )}
          </div>

          {/* Key Insight */}
          {data.key_insight && (
            <div className="px-2 py-1.5 rounded bg-primary/5 border border-primary/20">
              <p className="text-[10px] text-primary font-mono leading-relaxed">{data.key_insight}</p>
            </div>
          )}

          {/* Predictions */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.predictions?.map((pred, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-2 py-1.5 rounded bg-secondary/30 border border-border"
              >
                {directionIcon[pred.direction]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-semibold text-foreground truncate">
                      {pred.ticker ? `${pred.sector} (${pred.ticker})` : pred.sector}
                    </span>
                    <span className={`text-[8px] font-mono ${confidenceColor[pred.confidence]}`}>
                      {pred.confidence}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground">
                      {pred.timeframe === "SHORT" ? "24-48h" : "1-2w"}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                    {pred.rationale}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Last updated */}
          {lastUpdated && (
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-[8px] font-mono text-muted-foreground">
                Updated: {lastUpdated.toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span className="text-[8px] font-mono text-muted-foreground">
                Auto-refresh: 2min
              </span>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[7px] text-muted-foreground/60 leading-tight">
            ⚠ AI-generated predictions for informational purposes only. Not financial advice. Always consult a licensed financial advisor.
          </p>
        </div>
      )}
    </div>
  );
};
