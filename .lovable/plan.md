

# Add Lite Mode to 3D Map (UrbanScene3D)

## Context
The Orbital view's Lite Mode reduces Three.js renderer pixel ratio to 0.5. The 3D Map uses Google Maps JS API (not Three.js), so pixel ratio isn't directly adjustable. Instead, Lite Mode will optimize performance by:

## What Lite Mode Does
1. **Disables heavy overlay layers** — auto-turns off Traffic Particles, Weather Radar, Live Incidents, NASA NRT layers, heatmap
2. **Reduces flight interpolation frequency** — from current interval to 2x slower when lite
3. **Simplifies aircraft SVG icons** — smaller size, no animated rings/pulses
4. **Reduces marker update frequency** — vessels, earthquakes, weather refresh slower
5. **Adds a crosshair/reticle HUD** (same as Orbital) for the tactical feel
6. **Shows a performance indicator** in the top-left HUD

## UI
- A "⚡ Lite Mode / HD Mode" toggle button added to the **Style Presets bar** (bottom center, next to Normal/CRT/NVG/FLIR/Noir/Snow)
- When active, button glows with `gotham-orbital-btn-active` style
- A small "LITE" badge appears in the top-left HUD when active

## File Changes

### 1. Edit: `src/components/dashboard/UrbanScene3D.tsx`
- Add `liteMode` state (`useState(false)`)
- Add Lite Mode button to the Style Presets bar at bottom
- When `liteMode` is toggled ON:
  - Auto-disable: `showTrafficParticles`, `showWeatherRadar`, `showIncidents`, `showNrtModis/Viirs/Noaa20/Fires/NightLights`, `showHeatmap`
  - Reduce flight poll interval from 15s → 30s
  - Simplify `createAircraftSvg` — skip animated rings and pulse circles when lite
- When toggled OFF: restore previous layer states
- Add crosshair reticle overlay (same SVG as Orbital) when `liteMode` is true
- Add "LITE" indicator in top-left HUD panel
- Pass `liteMode` to `createAircraftSvg` to skip animations

No CSS changes needed — reuses existing styles.

