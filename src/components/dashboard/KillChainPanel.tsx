import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Crosshair, ArrowRight, CheckCircle, Loader2, Zap, MapPin, ChevronDown, ChevronUp, Scan, FileText, AlertTriangle, Radio, X, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  target?: { track_id: string; classification: string; priority: string; lat: number; lng: number; confidence?: number };
}

interface TargetOption {
  id: string;
  track_id: string;
  classification: string;
  priority: string;
  lat: number;
  lng: number;
  confidence: number;
  status: string;
}

interface EventOption {
  id: string;
  title: string;
  event_type: string;
  severity: string;
  lat: number;
  lng: number;
  confidence: number;
  source: "intel" | "conflict";
  created_at: string;
}

interface FeedEvent {
  id: string;
  ts: number;
  type: string;
  label: string;
  lat: number;
  lng: number;
  severity: string;
  color: string;
  source: string;
  icon: string;
}

const PHASES = ["find", "fix", "track", "target", "engage", "assess"];
const PHASE_COLORS: Record<string, string> = {
  find: "#00d4ff", fix: "#22c55e", track: "#eab308", target: "#f97316", engage: "#ef4444", assess: "#a855f7",
};
const PHASE_ICONS: Record<string, string> = {
  find: "🔍", fix: "📌", track: "👁", target: "🎯", engage: "💥", assess: "📋",
};

interface IntelContext {
  type: "event" | "target";
  title: string;
  event_type: string;
  severity: string;
  lat: number;
  lng: number;
  source: string;
  details?: string;
}

interface KillChainPanelProps {
  onLocate?: (lat: number, lng: number) => void;
  feedEvents?: FeedEvent[];
  onIntelContext?: (ctx: IntelContext) => void;
}

// ===== SITUATION-ADAPTIVE F2T2EA ACTIONS =====
type SituationCategory = "KINETIC" | "MARITIME" | "CYBER" | "NUCLEAR" | "SIGINT" | "CIVIL" | "DEFAULT";

const classifyEvent = (ev: EventOption): SituationCategory => {
  const t = (ev.event_type + " " + ev.title).toLowerCase();
  if (t.match(/strike|explosion|rocket|missile|artillery|bomb|ied|barrage|intercept/)) return "KINETIC";
  if (t.match(/naval|vessel|maritime|interdiction|boarding|ship|tanker|fleet|submarine/)) return "MARITIME";
  if (t.match(/cyber|hack|breach|malware|ransomware|ddos|phishing/)) return "CYBER";
  if (t.match(/nuclear|centrifuge|wmd|chemical|biological|cbrn|radiological|fordow|natanz|dimona/)) return "NUCLEAR";
  if (t.match(/gps|jamming|sigint|ew|electronic|spectrum|radar|signal/)) return "SIGINT";
  if (t.match(/protest|gathering|civil|crowd|riot|demonstration|unrest/)) return "CIVIL";
  return "DEFAULT";
};

const ADAPTIVE_ACTIONS: Record<SituationCategory, Record<string, (ev: EventOption) => string[]>> = {
  KINETIC: {
    find: (ev) => [`Correlate strike OSINT at ${ev.lat.toFixed(3)}°N, ${ev.lng.toFixed(3)}°E`, "Cross-ref IMINT/SIGINT for launch origin", "Task ISR for crater analysis & BDA imagery", `Source: ${ev.source.toUpperCase()} • Confidence ${(ev.confidence * 100).toFixed(0)}%`],
    fix: (ev) => ["Confirm launch site via SAR/EO overlay", `Classify ordnance from event: ${ev.event_type}`, "Establish TEL/artillery geo-lock ≤10m CEP"],
    track: () => ["Track launcher reposition via persistent ISR", "Monitor for reload/rearm indicators", "Maintain track custody — velocity vector ΔT 30s"],
    target: () => ["Match counter-battery platform via S2S", "Calculate Pk & collateral damage estimate (CDE)", "Verify ROE for kinetic response in engagement zone"],
    engage: () => ["⚠ HITL authorization REQUIRED — kinetic strike", "Confirm weapons-free / collateral deconfliction", "Execute counter-fire via assigned platform"],
    assess: () => ["Generate BDA via AEGIS — crater/damage analysis", "Assess functional kill vs re-strike requirement", "Update ontology — log ordnance type & effect achieved"],
  },
  MARITIME: {
    find: (ev) => [`Correlate AIS/EO at ${ev.lat.toFixed(3)}°N, ${ev.lng.toFixed(3)}°E`, "Cross-ref vessel registry & flag state", "Task P-8/MQ-9B for maritime ISR overwatch", `Source: ${ev.source.toUpperCase()} • Confidence ${(ev.confidence * 100).toFixed(0)}%`],
    fix: (ev) => ["Confirm vessel ID via AIS transponder + visual", `Validate threat type: ${ev.event_type}`, "Establish track lock — heading/speed/destination"],
    track: () => ["Maintain AIS track + SAR backup", "Monitor for course deviation or rendezvous", "Coordinate with coast guard / naval assets"],
    target: () => ["Assign nearest surface combatant or MPA", "Calculate intercept course & time-to-target", "Verify UNCLOS / maritime ROE compliance"],
    engage: () => ["⚠ HITL authorization — boarding party / warning shot", "ROE: graduated response protocol", "Deploy VBSS team or execute maritime interdiction"],
    assess: () => ["Confirm vessel status — stopped/boarded/diverted", "Document cargo manifest & crew disposition", "Update maritime COP — log interdiction outcome"],
  },
  CYBER: {
    find: (ev) => [`Correlate IOCs at infrastructure: ${ev.lat.toFixed(3)}°N, ${ev.lng.toFixed(3)}°E`, "Query threat intel feeds — VirusTotal/MISP/OTX", "Identify attack vector & initial access point", `Source: ${ev.source.toUpperCase()} • Confidence ${(ev.confidence * 100).toFixed(0)}%`],
    fix: (ev) => ["Isolate affected network segment", `Classify threat type: ${ev.event_type}`, "Forensic snapshot — preserve volatile artifacts"],
    track: () => ["Monitor lateral movement via EDR/SIEM", "Track C2 beacons & exfiltration channels", "Map kill chain stage (MITRE ATT&CK)"],
    target: () => ["Identify threat actor attribution (APT group)", "Prepare countermeasures — block IOCs/IPs", "Coordinate with CERT / national CSIRT"],
    engage: () => ["⚠ Authorization REQUIRED — active defense", "Execute network containment & C2 sinkhole", "Deploy countermeasures — quarantine & patch"],
    assess: () => ["Generate incident report — TTPs & IOCs", "Confirm threat neutralized — no persistence", "Update threat intel database & share with allies"],
  },
  NUCLEAR: {
    find: (ev) => [`Detect anomaly at ${ev.lat.toFixed(3)}°N, ${ev.lng.toFixed(3)}°E`, "Cross-ref IAEA monitoring & seismic data", "Task dedicated ISR for facility overwatch", `Source: ${ev.source.toUpperCase()} • Confidence ${(ev.confidence * 100).toFixed(0)}%`],
    fix: (ev) => ["Confirm via multi-INT — thermal/gas sampling", `Classify activity: ${ev.event_type}`, "Establish baseline deviation — ΔT from normal ops"],
    track: () => ["Monitor facility 24/7 — cascade status", "Track personnel & vehicle movement patterns", "Detect effluent/exhaust anomalies via EO/IR"],
    target: () => ["Assess CBRN contamination radius", "Model strike scenarios — bunker penetration Pk", "Coordinate IAEA notification & diplomatic channels"],
    engage: () => ["⚠ NATIONAL COMMAND AUTHORITY required", "CBRN protocols — fallout modeling mandatory", "Engage only with authorized strategic assets"],
    assess: () => ["CBRN survey — contamination radius mapping", "Confirm functional destruction of enrichment capability", "Coordinate international inspection & monitoring"],
  },
  SIGINT: {
    find: (ev) => [`Detect emission at ${ev.lat.toFixed(3)}°N, ${ev.lng.toFixed(3)}°E`, "Direction-finding — triangulate source", "Spectrum analysis — identify waveform & protocol", `Source: ${ev.source.toUpperCase()} • Confidence ${(ev.confidence * 100).toFixed(0)}%`],
    fix: (ev) => ["Confirm emitter location via multi-bearing", `Classify signal type: ${ev.event_type}`, "Geo-locate to ≤50m CEP"],
    track: () => ["Monitor emission pattern — on/off cycles", "Track mobile emitter if repositioning", "Correlate with known threat ELINT database"],
    target: () => ["Match EW asset for soft-kill / hard-kill", "Calculate jamming effectiveness radius", "Verify counter-EW ROE & frequency deconfliction"],
    engage: () => ["⚠ EW authorization REQUIRED", "Execute EA — jamming / spoofing / cyber", "Deploy counter-EW via assigned platform"],
    assess: () => ["Confirm signal suppression / emitter neutralized", "Assess impact on own-force navigation/comms", "Update ELINT database & threat library"],
  },
  CIVIL: {
    find: (ev) => [`Monitor gathering at ${ev.lat.toFixed(3)}°N, ${ev.lng.toFixed(3)}°E`, "Cross-ref social media & OSINT feeds", "Assess crowd size & movement pattern", `Source: ${ev.source.toUpperCase()} • Confidence ${(ev.confidence * 100).toFixed(0)}%`],
    fix: (ev) => ["Confirm location via CCTV / aerial ISR", `Classify situation: ${ev.event_type}`, "Identify key leadership & organizers"],
    track: () => ["Monitor crowd trajectory & growth rate", "Track social media escalation indicators", "Coordinate with local law enforcement"],
    target: () => ["Identify de-escalation opportunities", "Position QRF for force protection", "Prepare non-lethal response options"],
    engage: () => ["⚠ MINIMUM FORCE — ROE: non-lethal only", "Deploy crowd management measures", "Coordinate with civil authorities"],
    assess: () => ["Confirm crowd dispersal / situation stable", "Document incidents & use-of-force reports", "Update civil situation awareness map"],
  },
  DEFAULT: {
    find: (ev) => [`Correlate OSINT at ${ev.lat.toFixed(3)}°N, ${ev.lng.toFixed(3)}°E`, "Cross-reference SIGINT / IMINT / HUMINT sources", "Assign ISR asset for persistent surveillance", `Source: ${ev.source.toUpperCase()} • Confidence ${(ev.confidence * 100).toFixed(0)}%`],
    fix: (ev) => ["Confirm position via multi-sensor fusion", `Validate classification from event type: ${ev.event_type}`, "Establish geo-lock with ≤10m CEP"],
    track: () => ["Maintain track custody via assigned ISR", "Monitor for repositioning or dispersal", "Update velocity vector every 30s"],
    target: () => ["Match optimal shooter via S2S engine", "Calculate Pk (probability of kill) & collateral estimate", "Verify ROE compliance for engagement zone"],
    engage: () => ["⚠ HITL authorization REQUIRED", "ROE compliance check — confirm weapons-free", "Execute strike via assigned platform"],
    assess: () => ["Generate BDA via AEGIS AI", "Confirm functional kill or re-strike requirement", "Update ontology & close action-chain"],
  },
};

const getAdaptiveActions = (ev: EventOption): Record<string, (ev: EventOption) => string[]> => {
  const category = classifyEvent(ev);
  return ADAPTIVE_ACTIONS[category];
};

const KillChainEventModal = ({
  event,
  onConfirm,
  onCancel,
  loading,
}: {
  event: EventOption;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) => {
  const sevColor = event.severity === "critical" ? "#ef4444" : event.severity === "high" ? "#f97316" : event.severity === "medium" ? "#eab308" : "#22c55e";
  const typeEmoji = event.event_type.includes("strike") || event.event_type.includes("explosion") ? "💥" :
    event.event_type.includes("missile") ? "🚀" :
    event.event_type.includes("conflict") || event.event_type.includes("military") ? "⚔️" :
    event.event_type.includes("cyber") ? "🔓" : "📡";
  const situationCategory = classifyEvent(event);
  const adaptiveActions = ADAPTIVE_ACTIONS[situationCategory];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 px-3 py-2.5 border-b border-border bg-card">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm">{typeEmoji}</span>
              <span className="text-[10px] font-mono font-bold text-foreground truncate">{event.title}</span>
              <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${sevColor}20`, color: sevColor, border: `1px solid ${sevColor}40` }}>
                {event.severity.toUpperCase()}
              </span>
              <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                {situationCategory}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[7px] font-mono text-muted-foreground">
              <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{event.lat.toFixed(3)}°N, {event.lng.toFixed(3)}°E</span>
              <span>{event.source.toUpperCase()}</span>
              <span>{new Date(event.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
            </div>
          </div>
          <button onClick={onCancel} className="p-0.5 rounded hover:bg-accent transition-colors flex-shrink-0">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* F2T2EA Vertical Stepper */}
        <div className="px-3 py-2 space-y-0">
          <div className="text-[7px] font-mono text-muted-foreground tracking-[0.2em] mb-2 flex items-center gap-1">
            <Shield className="h-2.5 w-2.5" /> F2T2EA PHASE REVIEW
          </div>
          {PHASES.map((phase, i) => {
            const color = PHASE_COLORS[phase];
            const actions = adaptiveActions[phase](event);
            return (
              <div key={phase} className="flex gap-2">
                {/* Timeline line */}
                <div className="flex flex-col items-center w-5 flex-shrink-0">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]" style={{ backgroundColor: `${color}20`, border: `1.5px solid ${color}` }}>
                    {PHASE_ICONS[phase]}
                  </div>
                  {i < PHASES.length - 1 && <div className="w-px flex-1 min-h-[12px]" style={{ backgroundColor: `${color}30` }} />}
                </div>
                {/* Content */}
                <div className="pb-2 flex-1 min-w-0">
                  <span className="text-[8px] font-mono font-bold tracking-[0.15em]" style={{ color }}>{phase.toUpperCase()}</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {actions.map((action, j) => (
                      <li key={j} className="text-[7px] font-mono text-foreground/70 flex items-start gap-1">
                        <span className="text-[5px] mt-[3px] flex-shrink-0" style={{ color }}>●</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-3 py-2 border-t border-border bg-card">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-[8px] font-mono font-bold border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 rounded text-[8px] font-mono font-bold border text-[#f97316] border-[#f97316]/50 hover:bg-[#f97316]/10 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            INITIATE CHAIN
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const KillChainPanel = ({ onLocate, feedEvents, onIntelContext }: KillChainPanelProps) => {
  const [tasks, setTasks] = useState<KCTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [availableTargets, setAvailableTargets] = useState<TargetOption[]>([]);
  const [availableEvents, setAvailableEvents] = useState<EventOption[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [generatingBDA, setGeneratingBDA] = useState<string | null>(null);
  const [initiatingTarget, setInitiatingTarget] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<"targets" | "events">("targets");
  const [selectedEventForModal, setSelectedEventForModal] = useState<EventOption | null>(null);
  const [automatingId, setAutomatingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from("kill_chain_tasks")
      .select("*, target_tracks(track_id, classification, priority, lat, lng, confidence)")
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

  const fetchAvailableTargets = async () => {
    setLoadingTargets(true);
    const { data } = await supabase
      .from("target_tracks")
      .select("id, track_id, classification, priority, lat, lng, confidence, status")
      .in("status", ["detected", "confirmed"])
      .order("confidence", { ascending: false })
      .limit(20);
    setAvailableTargets(data || []);
    setLoadingTargets(false);
  };

  const fetchAvailableEvents = async () => {
    // If unified feed events are passed from the parent, use them directly
    if (feedEvents && feedEvents.length > 0) {
      const mapped: EventOption[] = feedEvents.map((fe) => ({
        id: fe.id,
        title: fe.label,
        event_type: fe.type,
        severity: fe.severity,
        lat: fe.lat,
        lng: fe.lng,
        confidence: fe.severity === "critical" ? 0.95 : fe.severity === "high" ? 0.85 : fe.severity === "medium" ? 0.7 : 0.5,
        source: (fe.source.includes("INTEL") || fe.source.includes("GEO") ? "intel" : "conflict") as "intel" | "conflict",
        created_at: new Date(fe.ts).toISOString(),
      }));
      setAvailableEvents(mapped);
      return;
    }
    // Fallback: fetch from DB
    const [{ data: intelEvents }, { data: geoAlerts }] = await Promise.all([
      supabase.from("intel_events").select("id, title, event_type, severity, lat, lng, confidence, created_at").order("created_at", { ascending: false }).limit(15),
      supabase.from("geo_alerts").select("id, title, type, severity, lat, lng, timestamp, source").order("timestamp", { ascending: false }).limit(15),
    ]);
    const mapped: EventOption[] = [
      ...(intelEvents || []).map((e: any) => ({ id: e.id, title: e.title, event_type: e.event_type, severity: e.severity, lat: e.lat, lng: e.lng, confidence: e.confidence, source: "intel" as const, created_at: e.created_at })),
      ...(geoAlerts || []).map((e: any) => ({ id: e.id, title: e.title, event_type: e.type, severity: e.severity, lat: e.lat, lng: e.lng, confidence: 0.8, source: "conflict" as const, created_at: e.timestamp })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
    setAvailableEvents(mapped);
  };

  // ===== AUTO-PROGRESSION ENGINE =====
  const PHASE_DELAYS: Record<string, number> = { find: 0, fix: 3000, track: 5000, target: 8000 };
  const PHASE_TOASTS: Record<string, string> = {
    find: "🔍 Correlating OSINT sources...",
    fix: "📌 Geo-locking target — S2S matching...",
    track: "👁 Track custody established",
    target: "🎯 Weaponeering complete — HITL APPROVAL REQUIRED",
    engage: "💥 Strike committed",
    assess: "📋 Generating BDA via AEGIS...",
  };

  const runKillChainAutomation = useCallback(async (taskId: string, targetTrackId: string) => {
    setAutomatingId(taskId);
    const autoPhases = ["fix", "track", "target"] as const;
    let cumulativeDelay = 0;

    for (const phase of autoPhases) {
      cumulativeDelay += PHASE_DELAYS[phase];
      await new Promise(resolve => setTimeout(resolve, PHASE_DELAYS[phase]));

      // At FIX phase, try S2S matching for best shooter
      if (phase === "fix") {
        toast.info(PHASE_TOASTS.fix);
        try {
          const { data: s2sData } = await supabase.functions.invoke("sensor-to-shooter", {
            body: { action: "match_shooters", target_track_id: targetTrackId },
          });
          if (s2sData?.recommendations?.[0]) {
            const best = s2sData.recommendations[0];
            await supabase.from("kill_chain_tasks").update({
              assigned_platform: best.shooter?.callsign || best.callsign || "AUTO-MATCHED",
              recommended_weapon: best.recommended_weapon || "AUTO-SELECTED",
              updated_at: new Date().toISOString(),
            }).eq("id", taskId);
          }
        } catch {
          console.warn("S2S auto-match unavailable during FIX phase");
        }
      } else {
        toast.info(PHASE_TOASTS[phase]);
      }

      // Advance the phase in DB
      const status = phase === "target" ? "pending" : "in_progress";
      await supabase.from("kill_chain_tasks").update({
        phase: phase as any,
        status: status as any,
        updated_at: new Date().toISOString(),
      }).eq("id", taskId);

      await fetchTasks();

      // At TARGET, pause for HITL
      if (phase === "target") {
        toast.warning("⚠ HITL APPROVAL REQUIRED — review & approve to proceed to ENGAGE", { duration: 10000 });
        break;
      }
    }
    setAutomatingId(null);
  }, [fetchTasks]);

  const handleOpenPicker = () => {
    setShowPicker(true);
    setPickerTab("targets");
    fetchAvailableTargets();
    fetchAvailableEvents();
  };

  const initiateFromEvent = async (ev: EventOption) => {
    setInitiatingTarget(ev.id);
    try {
      // Create a target track from the event first
      const trackId = `EVT-${Date.now()}`;
      const evTypeLower = (ev.event_type + " " + ev.title).toLowerCase();
      const classification = evTypeLower.match(/strike|explosion|artillery|barrage/) ? "artillery" :
        evTypeLower.match(/missile|rocket/) ? "missile_launcher" :
        evTypeLower.match(/radar|jam|signal/) ? "radar" :
        evTypeLower.match(/sam|air.?def/) ? "sam_site" :
        evTypeLower.match(/tank|armor/) ? "tank" :
        evTypeLower.match(/truck|convoy|transport/) ? "truck" :
        evTypeLower.match(/apc|vehicle/) ? "apc" :
        evTypeLower.match(/supply|depot|logistics/) ? "supply_depot" :
        "command_post"; // default to command_post (valid enum value)
      const sourceSensor = evTypeLower.match(/sigint|signal|gps|jam|spectrum/) ? "sigint" :
        evTypeLower.match(/satellite|imagery|sar|eo/) ? "satellite" : "drone";
      const priority = ev.severity === "critical" ? "critical" : ev.severity === "high" ? "high" : ev.severity === "medium" ? "medium" : "low";

      const { data: newTrack, error: trackErr } = await supabase.from("target_tracks").insert({
        track_id: trackId,
        classification: classification as any,
        confidence: ev.confidence,
        lat: ev.lat,
        lng: ev.lng,
        source_sensor: sourceSensor as any,
        status: "detected" as any,
        priority: priority as any,
        ai_assessment: `Event-sourced: ${ev.title}`,
      }).select("id").single();

      if (trackErr || !newTrack) throw new Error("Failed to create target track from event");

      // Now initiate kill chain with S2S recommendation
      let weapon = "TBD";
      let platform = "TBD";
      try {
        const { data: s2sData } = await supabase.functions.invoke("sensor-to-shooter", {
          body: { action: "recommend", target_id: newTrack.id },
        });
        if (s2sData?.recommendation) {
          weapon = s2sData.recommendation.recommended_weapon || weapon;
          platform = s2sData.recommendation.callsign || platform;
        }
      } catch { /* S2S unavailable */ }

      await supabase.from("kill_chain_tasks").insert({
        target_track_id: newTrack.id,
        phase: "find" as any,
        status: "in_progress" as any,
        recommended_weapon: weapon,
        assigned_platform: platform,
        notes: `Source: ${ev.source.toUpperCase()} EVENT — ${ev.title}`,
      });

      toast.success(`⚡ ACTION-CHAIN FROM EVENT`, {
        description: `${trackId} • ${ev.title.slice(0, 50)} • ${priority.toUpperCase()} priority`,
      });
      setShowPicker(false);
      fetchTasks();

      // Send context to C2 Intel
      onIntelContext?.({
        type: "event",
        title: ev.title,
        event_type: ev.event_type,
        severity: ev.severity,
        lat: ev.lat,
        lng: ev.lng,
        source: ev.source,
        details: `Confidence: ${(ev.confidence * 100).toFixed(0)}%. Action-chain initiated with platform: ${platform}, weapon: ${weapon}.`,
      });

      // Get inserted task ID for automation
      const { data: newTask } = await supabase
        .from("kill_chain_tasks")
        .select("id")
        .eq("target_track_id", newTrack.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (newTask) {
        toast.info(PHASE_TOASTS.find);
        runKillChainAutomation(newTask.id, newTrack.id);
      }
    } catch (err) {
      toast.error("Failed to initiate from event");
    } finally {
      setInitiatingTarget(null);
    }
  };

  const initiateKillChain = async (target: TargetOption) => {
    setInitiatingTarget(target.id);
    try {
      // Get S2S recommendation for weapon/platform
      let weapon = "TBD";
      let platform = "TBD";
      try {
        const { data: s2sData, error: s2sErr } = await supabase.functions.invoke("sensor-to-shooter", {
          body: { action: "recommend", target_id: target.id },
        });
        if (s2sErr) {
          console.error("S2S recommend error:", s2sErr);
          toast.warning("⚠ S2S engine unavailable — using defaults");
        } else if (s2sData?.recommendation) {
          weapon = s2sData.recommendation.recommended_weapon || weapon;
          platform = s2sData.recommendation.callsign || platform;
        }
      } catch (e) {
        console.error("S2S invoke failed:", e);
        toast.warning("⚠ S2S engine unavailable — using defaults");
      }

      await supabase.from("kill_chain_tasks").insert({
        target_track_id: target.id,
        phase: "find" as any,
        status: "in_progress" as any,
        recommended_weapon: weapon,
        assigned_platform: platform,
      });

      toast.success(`⚡ ACTION-CHAIN INITIATED`, {
        description: `${target.track_id} • ${target.classification} • ${target.priority.toUpperCase()} priority\nPlatform: ${platform} • Weapon: ${weapon}`,
      });
      setShowPicker(false);
      fetchTasks();

      // Get inserted task ID and start automation
      const { data: newTask } = await supabase
        .from("kill_chain_tasks")
        .select("id")
        .eq("target_track_id", target.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (newTask) {
        toast.info(PHASE_TOASTS.find);
        runKillChainAutomation(newTask.id, target.id);
      }
    } catch (err) {
      toast.error("Failed to initiate action-chain");
    } finally {
      setInitiatingTarget(null);
    }
  };

  const runATRScan = async () => {
    toast.info("🛰 Running ATR scan...");
    try {
      await supabase.functions.invoke("simulate-intel", { body: { type: "target_detection" } });
      toast.success("ATR scan complete — new detections available");
      setTimeout(() => fetchAvailableTargets(), 1500);
    } catch {
      toast.error("ATR scan failed");
    }
  };

  const advancePhase = async (task: KCTask) => {
    const currentIdx = PHASES.indexOf(task.phase);
    if (currentIdx >= PHASES.length - 1) return;
    const nextPhase = PHASES[currentIdx + 1] as any;
    if (nextPhase === "engage" && task.status !== "approved") return;
    await supabase.from("kill_chain_tasks").update({
      phase: nextPhase,
      status: (nextPhase === "engage" ? "in_progress" : "pending") as any,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id);
    toast.success(`${PHASE_ICONS[nextPhase]} Advanced to ${nextPhase.toUpperCase()}`);
    fetchTasks();

    // Auto-generate BDA when reaching ASSESS phase
    if (nextPhase === "assess") {
      toast.info(PHASE_TOASTS.assess);
      setTimeout(async () => {
        const { data: updatedTask } = await supabase
          .from("kill_chain_tasks")
          .select("*, target_tracks(track_id, classification, priority, lat, lng, confidence)")
          .eq("id", task.id)
          .single();
        if (updatedTask) {
          const mapped = { ...updatedTask, target: updatedTask.target_tracks } as unknown as KCTask;
          generateBDA(mapped);
        }
      }, 2000);
    }
  };

  const approveTask = async (id: string) => {
    await supabase.from("kill_chain_tasks").update({ status: "approved" as any, updated_at: new Date().toISOString() }).eq("id", id);
    toast.success("✅ Engagement APPROVED");
    fetchTasks();
  };

  const generateBDA = async (task: KCTask) => {
    if (!task.target) return;
    setGeneratingBDA(task.id);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/c2-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Generate a concise Battle Damage Assessment (BDA) for target ${task.target.track_id}, classification: ${task.target.classification}, location: ${task.target.lat.toFixed(4)}°N, ${task.target.lng.toFixed(4)}°E. Weapon used: ${task.recommended_weapon || "unknown"}. Platform: ${task.assigned_platform || "unknown"}. Include: damage estimate, functional impact, re-strike recommendation. Keep it under 150 words.`
          }],
        }),
      });
      if (!resp.ok) throw new Error("BDA generation failed");

      let bdaText = "";
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              bdaText += parsed.choices?.[0]?.delta?.content || "";
            } catch { /* skip */ }
          }
        }
      }

      if (bdaText) {
        await supabase.from("kill_chain_tasks").update({
          bda_result: bdaText,
          updated_at: new Date().toISOString(),
        }).eq("id", task.id);
        toast.success("📋 BDA generated");
        fetchTasks();
      }
    } catch {
      toast.error("BDA generation failed");
    } finally {
      setGeneratingBDA(null);
    }
  };

  const phaseCounts = PHASES.reduce((acc, p) => {
    acc[p] = tasks.filter(t => t.phase === p).length;
    return acc;
  }, {} as Record<string, number>);

  const priorityColor = (p: string) => {
    if (p === "critical") return "#ef4444";
    if (p === "high") return "#f97316";
    if (p === "medium") return "#eab308";
    return "#22c55e";
  };

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* F2T2EA Phase Review Modal */}
      {selectedEventForModal && (
        <KillChainEventModal
          event={selectedEventForModal}
          loading={initiatingTarget === selectedEventForModal.id}
          onCancel={() => setSelectedEventForModal(null)}
          onConfirm={async () => {
            await initiateFromEvent(selectedEventForModal);
            setSelectedEventForModal(null);
          }}
        />
      )}
      <div className="px-3 py-2 border-b border-[hsl(190,60%,12%)] bg-[hsl(220,20%,6%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-[#f97316]" />
            <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-foreground uppercase">ACTION-CHAIN</span>
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

      {/* Initiate button */}
      <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
        <button onClick={handleOpenPicker} className="w-full px-2 py-1.5 rounded text-[9px] font-mono font-bold border border-[#f97316]/40 text-[#f97316] hover:bg-[#f97316]/10 transition-colors flex items-center justify-center gap-1.5">
          <Crosshair className="h-3 w-3" /> INITIATE ACTION-CHAIN
        </button>
      </div>

      {/* Target / Event Picker */}
      {showPicker && (
        <div className="border-b border-[hsl(190,60%,10%)] bg-[hsl(220,15%,7%)]">
          <div className="px-3 py-1.5 border-b border-[hsl(190,60%,8%)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setPickerTab("targets")} className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded transition-colors ${pickerTab === "targets" ? "bg-[#f97316]/20 text-[#f97316]" : "text-muted-foreground hover:text-foreground"}`}>
                🎯 TARGETS
              </button>
              <button onClick={() => setPickerTab("events")} className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded transition-colors ${pickerTab === "events" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-muted-foreground hover:text-foreground"}`}>
                <span className="inline-flex items-center gap-0.5"><Radio className="h-2.5 w-2.5 inline" /> EVENTS</span>
              </button>
            </div>
            <button onClick={() => setShowPicker(false)} className="text-[8px] font-mono text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {pickerTab === "targets" && (
            <>
              {loadingTargets ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-3 w-3 animate-spin text-primary" /></div>
              ) : availableTargets.length === 0 ? (
                <div className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <AlertTriangle className="h-3 w-3 text-[#eab308]" />
                    <span className="text-[8px] font-mono text-[#eab308]">NO DETECTED TARGETS</span>
                  </div>
                  <button onClick={runATRScan} className="px-3 py-1 rounded text-[8px] font-mono border border-primary/40 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 mx-auto">
                    <Scan className="h-2.5 w-2.5" /> RUN ATR SCAN
                  </button>
                </div>
              ) : (
                <div className="max-h-[180px] overflow-y-auto scrollbar-thin">
                  {availableTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={() => initiateKillChain(t)}
                      disabled={initiatingTarget === t.id}
                      className="w-full text-left px-3 py-1.5 border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(190,20%,10%)] transition-colors flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor(t.priority) }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-mono font-bold text-foreground">{t.track_id}</span>
                          <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ backgroundColor: `${priorityColor(t.priority)}20`, color: priorityColor(t.priority) }}>
                            {t.priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[7px] font-mono text-muted-foreground">
                          {t.classification} • {t.confidence}% • {t.lat.toFixed(2)}°N {t.lng.toFixed(2)}°E
                        </div>
                      </div>
                      {initiatingTarget === t.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-[#f97316] flex-shrink-0" />
                      ) : (
                        <Zap className="h-3 w-3 text-[#f97316] flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {pickerTab === "events" && (
            <>
              {availableEvents.length === 0 ? (
                <div className="px-3 py-3 text-center">
                  <span className="text-[8px] font-mono text-muted-foreground">NO RECENT EVENTS</span>
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto scrollbar-thin">
                  {availableEvents.map(ev => {
                    const sevColor = ev.severity === "critical" ? "#ef4444" : ev.severity === "high" ? "#f97316" : ev.severity === "medium" ? "#eab308" : "#22c55e";
                    const typeEmoji = ev.event_type.includes("strike") || ev.event_type.includes("explosion") ? "💥" :
                      ev.event_type.includes("missile") ? "🚀" :
                      ev.event_type.includes("conflict") || ev.event_type.includes("military") ? "⚔️" :
                      ev.event_type.includes("cyber") ? "🔓" :
                      ev.event_type.includes("earthquake") ? "🌍" : "📡";
                    const ago = Math.round((Date.now() - new Date(ev.created_at).getTime()) / 60000);
                    const agoLabel = ago < 60 ? `${ago}m` : `${Math.round(ago / 60)}h`;
                    return (
                      <button
                        key={`${ev.source}-${ev.id}`}
                        onClick={() => setSelectedEventForModal(ev)}
                        disabled={initiatingTarget === ev.id || !!selectedEventForModal}
                        className="w-full text-left px-3 py-1.5 border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(190,20%,10%)] transition-colors flex items-center gap-2"
                      >
                        <span className="text-[10px] flex-shrink-0">{typeEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[8px] font-mono font-bold text-foreground truncate">{ev.title}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ backgroundColor: `${sevColor}20`, color: sevColor }}>
                              {ev.severity.toUpperCase()}
                            </span>
                            <span className="text-[6px] font-mono text-muted-foreground">{ev.source.toUpperCase()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground">{ev.lat.toFixed(1)}°N {ev.lng.toFixed(1)}°E</span>
                            <span className="text-[6px] font-mono text-muted-foreground">{agoLabel} ago</span>
                          </div>
                        </div>
                        {initiatingTarget === ev.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-[#00d4ff] flex-shrink-0" />
                        ) : (
                          <Crosshair className="h-3 w-3 text-[#00d4ff] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-6 text-[9px] font-mono text-muted-foreground">No active action-chains</div>
        ) : (
          tasks.map(task => {
            const col = PHASE_COLORS[task.phase] || "#888";
            const isExpanded = expandedTask === task.id;
            return (
              <div key={task.id} className="border-b border-[hsl(220,15%,10%)] border-l-2 hover:bg-[hsl(190,20%,10%)] transition-colors" style={{ borderLeftColor: col }}>
                <div className="px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold flex items-center gap-1" style={{ color: col }}>
                      {PHASE_ICONS[task.phase]} {task.phase.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[7px] font-mono px-1 py-0.5 rounded ${task.status === "approved" ? "bg-[#22c55e]/20 text-[#22c55e]" : task.status === "in_progress" ? "bg-[#eab308]/20 text-[#eab308]" : "bg-muted text-muted-foreground"}`}>
                        {task.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {task.target && (
                    <div className="text-[7px] font-mono text-muted-foreground mt-0.5">
                      {task.target.track_id} • {task.target.classification} • {task.target.lat.toFixed(2)}°N
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {task.target && onLocate && (
                      <button onClick={() => onLocate(task.target!.lat, task.target!.lng)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-primary/40 text-primary hover:bg-primary/10 transition-colors">
                        <MapPin className="h-2.5 w-2.5" /> LOCATE
                      </button>
                    )}
                    <button onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-[hsl(220,15%,25%)] text-muted-foreground hover:text-foreground hover:border-[hsl(220,15%,35%)] transition-colors">
                      {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />} DETAILS
                    </button>
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
                    {task.phase === "assess" && !task.bda_result && (
                      <button
                        onClick={() => generateBDA(task)}
                        disabled={generatingBDA === task.id}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-[#a855f7]/40 text-[#a855f7] hover:bg-[#a855f7]/10 disabled:opacity-50"
                      >
                        {generatingBDA === task.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <FileText className="h-2.5 w-2.5" />} GEN BDA
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-1 border-t border-[hsl(220,15%,12%)] bg-[hsl(220,15%,6%)]">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1.5">
                      <div>
                        <span className="text-[6px] font-mono text-muted-foreground tracking-wider">PLATFORM</span>
                        <div className="text-[8px] font-mono text-foreground">{task.assigned_platform || "—"}</div>
                      </div>
                      <div>
                        <span className="text-[6px] font-mono text-muted-foreground tracking-wider">WEAPON</span>
                        <div className="text-[8px] font-mono text-foreground">{task.recommended_weapon || "—"}</div>
                      </div>
                      <div>
                        <span className="text-[6px] font-mono text-muted-foreground tracking-wider">CREATED</span>
                        <div className="text-[8px] font-mono text-foreground">{new Date(task.created_at).toISOString().slice(0, 16).replace("T", " ")}</div>
                      </div>
                      {task.target?.confidence != null && (
                        <div>
                          <span className="text-[6px] font-mono text-muted-foreground tracking-wider">CONFIDENCE</span>
                          <div className="text-[8px] font-mono text-foreground">{task.target.confidence < 1 ? (task.target.confidence * 100).toFixed(0) : task.target.confidence}%</div>
                        </div>
                      )}
                    </div>
                    {task.notes && (
                      <div>
                        <span className="text-[6px] font-mono text-muted-foreground tracking-wider">NOTES</span>
                        <div className="text-[8px] font-mono text-foreground/80">{task.notes}</div>
                      </div>
                    )}
                    {task.bda_result && (
                      <div className="mt-1 p-1.5 rounded bg-[#a855f7]/5 border border-[#a855f7]/20">
                        <span className="text-[7px] font-mono font-bold text-[#a855f7] tracking-wider">📋 BDA REPORT</span>
                        <div className="text-[8px] font-mono text-foreground/80 mt-0.5 whitespace-pre-wrap leading-relaxed">{task.bda_result}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
