import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wifi, Volume2, VolumeX, Languages, MessageCircle, Youtube, Globe, ShieldAlert } from "lucide-react";
import { useLanguage, translations } from "@/hooks/useLanguage";
import { WarChatPanel } from "./WarChatPanel";
import { NotificationCenter } from "./NotificationCenter";
import { LiveChannelsModal } from "./LiveChannelsModal";
import { FourDMap } from "./FourDMap";
import { CyberImmunityModal } from "./CyberImmunityModal";
import warosLogo from "@/assets/waros-logo.png";
import { LiveDataFeedIndicator } from "./LiveDataFeedIndicator";
import type { Rocket, GeoAlert } from "@/data/mockData";
import type { TelegramMarker } from "@/hooks/useTelegramIntel";

interface DashboardHeaderProps {
  dataFresh?: boolean;
  alertMuted?: boolean;
  onToggleAlertMute?: () => void;
  rockets?: Rocket[];
  telegramMarkers?: TelegramMarker[];
  geoAlerts?: GeoAlert[];
  lastPollAt?: string | null;
  activeSources?: number;
  simulationActive?: boolean;
  onToggleSimulation?: () => void;
}

export const DashboardHeader = ({ dataFresh, alertMuted, onToggleAlertMute, rockets = [], telegramMarkers = [], geoAlerts = [], lastPollAt, activeSources = 0, simulationActive = false, onToggleSimulation }: DashboardHeaderProps) => {
  const now = new Date();
  const { lang, isArabic, toggle, t } = useLanguage();
  const [chatOpen, setChatOpen] = useState(false);
  const [showBalloon, setShowBalloon] = useState(true);
  const [showLiveChannels, setShowLiveChannels] = useState(false);
  const [show4DMap, setShow4DMap] = useState(false);
  const [showCyberImmunity, setShowCyberImmunity] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowBalloon(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <header className={`flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 border-b border-border bg-card/80 backdrop-blur transition-shadow duration-500 ${dataFresh ? "shadow-[inset_0_0_30px_hsl(190_100%_50%/0.08)] border-primary/40" : ""}`}>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <img src={warosLogo} alt="War OS Logo" className="h-6 w-6 sm:h-8 sm:w-8" />
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-wide text-foreground">
              WAR<span className="text-primary">OS</span>
            </h1>
            <p className="text-[8px] sm:text-[9px] text-muted-foreground tracking-widest uppercase hidden sm:block">
              RamiZpanorama
            </p>
          </div>

          {/* AI Chat trigger */}
          <div className="relative">
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={`relative flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-300 ${
                chatOpen
                  ? "border-primary bg-primary/20 text-primary shadow-[0_0_12px_hsl(190_100%_50%/0.3)]"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
              title="War Analyst AI Chat"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {!chatOpen && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </button>
            {!chatOpen && showBalloon && (
              <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 z-50 animate-bounce hidden sm:block">
                <div className="relative bg-primary text-primary-foreground text-[9px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap shadow-lg">
                  Chat with me 💬
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-primary rotate-45" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right buttons — grouped by priority */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide flex-shrink min-w-0">
          {/* ── PORTALS GROUP ── */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <span className="text-[7px] font-mono text-muted-foreground/60 uppercase tracking-widest hidden lg:inline mr-1">Portals</span>
            {/* Live Channels */}
            <button
              onClick={() => setShowLiveChannels(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded border-l-2 border border-destructive/40 border-l-destructive text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
              title="YouTube Live Channels"
            >
              <Youtube className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold hidden sm:inline">Live</span>
            </button>

            {/* Cyber Immunity */}
            <button
              onClick={() => setShowCyberImmunity(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded border-l-2 border border-primary/30 border-l-primary text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
              title="Cyber Immunity - OSINT Operations Center"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold hidden sm:inline">Cyber</span>
            </button>

            {/* 4D MAP */}
            <button
              onClick={() => setShow4DMap(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded border-l-2 border border-accent/30 border-l-accent text-accent hover:bg-accent/10 transition-colors flex-shrink-0"
              title="Open 4D Intelligence Map"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold hidden sm:inline">4D Map</span>
            </button>
          </div>

          {/* ── DIVIDER ── */}
          <div className="h-6 w-px bg-border/60 flex-shrink-0 hidden sm:block" />

          {/* ── CONTROLS GROUP ── */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Language toggle */}
            <button
              onClick={toggle}
              className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
              title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
            >
              <Languages className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold hidden sm:inline">
                {isArabic ? "EN" : "عربي"}
              </span>
            </button>

            {/* Notification Center */}
            <NotificationCenter rockets={rockets} alertMuted={alertMuted} telegramMarkers={telegramMarkers} geoAlerts={geoAlerts} />

            {/* Alert mute */}
            <button
              onClick={onToggleAlertMute}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded border transition-colors flex-shrink-0 ${
                alertMuted
                  ? "border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                  : "border-destructive/40 text-destructive hover:bg-destructive/10"
              }`}
              title={alertMuted ? "Unmute missile alerts" : "Mute missile alerts"}
            >
              {alertMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">
                {alertMuted
                  ? t(translations["alerts.muted"].en, translations["alerts.muted"].ar)
                  : t(translations["alerts.on"].en, translations["alerts.on"].ar)}
              </span>
            </button>
          </div>

          {/* ── DIVIDER ── */}
          <div className="h-6 w-px bg-border/60 flex-shrink-0 hidden sm:block" />

          {/* ── STATUS GROUP ── */}
          <div className="hidden sm:flex items-center gap-2.5 flex-shrink-0">
            <LiveDataFeedIndicator
              lastPollAt={lastPollAt ?? null}
              activeSources={activeSources}
              dataFresh={!!dataFresh}
            />
            <div className="flex items-center gap-1.5">
              <Wifi className="h-3 w-3 text-success animate-pulse" />
              <span className="text-[10px] font-mono text-success">
                {t(translations["status.online"].en, translations["status.online"].ar)}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-foreground">
                {now.toLocaleDateString(isArabic ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
              </div>
              <div className="text-[10px] font-mono text-primary">
                {now.toLocaleTimeString(isArabic ? 'ar-SA' : 'en-US', { hour12: false })} UTC
              </div>
            </div>
          </div>
        </div>
      </header>
      <WarChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      {showLiveChannels && <LiveChannelsModal onClose={() => setShowLiveChannels(false)} />}
      {show4DMap && <FourDMap onClose={() => setShow4DMap(false)} rockets={rockets} />}
      {showCyberImmunity && <CyberImmunityModal onClose={() => setShowCyberImmunity(false)} geoAlerts={geoAlerts} />}
    </>
  );
};
