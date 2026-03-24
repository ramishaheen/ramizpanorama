import { useState, useCallback, useRef, ReactNode, useEffect } from "react";
import { DEFAULT_COMPONENT_VISIBILITY, type ComponentVisibility } from "@/components/dashboard/MapCommandBar";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripVertical, ChevronDown, ChevronUp, Map, BarChart3, Bell, Layers, Lock, Unlock, Shield, Crosshair, Brain } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { IntelMap } from "@/components/dashboard/IntelMap";

import { RiskScoreGauge } from "@/components/dashboard/RiskScoreGauge";
import { NotificationPanel } from "@/components/dashboard/NotificationPanel";
import { TimelineSlider } from "@/components/dashboard/TimelineSlider";
import { LayerControls, type LayerState } from "@/components/dashboard/LayerControls";
import { AIPredictions } from "@/components/dashboard/AIPredictions";
import { LiveNewsFeed } from "@/components/dashboard/LiveNewsFeed";
import { Disclaimer } from "@/components/dashboard/Disclaimer";
import { CommodityTracker } from "@/components/dashboard/CommodityTracker";
import { SectorPredictions } from "@/components/dashboard/SectorPredictions";
import { CitizenSecurity } from "@/components/dashboard/CitizenSecurity";
import { CyberSecurityAlerts } from "@/components/dashboard/CyberSecurityAlerts";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useCitizenSecurity } from "@/hooks/useCitizenSecurity";
import { useWarUpdates } from "@/hooks/useWarUpdates";
import { useTelegramIntel } from "@/hooks/useTelegramIntel";
import { useGeoFusion } from "@/hooks/useGeoFusion";
import { WarUpdatesPanel } from "@/components/dashboard/WarUpdatesPanel";
import { DraggableWidget } from "@/components/dashboard/DraggableWidget";
import { TelegramFeed } from "@/components/dashboard/TelegramFeed";
import { WarEscalationEngine } from "@/components/dashboard/WarEscalationEngine";
import { RocketEntryPanel } from "@/components/dashboard/RocketEntryPanel";
import { RansomwareTracker } from "@/components/dashboard/RansomwareTracker";
import { CountryStatusPanel } from "@/components/dashboard/CountryStatusPanel";
import { SocialSentimentBox } from "@/components/dashboard/SocialSentimentBox";
import { WeatherTrafficPanel } from "@/components/dashboard/WeatherTrafficPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { RotateDeviceOverlay } from "@/components/RotateDeviceOverlay";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

const STORAGE_KEY = "waros-layout"; // layout persistence key
const DEFAULT_LEFT_ORDER = ["rockets", "risk", "ransomware", "geo-fusion", "weather", "escalation", "commodities", "news", "predictions", "telegram"];
const DEFAULT_RIGHT_ORDER = ["notifications", "war-updates", "layers", "timeline", "cyber"];

interface LayoutState {
  leftOrder: string[];
  rightOrder: string[];
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const DEFAULT_LAYOUT: LayoutState = {
  leftOrder: DEFAULT_LEFT_ORDER,
  rightOrder: DEFAULT_RIGHT_ORDER,
  leftWidth: 380,
  rightWidth: 300,
  leftCollapsed: false,
  rightCollapsed: false,
};

function loadLayout(): LayoutState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = { ...DEFAULT_LAYOUT, ...JSON.parse(stored) };
      // Ensure new widgets are always present in sidebar orders
      DEFAULT_RIGHT_ORDER.forEach((id) => {
        if (!parsed.rightOrder.includes(id)) {
          parsed.rightOrder.unshift(id);
        }
      });
      DEFAULT_LEFT_ORDER.forEach((id) => {
        if (!parsed.leftOrder.includes(id)) {
          parsed.leftOrder.push(id);
        }
      });
      return parsed;
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

const MOBILE_TABS = [
  { id: "map", label: "Map", icon: Map },
  { id: "intel", label: "Intel", icon: BarChart3 },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "layers", label: "Layers", icon: Layers },
] as const;

type MobileTab = typeof MOBILE_TABS[number]["id"];

// Component entry
const Index = () => {
  const { airspaceAlerts, vessels, geoAlerts, riskScore, timeline, rockets, loading, dataFresh, dailyCounts, lastPollAt, simulationActive, setSimulationActive } = useLiveDashboard();
  const citizenSecurity = useCitizenSecurity();
  const warUpdates = useWarUpdates();
  const telegramIntel = useTelegramIntel();
  const geoFusion = useGeoFusion();
  const isMobile = useIsMobile();

  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [alertMuted, setAlertMuted] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    airspace: true,
    maritime: true,
    alerts: true,
    rockets: true,
    heatmap: true,
    earthquakes: true,
    wildfires: true,
    weather: true,
    traffic: true,
    conflicts: true,
    flights: true,
    nuclear: true,
    airQuality: false,
    aisVessels: true,
    cities: true,
    googlePOI: false,
    googleTraffic: false,
    googleRoutes: false,
    news: true,
    telegram: true,
  });

  const initialLayout = loadLayout();
  const [leftOrder, setLeftOrder] = useState(initialLayout.leftOrder);
  const [rightOrder, setRightOrder] = useState(initialLayout.rightOrder);
  const [leftCollapsed, setLeftCollapsed] = useState(initialLayout.leftCollapsed);
  const [leftWidth, setLeftWidth] = useState(initialLayout.leftWidth);
  const [rightWidth, setRightWidth] = useState(initialLayout.rightWidth);
  const [rightCollapsed, setRightCollapsed] = useState(initialLayout.rightCollapsed);
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");
  const [layoutLocked, setLayoutLocked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [componentVisibility, setComponentVisibility] = useState<ComponentVisibility>(DEFAULT_COMPONENT_VISIBILITY);

  const toggleComponent = useCallback((key: keyof ComponentVisibility) => {
    setComponentVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Persist layout changes
  useEffect(() => {
    saveLayout({ leftOrder, rightOrder, leftWidth, rightWidth, leftCollapsed, rightCollapsed });
  }, [leftOrder, rightOrder, leftWidth, rightWidth, leftCollapsed, rightCollapsed]);

  const handleResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      setLeftWidth(Math.max(200, Math.min(600, startWidth + delta)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  const handleResizeRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setRightWidth(Math.max(200, Math.min(500, startWidth + delta)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [rightWidth]);

  const toggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers(prev => {
      const next = { ...prev, [layer]: !prev[layer] };
      // Turning off traffic layer also stops live simulation
      if (layer === 'traffic' && !next.traffic && simulationActive) {
        setSimulationActive(false);
      }
      return next;
    });
  }, [simulationActive, setSimulationActive]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleLeftDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLeftOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleRightDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRightOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const leftWidgets: Record<string, ReactNode> = {
    rockets: <RocketEntryPanel rockets={rockets} />,
    risk: <RiskScoreGauge score={riskScore} />,
    "geo-fusion": <CountryStatusPanel data={geoFusion.data} loading={geoFusion.loading} error={geoFusion.error} onRefresh={geoFusion.refresh} />,
    weather: <WeatherTrafficPanel />,
    escalation: <WarEscalationEngine />,
    commodities: <CommodityTracker riskScore={riskScore.overall} />,
    news: <LiveNewsFeed />,
    predictions: <AIPredictions />,
    telegram: <TelegramFeed />,
    ransomware: <RansomwareTracker />,
  };

  const rightWidgets: Record<string, ReactNode> = {
    notifications: (
      <div className="min-h-0 flex flex-col">
        <NotificationPanel alerts={geoAlerts} />
      </div>
    ),
    "war-updates": (
      <div className="min-h-0 flex flex-col">
        <WarUpdatesPanel
          data={warUpdates.data}
          loading={warUpdates.loading}
          error={warUpdates.error}
          onRefresh={warUpdates.refresh}
          onFlyTo={(lat, lng, headline) => setFlyToTarget({ lat, lng, label: headline })}
        />
      </div>
    ),
    layers: (
      <div className="p-2">
        <LayerControls layers={layers} onToggle={toggleLayer} />
      </div>
    ),
    timeline: (
      <div className="p-2">
        <TimelineSlider events={timeline} />
      </div>
    ),
    cyber: (
      <div className="p-2">
        <CyberSecurityAlerts />
      </div>
    ),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background maven-grid-subtle">
        <div className="text-center space-y-4 maven-glass p-8">
          <div className="h-8 w-8 border-2 border-primary/60 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em]">Initializing Intelligence Systems…</p>
          <div className="flex justify-center gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-1 w-6 rounded-full bg-primary/20 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── MOBILE / TABLET LAYOUT ───
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden relative">
        <RotateDeviceOverlay />
        <DashboardHeader dataFresh={dataFresh} alertMuted={alertMuted} onToggleAlertMute={() => setAlertMuted(m => !m)} rockets={rockets} telegramMarkers={telegramIntel.markers} geoAlerts={geoAlerts} lastPollAt={lastPollAt} activeSources={Object.values(layers).filter(Boolean).length} simulationActive={simulationActive} onToggleSimulation={() => setSimulationActive(v => !v)} />
        <StatsBar
          airspaceCount={dailyCounts.airspaceCount}
          vesselCount={dailyCounts.vesselCount}
          alertCount={dailyCounts.alertCount}
          riskScore={riskScore.overall}
          rocketCount={dailyCounts.rocketCount}
          impactCount={dailyCounts.impactCount}
          totalRockets={dailyCounts.totalRockets}
          rockets={dailyCounts.todayRockets}
          geoAlerts={dailyCounts.todayGeoAlerts}
          airspaceAlerts={dailyCounts.todayAirspace}
          dataFresh={dataFresh}
        />

        {/* Mobile tab content */}
        <div className="flex-1 overflow-hidden relative">
          {mobileTab === "map" && (
            <div className="h-full flex flex-col">
              <div className="flex-1 relative min-h-0">
                <IntelMap
                  airspaceAlerts={airspaceAlerts}
                  vessels={vessels}
                  geoAlerts={geoAlerts}
                  rockets={rockets}
                  layers={layers}
                  onToggleLayer={toggleLayer}
                  safetyData={citizenSecurity.data?.countries}
                  flyToTarget={flyToTarget}
                  newsMarkers={warUpdates.data?.updates}
                  telegramMarkers={telegramIntel.markers}
                  fusionEvents={geoFusion.data?.events}
                />
              </div>
            </div>
          )}

          {mobileTab === "intel" && (
            <div className="h-full overflow-y-auto p-2 space-y-2">
              <CitizenSecurity
                data={citizenSecurity.data}
                loading={citizenSecurity.loading}
                error={citizenSecurity.error}
                onRefresh={citizenSecurity.refresh}
              />
              <SectorPredictions />
              {leftOrder.map((id) => (
                <div key={id}>{leftWidgets[id]}</div>
              ))}
            </div>
          )}

          {mobileTab === "alerts" && (
            <div className="h-full overflow-y-auto">
              {rightOrder.map((id) => (
                <div key={id}>{rightWidgets[id]}</div>
              ))}
            </div>
          )}

          {mobileTab === "layers" && (
            <div className="h-full overflow-y-auto p-2 space-y-2">
              <LayerControls layers={layers} onToggle={toggleLayer} />
              <TimelineSlider events={timeline} />
            </div>
          )}
        </div>

        {/* Bottom tab bar */}
        <div className="flex-shrink-0 border-t border-border bg-card/90 backdrop-blur flex pb-safe">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-mono uppercase tracking-wider">{tab.label}</span>
                {active && <div className="w-4 h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        <Disclaimer />
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  return (
    <div className="flex flex-col h-screen overflow-hidden relative bg-background">
      {/* Ambient grid overlay */}
      <div className="absolute inset-0 maven-grid-subtle pointer-events-none z-0 opacity-40" />
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
      {componentVisibility.header && (
        <DashboardHeader dataFresh={dataFresh} alertMuted={alertMuted} onToggleAlertMute={() => setAlertMuted(m => !m)} rockets={rockets} telegramMarkers={telegramIntel.markers} geoAlerts={geoAlerts} lastPollAt={lastPollAt} activeSources={Object.values(layers).filter(Boolean).length} simulationActive={simulationActive} onToggleSimulation={() => setSimulationActive(v => !v)} />
      )}
      {componentVisibility.statsBar && (
        <StatsBar
          airspaceCount={dailyCounts.airspaceCount}
          vesselCount={dailyCounts.vesselCount}
          alertCount={dailyCounts.alertCount}
          riskScore={riskScore.overall}
          rocketCount={dailyCounts.rocketCount}
          impactCount={dailyCounts.impactCount}
          totalRockets={dailyCounts.totalRockets}
          rockets={dailyCounts.todayRockets}
          geoAlerts={dailyCounts.todayGeoAlerts}
          airspaceAlerts={dailyCounts.todayAirspace}
          dataFresh={dataFresh}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="flex-1">
          {/* Main 3-column row */}
          <ResizablePanel defaultSize={componentVisibility.bottomRow ? 75 : 100} minSize={30}>
            <div className="flex h-full overflow-hidden" ref={containerRef}>
              {/* Left sidebar - resizable & collapsible */}
              {componentVisibility.leftSidebar && (
                <>
                {!leftCollapsed ? (
                    <div className="flex-shrink-0 border-r border-border/25 flex flex-col maven-glass-heavy" style={{ width: leftWidth }}>
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/20">
                        <button
                          onClick={() => setLayoutLocked(l => !l)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[8px] font-mono uppercase tracking-wider transition-all duration-150 ${
                            layoutLocked
                              ? "text-warning bg-warning/8 border border-warning/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                          }`}
                          title={layoutLocked ? "Unlock widget reordering" : "Lock widget positions"}
                        >
                          {layoutLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          {layoutLocked ? "Locked" : "Unlocked"}
                        </button>
                        <button
                          onClick={() => setLeftCollapsed(true)}
                          className="hover:bg-primary/5 transition-colors p-0.5"
                          title="Collapse sidebar"
                        >
                          <PanelLeftClose className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto intel-feed-scroll">
                        <div className="p-2.5 space-y-0.5">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLeftDragEnd}>
                            <SortableContext items={leftOrder} strategy={verticalListSortingStrategy}>
                              {leftOrder.map((id) => {
                                const sectionMap: Record<string, { label: string; icon: any; color: string }> = {
                                  rockets: { label: "THREAT STATUS", icon: Shield, color: "text-critical" },
                                  "geo-fusion": { label: "SITUATIONAL AWARENESS", icon: Crosshair, color: "text-primary" },
                                  commodities: { label: "INTELLIGENCE", icon: Brain, color: "text-accent" },
                                };
                                const section = sectionMap[id];
                                return (
                                  <div key={id}>
                                    {section && (
                                      <div className="flex items-center gap-1.5 pt-3 pb-1.5 px-1">
                                        <div className="h-3 w-0.5 rounded-full bg-gradient-to-b from-primary to-primary/20" />
                                        <section.icon className={`h-2.5 w-2.5 ${section.color}`} />
                                        <span className={`text-[8px] font-mono uppercase tracking-[0.15em] ${section.color} font-bold`}>{section.label}</span>
                                        <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                                      </div>
                                    )}
                                    <DraggableWidget id={id} disabled={layoutLocked}>
                                      {leftWidgets[id]}
                                    </DraggableWidget>
                                  </div>
                                );
                              })}
                            </SortableContext>
                          </DndContext>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 flex-shrink-0 border-r border-border flex flex-col">
                      <button
                        onClick={() => setLeftCollapsed(false)}
                        className="flex items-center justify-center py-1.5 border-b border-border hover:bg-secondary/50 transition-colors"
                        title="Expand sidebar"
                      >
                        <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}

                  {/* Left resize handle */}
                  {!leftCollapsed && (
                    <div
                      onMouseDown={handleResizeLeft}
                      className="w-1.5 flex-shrink-0 cursor-col-resize bg-border/30 hover:bg-primary/30 transition-colors flex items-center justify-center group"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50" />
                    </div>
                  )}
                </>
              )}

              {/* Map (center) */}
              <div className="flex-1 relative min-w-0 h-full z-0">
                <IntelMap
                  airspaceAlerts={airspaceAlerts}
                  vessels={vessels}
                  geoAlerts={geoAlerts}
                  rockets={rockets}
                  layers={layers}
                  onToggleLayer={toggleLayer}
                  safetyData={citizenSecurity.data?.countries}
                  flyToTarget={flyToTarget}
                  newsMarkers={warUpdates.data?.updates}
                  telegramMarkers={telegramIntel.markers}
                  fusionEvents={geoFusion.data?.events}
                  componentVisibility={componentVisibility}
                  onToggleComponent={toggleComponent}
                />
              </div>

              {/* Right sidebar */}
              {componentVisibility.rightSidebar && (
                <>
                  {/* Right resize handle */}
                  {!rightCollapsed && (
                    <div
                      onMouseDown={handleResizeRight}
                      className="w-1.5 flex-shrink-0 cursor-col-resize bg-border/30 hover:bg-primary/30 transition-colors flex items-center justify-center group"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50" />
                    </div>
                  )}

              {!rightCollapsed ? (
                    <div className="flex-shrink-0 border-l border-border/25 flex flex-col relative maven-glass-heavy" style={{ width: rightWidth }}>
                      {/* Full-height resize edge on left side */}
                      <div
                        onMouseDown={handleResizeRight}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-primary/20 transition-colors"
                        title="Drag to resize"
                      />
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
                        <button
                          onClick={() => setLayoutLocked(l => !l)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
                            layoutLocked
                              ? "text-warning bg-warning/10 border border-warning/30"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          }`}
                          title={layoutLocked ? "Unlock widget reordering" : "Lock widget positions"}
                        >
                          {layoutLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          {layoutLocked ? "Locked" : "Unlocked"}
                        </button>
                        <button
                          onClick={() => setRightCollapsed(true)}
                          className="p-0.5 rounded hover:bg-secondary/50 transition-colors"
                          title="Collapse sidebar"
                        >
                          <PanelRightClose className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto intel-feed-scroll direction-rtl">
                        <div className="direction-ltr">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRightDragEnd}>
                            <SortableContext items={rightOrder} strategy={verticalListSortingStrategy}>
                              {rightOrder.map((id) => {
                                const accentMap: Record<string, string> = {
                                  notifications: "border-l-2 border-l-destructive",
                                  "war-updates": "border-l-2 border-l-warning",
                                  layers: "border-l-2 border-l-primary",
                                  timeline: "border-l-2 border-l-primary",
                                  cyber: "border-l-2 border-l-accent",
                                };
                                const labelMap: Record<string, string> = {
                                  notifications: "ALERTS",
                                  "war-updates": "WAR UPDATES",
                                  layers: "MAP LAYERS",
                                  timeline: "TIMELINE",
                                  cyber: "CYBER",
                                };
                                return (
                                  <div key={id} className={accentMap[id] || ""}>
                                    {labelMap[id] && (
                                      <div className="px-2 pt-2 pb-0.5">
                                        <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground font-semibold">{labelMap[id]}</span>
                                      </div>
                                    )}
                                    <DraggableWidget id={id} disabled={layoutLocked}>
                                      {rightWidgets[id]}
                                    </DraggableWidget>
                                  </div>
                                );
                              })}
                            </SortableContext>
                          </DndContext>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 flex-shrink-0 border-l border-border flex flex-col">
                      <button
                        onClick={() => setRightCollapsed(false)}
                        className="flex items-center justify-center py-1.5 border-b border-border hover:bg-secondary/50 transition-colors"
                        title="Expand sidebar"
                      >
                        <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ResizablePanel>

          {/* Bottom row */}
          {componentVisibility.bottomRow && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={25} minSize={10} maxSize={50}>
                <ResizablePanelGroup direction="horizontal" className="h-full">
                  <ResizablePanel defaultSize={33} minSize={15}>
                    <div className="h-full overflow-hidden">
                      <CitizenSecurity
                        data={citizenSecurity.data}
                        loading={citizenSecurity.loading}
                        error={citizenSecurity.error}
                        onRefresh={citizenSecurity.refresh}
                      />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={34} minSize={15}>
                    <div className="h-full overflow-hidden">
                      <SectorPredictions />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={33} minSize={15}>
                    <div className="h-full overflow-hidden">
                      <SocialSentimentBox />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {componentVisibility.disclaimer && <Disclaimer />}
      </div>
    </div>
  );
};

export default Index;
