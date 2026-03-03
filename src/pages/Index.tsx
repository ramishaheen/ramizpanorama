import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { IntelMap } from "@/components/dashboard/IntelMap";
import { RiskScoreGauge } from "@/components/dashboard/RiskScoreGauge";
import { NotificationPanel } from "@/components/dashboard/NotificationPanel";
import { TimelineSlider } from "@/components/dashboard/TimelineSlider";
import { LayerControls, type LayerState } from "@/components/dashboard/LayerControls";
import { Disclaimer } from "@/components/dashboard/Disclaimer";
import {
  mockAirspaceAlerts,
  mockVessels,
  mockGeoAlerts,
  mockRiskScore,
  mockTimeline,
} from "@/data/mockData";

const Index = () => {
  const [layers, setLayers] = useState<LayerState>({
    airspace: true,
    maritime: true,
    alerts: true,
    heatmap: false,
  });

  const toggleLayer = (layer: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DashboardHeader />
      <StatsBar
        airspaceCount={mockAirspaceAlerts.filter(a => a.active).length}
        vesselCount={mockVessels.length}
        alertCount={mockGeoAlerts.length}
        riskScore={mockRiskScore.overall}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="p-3 space-y-3">
            <RiskScoreGauge score={mockRiskScore} />
            <LayerControls layers={layers} onToggle={toggleLayer} />
          </div>
          <div className="p-3 pt-0">
            <TimelineSlider events={mockTimeline} />
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <IntelMap
            airspaceAlerts={mockAirspaceAlerts}
            vessels={mockVessels}
            geoAlerts={mockGeoAlerts}
            layers={layers}
          />
        </div>

        {/* Right sidebar - notifications */}
        <div className="w-80 flex-shrink-0 border-l border-border overflow-hidden">
          <NotificationPanel alerts={mockGeoAlerts} />
        </div>
      </div>

      <Disclaimer />
    </div>
  );
};

export default Index;
