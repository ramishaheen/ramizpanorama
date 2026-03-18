import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Brain, Scan, Mountain, Eye, RefreshCw, X, AlertTriangle,
  ChevronDown, ChevronRight, Shield, Map, Building2, Layers, Trees,
  Crosshair, Activity, Droplets, Factory, Truck, Trash2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GeoAIPanelProps {
  lat: number;
  lng: number;
  zoom: number;
  onClose: () => void;
  onFlyTo?: (lat: number, lng: number) => void;
  mapRef?: React.RefObject<any>;
}

type AnalysisType = "full" | "objects" | "terrain" | "change";

const ANALYSIS_TYPES: { id: AnalysisType; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "full", label: "Full Analysis", icon: Brain, desc: "Complete geospatial intelligence" },
  { id: "objects", label: "Object Detection", icon: Eye, desc: "Identify structures & vehicles" },
  { id: "terrain", label: "Terrain Analysis", icon: Mountain, desc: "Elevation, vegetation, soil" },
  { id: "change", label: "Change Detection", icon: Activity, desc: "Recent changes & anomalies" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#3b82f6", none: "#6b7280",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  vehicle: Truck, structure: Building2, vessel: Droplets, aircraft: Scan,
  equipment: Factory, natural: Trees,
};

const THREAT_MARKER_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  critical: { fill: "#ef4444", stroke: "#fca5a5", glow: "rgba(239,68,68,0.5)" },
  high: { fill: "#f97316", stroke: "#fdba74", glow: "rgba(249,115,22,0.4)" },
  medium: { fill: "#eab308", stroke: "#fde047", glow: "rgba(234,179,8,0.4)" },
  low: { fill: "#3b82f6", stroke: "#93c5fd", glow: "rgba(59,130,246,0.3)" },
  none: { fill: "#6b7280", stroke: "#9ca3af", glow: "rgba(107,114,128,0.2)" },
};

const STRATEGIC_CIRCLE_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  moderate: "#eab308",
  low: "#10b981",
};

function getScatterRadius(zoom: number): number {
  // Meters to scatter objects around center based on zoom
  if (zoom >= 20) return 50;
  if (zoom >= 18) return 100;
  if (zoom >= 16) return 200;
  if (zoom >= 14) return 400;
  return 800;
}

function offsetLatLng(lat: number, lng: number, radiusMeters: number): { lat: number; lng: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radiusMeters;
  const dLat = (dist * Math.cos(angle)) / 111320;
  const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos(lat * (Math.PI / 180)));
  return { lat: lat + dLat, lng: lng + dLng };
}

export const GeoAIPanel = ({ lat, lng, zoom, onClose, mapRef }: GeoAIPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("full");
  const [result, setResult] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    land_use: true, infrastructure: true, objects: true, terrain: true,
    military: true, risk: true, changes: true, actions: true,
  });

  const mapOverlaysRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const clearMapOverlays = useCallback(() => {
    mapOverlaysRef.current.forEach(o => {
      if (o.setMap) o.setMap(null);
      if (o.close) o.close();
    });
    mapOverlaysRef.current = [];
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }
  }, []);

  // Cleanup overlays on unmount
  useEffect(() => {
    return () => clearMapOverlays();
  }, [clearMapOverlays]);

  const renderDetectionsOnMap = useCallback((data: any) => {
    const google = (window as any).google;
    const map = mapRef?.current;
    if (!map || !google?.maps) return;

    clearMapOverlays();

    const a = data?.analysis || {};
    const objects = a.objects_detected || [];
    const strategicValue = a.strategic_value || "low";
    const scatterRadius = getScatterRadius(zoom);

    // Draw scanning area circle
    const circleColor = STRATEGIC_CIRCLE_COLORS[strategicValue] || STRATEGIC_CIRCLE_COLORS.low;
    const circle = new google.maps.Circle({
      center: { lat, lng },
      radius: scatterRadius,
      map,
      fillColor: circleColor,
      fillOpacity: 0.08,
      strokeColor: circleColor,
      strokeOpacity: 0.4,
      strokeWeight: 1.5,
      clickable: false,
    });
    mapOverlaysRef.current.push(circle);

    // Scanning center pulse marker
    const centerDiv = document.createElement("div");
    centerDiv.innerHTML = `
      <div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:${circleColor};opacity:0.3;animation:geoai-pulse 2s ease-in-out infinite;"></div>
        <div style="position:absolute;top:6px;left:6px;width:8px;height:8px;border-radius:50%;background:${circleColor};border:1px solid white;"></div>
      </div>
    `;
    if (google.maps.marker?.AdvancedMarkerElement) {
      const centerMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        map,
        content: centerDiv,
        zIndex: 9999,
      });
      mapOverlaysRef.current.push(centerMarker);
    }

    // Add pulse animation style if not already present
    if (!document.getElementById("geoai-pulse-style")) {
      const style = document.createElement("style");
      style.id = "geoai-pulse-style";
      style.textContent = `
        @keyframes geoai-pulse { 0%,100% { transform:scale(1); opacity:0.3; } 50% { transform:scale(2.5); opacity:0; } }
        @keyframes geoai-threat-pulse { 0%,100% { transform:scale(1); opacity:0.5; } 50% { transform:scale(1.8); opacity:0; } }
      `;
      document.head.appendChild(style);
    }

    // Create shared InfoWindow
    const infoWindow = new google.maps.InfoWindow();
    infoWindowRef.current = infoWindow;

    // Add object detection markers
    objects.forEach((obj: any, i: number) => {
      const threatLevel = obj.threat_level || "none";
      const colors = THREAT_MARKER_COLORS[threatLevel] || THREAT_MARKER_COLORS.none;
      const pos = offsetLatLng(lat, lng, scatterRadius);
      const conf = Math.round((obj.confidence || 0) * 100);
      const isHighThreat = threatLevel === "critical" || threatLevel === "high";

      const markerDiv = document.createElement("div");
      markerDiv.style.cursor = "pointer";
      markerDiv.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          ${isHighThreat ? `<div style="position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;background:${colors.glow};animation:geoai-threat-pulse 1.5s ease-in-out infinite;"></div>` : ""}
          <div style="position:relative;width:20px;height:20px;border-radius:50%;background:${colors.fill};border:2px solid ${colors.stroke};box-shadow:0 0 8px ${colors.glow};display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:8px;font-weight:bold;font-family:monospace;">${i + 1}</span>
          </div>
          <div style="margin-top:2px;background:rgba(0,0,0,0.85);border:1px solid ${colors.fill}40;border-radius:3px;padding:1px 4px;white-space:nowrap;max-width:120px;">
            <span style="color:${colors.fill};font-size:7px;font-family:monospace;font-weight:bold;">${obj.label || "Object"}</span>
            <span style="color:#9ca3af;font-size:6px;font-family:monospace;margin-left:3px;">${conf}%</span>
          </div>
        </div>
      `;

      if (google.maps.marker?.AdvancedMarkerElement) {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map,
          content: markerDiv,
          zIndex: 10000 + i,
        });

        marker.addListener("click", () => {
          const category = obj.category || "unknown";
          const description = obj.description || "";
          const count = obj.estimated_count || 1;
          infoWindow.setContent(`
            <div style="font-family:monospace;font-size:11px;max-width:200px;padding:4px;">
              <div style="font-weight:bold;color:${colors.fill};text-transform:uppercase;margin-bottom:4px;">${obj.label || "Detection"}</div>
              <div style="color:#666;margin-bottom:2px;">Category: <b>${category}</b></div>
              <div style="color:#666;margin-bottom:2px;">Count: <b>${count}</b></div>
              <div style="color:#666;margin-bottom:2px;">Confidence: <b>${conf}%</b></div>
              <div style="color:#666;margin-bottom:2px;">Threat: <b style="color:${colors.fill}">${threatLevel.toUpperCase()}</b></div>
              ${description ? `<div style="color:#888;margin-top:4px;font-size:10px;">${description}</div>` : ""}
            </div>
          `);
          infoWindow.open(map, marker);
        });

        mapOverlaysRef.current.push(marker);
      }
    });

    if (objects.length > 0) {
      toast({
        title: `${objects.length} Objects Plotted`,
        description: `Detection markers added to map around ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
      });
    }
  }, [lat, lng, zoom, mapRef, clearMapOverlays]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("geoai-analyze", {
        body: { lat, lng, zoom, analysisType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast({ title: "GeoAI Analysis Complete", description: `${analysisType} analysis at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°` });

      // Render detections on map for object detection or full analysis
      if (analysisType === "objects" || analysisType === "full") {
        renderDetectionsOnMap(data);
      }
    } catch (e: any) {
      console.error("GeoAI error:", e);
      toast({ title: "GeoAI Error", description: e.message || "Analysis failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [lat, lng, zoom, analysisType, renderDetectionsOnMap]);

  const a = result?.analysis || {};
  const hasOverlays = mapOverlaysRef.current.length > 0;

  const SectionHeader = ({ id, title, icon: Icon, count }: { id: string; title: string; icon: React.ElementType; count?: number }) => (
    <button onClick={() => toggleSection(id)} className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-secondary/20 transition-colors">
      <Icon className="h-3 w-3 text-primary flex-shrink-0" />
      <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider">{title}</span>
      {count !== undefined && <span className="text-[8px] font-mono text-muted-foreground ml-auto mr-1">{count}</span>}
      {expandedSections[id] ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="bg-black/90 backdrop-blur-xl border border-emerald-500/30 rounded-lg w-[340px] max-h-[85vh] flex flex-col"
      style={{ boxShadow: "0 4px 30px rgba(0,0,0,0.6), 0 0 25px rgba(16,185,129,0.08)" }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="h-4 w-4 text-emerald-400" />
            {loading && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">GeoAI</span>
            <span className="text-[7px] font-mono text-muted-foreground/60 block">Geospatial Intelligence</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasOverlays && (
            <button onClick={() => { clearMapOverlays(); toast({ title: "Detections Cleared", description: "Map markers removed" }); }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 transition-colors" title="Clear map detections">
              <Trash2 className="h-3 w-3 text-red-400" />
            </button>
          )}
          <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Coords + Analysis Type */}
      <div className="px-3 py-2 border-b border-border/20 space-y-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-3 w-3 text-emerald-400/70" />
          <span className="text-[8px] font-mono text-foreground/80">{lat.toFixed(5)}°N, {lng.toFixed(5)}°{lng >= 0 ? "E" : "W"}</span>
          <span className="text-[7px] font-mono text-muted-foreground/50 ml-auto">Z{zoom}</span>
        </div>

        <div className="grid grid-cols-2 gap-1">
          {ANALYSIS_TYPES.map(t => (
            <button key={t.id} onClick={() => setAnalysisType(t.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-left transition-all ${
                analysisType === t.id
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "border-border/30 text-muted-foreground hover:border-emerald-500/30 hover:text-foreground"
              }`}>
              <t.icon className="h-3 w-3 flex-shrink-0" />
              <div>
                <div className="text-[8px] font-mono font-bold">{t.label}</div>
                <div className="text-[6px] font-mono opacity-60">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <button onClick={runAnalysis} disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 transition-all">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Scan className="h-3.5 w-3.5" />}
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider">
            {loading ? "Analyzing..." : "Run GeoAI Analysis"}
          </span>
        </button>
      </div>

      {/* Results */}
      {result && (
        <ScrollArea className="flex-1 min-h-0 overflow-auto" style={{ maxHeight: "calc(85vh - 180px)" }}>
          <div className="px-3 py-2 space-y-1">
            {/* Summary */}
            {a.summary && (
              <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20 mb-2">
                <span className="text-[8px] font-mono text-emerald-400/90 leading-relaxed">{a.summary}</span>
              </div>
            )}

            {/* Strategic Value Badge */}
            {a.strategic_value && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[7px] font-mono text-muted-foreground uppercase">Strategic Value:</span>
                <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded ${
                  a.strategic_value === "critical" ? "bg-red-500/20 text-red-400" :
                  a.strategic_value === "high" ? "bg-orange-500/20 text-orange-400" :
                  a.strategic_value === "moderate" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-emerald-500/20 text-emerald-400"
                } uppercase`}>{a.strategic_value}</span>
              </div>
            )}

            {/* Land Use */}
            {a.land_use && (
              <>
                <SectionHeader id="land_use" title="Land Use Classification" icon={Map} />
                {expandedSections.land_use && (
                  <div className="pl-5 space-y-1 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-mono text-muted-foreground">Primary:</span>
                      <span className="text-[8px] font-mono font-bold text-foreground/90 uppercase">{a.land_use.primary}</span>
                    </div>
                    {a.land_use.urbanization_level && (
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] font-mono text-muted-foreground">Urbanization:</span>
                        <span className={`text-[8px] font-mono font-bold uppercase ${
                          a.land_use.urbanization_level === "high" ? "text-orange-400" : a.land_use.urbanization_level === "medium" ? "text-yellow-400" : "text-emerald-400"
                        }`}>{a.land_use.urbanization_level}</span>
                      </div>
                    )}
                    {a.land_use.breakdown?.map((b: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-secondary/30 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${b.percentage}%` }} />
                        </div>
                        <span className="text-[7px] font-mono text-foreground/80">{b.type}</span>
                        <span className="text-[7px] font-mono text-muted-foreground ml-auto">{b.percentage}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Infrastructure */}
            {a.infrastructure && (
              <>
                <SectionHeader id="infrastructure" title="Infrastructure" icon={Building2} count={a.infrastructure.critical?.length} />
                {expandedSections.infrastructure && (
                  <div className="pl-5 space-y-1 pb-2">
                    {a.infrastructure.roads && (
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] font-mono text-muted-foreground">Roads:</span>
                        <span className="text-[8px] font-mono text-foreground/80">{a.infrastructure.roads.density} density</span>
                        {a.infrastructure.roads.types?.map((t: string) => (
                          <span key={t} className="text-[6px] font-mono px-1 py-0.5 rounded bg-secondary/30 text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                    {a.infrastructure.buildings && (
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] font-mono text-muted-foreground">Buildings:</span>
                        <span className="text-[8px] font-mono text-foreground/80">{a.infrastructure.buildings.density} density</span>
                      </div>
                    )}
                    {a.infrastructure.critical?.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-orange-500/5 border border-orange-500/20">
                        <AlertTriangle className="h-2.5 w-2.5 text-orange-400 flex-shrink-0" />
                        <div>
                          <span className="text-[7px] font-mono font-bold text-orange-400 uppercase">{c.type}</span>
                          <span className="text-[7px] font-mono text-muted-foreground/80 block">{c.description}</span>
                        </div>
                        <span className="text-[7px] font-mono text-muted-foreground ml-auto">{Math.round(c.confidence * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Terrain */}
            {a.terrain && (
              <>
                <SectionHeader id="terrain" title="Terrain Analysis" icon={Mountain} />
                {expandedSections.terrain && (
                  <div className="pl-5 space-y-1 pb-2">
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        ["Type", a.terrain.type],
                        ["Elevation", a.terrain.elevation_estimate],
                        ["Vegetation", a.terrain.vegetation],
                        ["Trafficability", a.terrain.trafficability],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k as string} className="px-1.5 py-1 rounded bg-secondary/10 border border-border/20">
                          <span className="text-[6px] font-mono text-muted-foreground block">{k}</span>
                          <span className="text-[8px] font-mono text-foreground/80 font-bold uppercase">{v}</span>
                        </div>
                      ))}
                    </div>
                    {a.terrain.water_features?.map((w: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Droplets className="h-2.5 w-2.5 text-blue-400" />
                        <span className="text-[7px] font-mono text-blue-400">{w.type}</span>
                        <span className="text-[7px] font-mono text-muted-foreground/70">{w.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Objects Detected */}
            {a.objects_detected?.length > 0 && (
              <>
                <SectionHeader id="objects" title="Objects Detected" icon={Eye} count={a.objects_detected.length} />
                {expandedSections.objects && (
                  <div className="pl-5 space-y-1 pb-2">
                    {a.objects_detected.map((obj: any, i: number) => {
                      const ObjIcon = CATEGORY_ICONS[obj.category] || Scan;
                      const color = SEVERITY_COLORS[obj.threat_level] || SEVERITY_COLORS.none;
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-secondary/10 border border-border/20">
                          <ObjIcon className="h-3 w-3 flex-shrink-0" style={{ color }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-mono font-bold text-foreground/90">{obj.label}</span>
                              {obj.estimated_count > 1 && <span className="text-[7px] font-mono text-muted-foreground">×{obj.estimated_count}</span>}
                            </div>
                            <span className="text-[6px] font-mono text-muted-foreground/70 block truncate">{obj.description}</span>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className="text-[7px] font-mono" style={{ color }}>{Math.round(obj.confidence * 100)}%</span>
                            {obj.threat_level !== "none" && (
                              <span className="text-[6px] font-mono px-1 rounded" style={{ color, background: `${color}15` }}>{obj.threat_level}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Change Indicators */}
            {a.change_indicators?.length > 0 && (
              <>
                <SectionHeader id="changes" title="Change Detection" icon={Activity} count={a.change_indicators.length} />
                {expandedSections.changes && (
                  <div className="pl-5 space-y-1 pb-2">
                    {a.change_indicators.map((c: any, i: number) => (
                      <div key={i} className="px-1.5 py-1 rounded bg-secondary/10 border border-border/20">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[7px] font-mono font-bold text-yellow-400 uppercase">{c.type}</span>
                          <span className="text-[7px] font-mono text-muted-foreground ml-auto">{Math.round(c.confidence * 100)}%</span>
                        </div>
                        <span className="text-[6px] font-mono text-muted-foreground/80 block">{c.description}</span>
                        {c.timeframe && <span className="text-[6px] font-mono text-muted-foreground/50">{c.timeframe}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Military Assessment */}
            {a.military_assessment && (
              <>
                <SectionHeader id="military" title="Military Assessment" icon={Shield} />
                {expandedSections.military && (
                  <div className="pl-5 space-y-1 pb-2">
                    {[
                      ["Installations", a.military_assessment.installations_detected],
                      ["Fortifications", a.military_assessment.fortifications],
                      ["Staging Areas", a.military_assessment.staging_areas],
                      ["Supply Routes", a.military_assessment.supply_routes],
                    ].map(([label, val]) => (
                      <div key={label as string} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${val ? "bg-red-400" : "bg-emerald-400/40"}`} />
                        <span className="text-[7px] font-mono text-foreground/80">{label}</span>
                        <span className={`text-[7px] font-mono ml-auto ${val ? "text-red-400 font-bold" : "text-muted-foreground"}`}>
                          {val ? "DETECTED" : "Not detected"}
                        </span>
                      </div>
                    ))}
                    {a.military_assessment.notes && (
                      <div className="p-1.5 rounded bg-red-500/5 border border-red-500/20">
                        <span className="text-[7px] font-mono text-red-400/80">{a.military_assessment.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Risk Factors */}
            {a.risk_factors?.length > 0 && (
              <>
                <SectionHeader id="risk" title="Risk Factors" icon={AlertTriangle} count={a.risk_factors.length} />
                {expandedSections.risk && (
                  <div className="pl-5 space-y-1 pb-2">
                    {a.risk_factors.map((r: any, i: number) => {
                      const color = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.low;
                      return (
                        <div key={i} className="px-1.5 py-1 rounded border" style={{ borderColor: `${color}30`, background: `${color}05` }}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                            <span className="text-[7px] font-mono font-bold" style={{ color }}>{r.factor}</span>
                            <span className="text-[6px] font-mono uppercase px-1 rounded ml-auto" style={{ color, background: `${color}15` }}>{r.severity}</span>
                          </div>
                          <span className="text-[6px] font-mono text-muted-foreground/80 block pl-3">{r.description}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Recommended Actions */}
            {a.recommended_actions?.length > 0 && (
              <>
                <SectionHeader id="actions" title="Recommended Actions" icon={Layers} count={a.recommended_actions.length} />
                {expandedSections.actions && (
                  <div className="pl-5 space-y-1 pb-2">
                    {a.recommended_actions.map((action: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 px-1.5 py-1 rounded bg-secondary/10">
                        <span className="text-[8px] font-mono text-emerald-400 font-bold mt-0.5">{i + 1}.</span>
                        <span className="text-[7px] font-mono text-foreground/80">{action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Anomalies (change detection) */}
            {a.anomalies?.length > 0 && (
              <div className="space-y-1 pb-2">
                <span className="text-[8px] font-mono font-bold text-yellow-400 uppercase px-2">Anomalies</span>
                {a.anomalies.map((an: any, i: number) => (
                  <div key={i} className="px-2 py-1 rounded bg-yellow-500/5 border border-yellow-500/20 ml-2">
                    <span className="text-[7px] font-mono text-yellow-400">{an.description}</span>
                    <span className="text-[6px] font-mono text-muted-foreground block">Severity: {an.severity}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-border/20 flex items-center justify-between">
              <span className="text-[6px] font-mono text-muted-foreground/40">
                GeoAI • {result.generated_at ? new Date(result.generated_at).toLocaleTimeString() : ""}
              </span>
              <span className="text-[6px] font-mono text-muted-foreground/40">
                {result.has_imagery ? "📡 Satellite imagery" : "🌐 Geo-knowledge"}
              </span>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="px-3 py-6 flex flex-col items-center gap-2 text-center">
          <Brain className="h-8 w-8 text-emerald-400/30" />
          <span className="text-[9px] font-mono text-muted-foreground/60">
            Select analysis type and run GeoAI to analyze this location
          </span>
          <span className="text-[7px] font-mono text-muted-foreground/40">
            Powered by AI satellite imagery analysis
          </span>
        </div>
      )}
    </div>
  );
};
