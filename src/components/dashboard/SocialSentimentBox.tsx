import { useState } from "react";
import { MessageSquareShare, Radar, CircleDot } from "lucide-react";
import { SocialSentimentModal } from "./SocialSentimentModal";

const platforms = [
  { label: "X / Twitter", short: "X", color: "hsl(var(--foreground))" },
  { label: "Reddit", short: "RDT", color: "hsl(25 100% 50%)" },
  { label: "YouTube", short: "YT", color: "hsl(0 80% 55%)" },
  { label: "Telegram", short: "TG", color: "hsl(200 80% 55%)" },
];

export const SocialSentimentBox = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="h-full flex flex-col bg-card/80 backdrop-blur-sm relative overflow-hidden">
        {/* Scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 3px)",
          }}
        />

        {/* Header */}
        <div className="px-3 py-2 flex items-center justify-between border-b border-border/50 bg-background/60 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-primary font-bold text-sm leading-none">▎</span>
            <MessageSquareShare className="h-3 w-3 text-primary" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground font-mono">
              Social Harvesting
            </span>
          </div>
          <span className="text-[7px] text-primary font-mono uppercase tracking-wider">OSINT</span>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-3 gap-3 relative z-10">
          {/* Platform grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {platforms.map((p) => (
              <div
                key={p.short}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-none border border-border/40 bg-background/40"
              >
                <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                <span className="font-mono text-[9px] font-bold text-foreground/80 truncate">{p.label}</span>
                <span className="ml-auto font-mono text-[7px] text-muted-foreground/50">{p.short}</span>
              </div>
            ))}
          </div>

          {/* Status line */}
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[7px] text-muted-foreground/50 uppercase tracking-wider">
              4 sources ready
            </span>
            <div className="flex items-center gap-1">
              <CircleDot className="h-2.5 w-2.5 text-success" />
              <span className="font-mono text-[7px] text-success uppercase">Online</span>
            </div>
          </div>

          {/* Harvest button */}
          <button
            onClick={() => setModalOpen(true)}
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-none border border-primary/40 bg-primary/5 hover:bg-primary/15 hover:border-primary/70 transition-all duration-200 group"
            style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.08)" }}
          >
            <Radar className="h-3.5 w-3.5 text-primary group-hover:animate-spin" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
              Harvest
            </span>
          </button>

          {/* Footer hint */}
          <span className="font-mono text-[7px] text-muted-foreground/30 text-center">
            Analyze sentiment by country & topic
          </span>
        </div>
      </div>

      <SocialSentimentModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
