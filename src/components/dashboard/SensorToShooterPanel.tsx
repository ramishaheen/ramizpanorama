import { useState } from "react";
import { Crosshair, Zap, CheckCircle, XCircle, Loader2, Ship, Radar, ArrowRight, Target, Shield, Anchor, AlertTriangle } from "lucide-react";
import { useSensorToShooter, type StrikeRecommendation, type ShooterAsset } from "@/hooks/useSensorToShooter";

const ASSET_ICONS: Record<string, string> = {
  mq9_reaper: "🛩️", mq1_predator: "🛩️", f35_lightning: "✈️", f16_falcon: "✈️",
  ah64_apache: "🚁", artillery_m777: "💥", mlrs_himars: "🚀",
  naval_destroyer: "🚢", naval_frigate: "⚓", missile_battery_patriot: "🛡️",
};

const TASKING_COLORS: Record<string, string> = {
  idle: "#22c55e", tasked: "#eab308", rtb: "#f97316", maintenance: "#6b7280", combat: "#ef4444",
};

const DECISION_COLORS: Record<string, string> = {
  pending: "#eab308", committed: "#22c55e", discarded: "#6b7280", executing: "#f97316", complete: "#3b82f6", aborted: "#ef4444",
};

interface SensorToShooterPanelProps {
  onLocate?: (lat: number, lng: number) => void;
}

export const SensorToShooterPanel = ({ onLocate }: SensorToShooterPanelProps) => {
  const {
    shooters, recommendations, actionLogs, loading, matching,
    pendingCount, committedCount, idleShooters, darkVesselResult,
    matchShooters, commitStrike, discardStrike, detectDarkVessel, fetchAll,
  } = useSensorToShooter();

  const [subTab, setSubTab] = useState<"RECS" | "ASSETS" | "BDA" | "DARK">("RECS");
  const [matchResult, setMatchResult] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [scanRegion, setScanRegion] = useState<string>("bab_el_mandeb");

  const handleMatch = async () => {
    if (!selectedTarget) return;
    const result = await matchShooters(selectedTarget);
    setMatchResult(result);
  };

  const handleDarkVessel = async () => {
    await detectDarkVessel(scanRegion);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)] bg-[hsl(220,20%,6%)] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 text-[#ef4444]" />
            <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-foreground uppercase">S2S ENGINE</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pendingCount > 0 && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#eab308]/20 text-[#eab308] animate-pulse">{pendingCount} PENDING</span>
            )}
            <span className="text-[8px] font-mono text-muted-foreground">{idleShooters} IDLE</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="px-2 py-1 border-b border-[hsl(190,60%,10%)] flex items-center gap-0.5 flex-shrink-0">
        {(["RECS", "ASSETS", "BDA", "DARK"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 px-1 py-0.5 rounded text-[7px] font-mono font-bold border transition-colors ${subTab === t ? "border-[#ef4444]/50 bg-[#ef4444]/10 text-[#ef4444]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "DARK" ? "🌊 DARK" : t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
        ) : subTab === "RECS" ? (
          <>
            {/* Match trigger */}
            <div className="px-3 py-2 border-b border-[hsl(190,60%,10%)] space-y-1.5">
              <div className="text-[8px] font-mono text-muted-foreground tracking-wider">F2T2EA WEAPONEERING</div>
              <input
                value={selectedTarget}
                onChange={e => setSelectedTarget(e.target.value)}
                placeholder="Target Track ID (paste UUID)"
                className="w-full bg-muted/30 border border-[hsl(220,15%,18%)] rounded px-2 py-1 text-[8px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#ef4444]/50"
              />
              <button onClick={handleMatch} disabled={matching || !selectedTarget}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[8px] font-mono font-bold border border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 disabled:opacity-30 transition-colors">
                {matching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                {matching ? "MATCHING..." : "MATCH SHOOTER"}
              </button>
            </div>

            {/* AI result summary */}
            {matchResult && (
              <div className="px-3 py-2 border-b border-[hsl(190,60%,10%)] bg-[hsl(220,20%,5%)]">
                {matchResult.error ? (
                  <div className="text-[9px] font-mono text-[#ef4444]">⚠️ {matchResult.error}</div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-[8px] font-mono text-primary">IFF: {matchResult.iff_result?.toUpperCase()}</span>
                      <span className="text-[7px] font-mono text-muted-foreground ml-auto">{matchResult.ontology_matches} ONT MATCHES</span>
                    </div>
                    {matchResult.ai_reasoning && (
                      <div className="text-[8px] font-mono text-foreground/80 bg-[hsl(220,18%,8%)] rounded p-1.5 border border-[hsl(220,15%,12%)]">
                        {matchResult.ai_reasoning}
                      </div>
                    )}
                    <div className="text-[7px] font-mono text-muted-foreground">{matchResult.matches?.length || 0} shooters matched</div>
                  </div>
                )}
              </div>
            )}

            {/* Pending strike recommendations */}
            {recommendations.length === 0 ? (
              <div className="text-center py-6 text-[9px] font-mono text-muted-foreground">No strike recommendations</div>
            ) : (
              recommendations.map(rec => (
                <StrikeRecCard key={rec.id} rec={rec} onCommit={commitStrike} onDiscard={discardStrike} onLocate={onLocate} />
              ))
            )}
          </>
        ) : subTab === "ASSETS" ? (
          <>
            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: "IDLE", value: shooters.filter(s => s.current_tasking === "idle").length, color: "#22c55e" },
                  { label: "TASKED", value: shooters.filter(s => s.current_tasking === "tasked").length, color: "#eab308" },
                  { label: "TOTAL", value: shooters.length, color: "#00d4ff" },
                ].map(s => (
                  <div key={s.label} className="text-center py-1 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                    <div className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[7px] font-mono text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {shooters.map(s => (
              <button key={s.id} onClick={() => onLocate?.(s.lat, s.lng)}
                className="w-full text-left px-3 py-1.5 border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(190,20%,10%)] transition-colors">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">{ASSET_ICONS[s.asset_type] || "⚡"}</span>
                  <span className="text-[9px] font-mono font-bold text-foreground">{s.callsign}</span>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TASKING_COLORS[s.current_tasking] }} />
                  <span className="text-[7px] font-mono ml-auto" style={{ color: TASKING_COLORS[s.current_tasking] }}>{s.current_tasking.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 pl-4">
                  <span className="text-[7px] font-mono text-muted-foreground">{s.asset_type.replace(/_/g, " ")}</span>
                  <span className="text-[7px] font-mono text-muted-foreground">⛽{s.fuel_remaining_pct.toFixed(0)}%</span>
                  <span className="text-[7px] font-mono text-muted-foreground">ROE:{s.roe_zone}</span>
                  <span className="text-[7px] font-mono text-muted-foreground">📡{s.command_link_status}</span>
                </div>
              </button>
            ))}
            {shooters.length === 0 && <div className="text-center py-6 text-[9px] font-mono text-muted-foreground">No shooter assets deployed</div>}
          </>
        ) : subTab === "BDA" ? (
          <>
            <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
              <div className="flex items-center gap-1.5">
                <Target className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-mono font-bold text-foreground tracking-wider">BATTLE DAMAGE ASSESSMENT</span>
              </div>
            </div>
            {actionLogs.length === 0 ? (
              <div className="text-center py-6 text-[9px] font-mono text-muted-foreground">No action logs</div>
            ) : (
              actionLogs.map(log => (
                <div key={log.id} className="px-3 py-1.5 border-b border-[hsl(220,15%,10%)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-foreground">{log.effect.toUpperCase()}</span>
                    <span className="text-[7px] font-mono text-muted-foreground">{new Date(log.created_at).toISOString().slice(11, 19)}</span>
                  </div>
                  <div className="text-[8px] font-mono text-foreground/80 mt-0.5">{log.bda_summary}</div>
                  {log.lat !== 0 && (
                    <button onClick={() => onLocate?.(log.lat, log.lng)} className="text-[7px] font-mono text-primary hover:underline mt-0.5">
                      📍 {log.lat.toFixed(3)}°, {log.lng.toFixed(3)}° → LOCATE
                    </button>
                  )}
                </div>
              ))
            )}
          </>
        ) : (
          /* DARK VESSEL tab */
          <>
            <div className="px-3 py-2 border-b border-[hsl(190,60%,10%)] space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Ship className="h-3 w-3 text-[#06b6d4]" />
                <span className="text-[9px] font-mono font-bold text-[#06b6d4] tracking-wider">DARK VESSEL DETECTION</span>
              </div>
              <div className="text-[8px] font-mono text-muted-foreground">SAR + AIS fusion — detect transponder-off vessels</div>
              <div className="flex items-center gap-1">
                {[
                  { id: "bab_el_mandeb", label: "Bab el-Mandeb" },
                  { id: "hormuz", label: "Hormuz" },
                ].map(r => (
                  <button key={r.id} onClick={() => setScanRegion(r.id)}
                    className={`flex-1 px-1.5 py-1 rounded text-[8px] font-mono border transition-colors ${scanRegion === r.id ? "border-[#06b6d4]/50 bg-[#06b6d4]/10 text-[#06b6d4]" : "border-[hsl(220,15%,18%)] text-muted-foreground"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <button onClick={handleDarkVessel} disabled={matching}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[8px] font-mono font-bold border border-[#06b6d4]/40 bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 disabled:opacity-30 transition-colors">
                {matching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radar className="h-3 w-3" />}
                {matching ? "SCANNING..." : "RUN SAR/AIS FUSION SCAN"}
              </button>
            </div>

            {darkVesselResult && (
              <div className="px-3 py-2 space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: "AIS IN REGION", value: darkVesselResult.ais_vessels_in_region, color: "#22c55e" },
                    { label: "SAR DETECTIONS", value: darkVesselResult.sar_detections, color: "#00d4ff" },
                    { label: "DARK VESSELS", value: darkVesselResult.dark_vessels_detected, color: "#ef4444" },
                    { label: "DRONE DIVERTED", value: darkVesselResult.drone_diverted ? "YES" : "NO", color: darkVesselResult.drone_diverted ? "#22c55e" : "#6b7280" },
                  ].map(s => (
                    <div key={s.label} className="text-center py-1.5 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                      <div className="text-[10px] font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[7px] font-mono text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                {darkVesselResult.drone_diverted && (
                  <div className="bg-[hsl(220,18%,8%)] rounded p-2 border border-[#22c55e]/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px]">🛩️</span>
                      <span className="text-[9px] font-mono font-bold text-[#22c55e]">ISR DRONE DIVERTED</span>
                    </div>
                    <div className="text-[8px] font-mono text-foreground/80">
                      {darkVesselResult.drone_diverted.callsign} ({darkVesselResult.drone_diverted.asset_type})
                    </div>
                    <div className="text-[7px] font-mono text-muted-foreground">
                      Distance: {darkVesselResult.drone_diverted.distance_km}km • ETA: {darkVesselResult.drone_diverted.eta_min}min
                    </div>
                  </div>
                )}

                {darkVesselResult.dark_vessel_tracks?.map((track: any) => (
                  <div key={track.id} className="bg-[hsl(220,18%,8%)] rounded p-2 border border-[#ef4444]/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-[#ef4444]">⚠️ DARK VESSEL</span>
                      <span className="text-[7px] font-mono text-muted-foreground">{track.track_id}</span>
                    </div>
                    <div className="text-[8px] font-mono text-foreground/80 mt-0.5">{track.ai_assessment}</div>
                    <button onClick={() => onLocate?.(track.lat, track.lng)} className="text-[7px] font-mono text-primary hover:underline mt-1">
                      📍 {track.lat.toFixed(4)}°, {track.lng.toFixed(4)}° → LOCATE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// Strike Recommendation Card
// ============================================
function StrikeRecCard({ rec, onCommit, onDiscard, onLocate }: {
  rec: StrikeRecommendation;
  onCommit: (id: string) => void;
  onDiscard: (id: string) => void;
  onLocate?: (lat: number, lng: number) => void;
}) {
  const isPending = rec.decision === "pending";
  const col = DECISION_COLORS[rec.decision] || "#888";
  const target = rec.target_tracks;
  const shooter = rec.shooter_assets;

  return (
    <div className="px-2 py-2 border-b border-[hsl(220,15%,10%)] border-l-2 hover:bg-[hsl(190,20%,10%)] transition-colors" style={{ borderLeftColor: col }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono font-bold" style={{ color: col }}>
            {rec.decision.toUpperCase()}
          </span>
          {isPending && <span className="w-1.5 h-1.5 rounded-full bg-[#eab308] animate-pulse" />}
        </div>
        <span className="text-[7px] font-mono text-muted-foreground">{new Date(rec.created_at).toISOString().slice(11, 19)}</span>
      </div>

      {/* Target info */}
      {target && (
        <div className="flex items-center gap-1 mt-1">
          <Target className="h-2.5 w-2.5 text-[#ef4444]" />
          <span className="text-[8px] font-mono text-[#ef4444]">{target.classification?.toUpperCase().replace("_", " ")}</span>
          <span className="text-[7px] font-mono text-muted-foreground">• {(target.confidence * 100).toFixed(0)}%</span>
          <button onClick={() => onLocate?.(target.lat, target.lng)} className="text-[7px] font-mono text-primary hover:underline ml-auto">LOCATE</button>
        </div>
      )}

      {/* Shooter info */}
      {shooter && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px]">{ASSET_ICONS[shooter.asset_type] || "⚡"}</span>
          <span className="text-[8px] font-mono text-foreground">{shooter.callsign}</span>
          <span className="text-[7px] font-mono text-muted-foreground">⛽{shooter.fuel_remaining_pct?.toFixed(0)}%</span>
        </div>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-muted/30 text-foreground">🎯 {rec.recommended_weapon.toUpperCase()}</span>
        <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-muted/30 text-foreground">Pk:{(rec.probability_of_kill * 100).toFixed(0)}%</span>
        <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-muted/30 text-foreground">TTT:{rec.time_to_target_min}m</span>
        <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-muted/30 text-foreground">{rec.proximity_km}km</span>
      </div>

      {/* ROE */}
      <div className="flex items-center gap-1 mt-1">
        <span className={`text-[7px] font-mono px-1 py-0.5 rounded ${rec.roe_status === "CLEAR" ? "bg-[#22c55e]/20 text-[#22c55e]" : rec.roe_status.includes("DENIED") ? "bg-[#ef4444]/20 text-[#ef4444]" : "bg-[#eab308]/20 text-[#eab308]"}`}>
          ROE: {rec.roe_status}
        </span>
        <span className={`text-[7px] font-mono px-1 py-0.5 rounded ${rec.collateral_risk === "low" ? "bg-[#22c55e]/20 text-[#22c55e]" : rec.collateral_risk === "high" ? "bg-[#ef4444]/20 text-[#ef4444]" : "bg-[#eab308]/20 text-[#eab308]"}`}>
          CDR: {rec.collateral_risk.toUpperCase()}
        </span>
      </div>

      {/* AI reasoning */}
      {rec.ai_reasoning && (
        <div className="text-[7px] font-mono text-foreground/70 mt-1 bg-[hsl(220,18%,8%)] rounded p-1 border border-[hsl(220,15%,12%)]">
          {rec.ai_reasoning}
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-1 mt-1.5">
          <button onClick={() => onCommit(rec.id)}
            className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[8px] font-mono font-bold border border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors">
            <CheckCircle className="h-3 w-3" /> COMMIT
          </button>
          <button onClick={() => onDiscard(rec.id)}
            className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[8px] font-mono font-bold border border-[#ef4444]/50 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors">
            <XCircle className="h-3 w-3" /> DISCARD
          </button>
        </div>
      )}
    </div>
  );
}
