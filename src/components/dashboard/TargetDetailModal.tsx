import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Target, Crosshair, Shield, Eye, Radar, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmSlider } from "./ConfirmSlider";
import type { StrikeRecommendation } from "@/hooks/useSensorToShooter";

interface TargetDetailModalProps {
  targetId: string;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
  onCommitStrike?: (recommendationId: string) => Promise<any>;
}

const CLASS_ICONS: Record<string, string> = {
  tank: "🪖", truck: "🚛", missile_launcher: "🚀", apc: "🛡",
  radar: "📡", sam_site: "🎯", artillery: "💥", command_post: "🏛", supply_depot: "📦",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#dc2626", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

const THREAT_LABELS = ["", "MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"];

export const TargetDetailModal = ({ targetId, onClose, onLocate, onCommitStrike }: TargetDetailModalProps) => {
  const [target, setTarget] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: tgt }, { data: recs }] = await Promise.all([
        supabase.from("target_tracks").select("*").eq("id", targetId).single(),
        supabase.from("strike_recommendations")
          .select("*, shooter_assets(*)")
          .eq("target_track_id", targetId)
          .eq("decision", "pending")
          .order("probability_of_kill", { ascending: false })
          .limit(1),
      ]);
      if (tgt) setTarget(tgt);
      if (recs?.length) setRecommendation(recs[0]);
      setLoading(false);
    };
    fetchData();
  }, [targetId]);

  const handleCommit = async () => {
    if (!recommendation || !onCommitStrike) return;
    setCommitting(true);
    await onCommitStrike(recommendation.id);
    setCommitting(false);
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const threatLevel = target?.threat_level || 3;
  const velocityVector = target?.velocity_vector || {};
  const pCol = PRIORITY_COLORS[target?.priority] || "#888";
  const shooter = recommendation?.shooter_assets;

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[95vw] max-w-4xl bg-[hsl(220,25%,6%)] border rounded-lg overflow-hidden shadow-2xl"
        style={{ borderColor: pCol + "60" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: pCol + "30", background: `linear-gradient(90deg, ${pCol}10, transparent)` }}>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: pCol }} />
            <span className="text-xs font-mono font-bold tracking-[0.15em] text-foreground uppercase">
              TARGET DEEP DIVE
            </span>
            {target && (
              <span className="text-[9px] font-mono text-muted-foreground ml-2">— {target.track_id}</span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/20 transition-colors">
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !target ? (
          <div className="text-center py-20 text-sm font-mono text-muted-foreground">Target not found</div>
        ) : (
          <>
            {/* Main 3-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-[hsl(220,15%,12%)]">
              {/* LEFT: Sensor Image */}
              <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
                <div className="w-full aspect-square max-w-[200px] rounded border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,4%)] flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(220,25%,6%)]" />
                  {/* Crosshair overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <div className="w-full h-px bg-[#ef4444]" />
                    <div className="absolute w-px h-full bg-[#ef4444]" />
                    <div className="absolute w-16 h-16 rounded-full border border-[#ef4444]" />
                  </div>
                  <span className="text-4xl mb-2 relative z-10">{CLASS_ICONS[target.classification] || "🎯"}</span>
                  <span className="text-[10px] font-mono font-bold tracking-wider relative z-10" style={{ color: pCol }}>
                    {target.classification.toUpperCase().replace("_", " ")}
                  </span>
                  <span className="text-[8px] font-mono text-muted-foreground mt-1 relative z-10">
                    {target.source_sensor.toUpperCase()} FEED
                  </span>
                  {target.image_url && (
                    <img src={target.image_url} alt="Sensor" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  )}
                </div>
                <button
                  onClick={() => onLocate?.(target.lat, target.lng)}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-mono font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                >
                  <Eye className="h-3 w-3" /> LOCATE ON GLOBE
                </button>
              </div>

              {/* CENTER: Metadata */}
              <div className="p-4 space-y-3">
                <div className="text-[8px] font-mono text-muted-foreground tracking-[0.2em] uppercase">INTELLIGENCE METADATA</div>

                <div className="space-y-2">
                  {/* Confidence gauge */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono text-muted-foreground">AI CONFIDENCE</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: target.confidence > 0.8 ? "#22c55e" : target.confidence > 0.6 ? "#eab308" : "#ef4444" }}>
                        {(target.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[hsl(220,15%,12%)] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${target.confidence * 100}%`,
                        background: target.confidence > 0.8 ? "#22c55e" : target.confidence > 0.6 ? "#eab308" : "#ef4444",
                      }} />
                    </div>
                  </div>

                  {/* Threat Level */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono text-muted-foreground">THREAT LEVEL</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: threatLevel >= 4 ? "#ef4444" : threatLevel >= 3 ? "#eab308" : "#22c55e" }}>
                        {threatLevel}/5 — {THREAT_LABELS[threatLevel] || "UNKNOWN"}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex-1 h-1.5 rounded-sm" style={{
                          background: i <= threatLevel
                            ? (threatLevel >= 4 ? "#ef4444" : threatLevel >= 3 ? "#eab308" : "#22c55e")
                            : "hsl(220,15%,12%)",
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {[
                      { label: "PRIORITY", value: target.priority.toUpperCase(), color: pCol },
                      { label: "STATUS", value: target.status.toUpperCase(), color: "#00d4ff" },
                      { label: "COORDS", value: `${target.lat.toFixed(4)}°N ${target.lng.toFixed(4)}°E`, color: "#aaa" },
                      { label: "SENSOR", value: target.source_sensor.toUpperCase(), color: "#06b6d4" },
                      { label: "SPEED", value: velocityVector.speed_kts ? `${velocityVector.speed_kts} kts` : "STATIC", color: "#aaa" },
                      { label: "HEADING", value: velocityVector.heading_deg ? `${velocityVector.heading_deg}°` : "N/A", color: "#aaa" },
                      { label: "VERIFIED", value: target.analyst_verified ? "YES ✓" : "PENDING", color: target.analyst_verified ? "#22c55e" : "#eab308" },
                      { label: "DETECTED", value: new Date(target.detected_at).toISOString().slice(11, 19), color: "#888" },
                    ].map(m => (
                      <div key={m.label} className="py-1.5 px-2 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                        <div className="text-[7px] font-mono text-muted-foreground tracking-wider">{m.label}</div>
                        <div className="text-[9px] font-mono font-bold mt-0.5" style={{ color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Assessment */}
                  {target.ai_assessment && (
                    <div className="mt-2 p-2 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                      <div className="text-[7px] font-mono text-muted-foreground tracking-wider mb-1">AI ASSESSMENT</div>
                      <div className="text-[8px] font-mono text-foreground/80 leading-relaxed">{target.ai_assessment}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Recommended Action */}
              <div className="p-4 space-y-3">
                <div className="text-[8px] font-mono text-muted-foreground tracking-[0.2em] uppercase">RECOMMENDED ACTION</div>

                {recommendation && shooter ? (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded border border-[#22c55e]/30 bg-[#22c55e]/5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Crosshair className="h-3 w-3 text-[#22c55e]" />
                        <span className="text-[9px] font-mono font-bold text-[#22c55e]">ASSIGN: {shooter.callsign}</span>
                      </div>
                      <div className="text-[8px] font-mono text-foreground/70">{shooter.asset_type.replace(/_/g, " ").toUpperCase()}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: "WEAPON", value: recommendation.recommended_weapon.toUpperCase(), color: "#f97316" },
                        { label: "Pk", value: `${(recommendation.probability_of_kill * 100).toFixed(0)}%`, color: recommendation.probability_of_kill > 0.7 ? "#22c55e" : "#eab308" },
                        { label: "TTT", value: `${recommendation.time_to_target_min} min`, color: "#00d4ff" },
                        { label: "DIST", value: `${recommendation.proximity_km} km`, color: "#aaa" },
                      ].map(m => (
                        <div key={m.label} className="py-1.5 px-2 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                          <div className="text-[7px] font-mono text-muted-foreground tracking-wider">{m.label}</div>
                          <div className="text-[10px] font-mono font-bold mt-0.5" style={{ color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* ROE + Collateral */}
                    <div className="flex gap-1.5">
                      <span className={`flex-1 text-center text-[8px] font-mono font-bold px-2 py-1.5 rounded border ${
                        recommendation.roe_status === "CLEAR" ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]"
                        : recommendation.roe_status.includes("DENIED") ? "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]"
                        : "border-[#eab308]/40 bg-[#eab308]/10 text-[#eab308]"
                      }`}>
                        ROE: {recommendation.roe_status}
                      </span>
                      <span className={`flex-1 text-center text-[8px] font-mono font-bold px-2 py-1.5 rounded border ${
                        recommendation.collateral_risk === "low" ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]"
                        : recommendation.collateral_risk === "high" ? "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]"
                        : "border-[#eab308]/40 bg-[#eab308]/10 text-[#eab308]"
                      }`}>
                        CDR: {recommendation.collateral_risk.toUpperCase()}
                      </span>
                    </div>

                    {/* AI Reasoning */}
                    {recommendation.ai_reasoning && (
                      <div className="p-2 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                        <div className="text-[7px] font-mono text-muted-foreground tracking-wider mb-1">AI REASONING</div>
                        <div className="text-[8px] font-mono text-foreground/80 leading-relaxed">{recommendation.ai_reasoning}</div>
                      </div>
                    )}

                    {/* Shooter status */}
                    <div className="flex items-center gap-1.5 text-[8px] font-mono text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      <span>FUEL: {shooter.fuel_remaining_pct?.toFixed(0)}%</span>
                      <span>•</span>
                      <span>LINK: {shooter.command_link_status?.toUpperCase()}</span>
                      <span>•</span>
                      <span>ROE ZONE: {shooter.roe_zone?.toUpperCase()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Radar className="h-6 w-6 text-muted-foreground mb-2" />
                    <span className="text-[9px] font-mono text-muted-foreground">No pending strike recommendation</span>
                    <span className="text-[8px] font-mono text-muted-foreground/60 mt-1">Run F2T2EA match from S2S panel</span>
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM: HITL Confirm Slider */}
            {recommendation && recommendation.decision === "pending" && (
              <div className="px-4 py-3 border-t border-[hsl(220,15%,12%)] bg-[hsl(220,25%,5%)]">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-3 w-3 text-[#fbbf24]" />
                  <span className="text-[8px] font-mono text-[#fbbf24] tracking-[0.15em]">HUMAN-IN-THE-LOOP AUTHORIZATION REQUIRED</span>
                </div>
                <ConfirmSlider onConfirm={handleCommit} disabled={committing} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
