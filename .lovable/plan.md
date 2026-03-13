

# Fix Orbital Intelligence — Rendering Issues

## Diagnosis

After thorough code inspection of `SatelliteGlobe.tsx` (3145 lines), I identified several structural bugs that prevent features from working correctly after the globe initializes:

### Bug 1: Duplicate `ringsData` Overwrites OSINT Markers
During globe init, `ringsData` is set **twice**:
- Line 1647: `.ringsData(OSINT_MARKERS)` — conflict zones, military bases, radar sites
- Line 1731: `.ringsData(CITY_PRESETS...)` — city pulse rings

The second call **completely overwrites** the first, so OSINT marker rings never appear on the globe. The later `coverageRing` useEffect (line 2097) also only includes city rings + coverage, losing OSINT rings.

### Bug 2: Stale Closure in `htmlElement` Callback
The `htmlElement` callback (line 1681) is set once during init and captures `liteMode` from the initial closure (always `false`). When the user toggles Lite Mode, the city HTML elements **never re-render** with simplified styling because globe.gl doesn't re-invoke the factory function for existing elements.

### Bug 3: Vessel HTML Elements Not Updating on Lite Mode Toggle
Same stale closure issue — vessel markers created in the vessel useEffect (line 1946) capture `liteMode` but the useEffect doesn't include `liteMode` in its dependency array.

### Bug 4: Globe `htmlElementsData` Set During Init Only
The HTML elements (OSINT labels + city markers) are set once during init but never updated when data changes. The vessel useEffect at line 1946 calls `htmlElementsData` again, which **overwrites** the OSINT + city HTML elements with only vessel data.

## Plan

### 1. Fix ringsData — Merge OSINT + City + Coverage Rings
Remove the duplicate `ringsData` call during init. Consolidate all ring sources into the coverage ring useEffect, which already runs reactively:
- Merge `OSINT_MARKERS` rings + `CITY_PRESETS` rings + optional `coverageRing`
- Add `ringMaxRadius` handling per type (OSINT vs city vs coverage)

### 2. Fix HTML Elements — Consolidate Into Single Reactive Effect  
Create a new `useEffect` that merges OSINT labels, city markers, AND vessel markers into a single `htmlElementsData` call. This effect depends on `[aisVessels.data, vesselTypeVisible, liteMode]` so it re-renders when any of those change.
- Remove `htmlElementsData` from globe init
- Remove the separate vessel HTML useEffect's `htmlElementsData` calls
- The single effect handles all HTML element types

### 3. Fix Lite Mode Reactivity
Add `liteMode` to the dependency array of the consolidated HTML elements effect so city dots update their size and glow when toggling.

### 4. Ensure Globe Init Guard
Add a `globeInitError` display fallback so users see a clear message if WebGL context fails (e.g., after using the 3D Map which also uses WebGL).

## Files Changed

1. **Edit**: `src/components/dashboard/SatelliteGlobe.tsx`
   - Remove second `ringsData` call from init chain (line ~1731)
   - Remove `htmlElementsData` setup from init chain (line ~1674)
   - Merge OSINT rings into the coverage ring useEffect (line ~2097)
   - Create consolidated HTML elements useEffect combining OSINT labels + cities + vessels
   - Add `liteMode` to vessel/HTML element effect deps
   - Add WebGL context recovery guard

