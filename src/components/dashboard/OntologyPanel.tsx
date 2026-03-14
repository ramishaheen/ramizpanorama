import { useState } from "react";
import { Network, RefreshCw, Filter, MapPin, Zap, ArrowRight, Download, Database, Maximize2 } from "lucide-react";
import { useOntology, type OntologyEntity, type OntologyRelationship } from "@/hooks/useOntology";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OntologyManagerModal } from "./OntologyManagerModal";

const ENTITY_ICONS: Record<string, string> = {
  equipment: "🪖",
  facility: "🏛",
  unit: "⚔️",
  person: "👤",
  vehicle: "🚛",
  infrastructure: "🏗",
  weapon_system: "🎯",
};

const AFFILIATION_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  neutral: "#eab308",
  unknown: "#6b7280",
};

const REL_LABELS: Record<string, string> = {
  occupies: "OCCUPIES",
  commands: "COMMANDS",
  observes: "OBSERVES",
  targets: "TARGETS",
  transports: "TRANSPORTS",
  supplies: "SUPPLIES",
  defends: "DEFENDS",
  attacks: "ATTACKS",
};

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

interface OntologyPanelProps {
  onLocate?: (lat: number, lng: number) => void;
}

export const OntologyPanel = ({ onLocate }: OntologyPanelProps) => {
  const { entities, relationships, loading, fetchEntities, runCorrelation } = useOntology();
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<OntologyEntity | null>(null);
  const [correlating, setCorrelating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const entityTypes = ["equipment", "facility", "unit", "person", "vehicle", "infrastructure", "weapon_system"];
  const filtered = filterType ? entities.filter(e => e.entity_type === filterType) : entities;

  const handleCorrelate = async () => {
    setCorrelating(true);
    await runCorrelation();
    await fetchEntities();
    setCorrelating(false);
    toast.success("Correlation complete");
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensor-ingest", {
        body: {
          action: "ingest",
          feed_id: null,
          detections: SEED_DETECTIONS,
        },
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

  const entityRels = selectedEntity
    ? relationships.filter(r => r.source_entity_id === selectedEntity.id || r.target_entity_id === selectedEntity.id)
    : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Network className="h-3 w-3 text-primary" />
            <span className="text-[8px] font-bold tracking-[0.15em] text-foreground uppercase font-mono">ONTOLOGY</span>
            <span className="text-[7px] font-mono text-muted-foreground">({entities.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowManager(true)} className="p-1 rounded hover:bg-primary/10 transition-colors" title="Open Ontology Manager">
              <Maximize2 className="h-3 w-3 text-primary" />
            </button>
            <button onClick={handleCorrelate} disabled={correlating} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50" title="AI Correlate">
              <Zap className={`h-2.5 w-2.5 ${correlating ? "animate-pulse" : ""}`} />
              CORRELATE
            </button>
            <button onClick={() => fetchEntities(filterType || undefined)} className="p-1 rounded hover:bg-primary/10 transition-colors">
              <RefreshCw className={`h-3 w-3 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Type filters */}
      <div className="px-2 py-1.5 border-b border-[hsl(190,60%,10%)] flex flex-wrap gap-1">
        <button onClick={() => { setFilterType(null); setSelectedEntity(null); }}
          className={`px-1.5 py-0.5 rounded text-[7px] font-mono border transition-colors ${!filterType ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground"}`}>
          ALL ({entities.length})
        </button>
        {entityTypes.map(t => {
          const count = entities.filter(e => e.entity_type === t).length;
          if (count === 0) return null;
          return (
            <button key={t} onClick={() => { setFilterType(t); setSelectedEntity(null); }}
              className={`px-1.5 py-0.5 rounded text-[7px] font-mono border transition-colors ${filterType === t ? "border-primary/50 bg-primary/10 text-primary" : "border-[hsl(220,15%,15%)] text-muted-foreground"}`}>
              {ENTITY_ICONS[t]} {count}
            </button>
          );
        })}
      </div>

      {/* Entity detail or list */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {selectedEntity ? (
          <div className="p-3 space-y-2">
            <button onClick={() => setSelectedEntity(null)} className="text-[8px] font-mono text-primary hover:underline">← BACK</button>
            <div className="flex items-center gap-2">
              <span className="text-lg">{ENTITY_ICONS[selectedEntity.entity_type]}</span>
              <div>
                <div className="text-[11px] font-mono font-bold text-foreground">{selectedEntity.name}</div>
                <div className="text-[8px] font-mono text-muted-foreground">{selectedEntity.designation || selectedEntity.entity_type.toUpperCase()}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: "TYPE", value: selectedEntity.entity_type },
                { label: "AFFILIATION", value: selectedEntity.affiliation, color: AFFILIATION_COLORS[selectedEntity.affiliation] },
                { label: "CONFIDENCE", value: `${(selectedEntity.confidence * 100).toFixed(0)}%` },
                { label: "STATUS", value: selectedEntity.status },
              ].map(f => (
                <div key={f.label} className="px-1.5 py-1 rounded bg-[hsl(220,18%,8%)] border border-[hsl(220,15%,12%)]">
                  <div className="text-[7px] font-mono text-muted-foreground">{f.label}</div>
                  <div className="text-[9px] font-mono font-bold" style={{ color: f.color || "inherit" }}>{f.value}</div>
                </div>
              ))}
            </div>
            {selectedEntity.description && (
              <div className="text-[8px] font-mono text-muted-foreground bg-[hsl(220,18%,8%)] rounded p-2 border border-[hsl(220,15%,12%)]">{selectedEntity.description}</div>
            )}
            {Object.keys(selectedEntity.attributes).length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[8px] font-mono text-muted-foreground tracking-wider">ATTRIBUTES</div>
                {Object.entries(selectedEntity.attributes).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-1.5 py-0.5 bg-[hsl(220,18%,8%)] rounded">
                    <span className="text-[8px] font-mono text-muted-foreground">{k}</span>
                    <span className="text-[8px] font-mono text-foreground">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-primary" />
              <button onClick={() => onLocate?.(selectedEntity.lat, selectedEntity.lng)}
                className="text-[8px] font-mono text-primary hover:underline">
                {selectedEntity.lat.toFixed(4)}°, {selectedEntity.lng.toFixed(4)}° → LOCATE
              </button>
            </div>
            {entityRels.length > 0 && (
              <div className="space-y-1">
                <div className="text-[8px] font-mono text-muted-foreground tracking-wider">RELATIONSHIPS</div>
                {entityRels.map(r => {
                  const isSource = r.source_entity_id === selectedEntity.id;
                  const linkedId = isSource ? r.target_entity_id : r.source_entity_id;
                  const linkedEnt = entities.find(e => e.id === linkedId);
                  return (
                    <div key={r.id} className="flex items-center gap-1 px-1.5 py-1 bg-[hsl(220,18%,8%)] rounded border border-[hsl(220,15%,12%)]">
                      <ArrowRight className="h-2.5 w-2.5 text-primary" />
                      <span className="text-[8px] font-mono text-primary">{REL_LABELS[r.relationship_type] || r.relationship_type}</span>
                      <span className="text-[8px] font-mono text-foreground">{linkedEnt?.name || linkedId.slice(0, 8)}</span>
                      <span className="ml-auto text-[7px] font-mono text-muted-foreground">{(r.confidence * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {filtered.length === 0 && !loading && (
              <div className="px-3 py-4 text-center space-y-2">
                <div className="text-[9px] font-mono text-muted-foreground">No entities found</div>
                <button onClick={handleSeed} disabled={seeding}
                  className="flex items-center gap-1 mx-auto px-3 py-1.5 rounded text-[8px] font-mono font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                  <Database className={`h-3 w-3 ${seeding ? "animate-pulse" : ""}`} />
                  {seeding ? "SEEDING..." : "SEED ENTITIES"}
                </button>
                <div className="text-[7px] font-mono text-muted-foreground/60">Populate ontology with sample battlefield entities</div>
              </div>
            )}
            {filtered.map(ent => (
              <button key={ent.id} onClick={() => setSelectedEntity(ent)}
                className="w-full text-left px-3 py-1.5 border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(190,20%,10%)] transition-colors">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">{ENTITY_ICONS[ent.entity_type]}</span>
                  <span className="text-[9px] font-mono text-foreground truncate flex-1">{ent.name}</span>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AFFILIATION_COLORS[ent.affiliation] }} />
                  <span className="text-[7px] font-mono text-muted-foreground">{(ent.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 pl-4">
                  <span className="text-[7px] font-mono text-muted-foreground">{ent.entity_type}</span>
                  <span className="text-[7px] font-mono text-muted-foreground">{ent.lat.toFixed(2)}°, {ent.lng.toFixed(2)}°</span>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
      {showManager && <OntologyManagerModal onClose={() => setShowManager(false)} onLocate={onLocate} />}
    </div>
  );
};
