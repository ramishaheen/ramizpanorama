import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, RefreshCw, ChevronDown, ChevronUp, Shield, Globe,
  AlertTriangle, Plane, Anchor, Rocket, Users, Fuel
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WarUpdatesData, WarUpdate } from "@/hooks/useWarUpdates";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

interface WarUpdatesPanelProps {
  data: WarUpdatesData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  MILITARY: <Shield className="h-3 w-3" />,
  DIPLOMATIC: <Globe className="h-3 w-3" />,
  HUMANITARIAN: <Users className="h-3 w-3" />,
  ECONOMIC: <Fuel className="h-3 w-3" />,
  AIRSPACE: <Plane className="h-3 w-3" />,
  MARITIME: <Anchor className="h-3 w-3" />,
  MISSILE: <Rocket className="h-3 w-3" />,
  CIVILIAN: <AlertTriangle className="h-3 w-3" />,
};

const severityBorder: Record<string, string> = {
  low: "border-l-success",
  medium: "border-l-primary",
  high: "border-l-warning",
  critical: "border-l-critical",
};

const severityText: Record<string, string> = {
  low: "text-success",
  medium: "text-primary",
  high: "text-warning",
  critical: "text-critical",
};

const threatColors: Record<string, string> = {
  ELEVATED: "text-warning",
  HIGH: "text-warning",
  SEVERE: "text-destructive",
  CRITICAL: "text-critical",
};

const UpdateCard = ({ update }: { update: WarUpdate }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`border-l-2 ${severityBorder[update.severity]} bg-card/40 rounded-r px-2 py-1 cursor-pointer hover:bg-secondary/50 transition-colors`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-1.5">
        <div className={`flex-shrink-0 ${severityText[update.severity]}`}>
          {categoryIcons[update.category] || <AlertTriangle className="h-3 w-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={`text-[8px] font-mono uppercase tracking-wider ${severityText[update.severity]}`}>
              {update.category}
            </span>
            <span className="text-[8px] text-muted-foreground/60 font-mono truncate">{update.region}</span>
          </div>
          <p className="text-[10px] font-medium text-foreground leading-tight truncate">
            {update.headline}
          </p>
        </div>
        <div className="flex-shrink-0">
          {expanded ? <ChevronUp className="h-2.5 w-2.5 text-muted-foreground/50" /> : <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/50" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[9px] text-muted-foreground leading-relaxed mt-1 pl-4.5">
              {update.body}
            </p>
            <span className="text-[7px] text-muted-foreground/50 font-mono pl-4.5 block mt-0.5">{update.source}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const WarUpdatesPanel = ({ data, loading, error, onRefresh }: WarUpdatesPanelProps) => {
  const [showSummary, setShowSummary] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-destructive/5">
        <div className="flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5 text-destructive" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
            {t(tr["section.war_updates"].en, tr["section.war_updates"].ar)}
          </h3>
          <span className="text-[9px] font-mono text-primary uppercase">{t(tr["war.ai_live"].en, tr["war.ai_live"].ar)}</span>
          {data?.threat_level && (
            <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-current/20 ${threatColors[data.threat_level] || "text-warning"}`}>
              {data.threat_level}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {data?.situation_summary && (
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="px-1.5 py-0.5 text-[8px] font-mono uppercase text-muted-foreground hover:text-primary border border-border rounded transition-colors"
            >
              {showSummary ? t(tr["action.hide"].en, tr["action.hide"].ar) : t(tr["action.sitrep"].en, tr["action.sitrep"].ar)}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Situation Summary */}
      <AnimatePresence>
        {showSummary && data?.situation_summary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-destructive/5"
          >
            <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground leading-relaxed">
              {data.situation_summary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 flex items-center gap-2 text-destructive font-mono text-[10px]">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3 w-3 animate-spin text-primary" />
            <span className="font-mono text-[10px] text-muted-foreground">{t(tr["war.gathering"].en, tr["war.gathering"].ar)}</span>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {data?.updates?.map((update) => (
              <UpdateCard key={update.id} update={update} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
