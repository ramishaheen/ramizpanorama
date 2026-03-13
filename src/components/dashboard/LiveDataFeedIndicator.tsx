import { useState, useEffect } from "react";
import { Activity } from "lucide-react";

interface Props {
  lastPollAt: string | null;
  activeSources: number;
  dataFresh: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

export function LiveDataFeedIndicator({ lastPollAt, activeSources, dataFresh }: Props) {
  const [, setTick] = useState(0);

  // Re-render every 5s to keep time-ago fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute bottom-3 left-3 z-[1000] pointer-events-auto">
      <div className="flex items-center gap-2 bg-background/85 backdrop-blur-sm border border-border/50 rounded-md px-3 py-1.5 shadow-lg">
        {/* Pulse dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              dataFresh ? "animate-ping bg-green-400" : "bg-muted-foreground/50"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              lastPollAt ? "bg-green-500" : "bg-muted-foreground"
            }`}
          />
        </span>

        <Activity className="h-3 w-3 text-muted-foreground" />

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span className="text-foreground font-semibold">{activeSources}</span>
          <span>sources</span>
          <span className="text-border">│</span>
          <span>
            {lastPollAt ? timeAgo(lastPollAt) : "waiting…"}
          </span>
        </div>
      </div>
    </div>
  );
}
