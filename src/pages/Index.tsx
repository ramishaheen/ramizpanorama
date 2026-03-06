import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { IntelMap } from "@/components/dashboard/IntelMap";
import { RiskScoreGauge } from "@/components/dashboard/RiskScoreGauge";
import { NotificationPanel } from "@/components/dashboard/NotificationPanel";
import { TimelineSlider } from "@/components/dashboard/TimelineSlider";
import { LayerControls, type LayerState } from "@/components/dashboard/LayerControls";
import { AIPredictions } from "@/components/dashboard/AIPredictions";
import { Disclaimer } from "@/components/dashboard/Disclaimer";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";

const Index = () => {
  const { airspaceAlerts, vessels, geoAlerts, riskScore, timeline, rockets, loading, dataFresh } = useLiveDashboard();

  const [layers, setLayers] = useState<LayerState>({
    airspace: true,
    maritime: true,
    alerts: true,
    rockets: true,
    heatmap: false,
  });

  const toggleLayer = (layer: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
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
    <div className="flex flex-col h-screen overflow-hidden">
      <DashboardHeader dataFresh={dataFresh} />
      <StatsBar
        airspaceCount={airspaceAlerts.filter(a => a.active).length}
        vesselCount={vessels.length}
        alertCount={geoAlerts.length}
        riskScore={riskScore.overall}
        dataFresh={dataFresh}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[420px] flex-shrink-0 border-r border-border flex flex-col overflow-y-auto">
          <div className="p-3 space-y-3">
            <RiskScoreGauge score={riskScore} />
            <LayerControls layers={layers} onToggle={toggleLayer} />
            <AIPredictions />
          </div>
          <div className="p-3 pt-0">
            <TimelineSlider events={timeline} />
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative min-w-0 max-w-[40%] max-h-[55vh] self-center mx-auto">
          <IntelMap
            airspaceAlerts={airspaceAlerts}
            vessels={vessels}
            geoAlerts={geoAlerts}
            rockets={rockets}
            layers={layers}
          />
        </div>

        {/* Right sidebar - notifications */}
        <div className="w-80 flex-shrink-0 border-l border-border overflow-hidden">
          <NotificationPanel alerts={geoAlerts} />
        </div>
      </div>

      <Disclaimer />
    </div>
  );
};

export default Index;
