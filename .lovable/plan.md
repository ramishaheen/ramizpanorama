

# Enhance Orbital Intelligence — Gotham/Palantir Design Overhaul

## Objective
Restyle the SatelliteGlobe UI (overlays, panels, buttons, HUD) to match the Gotham/Palantir command aesthetic used in the map command bar, while preserving all existing functionality (globe init, satellite tracking, AI chat, predictions, vessels, flights, orbit trails). The globe must NOT reinitialize — only CSS classes and JSX wrapper styling change.

## Key Constraint
- **Globe must not restart**: No changes to `useEffect` dependencies for globe init (line ~1307). Only touch the JSX render tree (lines ~2015-2964) and CSS.
- All logic (propagation, AI chat, prediction, search, vessels, flights) stays untouched.

## Design Changes

### 1. CSS — New Gotham orbital classes (`src/index.css`)
Add a set of `gotham-orbital-*` classes mirroring the command bar aesthetic:
- **`.gotham-orbital-panel`**: Same gradient background as `.gotham-cmd-bar` (`hsl(220 30% 6% / 0.92)`), `backdrop-blur(20px)`, thin cyan border (`hsl(190 60% 18% / 0.25)`), no holographic green
- **`.gotham-orbital-btn`**: Matches `.gotham-cmd-btn` sizing (height 24px, 9px mono font, same border/hover/active states)
- **`.gotham-orbital-header`**: Section headers with `border-bottom`, uppercase 8px tracking, cyan accent
- **`.gotham-orbital-badge`**: Same as `.gotham-cmd-badge`
- **`.gotham-orbital-hud`**: Top-left HUD restyled — remove green holographic color, use cyan (`hsl(190 80% 55%)`) as primary accent
- Replace the green holographic overlays (scanlines, sweep, corner brackets) with subtle Gotham-style ones using cyan tones instead of green

### 2. JSX Render Changes (`SatelliteGlobe.tsx` lines ~2015-2964)
Only the return/render JSX changes — no logic/hooks/effects modified:

**a) Background & Overlays (lines ~2016-2058)**
- Change holographic green (`rgba(0,255,200,...)`) to Gotham cyan (`rgba(0,180,220,...)`)
- Reduce scanline opacity further for cleaner look
- Keep corner brackets but use cyan

**b) Top-left HUD (lines ~2061-2108)**
- Replace `holo-flicker`/`holo-text` classes with `gotham-orbital-hud` styling
- Change green text colors to cyan (`hsl(190 80% 55%)`)
- Classification label stays red
- Keep all stat counts exactly as-is

**c) Top-right timestamp (line ~2110+)**
- Restyle with `gotham-orbital-panel` class

**d) Right sidebar controls (lines ~2412-2482)**
- Replace inline `bg-black/80` buttons with `gotham-orbital-btn` class
- Labels, Search, Refresh, Close buttons get uniform Gotham styling
- Country satellite breakdown panel gets `gotham-orbital-panel`

**e) Bottom bar — Flights, Vessels, Globe Styles, City Presets, Nav controls (lines ~2130-2409)**
- Replace `bg-black/70 backdrop-blur-md border border-white/20` with `gotham-orbital-panel` class
- Category filter chips in bottom-left use `gotham-cmd-btn` / `gotham-cmd-btn-active` classes
- Globe style selector buttons get Gotham button styling
- City preset bar gets same unified strip look

**f) Selected satellite detail panel (lines ~2575-2712)**
- Apply `gotham-orbital-panel` background instead of inline `rgba(0,15,20,0.92)`
- Keep category color accents for border/header
- Data rows stay the same (already use `DataRow` component)
- AI Predict / Ask AI buttons get `gotham-orbital-btn` class

**g) AI Prediction panel (lines ~2716-2783)**
- Same `gotham-orbital-panel` treatment
- Green accent stays for prediction-specific elements

**h) AI Chat panel (lines ~2820-2900)**
- Apply `gotham-orbital-panel`
- Input area gets `gotham-orbital-btn` styling for send button

**i) Search overlay (lines ~2484-2541)**
- Apply `gotham-orbital-panel` with consistent border

**j) Hover tooltip (lines ~2787-2818)**
- Apply `gotham-orbital-panel` styling

### 3. What does NOT change
- Globe initialization effect (line ~1307)
- All `useCallback`/`useState`/`useEffect` hooks
- Satellite propagation logic
- TLE fetching/caching
- AI chat streaming
- Orbit prediction
- Flight/Vessel layers
- Country polygon interactions
- `createPortal` usage

### Summary
Pure visual reskin: swap the holographic green aesthetic for the Gotham/Palantir dark cyan command-bar aesthetic across all ~15 UI sub-panels in the orbital view. No structural or logic changes.

