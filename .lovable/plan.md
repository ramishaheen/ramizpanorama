

# Kill Chain, C2 Intel & Panoptic Control Enhancements

## 1. Kill Chain "INITIATE" Button — Full Target Selection & Actions

**Current problem**: The button blindly grabs the first `detected` target. No user choice, no feedback if none exist.

**Changes to `KillChainPanel.tsx`**:
- Replace `createKCFromTarget` with a **target picker modal** — when clicked, fetch all `detected`/`tracking` targets from `target_tracks`, display them in an inline dropdown list showing `track_id`, `classification`, `priority`, `lat/lng`, `confidence`
- User selects a target → creates kill chain task with phase `find`, status `in_progress`
- Auto-assign `recommended_weapon` and `assigned_platform` by calling the `sensor-to-shooter` edge function to get the best match
- Add a **toast notification** on successful initiation with target details
- If no targets available, show an inline "NO DETECTED TARGETS — Run ATR Scan" message with a button that triggers the `simulate-intel` edge function to generate new detections
- Add **BDA generation** button on `assess` phase tasks — calls `c2-assistant` with a BDA prompt for that specific target, stores result in `bda_result` field
- Show `bda_result` inline when present on assess-phase tasks
- Add per-task action buttons: "LOCATE" (zoom globe), "DETAILS" (expand inline with notes/weapon/platform)

## 2. C2 Intel Tab — Presentable Formatted Output

**Current problem**: Raw markdown in tiny 9px text, no structured sections, suggestions don't persist after response.

**Changes to `C2ChatTab.tsx`**:
- **Structured message rendering**: Parse assistant responses for known patterns (BDA REPORT, SITREP, COA, THREAT ASSESSMENT) and render them in styled card blocks with colored headers and section dividers
- **Auto-extract action items**: After each assistant response, parse for bullet-pointed recommendations and render them as clickable suggestion chips below the message
- **Better typography**: Increase base text to 10px, add proper heading hierarchy with colored borders (critical=red, advisory=amber, info=cyan)
- **Context-aware quick prompts**: After each response, generate 3-4 contextual follow-up suggestions based on the response content (e.g., after a SITREP → "Generate BDA for [mentioned target]", "COA for [mentioned threat]")
- **Copy button** on each assistant message for sharing intel
- **Timestamp headers** between message groups

## 3. Panoptic Control — Dynamic Latest Options

**Current problem**: Only has Density slider + 3 toggles (Flights/Satellites/Maritime). No awareness of current battlespace state.

**Changes to `FourDMap.tsx` (Panoptic Control section, lines 1237-1257)**:
- Add **dynamic suggestion chips** below the existing toggles, derived from live data:
  - Active kill chains count → "View Kill Chain (N active)"
  - Critical targets count → "N Critical Targets — Review"
  - Sensor feeds offline → "2 Sensors Offline — Check"
  - Recent conflict events → "New Events (N) — Filter"
- Each chip is clickable: switches to the relevant right-panel tab (KILLCHAIN, TARGETS, SENSORS, FEED)
- Add **Force Posture toggles**: "Blue Force", "Red Force", "Neutral" visibility toggles (using existing `blueUnits`/`redUnits` data)
- Add **Threat Level indicator**: Computed from active targets + kill chains + conflict events, displayed as a color bar (GREEN/AMBER/RED/BLACK)
- Add **Quick Layer Presets**: "ISR MODE" (satellites+sensors+targets), "STRIKE MODE" (targets+killchain+S2S), "RECON MODE" (flights+maritime+sensors)

## Files to Modify
- `src/components/dashboard/KillChainPanel.tsx` — target picker, BDA, locate, full actions
- `src/components/dashboard/C2ChatTab.tsx` — structured rendering, contextual suggestions, copy
- `src/components/dashboard/FourDMap.tsx` — Panoptic Control dynamic suggestions + presets

## No database changes needed
All data already exists in `target_tracks`, `kill_chain_tasks`, `sensor_feeds`, `force_units`.

