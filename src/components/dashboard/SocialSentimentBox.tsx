import { useState } from "react";
import { MessageSquareShare, Loader2 } from "lucide-react";
import { SocialSentimentModal } from "./SocialSentimentModal";

export const SocialSentimentBox = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className="h-full flex flex-col items-center justify-center cursor-pointer select-none group transition-colors hover:bg-secondary/30"
        onDoubleClick={() => setModalOpen(true)}
        title="Double-click to open Social Media Harvesting"
      >
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
            <MessageSquareShare className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground font-mono tracking-wide">SOCIAL MEDIA HARVESTING</h3>
          <p className="text-[10px] text-muted-foreground leading-tight max-w-[200px]">
            Double-click to analyze public social sentiment by country & topic
          </p>
          <div className="flex gap-1 mt-1">
            {["X", "Reddit", "YT", "TG"].map((p) => (
              <span key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{p}</span>
            ))}
          </div>
        </div>
      </div>

      <SocialSentimentModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
