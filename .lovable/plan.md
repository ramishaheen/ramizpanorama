

# Add "Scouting" Full-Screen Page to Intel Tools

## What it does
A new "SCOUTING" button in the Intel Tools dropdown (bottom bar of the main map). Clicking it opens a full-screen portal overlay (same pattern as SatelliteGlobe and UrbanScene3D — `createPortal` to `document.body` at z-index 99999) that consolidates all dashboard widgets into a single scrollable view.

## Content included in the Scouting page
All panels from the main dashboard layout:

**Left column widgets**: RocketEntryPanel, RiskScoreGauge, CountryStatusPanel (Geo-Fusion), WeatherTrafficPanel, WarEscalationEngine, CommodityTracker, LiveNewsFeed, AIPredictions, TelegramFeed

**Right column widgets**: NotificationPanel, WarUpdatesPanel, LayerControls, TimelineSlider, CyberSecurityAlerts

**Upper bar**: StatsBar (includes war cost estimate with live ticking counter)

**Bottom row**: CitizenSecurity, SectorPredictions, SocialSentimentBox

## Layout of the full-screen overlay
- Fixed full-screen div via `createPortal` to `document.body`
- Header bar with title "SCOUTING — INTELLIGENCE OVERVIEW" and close button (X) + Escape key dismissal
- StatsBar at top (war costs, counters)
- Below that, a responsive CSS grid layout:
  - 3 columns on desktop, 2 on tablet, 1 on mobile
  - Each widget in a card container
- Bottom row: CitizenSecurity, SectorPredictions, SocialSentimentBox in a 3-column row

## File changes

### 1. New file: `src/components/dashboard/ScoutingModal.tsx`
- Full-screen portal component (same pattern as SatelliteGlobe)
- Imports and renders all the widget components listed above
- Uses its own hooks for data (useLiveDashboard, useCitizenSecurity, useWarUpdates, useTelegramIntel, useGeoFusion)
- Escape key to close
- Scrollable grid layout

### 2. Edit: `src/components/dashboard/IntelMap.tsx`
- Import `ScoutingModal`
- Add `showScouting` state
- Add "SCOUTING" button to Intel Tools dropdown (with `Crosshair` or `BarChart3` icon) after SNAP ME
- Render `<ScoutingModal>` when `showScouting` is true

