import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ExternalLink, Languages, Play } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";

interface TelegramPost {
  id: number;
  text: string;
  date: string;
  views?: string;
  media?: string;
  mediaType?: "photo" | "video";
}

export const TelegramFeed = () => {
  const [posts, setPosts] = useState<TelegramPost[]>([]);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("telegram-feed");
      if (fnError) throw fnError;
      if (data?.posts) {
        setPosts(data.posts);
        if (showTranslation) {
          translatePosts(data.posts);
        }
      }
    } catch (e) {
      console.error("Telegram feed error:", e);
      setError("Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [showTranslation]);

  const translatePosts = useCallback(async (postsToTranslate: TelegramPost[]) => {
    const untranslated = postsToTranslate.filter(p => !translations[p.id]);
    if (untranslated.length === 0) return;

    setTranslating(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("translate-posts", {
        body: { texts: untranslated.map(p => p.text) },
      });
      if (fnError) throw fnError;
      if (data?.translations) {
        setTranslations(prev => {
          const next = { ...prev };
          untranslated.forEach((p, i) => {
            next[p.id] = data.translations[i] || p.text;
          });
          return next;
        });
      }
    } catch (e) {
      console.error("Translation error:", e);
    } finally {
      setTranslating(false);
    }
  }, [translations]);

  const toggleTranslation = useCallback(() => {
    setShowTranslation(prev => {
      const next = !prev;
      if (next && posts.length > 0) {
        translatePosts(posts);
      }
      return next;
    });
  }, [posts, translatePosts]);

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, 60_000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-background/60">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#29B6F6]" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">
            WarsLeaks
          </span>
          <a
            href="https://t.me/WarsLeaks"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[8px] font-mono text-muted-foreground hover:text-[#29B6F6] transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {t("Open ↗", "فتح ↗")}
          </a>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTranslation}
            title={showTranslation ? "Show original" : "Translate to English"}
            className={`p-1 transition-colors ${
              showTranslation 
                ? "text-[#29B6F6]" 
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            <Languages className={`h-3 w-3 ${translating ? "animate-pulse" : ""}`} />
          </button>
          <button
            onClick={fetchPosts}
            disabled={loading}
            className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Posts */}
      <div className="max-h-[400px] overflow-y-auto intel-feed-scroll">
        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-4 w-4 animate-spin text-[#29B6F6]" />
          </div>
        ) : error && posts.length === 0 ? (
          <div className="p-4 text-center">
            <p className="font-mono text-[10px] text-muted-foreground mb-2">{error}</p>
            <a
              href="https://t.me/WarsLeaks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#29B6F6]/10 border border-[#29B6F6]/30 text-[#29B6F6] font-mono text-[10px] hover:bg-[#29B6F6]/20 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {t("View on Telegram", "عرض على تيليجرام")}
            </a>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {posts.map((post) => {
              const displayText = showTranslation && translations[post.id] 
                ? translations[post.id] 
                : post.text;
              const isTranslated = showTranslation && !!translations[post.id];

              return (
                <a
                  key={post.id}
                  href={`https://t.me/WarsLeaks/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir={isTranslated ? "ltr" : "rtl"}
                  className={`block px-3 py-2.5 hover:bg-muted/30 transition-colors group ${
                    isTranslated ? "text-left" : "text-right"
                  }`}
                >
                  {/* Media thumbnail */}
                  {post.media && (
                    <div className="relative mb-2 rounded overflow-hidden bg-muted/20">
                      <img
                        src={post.media}
                        alt=""
                        loading="lazy"
                        className="w-full h-28 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                      {post.mediaType === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                            <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="font-mono text-xs text-foreground leading-relaxed line-clamp-4 group-hover:text-[#29B6F6] transition-colors">
                    {displayText}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 justify-start" dir="ltr">
                    <span className="font-mono text-[9px] text-muted-foreground/60">
                      {new Date(post.date).toLocaleString("en-GB", { 
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
                      })}
                    </span>
                    {post.views && (
                      <span className="font-mono text-[9px] text-muted-foreground/40">
                        👁 {post.views}
                      </span>
                    )}
                    {isTranslated && (
                      <span className="font-mono text-[9px] text-[#29B6F6]/50">
                        🌐 {t("translated", "مترجم")}
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
