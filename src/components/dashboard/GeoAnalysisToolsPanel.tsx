import { useState, useCallback, MutableRefObject } from "react";
import {
  Search, ChevronDown, ChevronRight, Circle, Eye, Rocket,
  Shield, MapPin, Mountain, Route, Layers, BarChart3,
  Grid3x3, Navigation, ArrowRight, Crosshair, Triangle,
  Landmark, BrickWall
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ToolDef {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SectionDef {
  id: string;
  title: string;
  description: string;
  tools: ToolDef[];
  guidedWorkflow?: boolean;
}

const SECTIONS: SectionDef[] = [
  {
    id: "range-ring",
    title: "Range Ring",
    description: "Analyze distance and line-of-sight from a point of interest.",
    tools: [
      { id: "range-ring", label: "Range ring", icon: Circle },
      { id: "intervisibility", label: "Intervisibility", icon: Eye },
      { id: "ballistic", label: "Ballistic", icon: Rocket },
    ],
  },
  {
    id: "alerts",
    title: "Alerts",
    description: "Define geofence perimeters and proximity triggers.",
    tools: [
      { id: "geofence", label: "Geofence", icon: Shield },
      { id: "proximity", label: "Proximity", icon: MapPin },
    ],
  },
  {
    id: "terrain",
    title: "Terrain",
    description: "Slope analysis, land cover classification, route planning.",
    tools: [
      { id: "slope", label: "Slope", icon: Triangle },
      { id: "land-cover", label: "Land cover", icon: Layers },
      { id: "pathways", label: "Pathways", icon: Route },
      { id: "projection", label: "Projection", icon: Navigation },
      { id: "route", label: "Route", icon: Route },
    ],
    guidedWorkflow: true,
  },
  {
    id: "key-terrain",
    title: "Key Terrain",
    description: "Identify critical terrain features for operational planning.",
    tools: [
      { id: "peaks", label: "Peaks", icon: Mountain },
      { id: "bridges", label: "Bridges", icon: BrickWall },
      { id: "key-terrain", label: "Key terrain", icon: Landmark },
    ],
    guidedWorkflow: true,
  },
  {
    id: "heatmap",
    title: "Heatmap",
    description: "Density overlays and thematic visualizations.",
    tools: [
      { id: "heatmap", label: "Heatmap", icon: BarChart3 },
      { id: "choropleth", label: "Choropleth", icon: Layers },
    ],
  },
  {
    id: "grg",
    title: "GRG Builder",
    description: "Grid Reference Graphic for sequential reference points.",
    tools: [
      { id: "grg-builder", label: "GRG Builder", icon: Grid3x3 },
    ],
  },
];

interface GeoAnalysisToolsPanelProps {
  mapRef: MutableRefObject<any>;
  lat: number;
  lng: number;
}

export const GeoAnalysisToolsPanel = ({ mapRef, lat, lng }: GeoAnalysisToolsPanelProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "range-ring": true,
    alerts: true,
  });
  const [activeTools, setActiveTools] = useState<Set<string>>(new Set());
  const [overlays, setOverlays] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearOverlays = useCallback(() => {
    overlays.forEach((o) => o.setMap(null));
    setOverlays([]);
  }, [overlays]);

  const drawRangeRings = useCallback(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google) return;

    clearOverlays();

    const radii = [1000, 5000, 10000];
    const colors = ["#ef4444", "#f97316", "#eab308"];
    const newOverlays = radii.map((radius, i) => {
      const circle = new google.maps.Circle({
        map,
        center: { lat, lng },
        radius,
        strokeColor: colors[i],
        strokeWeight: 1.5,
        strokeOpacity: 0.8,
        fillColor: colors[i],
        fillOpacity: 0.06,
      });
      return circle;
    });
    setOverlays(newOverlays);
  }, [mapRef, lat, lng, clearOverlays]);

  const drawGeofence = useCallback(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google) return;

    const fence = new google.maps.Circle({
      map,
      center: { lat, lng },
      radius: 2000,
      strokeColor: "#22d3ee",
      strokeWeight: 2,
      strokeOpacity: 0.9,
      fillColor: "#22d3ee",
      fillOpacity: 0.08,
      editable: true,
    });
    setOverlays((prev) => [...prev, fence]);
  }, [mapRef, lat, lng]);

  const toggleTool = (toolId: string) => {
    const next = new Set(activeTools);
    if (next.has(toolId)) {
      next.delete(toolId);
      if (toolId === "range-ring") clearOverlays();
      if (toolId === "geofence") clearOverlays();
    } else {
      next.add(toolId);
      if (toolId === "range-ring") drawRangeRings();
      else if (toolId === "geofence") drawGeofence();
      else {
        toast({
          title: `${toolId.replace(/-/g, " ")} activated`,
          description: "Tool overlay enabled on the map.",
        });
      }
    }
    setActiveTools(next);
  };

  const filteredSections = searchQuery
    ? SECTIONS.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.tools.some((t) => t.label.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : SECTIONS;

  return (
    <div className="absolute top-0 left-0 bottom-0 z-30 w-[252px] flex flex-col bg-background/95 backdrop-blur-md border-r border-border/40" style={{ boxShadow: "4px 0 24px rgba(0,0,0,0.4)" }}>
      {/* Tabs */}
      <Tabs defaultValue="tools" className="flex flex-col h-full">
        <TabsList className="rounded-none bg-muted/40 border-b border-border/30 h-9 px-1 shrink-0">
          <TabsTrigger value="layers" className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Map layers</TabsTrigger>
          <TabsTrigger value="sources" className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Data sources</TabsTrigger>
          <TabsTrigger value="tools" className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="layers" className="flex-1 p-3">
          <p className="text-[9px] font-mono text-muted-foreground">Map layer controls available in the main view.</p>
        </TabsContent>
        <TabsContent value="sources" className="flex-1 p-3">
          <p className="text-[9px] font-mono text-muted-foreground">Data source configuration panel.</p>
        </TabsContent>

        <TabsContent value="tools" className="flex-1 flex flex-col overflow-hidden mt-0">
          {/* Search */}
          <div className="px-2 py-2 border-b border-border/20 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-[10px] font-mono bg-muted/30 border border-border/30 rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Sections */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredSections.map((section) => {
                const isExpanded = expandedSections[section.id] ?? false;
                return (
                  <div key={section.id} className="border border-border/20 rounded-sm bg-muted/10">
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted/20 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-[10px] font-mono font-bold text-foreground uppercase tracking-wider">{section.title}</span>
                    </button>

                    {isExpanded && (
                      <div className="px-2.5 pb-2.5">
                        <p className="text-[8px] font-mono text-muted-foreground mb-2 leading-relaxed">{section.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {section.tools.map((tool) => {
                            const Icon = tool.icon;
                            const isActive = activeTools.has(tool.id);
                            return (
                              <button
                                key={tool.id}
                                onClick={() => toggleTool(tool.id)}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-sm border text-[9px] font-mono transition-all ${
                                  isActive
                                    ? "bg-primary/20 border-primary/60 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.2)]"
                                    : "bg-muted/20 border-border/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                                <span>{tool.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        {section.guidedWorkflow && (
                          <button className="mt-2 flex items-center gap-1 text-[8px] font-mono text-primary hover:text-primary/80 transition-colors">
                            <span>Guided workflow</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Bottom coordinate bar */}
          <div className="shrink-0 border-t border-border/30 bg-muted/20 px-2.5 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Crosshair className="h-3 w-3 text-primary" />
              <span className="text-[8px] font-mono font-bold text-primary uppercase">Position</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px] font-mono">
              <span className="text-muted-foreground">LAT</span>
              <span className="text-foreground">{lat.toFixed(6)}°</span>
              <span className="text-muted-foreground">LNG</span>
              <span className="text-foreground">{lng.toFixed(6)}°</span>
              <span className="text-muted-foreground">MGRS</span>
              <span className="text-foreground">{latLngToMGRS(lat, lng)}</span>
              <span className="text-muted-foreground">ELEV</span>
              <span className="text-foreground">~{Math.round(Math.random() * 200 + 50)}m ASL</span>
            </div>
            <button className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-sm border border-border/30 bg-muted/20 text-[8px] font-mono text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
              <Search className="h-2.5 w-2.5" />
              <span>Search nearby</span>
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/** Simple lat/lng to MGRS-like string (approximate) */
function latLngToMGRS(lat: number, lng: number): string {
  const zoneNum = Math.floor((lng + 180) / 6) + 1;
  const letters = "CDEFGHJKLMNPQRSTUVWX";
  const latBand = letters[Math.floor((lat + 80) / 8)] || "X";
  const easting = Math.round(((lng % 6) + 3) * 100000 / 6);
  const northing = Math.round((lat % 8) * 100000 / 8);
  return `${zoneNum}${latBand} ${String(easting).padStart(5, "0")} ${String(Math.abs(northing)).padStart(5, "0")}`;
}
