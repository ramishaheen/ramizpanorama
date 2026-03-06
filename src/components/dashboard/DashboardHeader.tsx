import { motion } from "framer-motion";
import { Shield, Wifi, Volume2, VolumeX, Languages } from "lucide-react";
import { useLanguage, translations } from "@/hooks/useLanguage";

interface DashboardHeaderProps {
  dataFresh?: boolean;
  alertMuted?: boolean;
  onToggleAlertMute?: () => void;
}

export const DashboardHeader = ({ dataFresh, alertMuted, onToggleAlertMute }: DashboardHeaderProps) => {
  const now = new Date();
  const { lang, isArabic, toggle, t } = useLanguage();

  return (
    <header className={`flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur transition-shadow duration-500 ${dataFresh ? "shadow-[inset_0_0_30px_hsl(190_100%_50%/0.08)] border-primary/40" : ""}`}>
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-sm font-bold tracking-wide text-foreground">
            SENTINEL<span className="text-primary">OS</span>
          </h1>
          <p className="text-[9px] text-muted-foreground tracking-widest uppercase">
            {t(translations["dashboard.title"].en, translations["dashboard.title"].ar)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Languages className="h-3 w-3" />
          <span className="text-[9px] font-mono uppercase tracking-wider font-bold">
            {isArabic ? "EN" : "عربي"}
          </span>
        </button>

        {/* Alert mute */}
        <button
          onClick={onToggleAlertMute}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${
            alertMuted
              ? "border-muted-foreground/30 text-muted-foreground hover:text-foreground"
              : "border-destructive/40 text-destructive hover:bg-destructive/10"
          }`}
          title={alertMuted ? "Unmute missile alerts" : "Mute missile alerts"}
        >
          {alertMuted ? (
            <VolumeX className="h-3 w-3" />
          ) : (
            <Volume2 className="h-3 w-3" />
          )}
          <span className="text-[9px] font-mono uppercase tracking-wider">
            {alertMuted
              ? t(translations["alerts.muted"].en, translations["alerts.muted"].ar)
              : t(translations["alerts.on"].en, translations["alerts.on"].ar)}
          </span>
        </button>

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
    </header>
  );
};
