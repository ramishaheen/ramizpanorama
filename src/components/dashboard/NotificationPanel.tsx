import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Plane, Ship, Globe, Shield, X } from "lucide-react";
import type { GeoAlert } from "@/data/mockData";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

interface NotificationPanelProps {
  alerts: GeoAlert[];
}

const typeIcons: Record<GeoAlert["type"], React.ReactNode> = {
  MILITARY: <Shield className="h-3 w-3" />,
  DIPLOMATIC: <Globe className="h-3 w-3" />,
  ECONOMIC: <AlertTriangle className="h-3 w-3" />,
  HUMANITARIAN: <AlertTriangle className="h-3 w-3" />,
};

const severityDot: Record<GeoAlert["severity"], string> = {
  low: "bg-success",
  medium: "bg-primary",
  high: "bg-warning",
  critical: "bg-critical",
};

const severityBorder: Record<GeoAlert["severity"], string> = {
  low: "border-l-success",
  medium: "border-l-primary",
  high: "border-l-warning",
  critical: "border-l-critical",
};

const severityText: Record<GeoAlert["severity"], string> = {
  low: "text-success",
  medium: "text-primary",
  high: "text-warning",
  critical: "text-critical",
};

export const NotificationPanel = ({ alerts }: NotificationPanelProps) => {
  const [selectedAlert, setSelectedAlert] = useState<GeoAlert | null>(null);
  const { t, isArabic } = useLanguage();

  const locale = isArabic ? 'ar-SA' : 'en-US';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedAlert(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sorted = [...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 maven-glass-heavy">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <div className="h-3 w-0.5 bg-destructive rounded-full" />
            {t(tr["section.intel_feed"].en, tr["section.intel_feed"].ar)}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-[8px] text-success font-mono font-bold uppercase">{t(tr["section.live"].en, tr["section.live"].ar)}</span>
            <span className="text-[7px] font-mono text-muted-foreground/40 border border-border/20 px-1">{sorted.length}</span>
          </div>
        </div>

        <div className="overflow-y-auto min-h-0 intel-feed-scroll" style={{ maxHeight: "200px" }}>
          <div className="p-1.5 space-y-0.5">
            <AnimatePresence>
              {sorted.map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                  onClick={() => setSelectedAlert(alert)}
                  className={`border-l-2 ${severityBorder[alert.severity]} px-2 py-1.5 cursor-pointer transition-all duration-150 hover:bg-primary/5 hover:translate-x-0.5 ${
                    alert.severity === 'critical' ? 'maven-breathe-critical bg-critical/3' : 'bg-card/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${severityDot[alert.severity]} ${alert.severity === 'critical' ? 'animate-pulse' : ''}`} />
                    <div className={`flex-shrink-0 ${severityText[alert.severity]}`}>
                      {typeIcons[alert.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`text-[8px] font-mono uppercase tracking-wider font-bold ${severityText[alert.severity]}`}>
                          {alert.type}
                        </span>
                        <span className="text-[7px] text-muted-foreground/50 font-mono">
                          {alert.region}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-foreground leading-tight truncate">
                        {alert.title}
                      </p>
                    </div>
                    <span className="text-[7px] text-muted-foreground/40 font-mono flex-shrink-0 tabular-nums">
                      {new Date(alert.timestamp).toLocaleTimeString(locale, { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Alert detail popup */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedAlert(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative w-[420px] max-w-[90vw] bg-card border border-border rounded-lg shadow-2xl overflow-hidden border-l-4 ${severityBorder[selectedAlert.severity]}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80">
                <div className="flex items-center gap-2">
                  <div className={severityText[selectedAlert.severity]}>
                    {typeIcons[selectedAlert.type]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono uppercase tracking-wider font-bold ${severityText[selectedAlert.severity]}`}>
                        {selectedAlert.type}
                      </span>
                      <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${severityDot[selectedAlert.severity]} text-white`}>
                        {selectedAlert.severity}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{selectedAlert.region}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="p-1 rounded hover:bg-destructive/20 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                <h2 className="text-sm font-semibold text-foreground leading-snug">
                  {selectedAlert.title}
                </h2>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {selectedAlert.summary}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-[9px] text-muted-foreground/70 font-mono">
                    {t(tr["notif.source"].en, tr["notif.source"].ar)}: {selectedAlert.source}
                  </span>
                  <span className="text-[9px] text-muted-foreground/70 font-mono">
                    {new Date(selectedAlert.timestamp).toLocaleString(locale, {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <div className="text-[9px] text-muted-foreground/50 font-mono">
                  {t(tr["notif.coords"].en, tr["notif.coords"].ar)}: {selectedAlert.lat.toFixed(4)}°N, {selectedAlert.lng.toFixed(4)}°E
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
