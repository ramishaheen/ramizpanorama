import { useState } from "react";
import { MessageSquareShare } from "lucide-react";
import { SocialSentimentModal } from "./SocialSentimentModal";

export const SocialSentimentBox = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className="h-full flex flex-col items-center justify-center maven-glass-heavy relative overflow-hidden cursor-pointer group transition-all duration-200 hover:border-primary/20"
      >
        {/* Animated waveform background */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M0,50 Q25,20 50,50 Q75,80 100,50 Q125,20 150,50 Q175,80 200,50 Q225,20 250,50 Q275,80 300,50 Q325,20 350,50 Q375,80 400,50" 
              fill="none" stroke="hsl(192 95% 48%)" strokeWidth="1.5" className="animate-pulse" />
            <path d="M0,50 Q25,35 50,50 Q75,65 100,50 Q125,35 150,50 Q175,65 200,50 Q225,35 250,50 Q275,65 300,50 Q325,35 350,50 Q375,65 400,50" 
              fill="none" stroke="hsl(42 100% 50%)" strokeWidth="1" style={{ opacity: 0.5 }} />
          </svg>
        </div>

        {/* Tactical grid */}
        <div className="absolute inset-0 maven-grid-subtle opacity-30 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="relative">
            <MessageSquareShare className="h-8 w-8 text-primary group-hover:text-primary/90 transition-colors duration-200" />
            <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary/60 animate-ping" />
          </div>
          <div className="text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground font-mono block">
              Social Sentiment Engine
            </span>
            <span className="text-[8px] text-primary/60 font-mono uppercase tracking-wider mt-0.5 block">
              Waveform · Geo-Mapping · Narrative Detection
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {['With', 'Against', 'Neutral'].map((label, i) => (
              <span key={label} className={`text-[7px] font-mono px-1.5 py-0.5 border ${
                i === 0 ? 'text-success border-success/20 bg-success/5' :
                i === 1 ? 'text-critical border-critical/20 bg-critical/5' :
                'text-muted-foreground border-border/20 bg-muted/5'
              }`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <SocialSentimentModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
