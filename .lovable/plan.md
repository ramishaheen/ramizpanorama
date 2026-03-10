

## Fix: Right Panel Disappearing & Enhance 4D Map Realism

### Problem Analysis

The right-side Attributes panel disappears because globe.gl's canvas (created inside `globeContainerRef`) expands to cover the full parent container, overlapping the right panel with a higher z-index. The globe's Three.js canvas gets `position: absolute` styling that covers the flex siblings. The fix requires constraining the globe canvas and ensuring the right panel has proper z-index stacking.

Additionally:
- Satellite rendering uses points (dots) instead of visible orbital representations
- Emulated data needs richer, more representative content per layer category
- The right panel needs stable positioning that won't be overridden by the globe canvas

### Plan

#### 1. Fix Right Panel Visibility (Attributes Panel)
- Wrap the globe container div in a `relative overflow-hidden` container so the canvas stays contained
- Give the right panel `z-[50]` and `position: relative` to ensure it stays above the globe canvas
- Add `pointer-events-auto` to the right panel to prevent the globe from intercepting clicks

#### 2. Satellite Orbit Visualization
- Replace simple dot rendering for satellites with arcs that trace partial orbital paths
- For ISR/key satellites: render 3-4 arc segments ahead and behind current position to show the orbital track
- Use `arcsData` with same-altitude start/end points offset by a few degrees along the orbital plane
- Color-code orbit tracks: red for military, cyan for EO, green for navigation, purple for weather

#### 3. Emulated Data Improvements
- Add more emulated OSINT events with varied categories and clearer descriptive labels
- Increase point radius for all markers by ~1.5x for better visibility
- Add `htmlElementsData` labels for key emulated events (top 5 critical) so they're always visible as floating HTML badges, not just hover labels
- Ensure all satellites (including non-ISR) get proper `objectsData` labels visible on the globe

#### 4. Layer Active State Feedback
- When a layer is toggled ON, briefly flash the left panel layer row with a glow effect
- Add a count badge next to each active layer showing how many items are currently rendered
- In the right panel Panoptic section, show a live count of visible points per sub-toggle

### Files to Modify
- `src/components/dashboard/FourDMap.tsx` — All changes in this single file

### Key Technical Details

**Right panel fix** — The core issue is the globe container div (`flex-1 relative`) allows the Three.js canvas to break out of its bounds. Fix:
```text
Before: <div className="flex-1 relative">
After:  <div className="flex-1 relative overflow-hidden" style={{minWidth:0}}>
```
And the right panel needs:
```text
<div className="w-64 flex-shrink-0 ... relative z-[50]" style={{minWidth:256}}>
```

**Satellite orbits** — Add orbital track arcs for top 30 satellites by computing positions ±10° along the mean anomaly, creating short arc segments that show direction of travel. These arcs use lower opacity (0.2-0.3) and thinner stroke.

**Persistent labels** — Use `htmlElementsData` or enhanced `objectsData` for the top ~20 critical emulated events so labels are always visible (not just on hover), similar to how ISR satellite labels work.

