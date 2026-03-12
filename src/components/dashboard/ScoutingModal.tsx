import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Crosshair } from "lucide-react";
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
import { SocialSentimentBox } from "./SocialSentimentBox";

interface ScoutingModalProps {
  onClose: () => void;
}

export function ScoutingModal({ onClose }: ScoutingModalProps) {
  const { airspaceAlerts, vessels, geoAlerts, riskScore, rockets, dataFresh, dailyCounts } = useLiveDashboard();
  const citizenSecurity = useCitizenSecurity();
  const warUpdates = useWarUpdates();
  const telegramIntel = useTelegramIntel();
  const geoFusion = useGeoFusion();

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

  return createPortal(
    <div
      className="fixed inset-0 bg-background/98 backdrop-blur-sm flex flex-col"
      style={{ zIndex: 99999 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">
            Scouting — Intelligence Overview
          </span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary animate-pulse">
            LIVE
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-secondary/50 transition-colors"
          title="Close (Esc)"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-border">
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="space-y-3">
            <RocketEntryPanel rockets={rockets} />
            <RiskScoreGauge score={riskScore} />
            <CountryStatusPanel
              data={geoFusion.data}
              loading={geoFusion.loading}
              error={geoFusion.error}
              onRefresh={geoFusion.refresh}
            />
            <WeatherTrafficPanel />
          </div>
          <div className="space-y-3">
            <WarEscalationEngine />
            <CommodityTracker riskScore={riskScore.overall} />
            <NotificationPanel alerts={geoAlerts} />
            <WarUpdatesPanel
              data={warUpdates.data}
              loading={warUpdates.loading}
              error={warUpdates.error}
              onRefresh={warUpdates.refresh}
            />
          </div>
          <div className="space-y-3">
            <LiveNewsFeed />
            <AIPredictions />
            <CyberSecurityAlerts />
            <TelegramFeed />
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border pt-3">
          <CitizenSecurity
            data={citizenSecurity.data}
            loading={citizenSecurity.loading}
            error={citizenSecurity.error}
            onRefresh={citizenSecurity.refresh}
          />
          <SectorPredictions />
          <SocialSentimentBox />
        </div>
      </div>
    </div>,
    document.body
  );
}
