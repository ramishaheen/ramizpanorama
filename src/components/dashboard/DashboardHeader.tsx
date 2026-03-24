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
      <header className={`flex items-center justify-between px-3 sm:px-5 py-1.5 sm:py-2 border-b-2 maven-glass-heavy transition-all duration-500 ${dataFresh ? "border-b-primary/50" : "border-b-primary/20"}`}>
        {/* Left: Brand + AI Chat */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-shrink-0">
          <img src={warosLogo} alt="War OS Logo" className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow-[0_0_8px_hsl(192_95%_48%/0.3)]" />
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-widest text-foreground">
              WAR<span className="text-gradient-primary">OS</span>
            </h1>
            <p className="text-[7px] sm:text-[8px] text-muted-foreground tracking-[0.2em] uppercase hidden sm:block font-mono">
              RamiZpanorama
            </p>
          </div>

          {/* System Heartbeat Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-sm border border-success/20 bg-success/5">
            <div className="relative">
              <div className="h-1.5 w-1.5 rounded-full bg-success maven-heartbeat" />
              <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success animate-ping opacity-40" />
            </div>
            <span className="text-[7px] font-mono uppercase tracking-widest text-success font-semibold">SYS OK</span>
          </div>

          {/* AI Chat trigger */}
          <div className="relative">
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={`relative flex items-center justify-center h-7 w-7 rounded-sm border transition-all duration-200 ${
                chatOpen
                  ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_16px_hsl(192_95%_48%/0.2)]"
                  : "border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
              title="War Analyst AI Chat"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {!chatOpen && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </button>
            {!chatOpen && showBalloon && (
              <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 z-50 animate-bounce hidden sm:block">
                <div className="relative bg-primary/90 text-primary-foreground text-[9px] font-semibold px-2.5 py-1 rounded-sm whitespace-nowrap shadow-lg backdrop-blur">
                  Chat with me 💬
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-primary/90 rotate-45" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right buttons — grouped by priority */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide flex-shrink min-w-0">
          {/* ── PORTALS GROUP ── */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <span className="text-[6px] font-mono text-muted-foreground/50 uppercase tracking-[0.2em] hidden lg:inline mr-0.5">Portals</span>
            {/* Live Channels */}
            <button
              onClick={() => setShowLiveChannels(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-sm border border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-all duration-150 flex-shrink-0 maven-hover"
              title="YouTube Live Channels"
            >
              <Youtube className="h-3.5 w-3.5" />
              <span className="text-[9px] font-mono uppercase tracking-wider font-bold hidden sm:inline">Live</span>
            </button>

            {/* Cyber Immunity */}
            <button
              onClick={() => setShowCyberImmunity(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-sm border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 transition-all duration-150 flex-shrink-0 maven-hover"
              title="Cyber Immunity - OSINT Operations Center"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="text-[9px] font-mono uppercase tracking-wider font-bold hidden sm:inline">Cyber</span>
            </button>

            {/* 4D MAP */}
            <button
              onClick={() => setShow4DMap(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-sm border border-accent/25 bg-accent/5 text-accent hover:bg-accent/10 hover:border-accent/40 transition-all duration-150 flex-shrink-0 maven-hover"
              title="Open 4D Intelligence Map"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[9px] font-mono uppercase tracking-wider font-bold hidden sm:inline">4D Map</span>
            </button>

          </div>

          {/* ── DIVIDER ── */}
          <div className="h-5 w-px bg-gradient-to-b from-transparent via-border/40 to-transparent flex-shrink-0 hidden sm:block" />

          {/* ── CONTROLS GROUP ── */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Language toggle */}
            <button
              onClick={toggle}
              className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-sm border border-border/40 hover:border-primary/30 text-muted-foreground hover:text-primary transition-all duration-150 flex-shrink-0"
              title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
            >
              <Languages className="h-3.5 w-3.5" />
              <span className="text-[9px] font-mono uppercase tracking-wider font-semibold hidden sm:inline">
                {isArabic ? "EN" : "عربي"}
              </span>
            </button>

            {/* Notification Center */}
            <NotificationCenter rockets={rockets} alertMuted={alertMuted} telegramMarkers={telegramMarkers} geoAlerts={geoAlerts} />

            {/* Alert mute */}
            <button
              onClick={onToggleAlertMute}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-sm border transition-all duration-150 flex-shrink-0 ${
                alertMuted
                  ? "border-muted-foreground/20 text-muted-foreground hover:text-foreground"
                  : "border-destructive/25 text-destructive hover:bg-destructive/8 maven-breathe-critical"
              }`}
              title={alertMuted ? "Unmute missile alerts" : "Mute missile alerts"}
            >
              {alertMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span className="text-[9px] font-mono uppercase tracking-wider hidden sm:inline">
                {alertMuted
                  ? t(translations["alerts.muted"].en, translations["alerts.muted"].ar)
                  : t(translations["alerts.on"].en, translations["alerts.on"].ar)}
              </span>
            </button>
          </div>

          {/* ── DIVIDER ── */}
          <div className="h-5 w-px bg-gradient-to-b from-transparent via-border/40 to-transparent flex-shrink-0 hidden sm:block" />

          {/* ── STATUS GROUP ── */}
          <div className="hidden sm:flex items-center gap-2.5 flex-shrink-0">
            <LiveDataFeedIndicator
              lastPollAt={lastPollAt ?? null}
              activeSources={activeSources}
              dataFresh={!!dataFresh}
              simulationActive={simulationActive}
              onToggleSimulation={onToggleSimulation}
            />
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm border border-success/15 bg-success/5">
              <Wifi className="h-3 w-3 text-success animate-pulse" />
              <span className="text-[9px] font-mono text-success font-semibold">
                {t(translations["status.online"].en, translations["status.online"].ar)}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-mono text-foreground/80 tabular-nums">
                {now.toLocaleDateString(isArabic ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
              </div>
              <div className="text-[10px] font-mono text-primary font-bold tabular-nums">
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
