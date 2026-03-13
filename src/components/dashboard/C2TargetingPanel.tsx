import { useState, useEffect, useCallback } from "react";
import { Target, CheckCircle, XCircle, ChevronDown, Loader2, Crosshair, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TargetDetailModal } from "./TargetDetailModal";
import { useSensorToShooter } from "@/hooks/useSensorToShooter";

interface TargetTrack {
  id: string;
  track_id: string;
  classification: string;
  confidence: number;
  lat: number;
  lng: number;
  detected_at: string;
  source_sensor: string;
  status: string;
  priority: string;
  analyst_verified: boolean;
  analyst_notes: string;
  ai_assessment: string;
}

interface C2TargetingPanelProps {
  onLocate: (lat: number, lng: number) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const CLASS_ICONS: Record<string, string> = {
  tank: "🪖",
  truck: "🚛",
  missile_launcher: "🚀",
  apc: "🛡",
  radar: "📡",
  sam_site: "🎯",
  artillery: "💥",
  command_post: "🏛",
  supply_depot: "📦",
};

export const C2TargetingPanel = ({ onLocate }: C2TargetingPanelProps) => {
  const [targets, setTargets] = useState<TargetTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalTargetId, setModalTargetId] = useState<string | null>(null);
  const { commitStrike } = useSensorToShooter();

  const fetchTargets = useCallback(async () => {
    const { data } = await supabase
      .from("target_tracks")
      .select("*")
      .order("priority", { ascending: true })
      .order("confidence", { ascending: false })
      .limit(50);
    if (data) setTargets(data as unknown as TargetTrack[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTargets();
    const channel = supabase
      .channel("target_tracks_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "target_tracks" }, () => fetchTargets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTargets]);

  const handleVerify = async (id: string, verified: boolean) => {
    await supabase.from("target_tracks").update({
      analyst_verified: verified,
      status: verified ? "confirmed" as const : "detected" as const,
    }).eq("id", id);
    fetchTargets();
  };

  const handlePriority = async (id: string, priority: string) => {
    await supabase.from("target_tracks").update({ priority: priority as any }).eq("id", id);
    fetchTargets();
  };

  const runATR = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("c2-targeting", {
        body: { lat: 33.5 + Math.random() * 4, lng: 36 + Math.random() * 15, source_sensor: "satellite" },
      });
      if (!error) fetchTargets();
    } catch { /* silent */ }
    setScanning(false);
  };

  const activeCount = targets.filter(t => t.status !== "destroyed").length;
  const criticalCount = targets.filter(t => t.priority === "critical").length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)] bg-[hsl(220,20%,6%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-[#ef4444]" />
            <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-foreground uppercase">TARGETING ENGINE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#dc2626]/20 text-[#dc2626]">{criticalCount} CRIT</span>
            <span className="text-[8px] font-mono text-muted-foreground">{activeCount} TGT</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[hsl(190,60%,10%)]">
        <button
          onClick={runATR}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded text-[9px] font-mono font-bold border border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 disabled:opacity-50 transition-colors"
        >
          {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
          {scanning ? "AI SCANNING..." : "RUN ATR SCAN"}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : targets.length === 0 ? (
          <div className="text-center py-6 text-[9px] font-mono text-muted-foreground">No targets tracked</div>
        ) : (
          targets.map(t => {
            const pCol = PRIORITY_COLORS[t.priority] || "#888";
            const expanded = expandedId === t.id;
            return (
              <div key={t.id} className="border-b border-[hsl(220,15%,10%)] border-l-2 hover:bg-[hsl(190,20%,10%)] transition-colors" style={{ borderLeftColor: pCol }}>
                <button onClick={() => setExpandedId(expanded ? null : t.id)} className="w-full text-left px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold flex items-center gap-1" style={{ color: pCol }}>
                      <span className="text-[11px]">{CLASS_ICONS[t.classification] || "🎯"}</span>
                      {t.classification.toUpperCase().replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-1">
                      {t.analyst_verified && <CheckCircle className="h-2.5 w-2.5 text-[#22c55e]" />}
                      <span className="text-[8px] font-mono text-muted-foreground">{(t.confidence * 100).toFixed(0)}%</span>
                      <ChevronDown className={`h-2.5 w-2.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  <div className="text-[7px] font-mono text-muted-foreground mt-0.5">
                    {t.track_id} • {t.lat.toFixed(3)}°N {t.lng.toFixed(3)}°E • {t.source_sensor}
                  </div>
                </button>
                {expanded && (
                  <div className="px-2 pb-2 space-y-1.5">
                    <p className="text-[8px] font-mono text-foreground/80">{t.ai_assessment}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button onClick={() => onLocate(t.lat, t.lng)} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border border-primary/40 text-primary hover:bg-primary/10">
                        <Eye className="h-2.5 w-2.5" /> LOCATE
                      </button>
                      <button onClick={() => setModalTargetId(t.id)} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border border-[#06b6d4]/40 text-[#06b6d4] hover:bg-[#06b6d4]/10">
                        <Target className="h-2.5 w-2.5" /> DEEP DIVE
                      </button>
                      <button onClick={() => handleVerify(t.id, true)} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border border-[#22c55e]/40 text-[#22c55e] hover:bg-[#22c55e]/10">
                        <CheckCircle className="h-2.5 w-2.5" /> VERIFY
                      </button>
                      <button onClick={() => handleVerify(t.id, false)} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10">
                        <XCircle className="h-2.5 w-2.5" /> REJECT
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] font-mono text-muted-foreground">PRIORITY:</span>
                      {["critical", "high", "medium", "low"].map(p => (
                        <button key={p} onClick={() => handlePriority(t.id, p)}
                          className={`px-1.5 py-0.5 rounded text-[7px] font-mono border transition-colors ${t.priority === p ? "border-current bg-current/10" : "border-[hsl(220,15%,18%)] text-muted-foreground hover:text-foreground"}`}
                          style={{ color: t.priority === p ? PRIORITY_COLORS[p] : undefined }}>
                          {p.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Target Detail Modal */}
      {modalTargetId && (
        <TargetDetailModal
          targetId={modalTargetId}
          onClose={() => setModalTargetId(null)}
          onLocate={onLocate}
          onCommitStrike={commitStrike}
        />
      )}
    </div>
  );
};
