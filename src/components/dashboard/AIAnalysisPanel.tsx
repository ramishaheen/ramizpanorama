import { useState } from "react";
import {
  X, Brain, Users, Car, Flame, Wind, AlertTriangle, Eye,
  Activity, BarChart3, TrendingUp, Clock, Shield, Zap,
  Camera, MapPin, RefreshCw
} from "lucide-react";
import type { AnalysisResult, CCTVEvent } from "@/hooks/useCCTVIntel";

interface AIAnalysisPanelProps {
  analysis: AnalysisResult | null;
  analyzing: string | null;
  events: CCTVEvent[];
  onClose: () => void;
  onAnalyze: (cameraId: string) => void;
  selectedCameraId?: string;
}

const severityColor: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
};

const eventTypeIcon: Record<string, any> = {
  person_detected: Users,
  vehicle_detected: Car,
  crowd_detected: Users,
  fire_detected: Flame,
  smoke_detected: Wind,
  traffic_congestion: Car,
  abnormal_activity: AlertTriangle,
  normal: Eye,
};

export function AIAnalysisPanel({ analysis, analyzing, events, onClose, onAnalyze, selectedCameraId }: AIAnalysisPanelProps) {
  const [tab, setTab] = useState<"analysis" | "events">("analysis");

  return (
    <div className="flex flex-col h-full" style={{ background: "#0a0f18" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(168,85,247,0.15)" }}>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-purple-300">AI INTELLIGENCE</span>
        </div>
        <div className="flex items-center gap-1">
          {selectedCameraId && (
            <button
              onClick={() => onAnalyze(selectedCameraId)}
              disabled={!!analyzing}
              className="px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 text-purple-300 hover:bg-purple-500/20 transition-all"
              style={{ border: "1px solid rgba(168,85,247,0.3)" }}
            >
              {analyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {analyzing ? "ANALYZING..." : "ANALYZE"}
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5">
            <X className="h-3 w-3 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "rgba(168,85,247,0.1)" }}>
        {(["analysis", "events"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider transition-all ${tab === t ? "text-purple-300" : "text-gray-600 hover:text-gray-400"}`}
            style={tab === t ? { borderBottom: "2px solid rgba(168,85,247,0.6)", background: "rgba(168,85,247,0.05)" } : {}}
          >
            {t === "analysis" ? "AI ANALYSIS" : `EVENTS (${events.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto cctv-scrollbar p-2">
        {tab === "analysis" && (
          <>
            {analyzing && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="relative">
                  <Brain className="h-8 w-8 text-purple-400 animate-pulse" />
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "rgba(168,85,247,0.3)" }} />
                </div>
                <span className="text-[10px] text-purple-400 font-mono">ANALYZING FEED...</span>
                <span className="text-[8px] text-gray-600 font-mono">AI Computer Vision Processing</span>
              </div>
            )}

            {!analyzing && !analysis && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <Eye className="h-8 w-8 text-gray-700" />
                <span className="text-[10px] text-gray-500 font-mono">SELECT A CAMERA AND CLICK ANALYZE</span>
                <span className="text-[8px] text-gray-700 font-mono">AI will detect people, vehicles, fire, smoke & abnormal activity</span>
              </div>
            )}

            {!analyzing && analysis && (
              <div className="space-y-2">
                {/* Summary */}
                <div className="rounded-lg p-2.5" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Shield className="h-3 w-3 text-purple-400" />
                    <span className="text-[8px] tracking-[0.15em] text-purple-400/70">SCENE ASSESSMENT</span>
                  </div>
                  <p className="text-[10px] text-gray-200 leading-relaxed">{analysis.analysis.summary}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{
                      color: severityColor[analysis.analysis.overall_severity] || "#9ca3af",
                      background: `${severityColor[analysis.analysis.overall_severity] || "#9ca3af"}15`,
                      border: `1px solid ${severityColor[analysis.analysis.overall_severity] || "#9ca3af"}40`,
                    }}>
                      {analysis.analysis.overall_severity?.toUpperCase()} THREAT
                    </span>
                    <span className="text-[8px] text-gray-500">{analysis.camera.city}, {analysis.camera.country}</span>
                  </div>
                </div>

                {/* Detections */}
                {analysis.analysis.detections?.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[8px] text-purple-400/60 tracking-[0.15em] px-1">DETECTIONS</div>
                    {analysis.analysis.detections.map((d, i) => {
                      const Icon = eventTypeIcon[`${d.type}_detected`] || Eye;
                      return (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.3)" }}>
                          <Icon className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-bold text-gray-200 capitalize">{d.type} × {d.count}</div>
                            <div className="text-[8px] text-gray-500 truncate">{d.description}</div>
                          </div>
                          <div className="text-[8px] font-mono font-bold" style={{ color: d.confidence > 0.8 ? "#22c55e" : d.confidence > 0.5 ? "#f59e0b" : "#ef4444" }}>
                            {(d.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "CROWD", value: analysis.analysis.crowd_density, icon: Users },
                    { label: "TRAFFIC", value: analysis.analysis.traffic_level, icon: Car },
                    { label: "VISIBILITY", value: analysis.analysis.visibility, icon: Eye },
                    { label: "EVENT", value: analysis.analysis.event_type, icon: Activity },
                  ].map(m => (
                    <div key={m.label} className="rounded p-2 text-center" style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.3)" }}>
                      <m.icon className="h-3 w-3 text-purple-400/60 mx-auto mb-1" />
                      <div className="text-[7px] text-gray-600 tracking-wider">{m.label}</div>
                      <div className="text-[9px] font-bold text-gray-300 capitalize">{m.value || "—"}</div>
                    </div>
                  ))}
                </div>

                {/* Abnormal */}
                {analysis.analysis.abnormal_activity && (
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <span className="text-[9px] font-bold text-red-400">ABNORMAL ACTIVITY DETECTED</span>
                    </div>
                    <p className="text-[9px] text-red-300/80 mt-1">{analysis.analysis.abnormal_description}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "events" && (
          <div className="space-y-1">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <span className="text-[10px] text-gray-600 font-mono">NO EVENTS RECORDED</span>
              </div>
            ) : (
              events.map(ev => {
                const Icon = eventTypeIcon[ev.event_type] || Eye;
                const sColor = severityColor[ev.severity] || "#9ca3af";
                return (
                  <div key={ev.id} className="flex items-start gap-2 px-2 py-1.5 rounded transition-all hover:bg-white/[0.02]"
                    style={{ background: "#0d1320", border: "1px solid rgba(55,65,81,0.2)" }}>
                    <div className="mt-0.5 p-1 rounded" style={{ background: `${sColor}15` }}>
                      <Icon className="h-3 w-3" style={{ color: sColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-gray-200 capitalize">{ev.event_type.replace(/_/g, " ")}</span>
                        <span className="text-[7px] px-1 rounded font-bold" style={{ color: sColor, background: `${sColor}15`, border: `1px solid ${sColor}30` }}>
                          {ev.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[8px] text-gray-500 truncate mt-0.5">{ev.summary}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[7px] text-gray-600 flex items-center gap-0.5">
                          <Clock className="h-2 w-2" /> {new Date(ev.created_at).toLocaleString()}
                        </span>
                        <span className="text-[7px] text-gray-600 flex items-center gap-0.5">
                          <MapPin className="h-2 w-2" /> {ev.lat.toFixed(2)}, {ev.lng.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[8px] font-mono font-bold text-purple-400/60">{(ev.confidence * 100).toFixed(0)}%</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
