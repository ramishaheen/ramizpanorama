import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

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
];

export const LiveNewsFeed = () => {
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [muted, setMuted] = useState(true);

  return (
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

      <div className="grid grid-cols-3 gap-1">
        {channels.map((ch, i) => (
          <div key={ch.id} className={`relative rounded overflow-hidden border bg-background ${
            selectedChannel === i ? "border-primary" : "border-border"
          }`}>
            <button
              onClick={() => setSelectedChannel(i)}
              className="absolute top-0 left-0 right-0 z-10 px-1.5 py-0.5 bg-background/80 backdrop-blur-sm text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <span className={`h-1 w-1 rounded-full ${selectedChannel === i ? "bg-critical animate-pulse" : "bg-muted-foreground"}`} />
              {ch.name}
            </button>
            <div className="aspect-video">
              <iframe
                key={`${ch.id}-${selectedChannel === i ? muted : true}`}
                src={`https://www.youtube.com/embed/${ch.id}?autoplay=1&mute=${selectedChannel === i && !muted ? 0 : 1}`}
                title={ch.name}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
