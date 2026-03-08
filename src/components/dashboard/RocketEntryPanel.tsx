import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, Plus, Trash2, Target, AlertTriangle, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Rocket as RocketType } from "@/data/mockData";

interface RocketEntryPanelProps {
  rockets: RocketType[];
}

const KNOWN_SCENARIOS = [
  { label: "Yemen → Saudi Arabia", origin: { lat: 15.4, lng: 44.2 }, target: { lat: 24.5, lng: 39.6 } },
  { label: "Iran → Gulf", origin: { lat: 35.7, lng: 51.4 }, target: { lat: 25.3, lng: 55.3 } },
  { label: "Gaza → Israel", origin: { lat: 31.5, lng: 34.5 }, target: { lat: 32.0, lng: 34.8 } },
  { label: "Lebanon → Israel", origin: { lat: 33.8, lng: 35.8 }, target: { lat: 33.0, lng: 35.2 } },
  { label: "Syria → Israel", origin: { lat: 33.5, lng: 36.3 }, target: { lat: 32.8, lng: 35.5 } },
  { label: "Iraq → Levant", origin: { lat: 33.3, lng: 44.4 }, target: { lat: 32.0, lng: 35.8 } },
  { label: "DPRK → S. Korea", origin: { lat: 39.0, lng: 125.7 }, target: { lat: 35.9, lng: 128.6 } },
  { label: "Custom", origin: { lat: 0, lng: 0 }, target: { lat: 0, lng: 0 } },
];

const ROCKET_TYPES = ["BALLISTIC", "CRUISE", "HYPERSONIC", "SAM", "ICBM"];
const STATUSES = ["launched", "in_flight", "intercepted", "impact"] as const;

export function RocketEntryPanel({ rockets }: RocketEntryPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("BALLISTIC");
  const [scenario, setScenario] = useState(0);
  const [originLat, setOriginLat] = useState("");
  const [originLng, setOriginLng] = useState("");
  const [targetLat, setTargetLat] = useState("");
  const [targetLng, setTargetLng] = useState("");
  const [severity, setSeverity] = useState<"high" | "critical">("critical");
  const [submitting, setSubmitting] = useState(false);

  const isCustom = KNOWN_SCENARIOS[scenario].label === "Custom";
  const activeRockets = rockets.filter(r => r.status === "launched" || r.status === "in_flight");

  const handleScenarioChange = (idx: number) => {
    setScenario(idx);
    if (KNOWN_SCENARIOS[idx].label !== "Custom") {
      setOriginLat(String(KNOWN_SCENARIOS[idx].origin.lat));
      setOriginLng(String(KNOWN_SCENARIOS[idx].origin.lng));
      setTargetLat(String(KNOWN_SCENARIOS[idx].target.lat));
      setTargetLng(String(KNOWN_SCENARIOS[idx].target.lng));
    }
  };

  const handleSubmit = async () => {
    const oLat = parseFloat(isCustom ? originLat : String(KNOWN_SCENARIOS[scenario].origin.lat));
    const oLng = parseFloat(isCustom ? originLng : String(KNOWN_SCENARIOS[scenario].origin.lng));
    const tLat = parseFloat(isCustom ? targetLat : String(KNOWN_SCENARIOS[scenario].target.lat));
    const tLng = parseFloat(isCustom ? targetLng : String(KNOWN_SCENARIOS[scenario].target.lng));

    if (isNaN(oLat) || isNaN(oLng) || isNaN(tLat) || isNaN(tLng)) {
      toast({ variant: "destructive", title: "Invalid coordinates" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("manage-rockets", {
        body: { action: "add", name: name || "Confirmed Launch", type, origin_lat: oLat, origin_lng: oLng, target_lat: tLat, target_lng: tLng, severity },
      });
      if (error) throw error;
      toast({ title: "🚀 Launch recorded", description: `${name || "Confirmed Launch"} — ${KNOWN_SCENARIOS[scenario].label}` });
      setName("");
      setShowForm(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to record launch", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await supabase.functions.invoke("manage-rockets", {
        body: { action: "update_status", id, status },
      });
      toast({ title: `Status updated to ${status}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.functions.invoke("manage-rockets", {
        body: { action: "delete", id },
      });
      toast({ title: "Rocket entry removed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    }
  };

  const handleClearAll = async () => {
    try {
      await supabase.functions.invoke("manage-rockets", {
        body: { action: "clear_all" },
      });
      toast({ title: "All rocket entries cleared" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Clear failed", description: e.message });
    }
  };

  return (
    <div className="rounded-lg border border-red-500/30 bg-card/80 backdrop-blur overflow-hidden" style={{ boxShadow: "0 0 15px rgba(239,68,68,0.1)" }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-red-400" />
          <span className="text-[11px] font-mono font-bold text-red-400 uppercase tracking-wider">Confirmed Launches</span>
          {activeRockets.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {activeRockets.length} ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {rockets.length > 0 && (
            <button onClick={handleClearAll} className="text-[8px] font-mono text-muted-foreground hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10" title="Clear all">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold uppercase transition-all ${showForm ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"}`}>
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showForm ? "Cancel" : "Add Launch"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="p-3 border-b border-border/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] font-mono text-muted-foreground uppercase">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shahab-3" className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[8px] font-mono text-muted-foreground uppercase">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none">
                {ROCKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[8px] font-mono text-muted-foreground uppercase">Scenario</label>
            <select value={scenario} onChange={(e) => handleScenarioChange(parseInt(e.target.value))} className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none">
              {KNOWN_SCENARIOS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
            </select>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-mono text-muted-foreground uppercase">Origin Lat</label>
                <input value={originLat} onChange={(e) => setOriginLat(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none" />
              </div>
              <div>
                <label className="text-[8px] font-mono text-muted-foreground uppercase">Origin Lng</label>
                <input value={originLng} onChange={(e) => setOriginLng(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none" />
              </div>
              <div>
                <label className="text-[8px] font-mono text-muted-foreground uppercase">Target Lat</label>
                <input value={targetLat} onChange={(e) => setTargetLat(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none" />
              </div>
              <div>
                <label className="text-[8px] font-mono text-muted-foreground uppercase">Target Lng</label>
                <input value={targetLng} onChange={(e) => setTargetLng(e.target.value)} className="w-full bg-background/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-[8px] font-mono text-muted-foreground uppercase">Severity</label>
            <div className="flex gap-1">
              {(["high", "critical"] as const).map(s => (
                <button key={s} onClick={() => setSeverity(s)} className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase border transition-all ${severity === s ? (s === "critical" ? "bg-red-500/20 text-red-400 border-red-500/50" : "bg-orange-500/20 text-orange-400 border-orange-500/50") : "border-border/40 text-muted-foreground hover:bg-white/5"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={submitting} className="w-full py-1.5 rounded text-[10px] font-mono font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all disabled:opacity-50">
            {submitting ? "Recording…" : "🚀 Record Confirmed Launch"}
          </button>
        </div>
      )}

      {/* Active rockets list */}
      {rockets.length > 0 ? (
        <div className="divide-y divide-border/20 max-h-60 overflow-y-auto">
          {rockets.map((rkt) => {
            const isActive = rkt.status === "launched" || rkt.status === "in_flight";
            return (
              <div key={rkt.id} className={`px-3 py-2 flex items-center gap-2 ${isActive ? "bg-red-500/5" : "opacity-60"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-red-500 animate-pulse" : rkt.status === "intercepted" ? "bg-green-500" : "bg-orange-500"}`} />
                    <span className="text-[10px] font-mono font-bold text-foreground/90 truncate">{rkt.name}</span>
                    <span className="text-[7px] font-mono text-muted-foreground/60 uppercase px-1 py-0.5 rounded border border-border/20">{rkt.type}</span>
                  </div>
                  <div className="text-[8px] font-mono text-muted-foreground/50 mt-0.5">
                    {rkt.status.toUpperCase()} • {rkt.severity}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isActive && (
                    <>
                      <button onClick={() => handleUpdateStatus(rkt.id, "intercepted")} className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all" title="Mark intercepted">
                        ✓ INT
                      </button>
                      <button onClick={() => handleUpdateStatus(rkt.id, "impact")} className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all" title="Mark impact">
                        💥 IMP
                      </button>
                    </>
                  )}
                  <button onClick={() => handleDelete(rkt.id)} className="text-[7px] font-mono px-1 py-0.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-3 py-4 text-center">
          <AlertTriangle className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1" />
          <p className="text-[9px] font-mono text-muted-foreground/50">No confirmed launches recorded</p>
          <p className="text-[8px] font-mono text-muted-foreground/30">Add confirmed intel from WarLeaks</p>
        </div>
      )}
    </div>
  );
}
