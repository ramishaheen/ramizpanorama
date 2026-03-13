import { useState, useEffect } from "react";
import { X, Target, Crosshair, Shield, Radar, AlertTriangle, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmSlider } from "./ConfirmSlider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TargetingWorkbenchProps {
  targetId: string;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
  onCommitStrike?: (recommendationId: string) => Promise<any>;
}

const CLASS_ICONS: Record<string, string> = {
  tank: "🪖", truck: "🚛", missile_launcher: "🚀", apc: "🛡",
  radar: "📡", sam_site: "🎯", artillery: "💥", command_post: "🏛",
  supply_depot: "📦", dark_vessel: "🚢",
};

// Reference library silhouettes — static mapping for side-by-side comparison
const REFERENCE_IMAGES: Record<string, { label: string; desc: string }> = {
  tank: { label: "T-72 / T-90 MBT", desc: "Main Battle Tank — 46t, 125mm smoothbore, composite armor" },
  truck: { label: "URAL-4320 / KAMAZ", desc: "Military logistics truck — 6×6 cargo, 10t payload" },
  missile_launcher: { label: "TEL — BM-21 / S-300", desc: "Transporter-Erector-Launcher — mobile ballistic/SAM platform" },
  apc: { label: "BTR-82A / BMP-3", desc: "Armored Personnel Carrier — 30mm autocannon, 8-wheel" },
  radar: { label: "P-18 / 96L6E", desc: "Mobile radar station — early warning / fire control" },
  sam_site: { label: "S-400 / Buk-M3", desc: "Surface-to-Air Missile System — multi-target engagement" },
  artillery: { label: "2S19 / D-30 Howitzer", desc: "Self-propelled / towed artillery — 152mm / 122mm" },
  command_post: { label: "Mobile CP / TOC", desc: "Tactical Operations Center — communications hub" },
  supply_depot: { label: "FOB / Supply Cache", desc: "Forward Operating Base — ammo, fuel, logistics" },
  dark_vessel: { label: "AIS-OFF Vessel", desc: "Transponder-dark vessel — potential sanctions evasion" },
};

const THREAT_LABELS = ["", "MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"];

const WEAPON_COST: Record<string, number> = {
  hellfire: 150000, jdam: 25000, gbu39: 40000, tomahawk: 1800000,
  harpoon: 1500000, excalibur: 68000, harm: 284000, paveway: 20000,
  "30mm_cannon": 50, hydra_70: 2500, he_155mm: 800, gmlrs: 168000,
  atacms: 1500000, pac3: 5900000, sm2: 2100000, aim120: 1100000,
  tow: 93000, sead_package: 500000, naval_gun: 2000,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#dc2626", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

export const TargetingWorkbench = ({ targetId, onClose, onLocate, onCommitStrike }: TargetingWorkbenchProps) => {
  const [target, setTarget] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: tgt }, { data: recData }] = await Promise.all([
        supabase.from("target_tracks").select("*").eq("id", targetId).single(),
        supabase.from("strike_recommendations")
          .select("*, shooter_assets(*)")
          .eq("target_track_id", targetId)
          .order("time_to_target_min", { ascending: true })
          .limit(5),
      ]);
      if (tgt) setTarget(tgt);
      if (recData) setRecs(recData);
      setLoading(false);
      setTimeout(() => setOpen(true), 50);
    };
    fetchData();
  }, [targetId]);

  const handleCommit = async (recId: string) => {
    if (!onCommitStrike) return;
    setCommitting(true);
    await onCommitStrike(recId);
    setCommitting(false);
  };

  const pCol = PRIORITY_COLORS[target?.priority] || "#888";
  const threatLevel = target?.threat_level || 3;
  const ref = REFERENCE_IMAGES[target?.classification] || { label: "UNKNOWN", desc: "Unclassified target" };
  const topPendingRec = recs.find(r => r.decision === "pending");

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] transition-transform duration-300 ease-out"
      style={{ transform: open ? "translateY(0)" : "translateY(100%)" }}
    >
      <div className="bg-[hsl(220,25%,6%)] border-t border-[hsl(190,60%,18%)] shadow-[0_-4px_30px_rgba(0,0,0,0.6)]"
        style={{ maxHeight: "42vh", minHeight: "180px" }}>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(190,60%,12%)]" style={{ background: `linear-gradient(90deg, ${pCol}10, transparent)` }}>
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5" style={{ color: pCol }} />
            <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-foreground uppercase">TARGETING WORKBENCH</span>
            {target && (
              <span className="text-[8px] font-mono text-muted-foreground ml-1">— {target.track_id} • {target.classification?.toUpperCase().replace("_", " ")}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {target && (
              <button onClick={() => onLocate?.(target.lat, target.lng)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                <Eye className="h-3 w-3" /> LOCATE
              </button>
            )}
            <button onClick={() => { setOpen(false); setTimeout(onClose, 300); }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20 transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !target ? (
          <div className="text-center py-12 text-[9px] font-mono text-muted-foreground">Target not found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-[hsl(220,15%,12%)] overflow-y-auto" style={{ maxHeight: "calc(42vh - 44px)" }}>
            {/* LEFT: Side-by-Side — Sensor vs Reference */}
            <div className="p-3 space-y-2">
              <div className="text-[8px] font-mono text-muted-foreground tracking-[0.2em]">SIDE-BY-SIDE</div>
              <div className="grid grid-cols-2 gap-2">
                {/* Sensor crop */}
                <div className="aspect-square rounded border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,4%)] flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center opacity-15">
                    <div className="w-full h-px bg-[#ef4444]" />
                    <div className="absolute w-px h-full bg-[#ef4444]" />
                    <div className="absolute w-8 h-8 rounded-full border border-[#ef4444]" />
                  </div>
                  <span className="text-2xl relative z-10">{CLASS_ICONS[target.classification] || "🎯"}</span>
                  <span className="text-[7px] font-mono font-bold mt-1 relative z-10" style={{ color: pCol }}>
                    SENSOR CROP
                  </span>
                  <span className="text-[6px] font-mono text-muted-foreground relative z-10">{target.source_sensor?.toUpperCase()}</span>
                  {target.image_url && <img src={target.image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
                </div>
                {/* Reference library */}
                <div className="aspect-square rounded border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,4%)] flex flex-col items-center justify-center">
                  <span className="text-2xl opacity-40">{CLASS_ICONS[target.classification] || "🎯"}</span>
                  <span className="text-[7px] font-mono font-bold mt-1 text-[#06b6d4]">REFERENCE</span>
                  <span className="text-[6px] font-mono text-muted-foreground text-center px-1">{ref.label}</span>
                </div>
              </div>
              <div className="text-[7px] font-mono text-foreground/60 leading-relaxed">{ref.desc}</div>
              {/* Quick metadata */}
              <div className="grid grid-cols-3 gap-1">
                {[
                  { l: "CONF", v: `${(target.confidence * 100).toFixed(0)}%`, c: target.confidence > 0.8 ? "#22c55e" : "#eab308" },
                  { l: "THREAT", v: `${threatLevel}/5`, c: threatLevel >= 4 ? "#ef4444" : "#eab308" },
                  { l: "PRI", v: target.priority?.toUpperCase(), c: pCol },
                ].map(m => (
                  <div key={m.l} className="text-center py-1 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                    <div className="text-[6px] font-mono text-muted-foreground">{m.l}</div>
                    <div className="text-[8px] font-mono font-bold" style={{ color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CENTER: Decision Matrix */}
            <div className="p-3 space-y-2">
              <div className="text-[8px] font-mono text-muted-foreground tracking-[0.2em]">DECISION MATRIX — TOP {recs.length} SHOOTERS</div>
              {recs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <Radar className="h-5 w-5 text-muted-foreground mb-2" />
                  <span className="text-[8px] font-mono text-muted-foreground">No recommendations — run F2T2EA from S2S tab</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[hsl(220,15%,12%)]">
                        {["ASSET", "WEAPON", "TTT", "Pk", "CDR", "COST", "ROE"].map(h => (
                          <TableHead key={h} className="text-[7px] font-mono text-muted-foreground px-1.5 py-1 h-auto">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recs.map((r, i) => {
                        const shooter = r.shooter_assets;
                        const cost = r.cost_estimate_usd || WEAPON_COST[r.recommended_weapon] || 0;
                        const costStr = cost >= 1000000 ? `$${(cost / 1000000).toFixed(1)}M` : cost >= 1000 ? `$${(cost / 1000).toFixed(0)}K` : `$${cost}`;
                        return (
                          <TableRow key={r.id} className={`border-[hsl(220,15%,10%)] ${i === 0 ? "bg-[hsl(220,18%,8%)]" : ""}`}>
                            <TableCell className="text-[8px] font-mono font-bold text-foreground px-1.5 py-1">
                              {shooter?.callsign || "—"}
                            </TableCell>
                            <TableCell className="text-[7px] font-mono text-[#f97316] px-1.5 py-1">{r.recommended_weapon?.toUpperCase()}</TableCell>
                            <TableCell className="text-[8px] font-mono text-[#00d4ff] px-1.5 py-1">{r.time_to_target_min}m</TableCell>
                            <TableCell className="text-[8px] font-mono px-1.5 py-1" style={{ color: r.probability_of_kill > 0.7 ? "#22c55e" : "#eab308" }}>
                              {(r.probability_of_kill * 100).toFixed(0)}%
                            </TableCell>
                            <TableCell className={`text-[7px] font-mono px-1.5 py-1 ${r.collateral_risk === "low" ? "text-[#22c55e]" : r.collateral_risk === "high" ? "text-[#ef4444]" : "text-[#eab308]"}`}>
                              {r.collateral_risk?.toUpperCase()}
                            </TableCell>
                            <TableCell className="text-[7px] font-mono text-foreground/70 px-1.5 py-1">{costStr}</TableCell>
                            <TableCell className={`text-[7px] font-mono px-1.5 py-1 ${r.roe_status === "CLEAR" ? "text-[#22c55e]" : r.roe_status?.includes("DENIED") ? "text-[#ef4444]" : "text-[#eab308]"}`}>
                              {r.roe_status}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* AI Reasoning for top rec */}
              {recs[0]?.ai_reasoning && (
                <div className="p-2 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                  <div className="text-[6px] font-mono text-muted-foreground tracking-wider mb-0.5">AI REASONING</div>
                  <div className="text-[7px] font-mono text-foreground/80 leading-relaxed">{recs[0].ai_reasoning}</div>
                </div>
              )}
            </div>

            {/* RIGHT: Target Summary + HITL Slider */}
            <div className="p-3 space-y-2 flex flex-col">
              <div className="text-[8px] font-mono text-muted-foreground tracking-[0.2em]">ENGAGEMENT AUTHORIZATION</div>

              {topPendingRec ? (
                <>
                  <div className="p-2 rounded border border-[#22c55e]/30 bg-[#22c55e]/5">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3 w-3 text-[#22c55e]" />
                      <span className="text-[8px] font-mono font-bold text-[#22c55e]">TOP: {topPendingRec.shooter_assets?.callsign}</span>
                    </div>
                    <div className="text-[7px] font-mono text-foreground/60 mt-0.5">
                      {topPendingRec.recommended_weapon?.toUpperCase()} • Pk:{(topPendingRec.probability_of_kill * 100).toFixed(0)}% • TTT:{topPendingRec.time_to_target_min}m
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    <div className={`text-center text-[7px] font-mono font-bold px-1.5 py-1 rounded border ${topPendingRec.roe_status === "CLEAR" ? "border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e]" : topPendingRec.roe_status?.includes("DENIED") ? "border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]" : "border-[#eab308]/30 bg-[#eab308]/5 text-[#eab308]"}`}>
                      ROE: {topPendingRec.roe_status}
                    </div>
                    <div className={`text-center text-[7px] font-mono font-bold px-1.5 py-1 rounded border ${topPendingRec.collateral_risk === "low" ? "border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e]" : topPendingRec.collateral_risk === "high" ? "border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]" : "border-[#eab308]/30 bg-[#eab308]/5 text-[#eab308]"}`}>
                      CDR: {topPendingRec.collateral_risk?.toUpperCase()}
                    </div>
                  </div>

                  <div className="flex-1" />

                  <div className="space-y-1.5 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-[#fbbf24]" />
                      <span className="text-[7px] font-mono text-[#fbbf24] tracking-[0.1em]">HITL AUTHORIZATION REQUIRED</span>
                    </div>
                    <ConfirmSlider onConfirm={() => handleCommit(topPendingRec.id)} disabled={committing} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 flex-1">
                  <Target className="h-5 w-5 text-muted-foreground mb-2" />
                  <span className="text-[8px] font-mono text-muted-foreground text-center">
                    {recs.length > 0 ? "All recommendations decided" : "No pending recommendations"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
