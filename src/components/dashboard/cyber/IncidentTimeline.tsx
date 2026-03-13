import { useMemo } from "react";
import { Clock, AlertTriangle, Zap, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CyberThreat } from "@/hooks/useCyberThreats";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0 90% 55%)",
  high: "hsl(25 95% 55%)",
  medium: "hsl(45 95% 55%)",
  low: "hsl(190 80% 55%)",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-primary/20 text-primary border-primary/30",
};

interface IncidentTimelineProps {
  threats: CyberThreat[];
  onSelect: (t: CyberThreat) => void;
}

export function IncidentTimeline({ threats, onSelect }: IncidentTimelineProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, CyberThreat[]> = {};
    threats.forEach(t => {
      const date = t.date?.split("T")[0] || "Unknown";
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [threats]);

  const typeIcons: Record<string, string> = {
    "Ransomware": "💀",
    "DDoS Attack": "⚡",
    "Espionage": "🕵️",
    "Wiper Malware": "🔥",
    "Zero-Day Exploit": "🎯",
    "Phishing Campaign": "🎣",
    "Supply Chain": "🔗",
    "Critical Infrastructure": "🏭",
    "Information Operations": "📡",
    "Network Disruption": "🌐",
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "hsl(var(--background))" }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground">Cyber Incident Timeline</span>
        <span className="text-[8px] font-mono text-muted-foreground ml-auto">{threats.length} incidents</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {threats.length === 0 ? (
            <div className="text-center text-[10px] text-muted-foreground py-16 font-mono">Awaiting incident data...</div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-border" />

              {grouped.map(([date, events]) => (
                <div key={date} className="mb-6">
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3 relative">
                    <div className="h-6 w-6 rounded-full bg-card border-2 border-primary flex items-center justify-center z-10">
                      <Clock className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-primary">{date}</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{events.length} events</span>
                  </div>

                  {/* Events */}
                  <div className="ml-[11px] pl-6 border-l-2 border-border space-y-2">
                    {events.map(event => (
                      <button
                        key={event.id}
                        onClick={() => onSelect(event)}
                        className="w-full text-left p-3 rounded border border-border bg-card/50 hover:bg-card/80 hover:border-primary/30 transition-all relative"
                      >
                        {/* Connector dot */}
                        <div
                          className="absolute -left-[25px] top-4 h-2.5 w-2.5 rounded-full border-2"
                          style={{ backgroundColor: SEVERITY_COLORS[event.severity], borderColor: SEVERITY_COLORS[event.severity] }}
                        />

                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-sm">{typeIcons[event.type] || "🛡️"}</span>
                          <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${SEVERITY_BG[event.severity]}`}>{event.severity}</span>
                          <span className="text-[8px] font-mono text-muted-foreground">{event.type}</span>
                          {event.verified && <span className="text-[7px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 font-mono">✓ VERIFIED</span>}
                        </div>

                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{event.attackerFlag}</span>
                          <span className="text-[10px] font-bold text-foreground">{event.attacker}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{event.targetFlag}</span>
                          <span className="text-[10px] text-foreground">{event.target}</span>
                        </div>

                        <p className="text-[9px] text-muted-foreground line-clamp-2">{event.description}</p>

                        {event.cve && (
                          <span className="text-[7px] mt-1 inline-block px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-mono">{event.cve}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
