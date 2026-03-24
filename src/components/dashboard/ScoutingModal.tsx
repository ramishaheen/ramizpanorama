import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { X, Shield, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useCitizenSecurity } from "@/hooks/useCitizenSecurity";
import { useWarUpdates } from "@/hooks/useWarUpdates";
import { useTelegramIntel } from "@/hooks/useTelegramIntel";
import { useGeoFusion } from "@/hooks/useGeoFusion";
import { StatsBar } from "./StatsBar";
import { RocketEntryPanel } from "./RocketEntryPanel";
import { RiskScoreGauge } from "./RiskScoreGauge";
import { CountryStatusPanel } from "./CountryStatusPanel";
import { WeatherTrafficPanel } from "./WeatherTrafficPanel";
import { WarEscalationEngine } from "./WarEscalationEngine";
import { CommodityTracker } from "./CommodityTracker";
import { LiveNewsFeed } from "./LiveNewsFeed";
import { AIPredictions } from "./AIPredictions";
import { TelegramFeed } from "./TelegramFeed";
import { NotificationPanel } from "./NotificationPanel";
import { WarUpdatesPanel } from "./WarUpdatesPanel";
import { CyberSecurityAlerts } from "./CyberSecurityAlerts";
import { CitizenSecurity } from "./CitizenSecurity";
import { SectorPredictions } from "./SectorPredictions";
import { SocialSentimentInline } from "./SocialSentimentInline";

interface ScoutingModalProps {
  onClose: () => void;
}

/* ── Sortable Tile wrapper ───────────────────────────── */
function SortableTile({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="scouting-tile">
      <div className="scouting-section-label">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <span>{label}</span>
      </div>
      <div className="flex-1 overflow-y-auto scouting-tile-body">
        {children}
      </div>
      <div className="absolute inset-0 pointer-events-none scanline opacity-30" />
    </div>
  );
}

/* ── UTC clock ────────────────────────────────────────── */
function UtcClock() {
  const [time, setTime] = useState(new Date().toISOString().slice(11, 19));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-primary font-mono text-[10px] tabular-nums">{time}Z</span>;
}

/* ── Tile definitions ─────────────────────────────────── */
const DEFAULT_ORDER = [
  "threat", "escalation", "sigint", "economic",
  "geofusion", "notifications", "cyberops", "aiintel",
  "citizen", "sector", "social",
];

/* ── Main modal ───────────────────────────────────────── */
export function ScoutingModal({ onClose }: ScoutingModalProps) {
  const { airspaceAlerts, vessels, geoAlerts, riskScore, rockets, dataFresh, dailyCounts } = useLiveDashboard();
  const citizenSecurity = useCitizenSecurity();
  const warUpdates = useWarUpdates();
  const telegramIntel = useTelegramIntel();
  const geoFusion = useGeoFusion();

  const [tileOrder, setTileOrder] = useState(DEFAULT_ORDER);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTileOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const tileContent: Record<string, { label: string; node: React.ReactNode }> = {
    threat: {
      label: "THREAT ASSESSMENT",
      node: (
        <div className="space-y-2">
          <RiskScoreGauge score={riskScore} />
          <RocketEntryPanel rockets={rockets} />
        </div>
      ),
    },
    escalation: {
      label: "ESCALATION MATRIX",
      node: (
        <div className="space-y-2">
          <WarEscalationEngine />
          <WarUpdatesPanel
            data={warUpdates.data}
            loading={warUpdates.loading}
            error={warUpdates.error}
            onRefresh={warUpdates.refresh}
          />
        </div>
      ),
    },
    sigint: {
      label: "SIGINT / OSINT",
      node: (
        <div className="space-y-2">
          <TelegramFeed />
          <LiveNewsFeed />
        </div>
      ),
    },
    economic: {
      label: "ECONOMIC WARFARE",
      node: <CommodityTracker riskScore={riskScore.overall} />,
    },
    geofusion: {
      label: "GEO-FUSION",
      node: (
        <div className="space-y-2">
          <CountryStatusPanel
            data={geoFusion.data}
            loading={geoFusion.loading}
            error={geoFusion.error}
            onRefresh={geoFusion.refresh}
          />
          <WeatherTrafficPanel />
        </div>
      ),
    },
    notifications: {
      label: "NOTIFICATIONS",
      node: <NotificationPanel alerts={geoAlerts} />,
    },
    cyberops: {
      label: "CYBER OPS",
      node: <CyberSecurityAlerts />,
    },
    aiintel: {
      label: "AI INTEL",
      node: (
        <div className="space-y-2">
          <AIPredictions />
          <SectorPredictions />
        </div>
      ),
    },
    citizen: {
      label: "CITIZEN SECURITY",
      node: (
        <CitizenSecurity
          data={citizenSecurity.data}
          loading={citizenSecurity.loading}
          error={citizenSecurity.error}
          onRefresh={citizenSecurity.refresh}
        />
      ),
    },
    sector: {
      label: "SECTOR PREDICTIONS",
      node: <SectorPredictions />,
    },
    social: {
      label: "SOCIAL MEDIA HARVESTING",
      node: <SocialSentimentInline />,
    },
  };

  return createPortal(
    <div className="scouting-overlay">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-0 scanline opacity-20 pointer-events-none" />

      {/* ── HEADER ───────────────────────────────────── */}
      <header className="scouting-header">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-mono font-bold text-primary uppercase tracking-[0.25em]">
            Scouting — Intelligence Overview
          </span>
          <span className="scouting-live-badge">LIVE</span>
        </div>
        <div className="flex items-center gap-4">
          <UtcClock />
          <span className="text-[8px] font-mono text-muted-foreground">
            REFRESH: {dataFresh ? <span className="text-success">FRESH</span> : <span className="text-warning">STALE</span>}
          </span>
          <button onClick={onClose} className="scouting-close-btn" title="Close (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="classification-banner">
        UNCLASSIFIED // FOR OFFICIAL USE ONLY
      </div>

      {/* ── STATS BAR ────────────────────────────────── */}
      <div className="border-b" style={{ borderColor: "hsl(190 60% 18%)" }}>
        <StatsBar
          airspaceCount={dailyCounts.airspaceCount}
          vesselCount={dailyCounts.vesselCount}
          alertCount={dailyCounts.alertCount}
          riskScore={riskScore.overall}
          rocketCount={dailyCounts.rocketCount}
          impactCount={dailyCounts.impactCount}
          totalRockets={dailyCounts.totalRockets}
          rockets={rockets}
          geoAlerts={geoAlerts}
          airspaceAlerts={dailyCounts.todayAirspace}
          dataFresh={dataFresh}
        />
      </div>

      {/* ── SORTABLE GRID ────────────────────────────── */}
      <div className="scouting-grid-container">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tileOrder} strategy={rectSortingStrategy}>
            <div className="scouting-sortable-grid">
              {tileOrder.map((id) => {
                const tile = tileContent[id];
                if (!tile) return null;
                return (
                  <SortableTile key={id} id={id} label={tile.label}>
                    {tile.node}
                  </SortableTile>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>,
    document.body
  );
}
