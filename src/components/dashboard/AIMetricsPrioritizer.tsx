import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Plus, Minus, ToggleLeft, ToggleRight, Gauge, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MetricConfig {
  id: string;
  label: string;
  description: string;
  weight: number;
  visible: boolean;
  color: string;
}

interface AIMetricsPrioritizerProps {
  onClose: () => void;
  onOptimized?: (results: any) => void;
  onApproveAndZoom?: (lat: number, lng: number) => void;
}

const DEFAULT_METRICS: MetricConfig[] = [
  { id: "agm_match", label: "AGM Match", description: "Effect Priority — weapon-target compatibility", weight: 30, visible: true, color: "#ef4444" },
  { id: "time_to_target", label: "Time to Target", description: "Minutes to reach engagement zone", weight: 50, visible: true, color: "#f97316" },
  { id: "distance", label: "Distance", description: "Proximity in kilometers", weight: 10, visible: true, color: "#eab308" },
  { id: "time_on_station", label: "Time on Station", description: "Remaining loiter time", weight: 20, visible: true, color: "#22c55e" },
  { id: "fuel", label: "Fuel", description: "Remaining fuel percentage", weight: 40, visible: true, color: "#06b6d4" },
  { id: "munitions", label: "Munitions", description: "Available ordnance count", weight: 10, visible: true, color: "#8b5cf6" },
  { id: "pk", label: "Probability of Kill", description: "Estimated Pk based on all factors", weight: 60, visible: false, color: "#ec4899" },
  { id: "collateral_risk", label: "Collateral Risk", description: "Estimated civilian risk level", weight: 80, visible: false, color: "#dc2626" },
  { id: "roe_compliance", label: "ROE Compliance", description: "Rules of engagement alignment", weight: 90, visible: false, color: "#16a34a" },
  { id: "sensor_coverage", label: "Sensor Coverage", description: "ISR coverage at target area", weight: 30, visible: false, color: "#0891b2" },
  { id: "weather", label: "Weather", description: "Atmospheric conditions factor", weight: 15, visible: false, color: "#64748b" },
  { id: "altitude_advantage", label: "Altitude Advantage", description: "Relative altitude superiority", weight: 20, visible: false, color: "#a855f7" },
  { id: "ew_threat", label: "EW Threat", description: "Electronic warfare threat level", weight: 40, visible: false, color: "#f43f5e" },
];

function GaugeViz({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} className="mx-auto">
      {/* Background arc */}
      <path
        d={`M 4 ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 4} ${size / 2 + 4}`}
        fill="none"
        stroke="hsl(220, 15%, 12%)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d={`M 4 ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 4} ${size / 2 + 4}`}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-300"
        style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
      />
      {/* Value text */}
      <text x={size / 2} y={size / 2} textAnchor="middle" className="text-[11px] font-mono font-bold fill-foreground">{value}</text>
    </svg>
  );
}

export const AIMetricsPrioritizer = ({ onClose, onOptimized, onApproveAndZoom }: AIMetricsPrioritizerProps) => {
  const [metrics, setMetrics] = useState<MetricConfig[]>(DEFAULT_METRICS);
  const [showAll, setShowAll] = useState(false);
  const [continuousOptimization, setContinuousOptimization] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const visibleMetrics = showAll ? metrics : metrics.filter(m => m.visible);

  const updateWeight = (id: string, delta: number) => {
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, weight: Math.max(0, Math.min(100, m.weight + delta)) } : m));
  };

  const toggleMetricVisibility = (id: string) => {
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, visible: !m.visible } : m));
  };

  const removeMetric = (id: string) => {
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, visible: false } : m));
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const weights: Record<string, number> = {};
      metrics.filter(m => m.visible).forEach(m => { weights[m.id] = m.weight; });

      const { data, error } = await supabase.functions.invoke("sensor-to-shooter", {
        body: { action: "optimize_match", weights },
      });

      if (!error && data?.ranked_recommendations) {
        setResults(data.ranked_recommendations);
        toast.success(`✅ ${data.ranked_recommendations.length} recommendations re-ranked`);
        onOptimized?.(data);
      } else {
        toast.error("Optimization failed — check pending recommendations");
      }
    } catch {
      toast.error("Failed to reach S2S engine");
    }
    setOptimizing(false);
  };

  const handleApproveTop = () => {
    if (results?.[0]) {
      const rec = results[0];
      const lat = rec.target_lat || 33.0;
      const lng = rec.target_lng || 44.0;
      onApproveAndZoom?.(lat, lng);
      toast.success("🎯 Approved — zooming to engagement area");
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[700px] max-w-[95vw] max-h-[85vh] bg-[hsl(220,20%,6%)] border border-border/40 rounded-lg shadow-2xl flex flex-col overflow-hidden" style={{ boxShadow: "0 0 60px hsl(190,80%,30%,0.08)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/30">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-xs font-bold font-mono tracking-[0.15em] text-foreground">CHOOSE WHICH METRICS AI SHOULD PRIORITIZE</h2>
            <p className="text-[8px] font-mono text-muted-foreground mt-0.5">Adjust weights to influence the S2S recommender scoring</p>
          </div>
          <button onClick={onClose} className="ml-auto w-7 h-7 flex items-center justify-center rounded border border-border/30 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {visibleMetrics.map(metric => (
              <div key={metric.id} className="relative bg-[hsl(220,15%,8%)] border border-border/20 rounded-lg p-3 hover:border-primary/20 transition-colors group">
                {/* Remove button */}
                <button
                  onClick={() => removeMetric(metric.id)}
                  className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>

                {/* Gauge */}
                <GaugeViz value={metric.weight} color={metric.color} size={80} />

                {/* Label */}
                <div className="text-center mt-1">
                  <div className="text-[9px] font-mono font-bold text-foreground">{metric.label}</div>
                  <div className="text-[7px] font-mono text-muted-foreground mt-0.5 leading-tight">{metric.description}</div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => updateWeight(metric.id, -5)}
                    className="w-6 h-6 flex items-center justify-center rounded border border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-foreground w-8 text-center">{metric.weight}</span>
                  <button
                    onClick={() => updateWeight(metric.id, 5)}
                    className="w-6 h-6 flex items-center justify-center rounded border border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Show all toggle */}
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-3 w-full py-2 text-[9px] font-mono text-primary/70 hover:text-primary border border-dashed border-border/20 rounded transition-colors"
          >
            {showAll ? "Show fewer metrics" : `Show all metrics (${metrics.length - metrics.filter(m => m.visible).length} hidden)`}
          </button>

          {/* Results */}
          {results && results.length > 0 && (
            <div className="mt-4 border border-primary/20 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-primary/5 border-b border-primary/10">
                <span className="text-[9px] font-mono font-bold text-primary">OPTIMIZED RECOMMENDATIONS</span>
              </div>
              <div className="divide-y divide-border/10">
                {results.slice(0, 5).map((rec: any, i: number) => (
                  <div key={rec.id || i} className="flex items-center gap-3 px-3 py-2 hover:bg-primary/5 transition-colors">
                    <span className="text-[10px] font-mono font-bold text-primary w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-mono text-foreground">{rec.callsign || rec.shooter_callsign} → {rec.recommended_weapon}</div>
                      <div className="text-[7px] font-mono text-muted-foreground">{rec.distance_km?.toFixed(1)}km • TTT {rec.time_to_target_min?.toFixed(1)}min • Pk {((rec.probability_of_kill || 0) * 100).toFixed(0)}%</div>
                    </div>
                    <span className="text-[8px] font-mono font-bold" style={{ color: rec.weighted_score > 0.7 ? "#22c55e" : rec.weighted_score > 0.4 ? "#eab308" : "#ef4444" }}>
                      {((rec.weighted_score || 0) * 100).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
              {results.length > 0 && (
                <div className="px-3 py-2 border-t border-primary/10">
                  <button
                    onClick={handleApproveTop}
                    className="w-full py-2 rounded text-[10px] font-mono font-bold bg-[#22c55e]/20 border border-[#22c55e]/40 text-[#22c55e] hover:bg-[#22c55e]/30 transition-colors"
                  >
                    ✓ APPROVE TOP RECOMMENDATION & ZOOM TO TARGET
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-border/30 bg-[hsl(220,20%,5%)]">
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="flex items-center gap-2 px-4 py-2 rounded text-[10px] font-mono font-bold bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
          >
            {optimizing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5" />}
            {optimizing ? "OPTIMIZING..." : "OPTIMIZE RECOMMENDER"}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[8px] font-mono text-muted-foreground">Continuous Optimization</span>
            <button
              onClick={() => setContinuousOptimization(!continuousOptimization)}
              className="text-primary"
            >
              {continuousOptimization ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
