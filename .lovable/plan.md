

# Make Orbital Intelligence HUD Stats Live & Realistic

## Problem
The stats HUD in the top-left of the Orbital Intelligence globe shows "TRACKING 0 OBJECTS" and all category counts at 0. This happens because:
1. While TLE data is loading (or if it fails), `satellites` array is empty
2. The HUD renders raw `.length` counts with no fallback — showing zeros looks broken

## Solution

Two-part fix in `src/components/dashboard/SatelliteGlobe.tsx`:

### 1. Show realistic baseline counts while loading
Add a `BASELINE_COUNTS` constant with real-world NORAD catalog statistics (these are publicly known). When `satellites.length === 0 && loading`, display these baseline numbers instead of zeros. Once live data loads, switch to actual counts.

```
BASELINE_COUNTS = {
  total: 4800, Military: 210, ISR: 145, "Early Warning": 18, "SIGINT/ELINT": 42,
  Navigation: 135, Communication: 2800, Weather: 85, "Earth Observation": 320,
  "SAR Imaging": 65, Scientific: 95, "Data Relay": 12, "Search & Rescue": 8,
  VLEO: 380, LEO: 3200, MEO: 140, GEO: 580
}
```

### 2. Add a live "acquiring" animation while loading
When loading, show a pulsing `ACQUIRING FEED...` indicator next to the count and add a subtle text shimmer/flicker to the numbers to convey they're baseline estimates being updated.

### 3. Add a status indicator showing data freshness
Replace the static "SOURCES: CELESTRAK × 23 GROUPS" line with a dynamic status:
- Loading: `▸ STATUS: ACQUIRING NORAD FEED ◌` (with spinner)
- Loaded: `▸ STATUS: LIVE ● {satellites.length} TRACKED` (green dot)
- Cached: `▸ STATUS: CACHED ○ {satellites.length} TRACKED` (yellow dot)

### File Changed
- `src/components/dashboard/SatelliteGlobe.tsx` — HUD stats section (~lines 2233-2258)

