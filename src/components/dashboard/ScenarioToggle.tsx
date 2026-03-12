import { motion } from "framer-motion";

export type Scenario = "conservative" | "base" | "severe";

interface ScenarioToggleProps {
  active: Scenario;
  onChange: (s: Scenario) => void;
}

const scenarioConfig: { key: Scenario; label: string; color: string }[] = [
  { key: "conservative", label: "Conservative", color: "bg-emerald-500/80" },
  { key: "base", label: "Base", color: "bg-amber-500/80" },
  { key: "severe", label: "Severe", color: "bg-red-500/80" },
];

export const ScenarioToggle = ({ active, onChange }: ScenarioToggleProps) => (
  <div className="inline-flex items-center gap-px bg-muted/50 rounded p-px border border-border/50">
    {scenarioConfig.map(({ key, label, color }) => (
      <button
        key={key}
        onClick={() => onChange(key)}
        className={`relative px-1.5 py-px text-[7px] font-mono font-semibold uppercase tracking-wider rounded transition-colors ${
          active === key ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
        }`}
      >
        {active === key && (
          <motion.div
            layoutId="scenario-bg"
            className={`absolute inset-0 ${color} rounded opacity-20`}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <span className="relative flex items-center gap-0.5">
          <span className={`inline-block h-1 w-1 rounded-full ${active === key ? color : "bg-muted-foreground/30"}`} />
          {label}
        </span>
      </button>
    ))}
  </div>
);
