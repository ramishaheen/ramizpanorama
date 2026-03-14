import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Network, X, Search, Filter, Zap, RefreshCw, ArrowRight, ArrowLeftRight,
  Database, MapPin, ChevronRight, Plus, RotateCcw, Clock, Shield,
  Eye, Link2, Unlink, AlertTriangle, CheckCircle, Loader2, Brain,
  Activity, Crosshair, Users, FileWarning, Layers
} from "lucide-react";
import { useOntology, type OntologyEntity, type OntologyRelationship } from "@/hooks/useOntology";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ENTITY_ICONS: Record<string, string> = {
  equipment: "🪖", facility: "🏛", unit: "⚔️", person: "👤",
  vehicle: "🚛", infrastructure: "🏗", weapon_system: "🎯",
};

const AFFILIATION_COLORS: Record<string, string> = {
  blue: "#3b82f6", red: "#ef4444", neutral: "#eab308", unknown: "#6b7280",
};

const REL_TYPE_COLORS: Record<string, string> = {
  occupies: "#22c55e", commands: "#3b82f6", observes: "#eab308",
  targets: "#ef4444", transports: "#8b5cf6", supplies: "#f97316",
  defends: "#06b6d4", attacks: "#dc2626",
  impacts: "#f43f5e", caused_by: "#a855f7", assessed_by: "#14b8a6",
  observed_at: "#84cc16", threatens: "#ff6b6b", defends_against: "#22d3ee",
};

const REL_LABELS: Record<string, string> = {
  occupies: "OCCUPIES", commands: "COMMANDS", observes: "OBSERVES",
  targets: "TARGETS", transports: "TRANSPORTS", supplies: "SUPPLIES",
  defends: "DEFENDS", attacks: "ATTACKS",
  impacts: "IMPACTS", caused_by: "CAUSED BY", assessed_by: "ASSESSED BY",
  observed_at: "OBSERVED AT", threatens: "THREATENS", defends_against: "DEFENDS AGAINST",
};

const FUSION_STAGES = [
  "Scanning ontology_entities...",
  "Scanning intel_events...",
  "Scanning geo_alerts...",
  "Scanning target_tracks...",
  "Scanning force_units...",
  "Scanning action_logs...",
  "Running AI correlation engine...",
  "Inserting discovered entities...",
  "Mapping cross-layer relationships...",
];

const SEED_DETECTIONS = [
  { name: "T-72B3 Platoon", entity_type: "equipment", affiliation: "red", lat: 33.312, lng: 44.366, confidence: 0.82, designation: "RU-ARM-4", description: "Armored platoon observed near checkpoint", attributes: { count: 4, camouflage: "partial" } },
  { name: "Natanz Enrichment Facility", entity_type: "facility", affiliation: "red", lat: 33.724, lng: 51.727, confidence: 0.95, designation: "IR-NUC-1", description: "Underground uranium enrichment complex", attributes: { hardened: true, depth_m: 8 } },
  { name: "S-300 Battery", entity_type: "weapon_system", affiliation: "red", lat: 32.651, lng: 51.677, confidence: 0.78, designation: "IR-SAM-3", description: "Mobile SAM battery, 4 TELs detected via SAR", attributes: { variant: "PMU-2", range_km: 200 } },
  { name: "IRGC QF Unit", entity_type: "unit", affiliation: "red", lat: 33.338, lng: 44.393, confidence: 0.65, designation: "IR-QF-7", description: "Quds Force advisory element", attributes: { strength: "company", mobility: "motorized" } },
  { name: "Blue Force FOB", entity_type: "facility", affiliation: "blue", lat: 32.45, lng: 45.12, confidence: 0.92, designation: "US-FOB-12", description: "Forward operating base with ISR assets", attributes: { perimeter: "secured", assets: ["MQ-9", "AH-64"] } },
  { name: "Supply Convoy", entity_type: "vehicle", affiliation: "red", lat: 33.52, lng: 44.78, confidence: 0.71, designation: "IR-LOG-9", description: "6-vehicle logistics convoy moving south", attributes: { vehicle_count: 6, speed_kph: 45 } },
  { name: "Comms Relay Tower", entity_type: "infrastructure", affiliation: "neutral", lat: 33.1, lng: 44.5, confidence: 0.88, designation: "CIV-COM-4", description: "Civilian communications tower, dual-use suspect", attributes: { height_m: 40, freq_bands: ["VHF", "UHF"] } },
  { name: "Field Commander", entity_type: "person", affiliation: "red", lat: 33.34, lng: 44.4, confidence: 0.55, designation: "HVT-014", description: "Assessed senior militia commander", attributes: { tier: "HVT", last_comms: "12h ago" } },
];

interface OntologyManagerModalProps {
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
}

export const OntologyManagerModal = ({ onClose, onLocate }: OntologyManagerModalProps) => {
  const { entities, relationships, loading, fetchEntities, fetchRelationships, runCorrelation, runAIFusion, fusing, fusionResult } = useOntology();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<OntologyEntity | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<OntologyRelationship | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [correlating, setCorrelating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [fusionStage, setFusionStage] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Animate fusion stages
  useEffect(() => {
    if (!fusing) { setFusionStage(0); return; }
    const interval = setInterval(() => {
      setFusionStage(prev => (prev + 1) % FUSION_STAGES.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [fusing]);

  const entityTypes = useMemo(() => {
    const types = ["equipment", "facility", "unit", "person", "vehicle", "infrastructure", "weapon_system"];
    return types.map(t => ({
      type: t,
      icon: ENTITY_ICONS[t],
      count: entities.filter(e => e.entity_type === t).length,
    }));
  }, [entities]);

  const filteredEntities = useMemo(() => {
    let list = selectedType ? entities.filter(e => e.entity_type === selectedType) : entities;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.designation?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
    }
    return list;
  }, [entities, selectedType, searchQuery]);

  const entityRelationships = useMemo(() => {
    if (!selectedEntity) return [];
    return relationships.filter(r => r.source_entity_id === selectedEntity.id || r.target_entity_id === selectedEntity.id);
  }, [selectedEntity, relationships]);

  const getEntityById = useCallback((id: string) => entities.find(e => e.id === id), [entities]);

  const handleCorrelate = async () => {
    setCorrelating(true);
    await runCorrelation();
    await fetchEntities();
    await fetchRelationships();
    setCorrelating(false);
    toast.success("🔗 AI Correlation complete — relationships updated");
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensor-ingest", {
        body: { action: "ingest", feed_id: null, detections: SEED_DETECTIONS },
      });
      if (error) throw error;
      toast.success(`🌐 Seeded ${data?.count || SEED_DETECTIONS.length} ontology entities`);
      await fetchEntities();
    } catch (e: any) {
      toast.error("Seed failed: " + (e.message || "Unknown error"));
    } finally {
      setSeeding(false);
    }
  };

  const handleAIFusion = async () => {
    const result = await runAIFusion();
    if (result) {
      await fetchEntities();
      await fetchRelationships();
      toast.success(`🧠 AI Fusion: ${result.discovered_entities} entities, ${result.discovered_relations} relations discovered`, { duration: 6000 });
    }
  };

  // Count AI-discovered relationships (those with ai_reason in metadata)
  const aiRelationships = useMemo(() => {
    return relationships.filter(r => r.metadata?.ai_reason || r.metadata?.source === "ai_fusion");
  }, [relationships]);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-[0.15em] text-foreground">ONTOLOGY MANAGER</span>
          <span className="text-[9px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted/30 border border-border">
            {entities.length} entities · {relationships.length} relations
          </span>
          {aiRelationships.length > 0 && (
            <span className="text-[9px] font-mono text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/30">
              <Brain className="h-2.5 w-2.5 inline mr-1" />{aiRelationships.length} AI-fused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* AI FUSION button */}
          <button onClick={handleAIFusion} disabled={fusing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-mono font-bold bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50 animate-pulse-subtle">
            {fusing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            AI FUSION
          </button>
          <button onClick={handleCorrelate} disabled={correlating}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono font-bold border border-accent/40 text-accent-foreground hover:bg-accent/10 transition-colors disabled:opacity-50">
            {correlating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            CORRELATE
          </button>
          <button onClick={() => { fetchEntities(); fetchRelationships(); }}
            className="p-1.5 rounded hover:bg-accent/10 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
            <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Fusion progress bar */}
      {fusing && (
        <div className="shrink-0 px-4 py-2 border-b border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[9px] font-mono text-primary font-bold">{FUSION_STAGES[fusionStage]}</span>
          </div>
          <div className="mt-1 h-1 bg-background/50 rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full transition-all duration-1000" style={{ width: `${((fusionStage + 1) / FUSION_STAGES.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Column 1: Entity Types / Relationship Types / Cross-Layer Sources */}
        <div className="w-[240px] shrink-0 flex flex-col border-r border-border bg-card/50 overflow-auto scrollbar-thin">
          <div className="shrink-0 px-3 py-2 border-b border-border">
            <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1.5">ENTITY TYPES</div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                className="w-full pl-7 pr-2 py-1 rounded bg-background border border-border text-[9px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {/* ALL button */}
            <button
              onClick={() => { setSelectedType(null); setSelectedEntity(null); setSelectedRelationship(null); }}
              className={`w-full text-left px-3 py-2 flex items-center justify-between border-b border-border/50 hover:bg-accent/5 transition-colors ${!selectedType ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-mono font-bold text-foreground">All Entities</span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground">{entities.length}</span>
            </button>
            {entityTypes.map(({ type, icon, count }) => (
              <button
                key={type}
                onClick={() => { setSelectedType(type); setSelectedEntity(null); setSelectedRelationship(null); }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between border-b border-border/50 hover:bg-accent/5 transition-colors ${selectedType === type ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{icon}</span>
                  <span className="text-[10px] font-mono text-foreground capitalize">{type.replace("_", " ")}</span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">{count}</span>
              </button>
            ))}

            {/* Relationship Types Section */}
            <div className="px-3 py-2 border-t border-border mt-1">
              <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1.5">RELATIONSHIP TYPES</div>
            </div>
            {Object.entries(REL_LABELS).map(([key, label]) => {
              const count = relationships.filter(r => r.relationship_type === key).length;
              return (
                <div key={key} className="px-3 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REL_TYPE_COLORS[key] || "#6b7280" }} />
                    <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground/60">{count}</span>
                </div>
              );
            })}

            {/* Cross-Layer Sources Section */}
            <div className="px-3 py-2 border-t border-border mt-1">
              <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1.5">
                <Layers className="h-2.5 w-2.5 inline mr-1" />CROSS-LAYER SOURCES
              </div>
            </div>
            {fusionResult?.sourceCounts ? (
              Object.entries(fusionResult.sourceCounts).map(([table, count]) => {
                const icons: Record<string, typeof Activity> = {
                  ontology_entities: Database, intel_events: Activity, geo_alerts: AlertTriangle,
                  target_tracks: Crosshair, force_units: Users, action_logs: FileWarning,
                };
                const Icon = icons[table] || Database;
                return (
                  <div key={table} className="px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-2.5 w-2.5 text-primary/60" />
                      <span className="text-[8px] font-mono text-muted-foreground">{table.replace("_", " ")}</span>
                    </div>
                    <span className={`text-[8px] font-mono ${count > 0 ? "text-primary" : "text-muted-foreground/40"}`}>{count}</span>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-[8px] font-mono text-muted-foreground/50 text-center">
                Run AI FUSION to scan layers
              </div>
            )}

            {entities.length === 0 && !loading && (
              <div className="px-3 py-6 text-center space-y-2">
                <div className="text-[9px] font-mono text-muted-foreground">No entities in ontology</div>
                <button onClick={handleSeed} disabled={seeding}
                  className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded text-[9px] font-mono font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                  <Database className={`h-3 w-3 ${seeding ? "animate-pulse" : ""}`} />
                  {seeding ? "SEEDING..." : "SEED ENTITIES"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Entity List */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          <div className="shrink-0 px-4 py-2.5 border-b border-border bg-card/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedType && <span className="text-lg">{ENTITY_ICONS[selectedType]}</span>}
              <div>
                <div className="text-[11px] font-mono font-bold text-foreground">
                  {selectedType ? selectedType.replace("_", " ").toUpperCase() : "ALL ENTITIES"}
                </div>
                <div className="text-[8px] font-mono text-muted-foreground">{filteredEntities.length} objects</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleSeed} disabled={seeding}
                className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors disabled:opacity-50">
                <Plus className="h-2.5 w-2.5" />
                SEED
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {filteredEntities.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Network className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <div className="text-[10px] font-mono text-muted-foreground mb-1">No entities found</div>
                <div className="text-[8px] font-mono text-muted-foreground/60">Seed entities or run ATR detection to populate the ontology</div>
              </div>
            )}
            {filteredEntities.map(ent => {
              const isSelected = selectedEntity?.id === ent.id;
              const relCount = relationships.filter(r => r.source_entity_id === ent.id || r.target_entity_id === ent.id).length;
              const isAIDiscovered = ent.attributes?.ai_discovered;
              return (
                <button
                  key={ent.id}
                  onClick={() => { setSelectedEntity(ent); setSelectedRelationship(null); }}
                  className={`w-full text-left px-4 py-2.5 border-b border-border/30 hover:bg-accent/5 transition-colors flex items-center gap-3 ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AFFILIATION_COLORS[ent.affiliation] }} />
                    <span className="text-sm">{ENTITY_ICONS[ent.entity_type]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono font-bold text-foreground truncate">{ent.name}</span>
                      {isAIDiscovered && <Brain className="h-2.5 w-2.5 text-primary shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-mono text-muted-foreground">{ent.designation || ent.entity_type}</span>
                      <span className="text-[7px] font-mono text-muted-foreground/60">{ent.lat.toFixed(2)}°, {ent.lng.toFixed(2)}°</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                      backgroundColor: `${AFFILIATION_COLORS[ent.affiliation]}15`,
                      color: AFFILIATION_COLORS[ent.affiliation],
                      border: `1px solid ${AFFILIATION_COLORS[ent.affiliation]}30`,
                    }}>
                      {ent.affiliation.toUpperCase()}
                    </span>
                    {relCount > 0 && (
                      <span className="text-[7px] font-mono text-muted-foreground flex items-center gap-0.5">
                        <Link2 className="h-2 w-2" /> {relCount}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 3: Detail Panel */}
        <div className="w-[320px] shrink-0 flex flex-col bg-card/30 overflow-auto scrollbar-thin">
          {selectedEntity ? (
            <>
              {/* Entity detail header */}
              <div className="shrink-0 px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{ENTITY_ICONS[selectedEntity.entity_type]}</span>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-mono font-bold text-foreground">{selectedEntity.name}</span>
                      {selectedEntity.attributes?.ai_discovered && <Brain className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground">{selectedEntity.designation || selectedEntity.entity_type.toUpperCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onLocate && (
                    <button onClick={() => { onLocate(selectedEntity.lat, selectedEntity.lng); onClose(); }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                      <MapPin className="h-2.5 w-2.5" /> LOCATE
                    </button>
                  )}
                  <button className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors">
                    <Eye className="h-2.5 w-2.5" /> TRACK
                  </button>
                </div>
              </div>

              {/* Properties */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
                <div>
                  <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1.5">PROPERTIES</div>
                  <div className="space-y-1">
                    {[
                      { id: "entity_type", label: "Entity Type", value: selectedEntity.entity_type.replace("_", " "), icon: "📦" },
                      { id: "affiliation", label: "Affiliation", value: selectedEntity.affiliation, icon: "🏴", color: AFFILIATION_COLORS[selectedEntity.affiliation] },
                      { id: "confidence", label: "Confidence", value: `${(selectedEntity.confidence * 100).toFixed(0)}%`, icon: "📊" },
                      { id: "status", label: "Status", value: selectedEntity.status, icon: "⚡" },
                      { id: "lat", label: "Latitude", value: `${selectedEntity.lat.toFixed(5)}°`, icon: "🌐" },
                      { id: "lng", label: "Longitude", value: `${selectedEntity.lng.toFixed(5)}°`, icon: "🌐" },
                      { id: "last_known", label: "Last Known", value: new Date(selectedEntity.last_known_at).toISOString().slice(0, 16).replace("T", " "), icon: "🕐" },
                    ].map(prop => (
                      <div key={prop.id} className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-background/50 border border-border/50">
                        <span className="text-[9px]">{prop.icon}</span>
                        <span className="text-[9px] font-mono text-muted-foreground flex-1">{prop.label}</span>
                        <span className="text-[9px] font-mono font-bold text-foreground" style={{ color: prop.color }}>{prop.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedEntity.description && (
                  <div>
                    <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1">DESCRIPTION</div>
                    <div className="text-[9px] font-mono text-foreground/80 bg-background/50 rounded p-2 border border-border/50">
                      {selectedEntity.description}
                    </div>
                  </div>
                )}

                {Object.keys(selectedEntity.attributes).length > 0 && (
                  <div>
                    <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1">ATTRIBUTES</div>
                    <div className="space-y-1">
                      {Object.entries(selectedEntity.attributes).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between px-2 py-1.5 rounded bg-background/50 border border-border/50">
                          <span className="text-[9px] font-mono text-muted-foreground">{key}</span>
                          <span className="text-[9px] font-mono text-foreground font-bold">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relationships */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground">
                      RELATIONSHIPS ({entityRelationships.length})
                    </div>
                    <button onClick={handleAIFusion} disabled={fusing}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                      {fusing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Brain className="h-2.5 w-2.5" />}
                      DISCOVER
                    </button>
                  </div>
                  {entityRelationships.length === 0 ? (
                    <div className="text-[8px] font-mono text-muted-foreground/60 bg-background/50 rounded p-3 border border-border/50 text-center">
                      <Unlink className="h-4 w-4 mx-auto mb-1 text-muted-foreground/30" />
                      No established relationships.
                      <br />Click DISCOVER to find connections.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {entityRelationships.map(rel => {
                        const isSource = rel.source_entity_id === selectedEntity.id;
                        const linkedId = isSource ? rel.target_entity_id : rel.source_entity_id;
                        const linkedEnt = getEntityById(linkedId);
                        const relColor = REL_TYPE_COLORS[rel.relationship_type] || "#6b7280";
                        const isRelSelected = selectedRelationship?.id === rel.id;
                        const hasAIReason = rel.metadata?.ai_reason;
                        return (
                          <button
                            key={rel.id}
                            onClick={() => setSelectedRelationship(isRelSelected ? null : rel)}
                            className={`w-full text-left px-2 py-2 rounded border transition-colors ${isRelSelected ? "bg-primary/10 border-primary/30" : "bg-background/50 border-border/50 hover:border-primary/20"}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <ArrowLeftRight className="h-2.5 w-2.5" style={{ color: relColor }} />
                              <span className="text-[8px] font-mono font-bold" style={{ color: relColor }}>
                                {isSource ? "" : "← "}{REL_LABELS[rel.relationship_type] || rel.relationship_type.toUpperCase()}{isSource ? " →" : ""}
                              </span>
                              {hasAIReason && <Brain className="h-2 w-2 text-primary" />}
                              <span className="ml-auto text-[7px] font-mono text-muted-foreground">{(rel.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-1.5 pl-4">
                              {linkedEnt && (
                                <>
                                  <span className="text-[9px]">{ENTITY_ICONS[linkedEnt.entity_type]}</span>
                                  <span className="text-[9px] font-mono text-foreground truncate">{linkedEnt.name}</span>
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: AFFILIATION_COLORS[linkedEnt.affiliation] }} />
                                </>
                              )}
                              {!linkedEnt && <span className="text-[8px] font-mono text-muted-foreground">{linkedId.slice(0, 12)}…</span>}
                            </div>
                            {isRelSelected && (
                              <div className="mt-1.5 pt-1.5 border-t border-border/30 space-y-0.5 pl-4">
                                {hasAIReason && (
                                  <div className="text-[7px] font-mono text-primary bg-primary/5 rounded p-1.5 border border-primary/20 mb-1">
                                    <Brain className="h-2 w-2 inline mr-1" />AI: {rel.metadata.ai_reason}
                                  </div>
                                )}
                                <div className="flex justify-between text-[7px] font-mono">
                                  <span className="text-muted-foreground">Valid From</span>
                                  <span className="text-foreground">{new Date(rel.valid_from).toISOString().slice(0, 16).replace("T", " ")}</span>
                                </div>
                                {rel.valid_to && (
                                  <div className="flex justify-between text-[7px] font-mono">
                                    <span className="text-muted-foreground">Valid To</span>
                                    <span className="text-foreground">{new Date(rel.valid_to).toISOString().slice(0, 16).replace("T", " ")}</span>
                                  </div>
                                )}
                                {Object.entries(rel.metadata || {}).filter(([k]) => k !== "ai_reason" && k !== "source").map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-[7px] font-mono">
                                    <span className="text-muted-foreground">{k}</span>
                                    <span className="text-foreground">{String(v)}</span>
                                  </div>
                                ))}
                                {linkedEnt && onLocate && (
                                  <button onClick={(e) => { e.stopPropagation(); onLocate(linkedEnt.lat, linkedEnt.lng); onClose(); }}
                                    className="flex items-center gap-1 mt-1 text-[7px] font-mono text-primary hover:underline">
                                    <MapPin className="h-2 w-2" /> Locate linked entity
                                  </button>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* AI Analysis Panel */}
                {fusionResult?.analysis_summary && (
                  <div>
                    <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1">
                      <Brain className="h-2.5 w-2.5 inline mr-1" />AI ANALYSIS
                    </div>
                    <div className="text-[8px] font-mono text-foreground/80 bg-primary/5 rounded p-2.5 border border-primary/20 leading-relaxed">
                      {fusionResult.analysis_summary}
                    </div>
                  </div>
                )}

                {selectedEntity.source_sensor_id && (
                  <div>
                    <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1">SOURCE</div>
                    <div className="text-[8px] font-mono text-muted-foreground bg-background/50 rounded p-2 border border-border/50">
                      Sensor ID: {selectedEntity.source_sensor_id.slice(0, 12)}…
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-muted-foreground mb-1">RID</div>
                  <div className="text-[8px] font-mono text-muted-foreground/70 bg-background/50 rounded p-2 border border-border/50 break-all">
                    ri.ontology.main.entity.{selectedEntity.id.slice(0, 20)}…
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Shield className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <div className="text-[11px] font-mono font-bold text-muted-foreground mb-1">SELECT AN ENTITY</div>
              <div className="text-[9px] font-mono text-muted-foreground/60 max-w-[200px]">
                Choose an entity from the list to view its properties, attributes, and established relationships.
              </div>
              {entities.length > 0 && (
                <button onClick={handleAIFusion} disabled={fusing}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-mono font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                  {fusing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                  RUN AI FUSION
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
