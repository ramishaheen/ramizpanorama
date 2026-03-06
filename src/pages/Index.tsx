import { useState, useCallback, ReactNode } from "react";
import { MissileAlertBanner } from "@/components/dashboard/MissileAlertBanner";
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
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useCitizenSecurity } from "@/hooks/useCitizenSecurity";
import { useWarUpdates } from "@/hooks/useWarUpdates";
import { WarUpdatesPanel } from "@/components/dashboard/WarUpdatesPanel";
import { DraggableWidget } from "@/components/dashboard/DraggableWidget";
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

const DEFAULT_LEFT_ORDER = ["risk", "commodities", "news", "predictions", "sectors"];
const DEFAULT_RIGHT_ORDER = ["notifications", "war-updates", "layers", "timeline"];

const Index = () => {
  const { airspaceAlerts, vessels, geoAlerts, riskScore, timeline, rockets, loading, dataFresh } = useLiveDashboard();
  const citizenSecurity = useCitizenSecurity();
  const warUpdates = useWarUpdates();

  const [alertMuted, setAlertMuted] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    airspace: true,
    maritime: true,
    alerts: true,
    rockets: true,
    heatmap: false,
  });
  const [leftOrder, setLeftOrder] = useState(DEFAULT_LEFT_ORDER);
  const [rightOrder, setRightOrder] = useState(DEFAULT_RIGHT_ORDER);

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
    risk: <RiskScoreGauge score={riskScore} />,
    commodities: <CommodityTracker />,
    news: <LiveNewsFeed />,
    predictions: <AIPredictions />,
    sectors: <SectorPredictions />,
  };

  const rightWidgets: Record<string, ReactNode> = {
    notifications: (
      <div className="min-h-0 flex flex-col" style={{ maxHeight: "28%" }}>
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
        />
      </div>
    ),
    layers: <LayerControls layers={layers} onToggle={toggleLayer} />,
    timeline: <TimelineSlider events={timeline} />,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Loading intel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <MissileAlertBanner rockets={rockets} muted={alertMuted} />
      <DashboardHeader dataFresh={dataFresh} alertMuted={alertMuted} onToggleAlertMute={() => setAlertMuted(m => !m)} />
      <StatsBar
        airspaceCount={airspaceAlerts.filter(a => a.active).length}
        vesselCount={vessels.length}
        alertCount={geoAlerts.length}
        riskScore={riskScore.overall}
        rocketCount={rockets.filter(r => r.status === 'launched' || r.status === 'in_flight').length}
        impactCount={rockets.filter(r => r.status === 'impact' || r.status === 'intercepted').length}
        dataFresh={dataFresh}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - draggable */}
        <div className="w-[420px] flex-shrink-0 border-r border-border flex flex-col overflow-y-auto">
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

        {/* Map + Citizen Security */}
        <div className="flex-1 relative min-w-0 h-full flex flex-col">
          <div className="flex-1 relative min-h-0">
            <IntelMap
              airspaceAlerts={airspaceAlerts}
              vessels={vessels}
              geoAlerts={geoAlerts}
              rockets={rockets}
              layers={layers}
              safetyData={citizenSecurity.data?.countries}
            />
          </div>
          <CitizenSecurity
            data={citizenSecurity.data}
            loading={citizenSecurity.loading}
            error={citizenSecurity.error}
            onRefresh={citizenSecurity.refresh}
          />
        </div>

        {/* Right sidebar - draggable */}
        <div className="w-80 flex-shrink-0 border-l border-border overflow-y-auto flex flex-col intel-feed-scroll">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRightDragEnd}>
            <SortableContext items={rightOrder} strategy={verticalListSortingStrategy}>
              {rightOrder.map((id) => (
                <DraggableWidget key={id} id={id}>
                  {rightWidgets[id]}
                </DraggableWidget>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
};

export default Index;
