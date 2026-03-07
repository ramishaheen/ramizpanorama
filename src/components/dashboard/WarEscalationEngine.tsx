import { useState } from "react";
import { useWarEscalation, type EscalationScenario, type EscalationIndicator, type ConflictPhase } from "@/hooks/useWarEscalation";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";
import {
  AlertTriangle, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Shield, Crosshair, Clock, History, Zap, Target
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const severityColor: Record<string, string> = {
  LOW: "text-success",
  MEDIUM: "text-warning",
  HIGH: "text-critical",
  CRITICAL: "text-critical animate-pulse",
  CATASTROPHIC: "text-critical animate-pulse",
};

const severityBg: Record<string, string> = {
  LOW: "bg-success/10 border-success/20",
  MEDIUM: "bg-warning/10 border-warning/20",
  HIGH: "bg-critical/10 border-critical/20",
  CRITICAL: "bg-critical/20 border-critical/30",
  CATASTROPHIC: "bg-critical/30 border-critical/40 animate-pulse",
};

const trendIcon = {
  ESCALATING: <TrendingUp className="h-3 w-3 text-critical" />,
  STABLE: <Minus className="h-3 w-3 text-warning" />,
  "DE-ESCALATING": <TrendingDown className="h-3 w-3 text-success" />,
};

const trendColor = {
  ESCALATING: "text-critical",
  STABLE: "text-warning",
  "DE-ESCALATING": "text-success",
};

const postureColor: Record<string, string> = {
  NORMAL: "bg-success/20 text-success",
  ELEVATED: "bg-warning/20 text-warning",
  HIGH: "bg-critical/20 text-critical",
  MAXIMUM: "bg-critical/30 text-critical animate-pulse",
};

const phaseStatusColor: Record<string, string> = {
  ACTIVE: "text-critical",
  EMERGING: "text-warning",
  POTENTIAL: "text-muted-foreground",
  PASSED: "text-success",
};

const directionIcon: Record<string, React.ReactNode> = {
  ESCALATORY: <TrendingUp className="h-2.5 w-2.5 text-critical" />,
  "DE-ESCALATORY": <TrendingDown className="h-2.5 w-2.5 text-success" />,
  AMBIGUOUS: <Minus className="h-2.5 w-2.5 text-warning" />,
};

function getProbabilityColor(p: number) {
  if (p >= 75) return "text-critical";
  if (p >= 50) return "text-warning";
  if (p >= 25) return "text-primary";
  return "text-success";
}

function getProbabilityBarColor(p: number) {
  if (p >= 75) return "[&>div]:bg-critical";
  if (p >= 50) return "[&>div]:bg-warning";
  if (p >= 25) return "[&>div]:bg-primary";
  return "[&>div]:bg-success";
}

export const WarEscalationEngine = () => {
  const { data, loading, error, refresh } = useWarEscalation();
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Crosshair className="h-3 w-3 text-critical" />
          {t(tr["section.escalation"]?.en || "War Escalation Engine", tr["section.escalation"]?.ar || "محرك تصعيد الحرب")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 rounded hover:bg-secondary/60 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </button>
          <button onClick={refresh} disabled={loading} className="p-1 rounded hover:bg-secondary/60 transition-colors">
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 text-critical animate-spin" />
          <span className="text-[10px] text-muted-foreground ml-2 font-mono">
            {t("Analyzing escalation patterns…", "جاري تحليل أنماط التصعيد…")}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 py-3 px-2 rounded bg-critical/10 border border-critical/20">
          <AlertTriangle className="h-3 w-3 text-critical" />
          <span className="text-[10px] text-critical">{error}</span>
        </div>
      )}

      {/* Main content */}
      {data && !data.error && (
        <div className="space-y-2">
          {/* Overall probability gauge */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono text-muted-foreground uppercase">Escalation Probability</span>
                <span className={`text-sm font-mono font-bold ${getProbabilityColor(data.overall_escalation_probability || 0)}`}>
                  {data.overall_escalation_probability || 0}%
                </span>
              </div>
              <Progress
                value={data.overall_escalation_probability || 0}
                className={`h-2 ${getProbabilityBarColor(data.overall_escalation_probability || 0)}`}
              />
            </div>
          </div>

          {/* Trend + Posture + Kahn Rung */}
          <div className="flex items-center gap-2 flex-wrap">
            {data.trend && (
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${trendColor[data.trend]}`}>
                {trendIcon[data.trend]} {data.trend}
                {data.trend_velocity && <span className="text-[8px] opacity-70">({data.trend_velocity})</span>}
              </span>
            )}
            {data.recommended_posture && (
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${postureColor[data.recommended_posture]}`}>
                <Shield className="h-2.5 w-2.5 inline mr-0.5" />
                {data.recommended_posture}
              </span>
            )}
            {data.current_escalation_level && (
              <span className="text-[9px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/40">
                Kahn #{data.current_escalation_level.kahn_rung}: {data.current_escalation_level.label}
              </span>
            )}
          </div>

          {/* Key Assessment */}
          {data.key_assessment && (
            <div className="px-2 py-1.5 rounded bg-critical/5 border border-critical/15">
              <p className="text-[10px] text-foreground font-mono leading-relaxed">{data.key_assessment}</p>
            </div>
          )}

          {/* 24h Outlook */}
          {data.next_24h_outlook && (
            <div className="px-2 py-1 rounded bg-secondary/30 border border-border">
              <div className="flex items-center gap-1 mb-0.5">
                <Clock className="h-2.5 w-2.5 text-primary" />
                <span className="text-[8px] font-mono text-primary uppercase font-bold">Next 24h</span>
              </div>
              <p className="text-[9px] text-muted-foreground font-mono leading-snug">{data.next_24h_outlook}</p>
            </div>
          )}

          {/* Scenarios (top 3) */}
          {data.scenarios && data.scenarios.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 mb-0.5">
                <Target className="h-2.5 w-2.5 text-warning" />
                <span className="text-[8px] font-mono text-muted-foreground uppercase font-bold">Escalation Scenarios</span>
              </div>
              {data.scenarios.slice(0, expanded ? undefined : 3).map((s: EscalationScenario, i: number) => (
                <div key={i} className={`px-2 py-1.5 rounded border ${severityBg[s.severity] || "bg-secondary/30 border-border"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold text-foreground">{s.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-mono text-muted-foreground">{s.timeline}</span>
                      <span className={`text-[10px] font-mono font-bold ${getProbabilityColor(s.probability)}`}>
                        {s.probability}%
                      </span>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground font-mono leading-snug mt-0.5 line-clamp-2">{s.description}</p>
                  {expanded && s.triggers && s.triggers.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.triggers.map((trigger, ti) => (
                        <span key={ti} className="text-[7px] font-mono px-1 py-0.5 rounded bg-secondary/50 text-muted-foreground">
                          <Zap className="h-2 w-2 inline mr-0.5" />{trigger}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Expanded sections */}
          {expanded && (
            <>
              {/* Conflict Phases */}
              {data.conflict_phases && data.conflict_phases.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-muted-foreground uppercase font-bold flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" /> Conflict Phases
                  </span>
                  {data.conflict_phases.map((p: ConflictPhase, i: number) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-secondary/20 border border-border">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-mono font-bold ${phaseStatusColor[p.status]}`}>{p.status}</span>
                        <span className="text-[9px] font-mono text-foreground">{p.phase}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-muted-foreground">{p.timeline}</span>
                        <span className={`text-[9px] font-mono font-bold ${getProbabilityColor(p.probability)}`}>{p.probability}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Escalation Indicators */}
              {data.escalation_indicators && data.escalation_indicators.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-muted-foreground uppercase font-bold flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> Key Indicators
                  </span>
                  {data.escalation_indicators.slice(0, 5).map((ind: EscalationIndicator, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 px-2 py-1 rounded bg-secondary/20 border border-border">
                      {directionIcon[ind.direction]}
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-mono text-foreground">{ind.indicator}</span>
                        <p className="text-[8px] text-muted-foreground font-mono leading-snug">{ind.detail}</p>
                      </div>
                      <span className={`text-[7px] font-mono font-bold ${ind.significance === "HIGH" ? "text-critical" : ind.significance === "MEDIUM" ? "text-warning" : "text-muted-foreground"}`}>
                        {ind.significance}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Historical Analogy */}
              {data.historical_analogy && (
                <div className="px-2 py-1.5 rounded bg-primary/5 border border-primary/15">
                  <div className="flex items-center gap-1 mb-1">
                    <History className="h-2.5 w-2.5 text-primary" />
                    <span className="text-[8px] font-mono text-primary uppercase font-bold">Historical Parallel</span>
                    <span className="text-[8px] font-mono text-muted-foreground ml-auto">{data.historical_analogy.similarity_score}% match</span>
                  </div>
                  <p className="text-[9px] font-mono text-foreground font-semibold">{data.historical_analogy.conflict}</p>
                  <p className="text-[8px] font-mono text-muted-foreground leading-snug mt-0.5">{data.historical_analogy.current_parallel}</p>
                  <p className="text-[8px] font-mono text-primary/70 leading-snug mt-0.5 italic">"{data.historical_analogy.lesson}"</p>
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <p className="text-[7px] text-muted-foreground/60 leading-tight">
            {t(
              "⚠ AI-generated conflict analysis for informational purposes only. Not for operational military use.",
              "⚠ تحليل صراع مُولّد بالذكاء الاصطناعي لأغراض إعلامية فقط. ليس للاستخدام العسكري العملياتي."
            )}
          </p>
        </div>
      )}
    </div>
  );
};
