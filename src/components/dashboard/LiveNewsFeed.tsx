import { useState, useCallback, useRef } from "react";
import { Volume2, VolumeX, X, Play, Radio, RefreshCw } from "lucide-react";

// Using YouTube channel IDs — the embed auto-resolves to the current live stream
const channels = [
  // English
  { channelId: "UCoMdktPbSTixAyNGwb-UYkQ", name: "Sky News" },
  { channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg", name: "Al Jazeera EN" },
  { channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg", name: "France 24 EN" },
  { channelId: "UC16niRr50-MSBwiO3YDb3RA", name: "BBC News" },
  { channelId: "UC7fWeaHhqgM4Lba7TTRFDKA", name: "TRT World" },
  { channelId: "UCef1-8eOpJgud7szVPlZQAQ", name: "CNN-News18" },
  { channelId: "UC_gUM8rL-Lrg6O3adPW9K1g", name: "WION" },
  { channelId: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News" },
  { channelId: "UCJg9wBPyKMNA5sRDnvzmkdg", name: "i24 News EN" },
  { channelId: "UCUrHMEQjdPvOYgzVOmCCSbw", name: "Press TV" },
  { channelId: "UCBi2mrWuNuyYy4gbM6fU18Q", name: "NBC News" },
  // Arabic
  { channelId: "UCfiwzLy-8yKzIbsmZTzxDgw", name: "الجزيرة مباشر" },
  { channelId: "UCYMAnZ1rFgaPS6PaJ4PMiIA", name: "العربية" },
  { channelId: "UCIJXOvggjKtCagMfxvcCzAA", name: "سكاي نيوز عربية" },
  { channelId: "UCddiUEpeqJcYeBxX1IVBKvQ", name: "RT عربي" },
  { channelId: "UCIwKT4JYoai2WidLzaRz1SA", name: "France 24 عربي" },
  { channelId: "UCj0bEC3L7cNZrZBXFLGjJRA", name: "BBC عربي" },
  { channelId: "UCHMr60HFkJO-qEUYHG8LTtA", name: "DW عربية" },
  { channelId: "UCLsE0EPaHMHRLYOCchOhYNg", name: "الحدث" },
];

const getEmbedUrl = (channelId: string, muted: boolean) =>
  `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=${muted ? 1 : 0}`;

const getThumbnailUrl = (channelId: string) =>
  `https://yt3.googleusercontent.com/channel/${channelId}`;

export const LiveNewsFeed = () => {
  const [muted, setMuted] = useState(true);
  const [activeChannel, setActiveChannel] = useState<number>(0);
  const [expandedChannel, setExpandedChannel] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const handleManualRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

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

        {/* Active player */}
        <div className="relative rounded overflow-hidden border border-border bg-background mb-2">
          <div className="absolute top-0 left-0 right-0 z-10 px-2 py-1 bg-background/80 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-critical animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-foreground">{channels[activeChannel].name}</span>
              <span className="text-[8px] font-mono text-primary uppercase">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpandedChannel(activeChannel)}
                className="text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors uppercase"
              >
                Fullscreen
              </button>
              <button
                onClick={handleManualRetry}
                className="p-0.5 rounded hover:bg-secondary/60 transition-colors"
                title="Retry stream"
              >
                <RefreshCw className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="aspect-video">
            <iframe
              key={`player-${channels[activeChannel].channelId}-${muted}-${retryKey}`}
              src={getEmbedUrl(channels[activeChannel].channelId, muted)}
              title={channels[activeChannel].name}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        </div>

        {/* Channel selector */}
        <div className="grid grid-cols-4 gap-1">
          {channels.map((ch, i) => (
            <button
              key={ch.channelId}
              onClick={() => setActiveChannel(i)}
              className={`relative rounded overflow-hidden border transition-all text-left ${
                activeChannel === i
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <div className="aspect-video bg-background relative flex items-center justify-center">
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
                key={`expanded-${channels[expandedChannel].channelId}-${muted}-${retryKey}`}
                src={getEmbedUrl(channels[expandedChannel].channelId, muted)}
                title={channels[expandedChannel].name}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="flex gap-1 px-3 py-2 overflow-x-auto border-t border-border bg-background">
              {channels.map((ch, i) => (
                <button
                  key={ch.channelId}
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
