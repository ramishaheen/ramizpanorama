import { useState, useCallback } from "react";
import { Volume2, VolumeX, X, Play, Radio, RefreshCw, ExternalLink } from "lucide-react";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

interface Channel {
  videoId: string; // YouTube video ID for the live stream
  channelId?: string; // YouTube channel ID (kept as backup reference)
  name: string;
  region: string;
  logo?: string;
  directUrl?: string; // fallback direct URL when YouTube embed fails
}

const channels: Channel[] = [
  // Middle East - Arabic
  { videoId: "bNyUyrR0PHo", channelId: "UCfiwzLy-8yKzIbsmZTzxDgw", name: "الجزيرة", region: "🇶🇦 Arabic", directUrl: "https://www.aljazeera.net/live" },
  { videoId: "NvuZuk9HWIQ", channelId: "UCYMAnZ1rFgaPS6PaJ4PMiIA", name: "العربية", region: "🇸🇦 Arabic", directUrl: "https://www.alarabiya.net/live-stream" },
  { videoId: "yd_H1PwIB0E", channelId: "UCIJXOvggjKtCagMfxvcCzAA", name: "سكاي نيوز عربية", region: "🇦🇪 Arabic", directUrl: "https://www.skynewsarabia.com/live-tv" },
  { videoId: "n7eQejkXbnM", channelId: "UCLsE0EPaHMHRLYOCchOhYNg", name: "الحدث", region: "🇸🇦 Arabic", directUrl: "https://www.alhadath.net/live-stream" },
  { videoId: "MtDYtXIPOtY", channelId: "UCj0bEC3L7cNZrZBXFLGjJRA", name: "BBC عربي", region: "🇬🇧 Arabic", directUrl: "https://www.bbc.com/arabic/live" },
  { videoId: "3ursYA8HMeo", channelId: "UCIwKT4JYoai2WidLzaRz1SA", name: "France 24 عربي", region: "🇫🇷 Arabic", directUrl: "https://www.france24.com/ar/%D8%A7%D9%84%D8%A8%D8%AB-%D8%A7%D9%84%D9%85%D8%A8%D8%A7%D8%B4%D8%B1" },
  { videoId: "AGkp2AL8e7o", channelId: "UCHMr60HFkJO-qEUYHG8LTtA", name: "DW عربية", region: "🇩🇪 Arabic", directUrl: "https://www.dw.com/ar/live-tv/channel-arabic" },
  { videoId: "tPMMTMYJVdg", channelId: "UCddiUEpeqJcYeBxX1IVBKvQ", name: "RT عربي", region: "🇷🇺 Arabic", directUrl: "https://arabic.rt.com/live/" },
  // Jordan
  { videoId: "7bsZR9_lnKA", channelId: "UC0jiFAzTgl17k7awGbuoYew", name: "المملكة", region: "🇯🇴 Jordan", directUrl: "https://www.almamlakatv.com/live" },
  // Iraq / Kurdish
  { videoId: "rTI9BoYHj4Y", channelId: "UCAUHoE2Ykw0sguyi5AjhrjQ", name: "Rudaw", region: "🇮🇶 Kurdistan", directUrl: "https://www.rudaw.net/english/onair/tv/live" },
  // Israel
  { videoId: "aVg6hG8lwQk", channelId: "UCJg9wBPyKMNA5sRDnvzmkdg", name: "i24 News EN", region: "🇮🇱 Israel", directUrl: "https://www.i24news.tv/en/live" },
  { videoId: "rTI9BoYHj4Y", channelId: "UCUrHMEQjdPvOYgzVOmCCSbw", name: "Press TV", region: "🇮🇷 Iran", directUrl: "https://www.presstv.ir/live" },
  // English - International
  { videoId: "SgftwJdAA3M", channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg", name: "Al Jazeera EN", region: "🇶🇦 English", directUrl: "https://www.aljazeera.com/live" },
  { videoId: "U--OjmpjF5o", channelId: "UCoMdktPbSTixAyNGwb-UYkQ", name: "Sky News", region: "🇬🇧 English", directUrl: "https://news.sky.com/watch-live" },
  { videoId: "MtDYtXIPOtY", channelId: "UC16niRr50-MSBwiO3YDb3RA", name: "BBC News", region: "🇬🇧 English", directUrl: "https://www.bbc.com/news/live" },
  { videoId: "3ursYA8HMeo", channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg", name: "France 24 EN", region: "🇫🇷 English", directUrl: "https://www.france24.com/en/live" },
  { videoId: "66LVIaUxaFk", channelId: "UC7fWeaHhqgM4Lba7TTRFDKA", name: "TRT World", region: "🇹🇷 English", directUrl: "https://www.trtworld.com/live" },
  { videoId: "AGkp2AL8e7o", channelId: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News", region: "🇩🇪 English", directUrl: "https://www.dw.com/en/live-tv/channel-english" },
  // USA
  { videoId: "rTI9BoYHj4Y", channelId: "UCRrW0ddrbFnJCbyZqHHv4KQ", name: "CNN", region: "🇺🇸 USA", directUrl: "https://edition.cnn.com/live-tv" },
  { videoId: "rTI9BoYHj4Y", channelId: "UCBi2mrWuNuyYy4gbM6fU18Q", name: "NBC News", region: "🇺🇸 USA", directUrl: "https://www.nbcnews.com/now" },
  { videoId: "rTI9BoYHj4Y", channelId: "UCaXkIU1QidjPwiAYu6GcHjg", name: "MSNBC", region: "🇺🇸 USA", directUrl: "https://www.msnbc.com/live" },
  { videoId: "rTI9BoYHj4Y", channelId: "UCXIJgqnII2ZOINSWNOGFThA", name: "Fox News", region: "🇺🇸 USA", directUrl: "https://www.foxnews.com/video/5614615980001" },
  { videoId: "rTI9BoYHj4Y", channelId: "UCBnbGo_3PbO2AKkmCBPK0Xg", name: "ABC News", region: "🇺🇸 USA", directUrl: "https://abcnews.go.com/live" },
  { videoId: "rTI9BoYHj4Y", channelId: "UC8p1vwvWtl6T73JiExfWs1g", name: "CBS News", region: "🇺🇸 USA", directUrl: "https://www.cbsnews.com/live/" },
  // Asia
  { videoId: "rTI9BoYHj4Y", channelId: "UCef1-8eOpJgud7szVPlZQAQ", name: "CNN-News18", region: "🇮🇳 India" },
  { videoId: "rTI9BoYHj4Y", channelId: "UC_gUM8rL-Lrg6O3adPW9K1g", name: "WION", region: "🇮🇳 India" },
  { videoId: "rTI9BoYHj4Y", channelId: "UCZFMm1mMw0F81Z37aaEzTUA", name: "NDTV", region: "🇮🇳 India" },
  { videoId: "rTI9BoYHj4Y", channelId: "UCYPvAwZP8pZhSMhG76_le_g", name: "India Today", region: "🇮🇳 India" },
  { videoId: "rTI9BoYHj4Y", channelId: "UC2wKfjlioOCLP4xQMOJNzg0", name: "CGTN", region: "🇨🇳 China" },
  { videoId: "f0lYkdA-Gtw", channelId: "UC3Uo9-MNEkPr9DJH53xUWQA", name: "NHK World", region: "🇯🇵 Japan" },
  // Europe
  { videoId: "pykpO5kQJ98", channelId: "UCW2QcKZiU8aUGg4yxCIditg", name: "Euronews", region: "🇪🇺 Europe", directUrl: "https://www.euronews.com/live" },
];

const REGIONS = [...new Set(channels.map((c) => c.region))];

const getEmbedUrl = (channel: Channel, muted: boolean) => {
  return `https://www.youtube.com/embed/${channel.videoId}?autoplay=1&mute=${muted ? 1 : 0}&rel=0`;
};

const getDirectUrl = (channel: Channel) => channel.directUrl || null;

export const LiveNewsFeed = () => {
  const [muted, setMuted] = useState(true);
  const [activeChannel, setActiveChannel] = useState<number>(0);
  const [expandedChannel, setExpandedChannel] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleManualRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const filteredChannels = filterRegion
    ? channels.filter((c) => c.region === filterRegion)
    : channels;

  // Map filtered index back to global index
  const getGlobalIndex = (filteredIdx: number) =>
    channels.indexOf(filteredChannels[filteredIdx]);

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-critical animate-pulse" />
            {t(tr["section.news"].en, tr["section.news"].ar)} ({channels.length} {t(tr["news.channels"].en, tr["news.channels"].ar)})
          </h4>
          <div className="flex items-center gap-1">
            <button
              onClick={handleManualRetry}
              className="p-1 rounded hover:bg-secondary/60 transition-colors"
              title={t("Retry stream", "إعادة المحاولة")}
            >
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
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
        </div>

        {/* Active player */}
        <div className="relative rounded overflow-hidden border border-border bg-background mb-2">
          <div className="absolute top-0 left-0 right-0 z-10 px-2 py-1 bg-background/80 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-critical animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-foreground">{channels[activeChannel].name}</span>
              <span className="text-[8px] font-mono text-muted-foreground">{channels[activeChannel].region}</span>
              <span className="text-[8px] font-mono text-primary uppercase">{t(tr["section.live"].en, tr["section.live"].ar)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {getDirectUrl(channels[activeChannel]) && (
                <a
                  href={getDirectUrl(channels[activeChannel])!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors uppercase flex items-center gap-0.5"
                  title={t("Open direct stream", "فتح البث المباشر")}
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  {t("Direct", "مباشر")}
                </a>
              )}
              <button
                onClick={() => setExpandedChannel(activeChannel)}
                className="text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors uppercase"
              >
                {t(tr["action.expand"] ? tr["action.expand"].en : "Expand", tr["action.expand"] ? tr["action.expand"].ar : "توسيع")}
              </button>
            </div>
          </div>
          <div className="aspect-video">
            <iframe
              key={`player-${channels[activeChannel].videoId}-${muted}-${retryKey}`}
              src={getEmbedUrl(channels[activeChannel], muted)}
              title={channels[activeChannel].name}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        </div>

        {/* Region filter tabs */}
        <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border">
          <button
            onClick={() => setFilterRegion(null)}
            className={`flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-[7px] transition-colors ${
              filterRegion === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tr["news.all"].en, tr["news.all"].ar)} ({channels.length})
          </button>
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setFilterRegion(region)}
              className={`flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-[7px] transition-colors whitespace-nowrap ${
                filterRegion === region
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        {/* Channel selector - scrollable grid with thumbnails */}
        <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div className="grid grid-cols-4 gap-1">
            {filteredChannels.map((ch, i) => {
              const globalIdx = getGlobalIndex(i);
              return (
                <button
                  key={ch.channelId}
                  onClick={() => setActiveChannel(globalIdx)}
                  className={`relative rounded overflow-hidden border transition-all text-left ${
                    activeChannel === globalIdx
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    <img
                      src={`https://img.youtube.com/vi/${ch.videoId}/mqdefault.jpg`}
                      alt={ch.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground text-center px-0.5 leading-tight">
                        {ch.name}
                      </span>
                    </div>
                    {activeChannel === globalIdx ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <Radio className="h-3 w-3 text-primary animate-pulse" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/20 opacity-0 hover:opacity-100 transition-opacity">
                        <Play className="h-3 w-3 text-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="px-1 py-0.5 bg-background/90 flex items-center gap-1">
                    {activeChannel === globalIdx && (
                      <span className="h-1 w-1 rounded-full bg-critical animate-pulse flex-shrink-0" />
                    )}
                    <span className="text-[6px] font-mono text-muted-foreground truncate">{ch.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
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
                <span className="font-mono text-[10px] text-muted-foreground">
                  {channels[expandedChannel].region}
                </span>
                <span className="font-mono text-[10px] text-primary uppercase">{t(tr["section.live"].en, tr["section.live"].ar)}</span>
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
                key={`expanded-${channels[expandedChannel].videoId}-${muted}-${retryKey}`}
                src={getEmbedUrl(channels[expandedChannel], muted)}
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
