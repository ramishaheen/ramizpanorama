import { useState } from "react";
import { Volume2, VolumeX, X, Play, Radio } from "lucide-react";

const channels = [
  { id: "9Auq9mYxFEe", name: "Sky News" },
  { id: "gCNeDWCI0vo", name: "Al Jazeera" },
  { id: "0PJ2Sj4PVpg", name: "France 24" },
  { id: "w_Ma8oQLmSM", name: "BBC News" },
  { id: "XWq5kBlakcQ", name: "TRT World" },
  { id: "_C8-9TS-2gk", name: "CNN-News18" },
  { id: "0UrpSCv6A1Y", name: "WION" },
  { id: "pqabxBKzZ6M", name: "DW News" },
  { id: "seVDbrCyEt8", name: "i24 News" },
  { id: "V1SZGB5oZeM", name: "Press TV (Iran)" },
  { id: "jNhh-OLzWlE", name: "i24 Israel" },
  { id: "dp8PhLsUcFE", name: "NBC News (USA)" },
  { id: "bGkMOg1Ov7I", name: "RT News (Russia)" },
  // Arabic News Channels
  { id: "uPh_v39Cbow", name: "الجزيرة مباشر" },
  { id: "NvuZuk9HWIQ", name: "العربية" },
  { id: "yd_H1PwIB0E", name: "سكاي نيوز عربية" },
  { id: "jJqcFN-hjGg", name: "العربية Live" },
  { id: "UCB3algFg6U", name: "France 24 عربي" },
  { id: "dsivequqb-Q", name: "BBC عربي" },
  { id: "vBOG85PlrTw", name: "DW عربية" },
];

export const LiveNewsFeed = () => {
  const [muted, setMuted] = useState(true);
  const [activeChannel, setActiveChannel] = useState<number>(0);
  const [expandedChannel, setExpandedChannel] = useState<number | null>(null);

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-critical animate-pulse" />
            Live News Feeds
          </h4>
          <button
            onClick={() => setMuted(!muted)}
            className="p-1 rounded hover:bg-secondary/60 transition-colors"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Volume2 className="h-3 w-3 text-primary" />
            )}
          </button>
        </div>

        {/* Active player - only one iframe at a time */}
        <div className="relative rounded overflow-hidden border border-border bg-background mb-2">
          <div className="absolute top-0 left-0 right-0 z-10 px-2 py-1 bg-background/80 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-critical animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-foreground">{channels[activeChannel].name}</span>
              <span className="text-[8px] font-mono text-primary uppercase">LIVE</span>
            </div>
            <button
              onClick={() => setExpandedChannel(activeChannel)}
              className="text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors uppercase"
            >
              Fullscreen
            </button>
          </div>
          <div className="aspect-video">
            <iframe
              key={`player-${channels[activeChannel].id}-${muted}`}
              src={`https://www.youtube.com/embed/${channels[activeChannel].id}?autoplay=1&mute=${muted ? 1 : 0}`}
              title={channels[activeChannel].name}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        </div>

        {/* Channel selector - thumbnails, no iframes */}
        <div className="grid grid-cols-4 gap-1">
          {channels.map((ch, i) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(i)}
              className={`relative rounded overflow-hidden border transition-all text-left ${
                activeChannel === i
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <div className="aspect-video bg-background relative">
                <img
                  src={`https://img.youtube.com/vi/${ch.id}/mqdefault.jpg`}
                  alt={ch.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {activeChannel === i ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                    <Radio className="h-3 w-3 text-primary animate-pulse" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30 opacity-0 hover:opacity-100 transition-opacity">
                    <Play className="h-3 w-3 text-foreground" />
                  </div>
                )}
              </div>
              <div className="px-1 py-0.5 bg-background/90 flex items-center gap-1">
                {activeChannel === i && (
                  <span className="h-1 w-1 rounded-full bg-critical animate-pulse flex-shrink-0" />
                )}
                <span className="text-[7px] font-mono text-muted-foreground truncate">{ch.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Expanded channel overlay */}
      {expandedChannel !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-[85vw] max-w-[1100px] bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-critical animate-pulse" />
                <span className="font-mono text-sm font-bold text-foreground">
                  {channels[expandedChannel].name}
                </span>
                <span className="font-mono text-[10px] text-primary uppercase">LIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMuted(!muted)}
                  className="p-1.5 rounded hover:bg-secondary/60 transition-colors"
                >
                  {muted ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-primary" />
                  )}
                </button>
                <button
                  onClick={() => setExpandedChannel(null)}
                  className="p-1.5 rounded hover:bg-destructive/20 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>
            <div className="aspect-video">
              <iframe
                key={`expanded-${channels[expandedChannel].id}-${muted}`}
                src={`https://www.youtube.com/embed/${channels[expandedChannel].id}?autoplay=1&mute=${muted ? 1 : 0}`}
                title={channels[expandedChannel].name}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="flex gap-1 px-3 py-2 overflow-x-auto border-t border-border bg-background">
              {channels.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => setExpandedChannel(i)}
                  className={`flex-shrink-0 px-2 py-1 rounded font-mono text-[9px] transition-colors ${
                    expandedChannel === i
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
