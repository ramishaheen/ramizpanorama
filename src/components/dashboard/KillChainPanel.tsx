import { useState, useEffect, useCallback } from "react";
import { Crosshair, ArrowRight, CheckCircle, Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface KCTask {
  id: string;
  target_track_id: string;
  phase: string;
  status: string;
  assigned_platform: string;
  recommended_weapon: string;
  notes: string;
  bda_result: string;
  created_at: string;
  target?: { track_id: string; classification: string; priority: string; lat: number; lng: number };
}

const PHASES = ["find", "fix", "track", "target", "engage", "assess"];
const PHASE_COLORS: Record<string, string> = {
  find: "#00d4ff", fix: "#22c55e", track: "#eab308", target: "#f97316", engage: "#ef4444", assess: "#a855f7",
};
const PHASE_ICONS: Record<string, string> = {
  find: "🔍", fix: "📌", track: "👁", target: "🎯", engage: "💥", assess: "📋",
};

export const KillChainPanel = () => {
  const [tasks, setTasks] = useState<KCTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("kill_chain_tasks")
      .select("*, target_tracks(track_id, classification, priority, lat, lng)")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) {
      setTasks(data.map((d: any) => ({ ...d, target: d.target_tracks })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel("kc_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "kill_chain_tasks" }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  const advancePhase = async (task: KCTask) => {
    const currentIdx = PHASES.indexOf(task.phase);
    if (currentIdx >= PHASES.length - 1) return;
    const nextPhase = PHASES[currentIdx + 1] as any;
    // Engage phase requires approved status
    if (nextPhase === "engage" && task.status !== "approved") return;
    await supabase.from("kill_chain_tasks").update({
      phase: nextPhase,
      status: (nextPhase === "engage" ? "in_progress" : "pending") as any,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id);
    fetchTasks();
  };

  const approveTask = async (id: string) => {
    await supabase.from("kill_chain_tasks").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", id);
    fetchTasks();
  };

  const createKCFromTarget = async () => {
    // Get first detected target not yet in kill chain
    const { data: targets } = await supabase.from("target_tracks").select("id").eq("status", "detected").limit(1);
    if (!targets?.length) return;
    await supabase.from("kill_chain_tasks").insert({
      target_track_id: targets[0].id,
      phase: "find",
      status: "in_progress",
    });
    fetchTasks();
  };

  const phaseCounts = PHASES.reduce((acc, p) => {
    acc[p] = tasks.filter(t => t.phase === p).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)] bg-[hsl(220,20%,6%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-[#f97316]" />
            <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-foreground uppercase">KILL CHAIN</span>
          </div>
          <span className="text-[8px] font-mono text-muted-foreground">{tasks.length} TASKS</span>
        </div>
      </div>

      {/* Phase pipeline */}
      <div className="px-2 py-2 border-b border-[hsl(190,60%,10%)] flex items-center gap-0.5 overflow-x-auto">
        {PHASES.map((p, i) => (
          <div key={p} className="flex items-center gap-0.5 flex-shrink-0">
            <div className="flex flex-col items-center px-1.5 py-1 rounded" style={{ backgroundColor: `${PHASE_COLORS[p]}10`, border: `1px solid ${PHASE_COLORS[p]}30` }}>
              <span className="text-[10px]">{PHASE_ICONS[p]}</span>
              <span className="text-[7px] font-mono font-bold" style={{ color: PHASE_COLORS[p] }}>{p.toUpperCase()}</span>
              <span className="text-[8px] font-mono text-foreground font-bold">{phaseCounts[p]}</span>
            </div>
            {i < PHASES.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />}
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
        <button onClick={createKCFromTarget} className="w-full px-2 py-1 rounded text-[8px] font-mono border border-[hsl(190,60%,20%)] text-primary hover:bg-primary/10 transition-colors">
          + INITIATE KILL CHAIN
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-6 text-[9px] font-mono text-muted-foreground">No active kill chains</div>
        ) : (
          tasks.map(task => {
            const col = PHASE_COLORS[task.phase] || "#888";
            return (
              <div key={task.id} className="px-2 py-1.5 border-b border-[hsl(220,15%,10%)] border-l-2 hover:bg-[hsl(190,20%,10%)] transition-colors" style={{ borderLeftColor: col }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold flex items-center gap-1" style={{ color: col }}>
                    {PHASE_ICONS[task.phase]} {task.phase.toUpperCase()}
                  </span>
                  <span className={`text-[7px] font-mono px-1 py-0.5 rounded ${task.status === "approved" ? "bg-[#22c55e]/20 text-[#22c55e]" : task.status === "in_progress" ? "bg-[#eab308]/20 text-[#eab308]" : "bg-muted text-muted-foreground"}`}>
                    {task.status.toUpperCase()}
                  </span>
                </div>
                {task.target && (
                  <div className="text-[7px] font-mono text-muted-foreground mt-0.5">
                    {task.target.track_id} • {task.target.classification} • {task.target.lat.toFixed(2)}°N
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1">
                  {task.phase === "target" && task.status !== "approved" && (
                    <button onClick={() => approveTask(task.id)} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-[#22c55e]/40 text-[#22c55e] hover:bg-[#22c55e]/10">
                      <CheckCircle className="h-2.5 w-2.5" /> APPROVE
                    </button>
                  )}
                  {PHASES.indexOf(task.phase) < PHASES.length - 1 && (
                    <button
                      onClick={() => advancePhase(task)}
                      disabled={PHASES[PHASES.indexOf(task.phase) + 1] === "engage" && task.status !== "approved"}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-30"
                    >
                      <ArrowRight className="h-2.5 w-2.5" /> ADVANCE
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
