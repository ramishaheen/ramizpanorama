

# Lite Mode: Clear Gun-Eye Center + Radial Blur + Performance Boost

## What Changes

### 1. Radial Blur Effect — Clear Center, Blurred Edges
Add a CSS radial blur overlay when `liteMode` is active in both **SatelliteGlobe** and **UrbanScene3D**. This uses a combination of `backdrop-filter: blur()` with a radial `mask-image` to keep the center (where the gun-eye reticle sits) crystal clear while blurring the periphery.

**Technique**: A full-screen overlay div with `backdrop-filter: blur(4px)` masked by a radial gradient (`radial-gradient(circle, transparent 15%, black 40%)`) — the transparent center lets the sharp content through, the opaque edges apply the blur.

### 2. Gun-Eye Reticle Enhancement
- Increase reticle opacity from 0.5 → 0.8 (SatelliteGlobe) and 0.3 → 0.7 (UrbanScene3D)
- Make lines slightly thicker for better visibility against the blurred background
- Add a subtle glow via `filter: drop-shadow` on the SVG

### 3. Performance Optimizations in Lite Mode

**SatelliteGlobe (`SatelliteGlobe.tsx`)**:
- Already reduces pixel ratio to 0.5 — good
- Reduce label rendering: skip city HTML elements entirely when `liteMode` (currently just shrinks them)
- Disable atmosphere glow layer when lite

**UrbanScene3D (`UrbanScene3D.tsx`)**:
- Already disables heavy layers and reduces aircraft SVGs
- Add: reduce Google Maps tile detail by setting `map.setOptions({ maxZoom: 16 })` in lite mode
- Increase flight poll interval from 30s → 60s in lite mode
- Disable interpolation animation (smooth aircraft movement) in lite mode — just snap positions
- Skip info window hover listeners on markers in lite mode

### Files Changed
- `src/components/dashboard/SatelliteGlobe.tsx` — blur overlay, reticle enhancement, perf tweaks
- `src/components/dashboard/UrbanScene3D.tsx` — blur overlay, reticle enhancement, perf tweaks

