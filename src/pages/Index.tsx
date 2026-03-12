import { useState, useCallback, useRef, ReactNode, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripVertical, ChevronDown, ChevronUp, Map, BarChart3, Bell, Layers, Lock, Unlock } from "lucide-react";
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
import { CountryStatusPanel } from "@/components/dashboard/CountryStatusPanel";
import { SocialSentimentBox } from "@/components/dashboard/SocialSentimentBox";
import { WeatherTrafficPanel } from "@/components/dashboard/WeatherTrafficPanel";
import { useIsMobile } from "@/hooks/use-mobile";
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

const STORAGE_KEY = "waros-layout";
const DEFAULT_LEFT_ORDER = ["rockets", "risk", "geo-fusion", "weather", "escalation", "commodities", "news", "predictions", "telegram"];
const DEFAULT_RIGHT_ORDER = ["notifications", "war-updates"];

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
  const { airspaceAlerts, vessels, geoAlerts, riskScore, timeline, rockets, loading, dataFresh, dailyCounts } = useLiveDashboard();
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

  const toggleLayer = (layer: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

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
  };

  const rightWidgets: Record<string, ReactNode> = {
    cyber: <CyberSecurityAlerts />,
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">جاري تحميل المعلومات…</p>
        </div>
      </div>
    );
  }

  // ─── MOBILE / TABLET LAYOUT ───
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden relative">
        <DashboardHeader dataFresh={dataFresh} alertMuted={alertMuted} onToggleAlertMute={() => setAlertMuted(m => !m)} rockets={rockets} telegramMarkers={telegramIntel.markers} />
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
              <div className="flex flex-col sm:flex-row border-t border-border sm:h-[220px]">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <CitizenSecurity
                    data={citizenSecurity.data}
                    loading={citizenSecurity.loading}
                    error={citizenSecurity.error}
                    onRefresh={citizenSecurity.refresh}
                  />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden border-t sm:border-t-0 sm:border-l border-border/50">
                  <SectorPredictions />
                </div>
              </div>
            </div>
          )}

          {mobileTab === "intel" && (
            <div className="h-full overflow-y-auto p-3 space-y-3">
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
            <div className="h-full overflow-y-auto p-3 space-y-3">
              <LayerControls layers={layers} onToggle={toggleLayer} />
              <TimelineSlider events={timeline} />
            </div>
          )}
        </div>

        {/* Bottom tab bar */}
        <div className="flex-shrink-0 border-t border-border bg-card/90 backdrop-blur flex">
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
    <div className="flex flex-col h-screen overflow-hidden relative">
      <DashboardHeader dataFresh={dataFresh} alertMuted={alertMuted} onToggleAlertMute={() => setAlertMuted(m => !m)} rockets={rockets} telegramMarkers={telegramIntel.markers} />
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="flex-1">
          {/* Main 3-column row */}
          <ResizablePanel defaultSize={75} minSize={30}>
            <div className="flex h-full overflow-hidden" ref={containerRef}>
              {/* Left sidebar - resizable & collapsible */}
              {!leftCollapsed ? (
                <div className="flex-shrink-0 border-r border-border flex flex-col" style={{ width: leftWidth }}>
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
                      onClick={() => setLeftCollapsed(true)}
                      className="hover:bg-secondary/50 transition-colors rounded p-0.5"
                      title="Collapse sidebar"
                    >
                      <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-3 space-y-3">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLeftDragEnd}>
                        <SortableContext items={leftOrder} strategy={verticalListSortingStrategy}>
                          {leftOrder.map((id) => (
                            <DraggableWidget key={id} id={id}>
                              {leftWidgets[id]}
                            </DraggableWidget>
                          ))}
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
                />
              </div>

              {/* Right resize handle */}
              {!rightCollapsed && (
                <div
                  onMouseDown={handleResizeRight}
                  className="w-1.5 flex-shrink-0 cursor-col-resize bg-border/30 hover:bg-primary/30 transition-colors flex items-center justify-center group"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50" />
                </div>
              )}

              {/* Right sidebar - resizable & collapsible */}
              {!rightCollapsed ? (
                <div className="flex-shrink-0 border-l border-border flex flex-col relative" style={{ width: rightWidth }}>
                  {/* Full-height resize edge on left side */}
                  <div
                    onMouseDown={handleResizeRight}
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-primary/20 transition-colors"
                    title="Drag to resize"
                  />
                  <button
                    onClick={() => setRightCollapsed(true)}
                    className="flex items-center justify-start pl-2 py-1.5 border-b border-border hover:bg-secondary/50 transition-colors"
                    title="Collapse sidebar"
                  >
                    <PanelRightClose className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div className="flex-1 overflow-y-auto intel-feed-scroll direction-rtl">
                    <div className="direction-ltr">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRightDragEnd}>
                        <SortableContext items={rightOrder} strategy={verticalListSortingStrategy}>
                          {rightOrder.map((id) => (
                            <DraggableWidget key={id} id={id}>
                              {rightWidgets[id]}
                            </DraggableWidget>
                          ))}
                        </SortableContext>
                      </DndContext>
                      <div className="p-2 space-y-2">
                        <LayerControls layers={layers} onToggle={toggleLayer} />
                        <TimelineSlider events={timeline} />
                        <CyberSecurityAlerts />
                      </div>
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
            </div>
          </ResizablePanel>

          {/* Vertical resize handle between map and bottom row */}
          <ResizableHandle withHandle />

          {/* Bottom row — Citizen Security + Sector Predictions + Social Sentiment — resizable */}
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
        </ResizablePanelGroup>
      </div>

      <Disclaimer />
    </div>
  );
};

export default Index;
