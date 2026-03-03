import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Plane, Ship, Globe, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GeoAlert } from "@/data/mockData";

interface NotificationPanelProps {
  alerts: GeoAlert[];
}

const typeIcons: Record<GeoAlert["type"], React.ReactNode> = {
  MILITARY: <Shield className="h-3.5 w-3.5" />,
  DIPLOMATIC: <Globe className="h-3.5 w-3.5" />,
  ECONOMIC: <AlertTriangle className="h-3.5 w-3.5" />,
  HUMANITARIAN: <AlertTriangle className="h-3.5 w-3.5" />,
};

const severityStyles: Record<GeoAlert["severity"], string> = {
  low: "border-l-success text-success",
  medium: "border-l-primary text-primary",
  high: "border-l-warning text-warning",
  critical: "border-l-critical text-critical",
};

export const NotificationPanel = ({ alerts }: NotificationPanelProps) => {
  const sorted = [...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Intel Feed
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] text-muted-foreground font-mono">LIVE</span>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          <AnimatePresence>
            {sorted.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`border-l-2 ${severityStyles[alert.severity]} bg-card/50 rounded-r-md p-3 cursor-pointer hover:bg-secondary/50 transition-colors`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{typeIcons[alert.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                        {alert.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {alert.region}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground leading-tight mb-1 line-clamp-2">
                      {alert.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {alert.summary}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {alert.source}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
};
