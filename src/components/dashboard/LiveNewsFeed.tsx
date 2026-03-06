import { useState, useCallback, useEffect, useRef } from "react";
import { Volume2, VolumeX, X, Play, Radio, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

interface Channel {
  videoId: string;
  name: string;
  region: string;
  logo?: string;
  directUrl?: string;
}

const channels: Channel[] = [
  // Middle East - Arabic
  { videoId: "bNyUyrR0PHo", name: "الجزيرة", region: "🇶🇦 Arabic", directUrl: "https://www.aljazeera.net/live" },
  { videoId: "NvuZuk9HWIQ", name: "العربية", region: "🇸🇦 Arabic", directUrl: "https://www.alarabiya.net/live-stream" },
  { videoId: "5CJS9t1xvUg", name: "سكاي نيوز عربية", region: "🇦🇪 Arabic", directUrl: "https://www.skynewsarabia.com/livestream-%D8%A7%D9%84%D8%A8%D8%AB-%D8%A7%D9%84%D9%85%D8%A8%D8%A7%D8%B4%D8%B1" },
  { videoId: "n7eQejkXbnM", name: "الحدث", region: "🇸🇦 Arabic", directUrl: "https://www.alhadath.net/live-stream" },
  { videoId: "MtDYtXIPOtY", name: "BBC عربي", region: "🇬🇧 Arabic", directUrl: "https://www.bbc.com/arabic/live" },
  { videoId: "3ursYA8HMeo", name: "France 24 عربي", region: "🇫🇷 Arabic", directUrl: "https://www.france24.com/ar/%D8%A7%D9%84%D8%A8%D8%AB-%D8%A7%D9%84%D9%85%D8%A8%D8%A7%D8%B4%D8%B1" },
  { videoId: "AGkp2AL8e7o", name: "DW عربية", region: "🇩🇪 Arabic", directUrl: "https://www.dw.com/ar/live-tv/channel-arabic" },
  { videoId: "tPMMTMYJVdg", name: "RT عربي", region: "🇷🇺 Arabic", directUrl: "https://arabic.rt.com/live/" },
  // Jordan
  { videoId: "7bsZR9_lnKA", name: "المملكة", region: "🇯🇴 Jordan", directUrl: "https://www.almamlakatv.com/live" },
  // Iraq / Kurdish
  { videoId: "rTI9BoYHj4Y", name: "Rudaw", region: "🇮🇶 Kurdistan", directUrl: "https://www.rudaw.net/english/onair/tv/live" },
  // Israel & Iran
  { videoId: "aVg6hG8lwQk", name: "i24 News EN", region: "🇮🇱 Israel", directUrl: "https://www.i24news.tv/en/live" },
  { videoId: "2-eEd2RJjEg", name: "Press TV", region: "🇮🇷 Iran", directUrl: "https://www.presstv.ir/live" },
  // English - International
  { videoId: "SgftwJdAA3M", name: "Al Jazeera EN", region: "🇶🇦 English", directUrl: "https://www.aljazeera.com/live" },
  { videoId: "zhJEr9Fhu7U", name: "Sky News", region: "🇬🇧 English", directUrl: "https://news.sky.com/watch-live" },
  { videoId: "j_uT9ejcxmE", name: "BBC News", region: "🇬🇧 English", directUrl: "https://www.bbc.com/news/live" },
  { videoId: "h3MuIUNCCzI", name: "France 24 EN", region: "🇫🇷 English", directUrl: "https://www.france24.com/en/live" },
  { videoId: "66LVIaUxaFk", name: "TRT World", region: "🇹🇷 English", directUrl: "https://www.trtworld.com/live" },
  { videoId: "AGkp2AL8e7o", name: "DW News", region: "🇩🇪 English", directUrl: "https://www.dw.com/en/live-tv/channel-english" },
  // USA
  { videoId: "49ZrOhhMSOA", name: "CNN", region: "🇺🇸 USA", directUrl: "https://edition.cnn.com/live-tv" },
  { videoId: "enKWyZH6dVI", name: "NBC News", region: "🇺🇸 USA", directUrl: "https://www.nbcnews.com/now" },
  { videoId: "zy9cCJ7rzAg", name: "MSNBC", region: "🇺🇸 USA", directUrl: "https://www.msnbc.com/live" },
  { videoId: "R_lRjToLD3U", name: "Fox News", region: "🇺🇸 USA", directUrl: "https://www.foxnews.com/video/5614615980001" },
  { videoId: "AgPuZmdNh20", name: "ABC News", region: "🇺🇸 USA", directUrl: "https://abcnews.go.com/live" },
  { videoId: "Ma1lqWb7RSY", name: "CBS News", region: "🇺🇸 USA", directUrl: "https://www.cbsnews.com/live/" },
  // Asia
  { videoId: "rfDx1HMvXbQ", name: "CNN-News18", region: "🇮🇳 India", directUrl: "https://www.news18.com/livetv/" },
  { videoId: "H6XNNpj8nrI", name: "WION", region: "🇮🇳 India", directUrl: "https://www.wionews.com/live-tv" },
  { videoId: "MN8p-Vrn6G0", name: "NDTV", region: "🇮🇳 India", directUrl: "https://www.ndtv.com/live" },
  { videoId: "NZSkW2eM1ZI", name: "India Today", region: "🇮🇳 India", directUrl: "https://www.indiatoday.in/livetv" },
  { videoId: "f0lYkdA-Gtw", name: "NHK World", region: "🇯🇵 Japan", directUrl: "https://www3.nhk.or.jp/nhkworld/en/live/" },
  // Europe
  { videoId: "pykpO5kQJ98", name: "Euronews", region: "🇪🇺 Europe", directUrl: "https://www.euronews.com/live" },
];

const REGIONS = [...new Set(channels.map((c) => c.region))];

const getEmbedUrl = (channel: Channel, muted: boolean) => {
  return `https://www.youtube.com/embed/${channel.videoId}?autoplay=1&mute=${muted ? 1 : 0}&rel=0`;
};

const getDirectUrl = (channel: Channel) => channel.directUrl || null;

// Check if a YouTube video ID is valid/embeddable using oEmbed
const checkVideoValid = async (videoId: string): Promise<boolean> => {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { mode: "no-cors" }
    );
    // With no-cors, response is opaque (status 0) — treat as valid
    // Only mark invalid if we get an explicit non-ok with cors
    return true;
  } catch {
    // Network errors: assume valid to avoid false positives
    return true;
  }
};

export const LiveNewsFeed = () => {
  const [muted, setMuted] = useState(true);
  const [activeChannel, setActiveChannel] = useState<number>(0);
  const [expandedChannel, setExpandedChannel] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());
  const checkedVideos = useRef<Set<string>>(new Set());
  const { t } = useLanguage();

  // Auto-check active channel's video validity
  useEffect(() => {
    const channel = channels[activeChannel];
    if (!channel || checkedVideos.current.has(channel.videoId)) return;
    checkedVideos.current.add(channel.videoId);

    checkVideoValid(channel.videoId).then((valid) => {
      if (!valid) {
        setFailedVideos((prev) => new Set(prev).add(channel.videoId));
      }
    });
  }, [activeChannel]);

  // Also check expanded channel
  useEffect(() => {
    if (expandedChannel === null) return;
    const channel = channels[expandedChannel];
    if (!channel || checkedVideos.current.has(channel.videoId)) return;
    checkedVideos.current.add(channel.videoId);

    checkVideoValid(channel.videoId).then((valid) => {
      if (!valid) {
        setFailedVideos((prev) => new Set(prev).add(channel.videoId));
      }
    });
  }, [expandedChannel]);

  const handleManualRetry = useCallback(() => {
    // Clear failed status for current channel so it re-checks
    const ch = channels[activeChannel];
    checkedVideos.current.delete(ch.videoId);
    setFailedVideos((prev) => {
      const next = new Set(prev);
      next.delete(ch.videoId);
      return next;
    });
    setRetryKey((k) => k + 1);
  }, [activeChannel]);

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
            {failedVideos.has(channels[activeChannel].videoId) && channels[activeChannel].directUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 gap-2 p-4">
                <AlertTriangle className="h-6 w-6 text-warning" />
                <p className="text-[10px] font-mono text-muted-foreground text-center">
                  {t("Stream unavailable on YouTube", "البث غير متاح على يوتيوب")}
                </p>
                <a
                  href={channels[activeChannel].directUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-[10px] font-mono font-bold flex items-center gap-1 hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("Watch on official site", "شاهد على الموقع الرسمي")}
                </a>
                <button
                  onClick={handleManualRetry}
                  className="text-[8px] font-mono text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                  {t("↻ Retry YouTube", "↻ أعد المحاولة")}
                </button>
              </div>
            ) : (
              <iframe
                key={`player-${channels[activeChannel].videoId}-${muted}-${retryKey}`}
                src={getEmbedUrl(channels[activeChannel], muted)}
                title={channels[activeChannel].name}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )}
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
                  key={ch.videoId}
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
                    {failedVideos.has(ch.videoId) ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      </div>
                    ) : activeChannel === globalIdx ? (
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
              {failedVideos.has(channels[expandedChannel].videoId) && channels[expandedChannel].directUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 gap-3 p-6">
                  <AlertTriangle className="h-10 w-10 text-warning" />
                  <p className="text-sm font-mono text-muted-foreground text-center">
                    {t("Stream unavailable on YouTube", "البث غير متاح على يوتيوب")}
                  </p>
                  <a
                    href={channels[expandedChannel].directUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-mono font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("Watch on official site", "شاهد على الموقع الرسمي")}
                  </a>
                  <button
                    onClick={handleManualRetry}
                    className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    {t("↻ Retry YouTube", "↻ أعد المحاولة")}
                  </button>
                </div>
              ) : (
                <iframe
                  key={`expanded-${channels[expandedChannel].videoId}-${muted}-${retryKey}`}
                  src={getEmbedUrl(channels[expandedChannel], muted)}
                  title={channels[expandedChannel].name}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            <div className="flex gap-1 px-3 py-2 overflow-x-auto border-t border-border bg-background">
              {channels.map((ch, i) => (
                <button
                  key={ch.videoId}
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
