import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";

export const TelegramFeed = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    // Load Telegram widget script
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-post", "WarsLeaks/1");
    script.setAttribute("data-width", "100%");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-color", "29B6F6");
    script.setAttribute("data-dark", "1");
    script.setAttribute("data-dark-color", "29B6F6");
    script.async = true;

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#29B6F6]" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <h3 className="text-xs font-bold text-foreground tracking-wide uppercase">
          {t("WarsLeaks", "WarsLeaks")}
        </h3>
        <a
          href="https://t.me/WarsLeaks"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          {t("Open in Telegram ↗", "فتح في تيليجرام ↗")}
        </a>
      </div>
      <div
        ref={containerRef}
        className="overflow-y-auto max-h-[300px] rounded bg-muted/30 p-1"
      />
      <iframe
        src="https://t.me/s/WarsLeaks"
        className="w-full h-[400px] rounded border border-border bg-background"
        title="WarsLeaks Telegram Channel"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
};
