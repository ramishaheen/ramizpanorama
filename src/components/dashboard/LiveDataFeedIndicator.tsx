import { useState, useEffect } from "react";


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

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
            dataFresh ? "animate-ping bg-green-400" : "bg-muted-foreground/50"
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            lastPollAt ? "bg-green-500" : "bg-muted-foreground"
          }`}
        />
      </span>
      <span className="text-[10px] font-mono text-muted-foreground">
        <span className="text-foreground font-semibold">{activeSources}</span> src
      </span>
      <span className="text-[10px] font-mono text-muted-foreground">
        {lastPollAt ? timeAgo(lastPollAt) : "…"}
      </span>
    </div>
  );
}
