import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, Filter, ArrowUpDown, Grip, Clock, Target, Zap, Eye, Crosshair, Shield, CheckCircle2, AlertTriangle, ChevronDown, Sparkles, ArrowRight, Loader2, Bot, Play, SkipForward, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KanbanTask {
  id: string;
  target_track_id: string;
  phase: string;
  status: string;
  assigned_platform: string;
  recommended_weapon: string;
  notes: string;
  bda_result: string;
  created_at: string;
  updated_at: string;
  target?: { track_id: string; classification: string; priority: string; lat: number; lng: number; confidence: number; status: string };
}

interface AISuggestion {
  taskId: string;
  fromColumn: string;
  toColumn: string;
  reason: string;
  confidence: number;
  priority: "critical" | "high" | "medium" | "low";
  autoExecute: boolean;
}

interface KillChainKanbanProps {
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
  onOpenOptimizer?: () => void;
}

const COLUMNS = [
  { id: "deliberate", label: "DELIBERATE", phase: "find", color: "#00d4ff", icon: "🔍", description: "Manual planning targets" },
  { id: "dynamic", label: "DYNAMIC", phase: "find", color: "#f97316", icon: "⚡", description: "Auto-detected, high urgency" },
  { id: "pending_pairing", label: "PENDING PAIRING", phase: "fix", color: "#eab308", icon: "🔗", description: "Awaiting shooter match" },
  { id: "paired", label: "PAIRED", phase: "track", color: "#22c55e", icon: "🎯", description: "Shooter assigned" },
  { id: "in_execution", label: "IN EXECUTION", phase: "engage", color: "#ef4444", icon: "💥", description: "Strike in progress" },
  { id: "pending_bda", label: "PENDING BDA", phase: "assess", color: "#a855f7", icon: "📋", description: "Awaiting damage report" },
  { id: "complete", label: "COMPLETE", phase: "assess", color: "#6b7280", icon: "✅", description: "Assessment complete" },
];

function mapTaskToColumn(task: KanbanTask): string {
  if (task.status === "complete" || task.bda_result) return "complete";
  if (task.phase === "assess") return "pending_bda";
  if (task.phase === "engage") return "in_execution";
  if (task.phase === "target" || task.phase === "track") return task.assigned_platform ? "paired" : "pending_pairing";
  if (task.phase === "fix") return "pending_pairing";
  if (task.status === "in_progress" && task.phase === "find") return "dynamic";
  return "deliberate";
}

function mapColumnToPhaseStatus(columnId: string): { phase: string; status: string } {
  switch (columnId) {
    case "deliberate": return { phase: "find", status: "pending" };
    case "dynamic": return { phase: "find", status: "in_progress" };
    case "pending_pairing": return { phase: "fix", status: "in_progress" };
    case "paired": return { phase: "track", status: "in_progress" };
    case "in_execution": return { phase: "engage", status: "in_progress" };
    case "pending_bda": return { phase: "assess", status: "in_progress" };
    case "complete": return { phase: "assess", status: "complete" };
    default: return { phase: "find", status: "pending" };
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

const COLUMN_ORDER = COLUMNS.map(c => c.id);

function getNextColumn(currentCol: string): string | null {
  const idx = COLUMN_ORDER.indexOf(currentCol);
  if (idx < 0 || idx >= COLUMN_ORDER.length - 1) return null;
  return COLUMN_ORDER[idx + 1];
}

// AI suggestion engine — analyzes tasks and recommends optimal transitions
function generateAISuggestions(tasks: KanbanTask[]): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const now = Date.now();

  for (const task of tasks) {
    const currentCol = mapTaskToColumn(task);
    const nextCol = getNextColumn(currentCol);
    if (!nextCol) continue;

    const age = now - new Date(task.updated_at || task.created_at).getTime();
    const ageMin = age / 60000;
    const priority = task.target?.priority || "medium";
    const confidence = task.target?.confidence || 0.5;

    // Deliberate → Dynamic: High-priority targets detected > 2min ago
    if (currentCol === "deliberate" && priority === "critical" && ageMin > 2) {
      suggestions.push({
        taskId: task.id, fromColumn: currentCol, toColumn: "dynamic",
        reason: `Critical target idle ${Math.round(ageMin)}m — escalate to DYNAMIC`,
        confidence: 0.92, priority: "critical", autoExecute: false,
      });
    } else if (currentCol === "deliberate" && (priority === "high" || priority === "critical") && ageMin > 5) {
      suggestions.push({
        taskId: task.id, fromColumn: currentCol, toColumn: "pending_pairing",
        reason: `High-priority target — advance to PAIRING (conf: ${(confidence * 100).toFixed(0)}%)`,
        confidence: 0.85, priority: "high", autoExecute: false,
      });
    }

    // Dynamic → Pending Pairing: auto-advance when confidence > 70%
    if (currentCol === "dynamic" && confidence > 0.7) {
      suggestions.push({
        taskId: task.id, fromColumn: currentCol, toColumn: "pending_pairing",
        reason: `Confidence ${(confidence * 100).toFixed(0)}% — ready for S2S pairing`,
        confidence: confidence, priority: priority as any, autoExecute: priority === "critical",
      });
    }

    // Pending Pairing → Paired: when platform is assigned
    if (currentCol === "pending_pairing" && task.assigned_platform) {
      suggestions.push({
        taskId: task.id, fromColumn: currentCol, toColumn: "paired",
        reason: `Platform ${task.assigned_platform} matched — advance to PAIRED`,
        confidence: 0.95, priority: "high", autoExecute: true,
      });
    }

    // Paired → In Execution: high-confidence critical targets
    if (currentCol === "paired" && priority === "critical" && confidence > 0.85 && task.assigned_platform) {
      suggestions.push({
        taskId: task.id, fromColumn: currentCol, toColumn: "in_execution",
        reason: `⚠ HITL required — ${task.assigned_platform} ready, Pk ${(confidence * 100).toFixed(0)}%`,
        confidence: confidence, priority: "critical", autoExecute: false,
      });
    }

    // In Execution → Pending BDA: tasks in execution > 3 min
    if (currentCol === "in_execution" && ageMin > 3) {
      suggestions.push({
        taskId: task.id, fromColumn: currentCol, toColumn: "pending_bda",
        reason: `Engagement window elapsed — generate BDA via AEGIS`,
        confidence: 0.88, priority: "high", autoExecute: false,
      });
    }

    // Pending BDA → Complete: when BDA result exists
    if (currentCol === "pending_bda" && task.bda_result) {
      suggestions.push({
        taskId: task.id, fromColumn: currentCol, toColumn: "complete",
        reason: `BDA available — mark COMPLETE`,
        confidence: 0.98, priority: "medium", autoExecute: true,
      });
    }
  }

  // Sort by priority then confidence
  const prioOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  suggestions.sort((a, b) => (prioOrder[a.priority] - prioOrder[b.priority]) || (b.confidence - a.confidence));

  return suggestions;
}

export const KillChainKanban = ({ onClose, onLocate, onOpenOptimizer }: KillChainKanbanProps) => {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [aiProcessing, setAiProcessing] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [executingSuggestion, setExecutingSuggestion] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("kill_chain_tasks")
      .select("*, target_tracks(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      const mapped = data.map((t: any) => ({
        ...t,
        target: t.target_tracks ? {
          track_id: t.target_tracks.track_id,
          classification: t.target_tracks.classification,
          priority: t.target_tracks.priority,
          lat: t.target_tracks.lat,
          lng: t.target_tracks.lng,
          confidence: t.target_tracks.confidence,
          status: t.target_tracks.status,
        } : undefined,
      }));
      setTasks(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    const ch = supabase.channel("kanban_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "kill_chain_tasks" }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchTasks]);

  // Regenerate AI suggestions when tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      setSuggestions(generateAISuggestions(tasks));
    }
  }, [tasks]);

  const handleDragStart = (taskId: string) => setDraggedTaskId(taskId);
  const handleDragOver = (e: React.DragEvent, columnId: string) => { e.preventDefault(); setDragOverColumn(columnId); };
  const handleDragLeave = () => setDragOverColumn(null);

  const moveTask = async (taskId: string, columnId: string, source?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentColumn = mapTaskToColumn(task);
    if (currentColumn === columnId) return;

    const { phase, status } = mapColumnToPhaseStatus(columnId);

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, phase, status, updated_at: new Date().toISOString() } : t));

    await supabase.from("kill_chain_tasks").update({ phase: phase as any, status: status as any, updated_at: new Date().toISOString() }).eq("id", taskId);

    // Column-specific AI triggers
    if (columnId === "pending_pairing") {
      setAiProcessing(taskId);
      toast.info("🔗 S2S Engine: Auto-matching shooters...");
      try {
        await supabase.functions.invoke("sensor-to-shooter", {
          body: { action: "match_shooters", target_track_id: task.target_track_id },
        });
        toast.success("✅ Shooter pairing complete");
      } catch { toast.error("S2S matching failed"); }
      setAiProcessing(null);
    } else if (columnId === "pending_bda") {
      toast.info("📋 AEGIS: Generating BDA report...");
    } else if (columnId === "in_execution") {
      toast.warning("⚠ ENGAGEMENT ACTIVE — monitoring strike");
    }

    if (source) toast.success(`${source}: Moved to ${COLUMNS.find(c => c.id === columnId)?.label}`);
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedTaskId) return;
    setDragOverColumn(null);
    await moveTask(draggedTaskId, columnId);
    setDraggedTaskId(null);
  };

  // Execute a single AI suggestion
  const executeSuggestion = async (suggestion: AISuggestion) => {
    setExecutingSuggestion(suggestion.taskId);
    await moveTask(suggestion.taskId, suggestion.toColumn, "AI OPTIMIZER");
    setSuggestions(prev => prev.filter(s => s.taskId !== suggestion.taskId));
    setExecutingSuggestion(null);
  };

  // Execute all auto-executable suggestions
  const runAIOptimizer = async () => {
    setAiRunning(true);
    const autoSuggestions = suggestions.filter(s => s.autoExecute);
    const manualSuggestions = suggestions.filter(s => !s.autoExecute);

    if (autoSuggestions.length === 0 && manualSuggestions.length > 0) {
      toast.info(`🧠 AI OPTIMIZER: ${manualSuggestions.length} suggestions require HITL approval`);
      setAiRunning(false);
      return;
    }

    for (const s of autoSuggestions) {
      setExecutingSuggestion(s.taskId);
      await moveTask(s.taskId, s.toColumn, "AI AUTO");
      await new Promise(r => setTimeout(r, 600)); // stagger for visual effect
    }

    setExecutingSuggestion(null);
    setSuggestions(prev => prev.filter(s => !s.autoExecute));
    toast.success(`🧠 AI OPTIMIZER: ${autoSuggestions.length} actions executed, ${manualSuggestions.length} pending HITL`);
    setAiRunning(false);
  };

  const filteredTasks = searchQuery
    ? tasks.filter(t => {
        const q = searchQuery.toLowerCase();
        return t.target?.track_id?.toLowerCase().includes(q)
          || t.target?.classification?.toLowerCase().includes(q)
          || t.notes?.toLowerCase().includes(q)
          || t.assigned_platform?.toLowerCase().includes(q);
      })
    : tasks;

  const getColumnTasks = (columnId: string) => filteredTasks.filter(t => mapTaskToColumn(t) === columnId);
  const getColumnSuggestions = (columnId: string) => suggestions.filter(s => s.fromColumn === columnId);

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 bg-[hsl(220,20%,6%)]">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold font-mono tracking-[0.2em] text-foreground">KILL CHAIN</span>
          <span className="text-primary text-xs font-bold font-mono">BOARD</span>
        </div>

        <div className="flex-1 max-w-xs relative ml-4">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search targets..."
            className="w-full pl-7 pr-2 py-1.5 rounded text-[10px] font-mono bg-[hsl(220,15%,10%)] border border-border/30 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* AI Suggestions toggle */}
          {suggestions.length > 0 && (
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[9px] font-mono font-bold border transition-colors ${showSuggestions ? "border-[#10b981]/50 text-[#10b981] bg-[#10b981]/10" : "border-border/30 text-muted-foreground hover:text-foreground"}`}
            >
              <Brain className="h-3 w-3" />
              {suggestions.length} SUGGESTIONS
            </button>
          )}

          {/* Run AI Optimizer */}
          <button
            onClick={runAIOptimizer}
            disabled={aiRunning || suggestions.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[9px] font-mono font-bold border border-[#f97316]/40 text-[#f97316] hover:bg-[#f97316]/10 disabled:opacity-30 transition-colors"
          >
            {aiRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            AI EXECUTE
          </button>

          {onOpenOptimizer && (
            <button onClick={onOpenOptimizer} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[9px] font-mono font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-colors">
              <Sparkles className="h-3 w-3" /> AI OPTIMIZE
            </button>
          )}
          <button className="flex items-center gap-1 px-2 py-1.5 rounded text-[9px] font-mono border border-border/30 text-muted-foreground hover:text-foreground transition-colors">
            <Filter className="h-3 w-3" /> Filter
          </button>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div className="flex gap-1 h-full min-w-max">
          {COLUMNS.map((col, colIdx) => {
            const colTasks = getColumnTasks(col.id);
            const colSuggestions = showSuggestions ? getColumnSuggestions(col.id) : [];
            const isOver = dragOverColumn === col.id;
            const nextCol = COLUMNS[colIdx + 1];

            return (
              <div key={col.id} className="flex items-stretch">
                {/* Column */}
                <div
                  className={`flex flex-col w-52 rounded-lg border transition-colors ${isOver ? "border-primary/60 bg-primary/5" : "border-border/20 bg-[hsl(220,15%,7%)]"}`}
                  onDragOver={e => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(col.id)}
                >
                  {/* Column Header */}
                  <div className="px-2.5 py-2 border-b border-border/15 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{col.icon}</span>
                      <span className="text-[8px] font-mono font-bold tracking-wider" style={{ color: col.color }}>{col.label}</span>
                      <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-[hsl(220,15%,12%)] text-muted-foreground">{colTasks.length}</span>
                    </div>
                    <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{col.description}</p>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 scrollbar-thin">
                    {colTasks.map(task => {
                      const taskSuggestion = colSuggestions.find(s => s.taskId === task.id);
                      const isExecuting = executingSuggestion === task.id;

                      return (
                        <div key={task.id} className="relative">
                          <div
                            draggable
                            onDragStart={() => handleDragStart(task.id)}
                            className={`rounded border border-border/25 bg-[hsl(220,15%,9%)] p-2 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all group ${draggedTaskId === task.id ? "opacity-40 scale-95" : ""} ${aiProcessing === task.id || isExecuting ? "animate-pulse border-primary/50" : ""} ${taskSuggestion ? "ring-1 ring-[#10b981]/30" : ""}`}
                          >
                            {/* Card header */}
                            <div className="flex items-start gap-1 mb-1">
                              <Grip className="h-2.5 w-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-mono font-bold text-foreground truncate">
                                    {task.target?.track_id || task.id.slice(0, 8)}
                                  </span>
                                  {task.target?.priority && (
                                    <span className="text-[6px] font-mono px-0.5 py-0.5 rounded" style={{ color: PRIORITY_COLORS[task.target.priority] || "#6b7280", backgroundColor: `${PRIORITY_COLORS[task.target.priority] || "#6b7280"}15`, border: `1px solid ${PRIORITY_COLORS[task.target.priority] || "#6b7280"}30` }}>
                                      {task.target.priority.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[7px] font-mono text-muted-foreground mt-0.5">
                                  {task.target?.classification?.toUpperCase().replace("_", " ") || "UNKNOWN"}
                                </div>
                              </div>
                              <div className="w-2.5 h-2.5 rotate-45 border border-destructive bg-destructive/20 flex-shrink-0" />
                            </div>

                            {/* Details */}
                            {task.target && (
                              <div className="flex items-center gap-1.5 text-[6px] font-mono text-muted-foreground mb-1">
                                <span>{(task.target.confidence * 100).toFixed(0)}% CONF</span>
                                <span>•</span>
                                <span>{task.target.lat.toFixed(2)}°N</span>
                              </div>
                            )}

                            {task.assigned_platform && (
                              <div className="flex items-center gap-1 text-[6px] font-mono text-[#22c55e] mb-1">
                                <Shield className="h-2 w-2" />
                                <span>{task.assigned_platform}</span>
                                {task.recommended_weapon && <span className="text-muted-foreground">• {task.recommended_weapon}</span>}
                              </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-1 border-t border-border/10">
                              <span className="text-[6px] font-mono text-muted-foreground/60">
                                <Clock className="h-2 w-2 inline mr-0.5" />
                                {timeAgo(task.updated_at || task.created_at)}
                              </span>
                              {task.target && onLocate && (
                                <button
                                  onClick={e => { e.stopPropagation(); onLocate(task.target!.lat, task.target!.lng); onClose(); }}
                                  className="text-[6px] font-mono text-primary/60 hover:text-primary transition-colors"
                                >
                                  LOCATE
                                </button>
                              )}
                            </div>
                          </div>

                          {/* AI Suggestion badge on card */}
                          {taskSuggestion && (
                            <button
                              onClick={() => executeSuggestion(taskSuggestion)}
                              disabled={!!executingSuggestion}
                              className="absolute -right-1 top-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-[6px] font-mono font-bold bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] hover:bg-[#10b981]/30 transition-colors z-10 disabled:opacity-50"
                              title={taskSuggestion.reason}
                            >
                              {isExecuting ? <Loader2 className="h-2 w-2 animate-spin" /> : <SkipForward className="h-2 w-2" />}
                              {taskSuggestion.autoExecute ? "AUTO" : "MOVE"}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {colTasks.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/30">
                        <Target className="h-5 w-5 mb-1" />
                        <span className="text-[7px] font-mono">Drop targets here</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Suggestion Arrow between columns */}
                {nextCol && colSuggestions.length > 0 && showSuggestions && (
                  <div className="flex flex-col items-center justify-center w-8 flex-shrink-0 gap-1">
                    {colSuggestions.slice(0, 3).map((s, i) => (
                      <button
                        key={`${s.taskId}-${i}`}
                        onClick={() => executeSuggestion(s)}
                        disabled={!!executingSuggestion}
                        className="group/arrow flex flex-col items-center gap-0.5 p-1 rounded transition-all hover:bg-[#10b981]/10 disabled:opacity-40"
                        title={s.reason}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${s.priority === "critical" ? "border-destructive/50 bg-destructive/10" : s.priority === "high" ? "border-[#f97316]/50 bg-[#f97316]/10" : "border-[#10b981]/50 bg-[#10b981]/10"}`}>
                          <ArrowRight className={`h-2.5 w-2.5 ${s.priority === "critical" ? "text-destructive" : s.priority === "high" ? "text-[#f97316]" : "text-[#10b981]"}`} />
                        </div>
                        <span className={`text-[5px] font-mono font-bold ${s.priority === "critical" ? "text-destructive" : s.priority === "high" ? "text-[#f97316]" : "text-[#10b981]"}`}>
                          {(s.confidence * 100).toFixed(0)}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Empty spacer when no suggestions */}
                {nextCol && (colSuggestions.length === 0 || !showSuggestions) && (
                  <div className="w-1.5 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Suggestions Banner */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="px-4 py-1.5 border-t border-[#10b981]/20 bg-[#10b981]/5">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
            <Bot className="h-3.5 w-3.5 text-[#10b981] flex-shrink-0" />
            <span className="text-[8px] font-mono font-bold text-[#10b981] flex-shrink-0">AI ACTIONS:</span>
            {suggestions.slice(0, 6).map((s, i) => {
              const task = tasks.find(t => t.id === s.taskId);
              return (
                <button
                  key={`${s.taskId}-${i}`}
                  onClick={() => executeSuggestion(s)}
                  disabled={!!executingSuggestion}
                  className="flex items-center gap-1.5 px-2 py-1 rounded border border-border/20 bg-[hsl(220,15%,9%)] hover:border-[#10b981]/40 transition-colors flex-shrink-0 disabled:opacity-40 group/sug"
                >
                  {executingSuggestion === s.taskId ? (
                    <Loader2 className="h-2.5 w-2.5 text-[#10b981] animate-spin" />
                  ) : (
                    <ArrowRight className={`h-2.5 w-2.5 ${s.priority === "critical" ? "text-destructive" : s.priority === "high" ? "text-[#f97316]" : "text-[#10b981]"}`} />
                  )}
                  <span className="text-[7px] font-mono text-foreground/80 max-w-[180px] truncate">
                    {task?.target?.track_id || s.taskId.slice(0, 6)}: {s.reason.slice(0, 50)}
                  </span>
                  <span className={`text-[6px] font-mono font-bold px-1 rounded ${s.autoExecute ? "bg-[#10b981]/20 text-[#10b981]" : "bg-[#f97316]/20 text-[#f97316]"}`}>
                    {s.autoExecute ? "AUTO" : "HITL"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats footer */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border/30 bg-[hsl(220,20%,6%)]">
        {COLUMNS.map(col => (
          <div key={col.id} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
            <span className="text-[7px] font-mono text-muted-foreground">{col.label}</span>
            <span className="text-[7px] font-mono font-bold" style={{ color: col.color }}>{getColumnTasks(col.id).length}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[7px] font-mono text-muted-foreground">
            {tasks.length} TASKS • {suggestions.length} AI SUGGESTIONS
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};
