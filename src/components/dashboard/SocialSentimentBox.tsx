import { useState } from "react";
import { MessageSquareShare } from "lucide-react";
import { SocialSentimentModal } from "./SocialSentimentModal";

export const SocialSentimentBox = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className="h-full flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm relative overflow-hidden cursor-pointer hover:bg-card/90 transition-colors duration-200"
      >
        {/* Scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 3px)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-2">
          <MessageSquareShare className="h-8 w-8 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground font-mono text-center">
            Social Media Harvesting
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">
            Click to analyze sentiment
          </span>
        </div>
      </div>

      <SocialSentimentModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
