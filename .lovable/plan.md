

# Kill Chain Kanban Board + AI Metrics Prioritization + Telemetry Panel

## Overview
Three additions to the Gotham 4D system:

1. **Kill Chain Kanban Board** — Drag-and-drop workflow board (7 columns) accessible from the 4D Map header
2. **AI Metrics Prioritization Modal** — Palantir-style metric weight selector (per the uploaded image) that lets the AI optimize shooter-target matching based on user-tuned criteria
3. **Telemetry Panel** — Platform/sensor telemetry sidebar for the 3D zoom view
4. **Detection-to-Action flow** — Click AI detection → initiate kill chain → AI recommends action via weighted metrics → approve → map zooms to engagement area

## Components

### 1. `KillChainKanban.tsx` (new)
Full-screen overlay with 7 drag-and-drop columns:
- **DELIBERATE** | **DYNAMIC** | **PENDING PAIRING** | **PAIRED** | **IN EXECUTION** | **PENDING BDA** | **COMPLETE**
- Cards show: target ID, classification, priority badge, time-on-target, last-edited timestamp
- HTML5 native drag-and-drop (no library needed)
- Column drops update `kill_chain_tasks.phase` + `status` in DB
- Column-specific AI triggers:
  - PENDING PAIRING → auto-invoke S2S engine
  - IN EXECUTION → status monitoring
  - PENDING BDA → auto-generate BDA via AEGIS
- Top toolbar: `+ Add`, Search, Filter, Sort, Group
- Reads from existing `kill_chain_tasks` table with realtime subscription

### 2. `AIMetricsPrioritizer.tsx` (new) — from uploaded image
A modal/panel: **"Choose which metrics AI should prioritize"**
- 6 visible gauge cards (expandable to 13 via "Show all metrics"):
  - **AGM Match (Effect Priority)** — weight 0-100, default 30
  - **Time to Target** — default 50
  - **Distance** — default 10
  - **Time on Station** — default 20
  - **Fuel** — default 40
  - **Munitions** — default 10
  - Hidden: Pk, Collateral Risk, ROE Compliance, Sensor Coverage, Weather, Altitude Advantage, EW Threat
- Each card: semi-circular gauge visualization (CSS), `−` / `+` buttons, removable `×`
- Bottom bar: **"Optimize Recommender"** button (sends weights to `sensor-to-shooter` edge function) + **"Continuous Optimization On"** toggle
- When "Optimize Recommender" clicked: calls S2S with `action: "optimize_match"` + weights object → AI re-ranks all pending recommendations using weighted scoring → results update Kanban cards
- When approved: map auto-zooms to the target area with the 3D inline view

### 3. `TelemetryPanel.tsx` (new)
Left sidebar tab in `Inline3DView`:
- **Platform**: Altitude (MSL), Heading, Pitch, Roll, MGRS
- **Sensor**: FLIR type, Azimuth, Elevation, SPI coords
- **AI Detections counter**: Person/Vehicle count badges
- Simulated from map camera state

### 4. Edge function update: `sensor-to-shooter/index.ts`
Add new action `optimize_match`:
- Accepts `weights` object with metric names → values
- Re-scores existing pending recommendations using weighted formula:
  ```
  score = Σ(weight_i × normalized_metric_i) / Σ(weight_i)
  ```
- Factors: proximity_km, time_to_target_min, probability_of_kill, fuel match, payload_match_score, collateral_risk
- Returns ranked recommendations
- On approval: returns target coords for map zoom

### 5. Integration changes

**`FourDMap.tsx`**: Add "BOARD" button in header to toggle Kanban overlay. Add "AI OPTIMIZE" button to open metrics prioritizer.

**`Inline3DView.tsx`**: Add TelemetryPanel as a tab. Add detection click handler → "INITIATE KILL CHAIN" popover → creates `kill_chain_tasks` row → card appears on Kanban.

**`KillChainPanel.tsx`**: Add button to open AIMetricsPrioritizer when in "target" phase.

## Workflow
1. User zooms into event on 4D globe → 3D view opens with telemetry
2. AI detects objects → click detection → "INITIATE KILL CHAIN"
3. Card created in Kanban DYNAMIC column
4. Drag to PENDING PAIRING → AI auto-matches shooters
5. User opens **AI Metrics Prioritizer** → adjusts weights (TTT, Distance, Fuel, etc.)
6. Clicks "Optimize Recommender" → AI re-ranks with weighted scoring
7. User reviews top recommendation → approves via Confirm Slider
8. Map zooms to engagement area with range rings + telemetry overlay
9. After engagement → card moves to PENDING BDA → AEGIS generates report → COMPLETE

## Files
1. **Create** `src/components/dashboard/KillChainKanban.tsx`
2. **Create** `src/components/dashboard/AIMetricsPrioritizer.tsx`
3. **Create** `src/components/dashboard/TelemetryPanel.tsx`
4. **Modify** `src/components/dashboard/FourDMap.tsx` — header buttons
5. **Modify** `src/components/dashboard/Inline3DView.tsx` — telemetry + detection click
6. **Modify** `supabase/functions/sensor-to-shooter/index.ts` — add `optimize_match` action

