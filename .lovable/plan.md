

# Redesign Scouting Page — Gotham/Palantir Military Design

## Vision
Transform from a simple stacked grid into a Palantir Gotham-style intelligence dashboard: tight uniform tiles with labeled section headers, crisp 1px borders, scanline overlays, and a structured sector-based layout that reads like a single source of truth.

## Design Language
- **Background**: Pure dark `#0a0c10` with subtle grid pattern overlay
- **Tiles**: Uniform rectangular cells with 1px `hsl(190 60% 20%)` borders, no rounded corners (sharp military aesthetic), inner glow on hover
- **Section Headers**: Uppercase monospace labels with left cyan accent bar (2px), e.g. `▎THREAT ASSESSMENT`, `▎SIGINT`, `▎ECONOMIC WARFARE`
- **Scanline overlay**: Subtle repeating gradient across the entire page
- **Header**: Add timestamp, classification banner ("UNCLASSIFIED // FOR OFFICIAL USE ONLY"), and data freshness indicator
- **Typography**: All `font-mono`, sizes 8-11px for data, muted labels

## Layout (4-column grid, fixed height tiles)

```text
┌─────────────────────────────────────────────────────────┐
│ ▌SCOUTING  INTELLIGENCE OVERVIEW    [LIVE] [UTC TIME] X │
│  UNCLASSIFIED // FOUO         DATA REFRESH: 2.3s ago    │
├─────────────────────────────────────────────────────────┤
│ STATS BAR (war costs ticking, counters)                  │
├──────────────┬──────────────┬──────────────┬────────────┤
│ ▎THREAT      │ ▎ESCALATION  │ ▎SIGINT      │ ▎ECONOMIC  │
│  RiskGauge   │  WarEscal    │  TelegramFeed│  Commodity │
│  RocketEntry │  WarUpdates  │  LiveNews    │  CostCount │
├──────────────┼──────────────┼──────────────┼────────────┤
│ ▎GEO-FUSION  │ ▎NOTIFICATIONS│ ▎CYBER      │ ▎AI INTEL  │
│  CountryPanel│  NotifPanel  │  CyberAlerts │  AIPredic  │
│  WeatherTraf │              │              │  SectorPred│
├──────────────┴──────────────┴──────────────┴────────────┤
│ ▎CIVIL INDICATORS                                        │
│  CitizenSecurity  │  SectorPredictions │ SocialSentiment │
└─────────────────────────────────────────────────────────┘
```

## File Changes

### `src/components/dashboard/ScoutingModal.tsx` — Full rewrite
- Replace the current loose grid with a structured 4-column CSS grid layout
- Each widget wrapped in a `ScoutingTile` component: sharp corners, 1px border, section header with cyan accent bar, scanline overlay
- Add classification banner and UTC clock in header
- Add `grid-bg scanline` classes to the background
- Section groupings: THREAT ASSESSMENT, ESCALATION, SIGINT, ECONOMIC WARFARE, GEO-FUSION, NOTIFICATIONS, CYBER OPS, AI INTEL, CIVIL INDICATORS
- Bottom row spans full width as a 3-column sub-grid
- Gap reduced to 2px for tight Gotham tile feel
- Each tile has a subtle hover state: `border-primary/40` glow

### `src/index.css` — Add scouting-specific styles
- `.scouting-tile` — sharp borders, inner padding 8px, hover glow transition
- `.scouting-section-label` — uppercase mono with left cyan bar
- `.classification-banner` — centered amber text on dark strip

