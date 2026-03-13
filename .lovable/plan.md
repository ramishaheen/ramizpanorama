

# Orbital Intel — Hover-Only City Labels + Lite Mode Crosshair

## Changes

### 1. City Labels: Show Name on Hover Only
Both city marker render blocks (lines ~1684-1704 and ~2030-2050) currently show the city name always. Change to:
- Default state: show only a small glowing dot (5px cyan circle) — no text label
- On `mouseenter`: expand to show the full label with name, landmark, and country
- On `mouseleave`: collapse back to just the dot

This keeps the globe clean while letting users discover cities by hovering.

### 2. Lite Mode: Crosshair Reticle Overlay
When `liteMode` is active, add a centered crosshair/gun-sight SVG overlay on the globe container:
- Fixed center-screen reticle with concentric circles, cross lines, and range tick marks
- Semi-transparent cyan styling matching the Gotham theme
- The reticle stays fixed while the user rotates/pans the globe, creating a "scope" feel for focused reconnaissance
- Also reduce city markers to even smaller dots (3px) in lite mode

### Files Changed
1. **Edit**: `src/components/dashboard/SatelliteGlobe.tsx`
   - Update both city `htmlElement` render blocks to hide label text by default, show on hover
   - Add a crosshair SVG overlay div that renders when `liteMode === true`
   - Reduce marker sizes in lite mode

