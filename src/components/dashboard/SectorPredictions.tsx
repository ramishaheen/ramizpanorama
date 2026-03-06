import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, RefreshCw, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  Minus, Activity, AlertTriangle, Loader2, X
} from "lucide-react";
import { useSectorPredictions, type SectorPredictionsData } from "@/hooks/useSectorPredictions";

const flagEmoji: Record<string, string> = {
  AE: "🇦🇪", JO: "🇯🇴", SA: "🇸🇦", BH: "🇧🇭",
  OM: "🇴🇲", KW: "🇰🇼", QA: "🇶🇦", IQ: "🇮🇶",
  LB: "🇱🇧", YE: "🇾🇪",
};

const outlookColors: Record<string, string> = {
  POSITIVE: "text-success",
  CAUTIOUS: "text-warning",
  NEGATIVE: "text-destructive",
  CRITICAL: "text-critical",
};

const outlookBg: Record<string, string> = {
  POSITIVE: "bg-success/10 border-success/20",
  CAUTIOUS: "bg-warning/10 border-warning/20",
  NEGATIVE: "bg-destructive/10 border-destructive/20",
  CRITICAL: "bg-critical/10 border-critical/20",
};

const impactColors: Record<string, string> = {
  POSITIVE: "text-success",
  NEUTRAL: "text-muted-foreground",
  NEGATIVE: "text-warning",
  SEVERE: "text-critical",
};

const trendIcons: Record<string, React.ReactNode> = {
  UP: <TrendingUp className="h-2.5 w-2.5 text-success" />,
  DOWN: <TrendingDown className="h-2.5 w-2.5 text-critical" />,
  STABLE: <Minus className="h-2.5 w-2.5 text-muted-foreground" />,
  VOLATILE: <Activity className="h-2.5 w-2.5 text-warning" />,
};

export const SectorPredictions = () => {
  const { data, loading, error, refresh } = useSectorPredictions();
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<{ country: string; sector: any } | null>(null);
  const [detailCountry, setDetailCountry] = useState<{ name: string; code: string; overall_outlook: string; sectors: any[] } | null>(null);

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3 text-primary" />
            AI Sector Predictions
            <span className="text-[8px] text-primary font-mono">BY COUNTRY</span>
          </h3>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1 rounded hover:bg-secondary/60 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            <span className="text-[9px] text-muted-foreground ml-2 font-mono">Analyzing regional sectors…</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 py-2 px-2 rounded bg-critical/10 border border-critical/20">
            <AlertTriangle className="h-3 w-3 text-critical" />
            <span className="text-[9px] text-critical">{error}</span>
          </div>
        )}

        {data && !data.error && (
          <div className="space-y-1 max-h-[200px] overflow-y-auto intel-feed-scroll">
            {data.countries?.map((country) => (
              <div key={country.code} className={`rounded border ${outlookBg[country.overall_outlook] || "bg-muted/10 border-border"}`}>
                <button
                  onClick={() => setExpandedCountry(prev => prev === country.code ? null : country.code)}
                  onDoubleClick={(e) => { e.stopPropagation(); setDetailCountry(country); }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
                >
                  <span className="text-sm">{flagEmoji[country.code] || "🏳️"}</span>
                  <span className="font-mono text-[10px] font-bold text-foreground flex-1">{country.name}</span>
                  <span className={`font-mono text-[8px] font-bold uppercase ${outlookColors[country.overall_outlook]}`}>
                    {country.overall_outlook}
                  </span>
                  <span className="text-[8px] text-muted-foreground/50 font-mono">{country.sectors?.length || 0}s</span>
                  {expandedCountry === country.code ? (
                    <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence>
                  {expandedCountry === country.code && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2 pb-1.5 space-y-0.5">
                        {country.sectors?.map((sector, i) => (
                          <div
                            key={i}
                            onClick={() => setSelectedSector({ country: country.name, sector })}
                            className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-background/50 cursor-pointer hover:bg-secondary/40 transition-colors"
                          >
                            {trendIcons[sector.trend] || trendIcons.STABLE}
                            <span className="font-mono text-[9px] text-foreground flex-1 truncate">{sector.name}</span>
                            <span className={`font-mono text-[7px] font-bold uppercase ${impactColors[sector.impact]}`}>
                              {sector.impact}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {data?.regional_summary && (
          <p className="text-[8px] text-muted-foreground/60 mt-1.5 leading-snug line-clamp-2 font-mono">
            {data.regional_summary}
          </p>
        )}
      </div>

      {/* Country overview popup on double-click */}
      <AnimatePresence>
        {detailCountry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDetailCountry(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative w-[460px] max-w-[90vw] bg-card border border-border rounded-lg shadow-2xl overflow-hidden`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{flagEmoji[detailCountry.code] || "🏳️"}</span>
                  <div>
                    <h2 className="font-mono text-sm font-bold text-foreground">{detailCountry.name}</h2>
                    <span className={`font-mono text-[10px] font-bold uppercase ${outlookColors[detailCountry.overall_outlook]}`}>
                      Outlook: {detailCountry.overall_outlook}
                    </span>
                  </div>
                </div>
                <button onClick={() => setDetailCountry(null)} className="p-1 rounded hover:bg-destructive/20">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-2 max-h-[60vh] overflow-y-auto">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block">All Sectors ({detailCountry.sectors?.length})</span>
                {detailCountry.sectors?.map((sector, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded border border-border/50 bg-background/30 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => { setDetailCountry(null); setSelectedSector({ country: detailCountry.name, sector }); }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-foreground">{sector.name}</span>
                      <div className="flex items-center gap-2">
                        {trendIcons[sector.trend]}
                        <span className={`font-mono text-[8px] font-bold uppercase ${impactColors[sector.impact]}`}>{sector.impact}</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-snug">{sector.prediction}</p>
                  </div>
                ))}
                <div className="text-[8px] text-muted-foreground/40 font-mono pt-2 border-t border-border/30">
                  Double-click country row to open • Click sector for details
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sector detail popup */}
      <AnimatePresence>
        {selectedSector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedSector(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-[380px] max-w-[90vw] bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/80">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{selectedSector.sector.name}</span>
                    {trendIcons[selectedSector.sector.trend]}
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono">{selectedSector.country}</span>
                </div>
                <button onClick={() => setSelectedSector(null)} className="p-1 rounded hover:bg-destructive/20">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-current/20 ${impactColors[selectedSector.sector.impact]}`}>
                    Impact: {selectedSector.sector.impact}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    Confidence: {selectedSector.sector.confidence}
                  </span>
                </div>

                <p className="text-[11px] text-foreground leading-relaxed">{selectedSector.sector.prediction}</p>

                {selectedSector.sector.opportunities?.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-mono uppercase text-success font-bold mb-1">Opportunities</h4>
                    <ul className="space-y-0.5">
                      {selectedSector.sector.opportunities.map((opp: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <TrendingUp className="h-2.5 w-2.5 mt-0.5 text-success flex-shrink-0" />
                          <span className="text-[10px] text-muted-foreground">{opp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedSector.sector.risks?.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-mono uppercase text-critical font-bold mb-1">Risks</h4>
                    <ul className="space-y-0.5">
                      {selectedSector.sector.risks.map((risk: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <AlertTriangle className="h-2.5 w-2.5 mt-0.5 text-critical flex-shrink-0" />
                          <span className="text-[10px] text-muted-foreground">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
