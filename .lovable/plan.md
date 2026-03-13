

# Fix Cyber Immunity Threat Map — Add World Map + Details

## Problem
The threat map is an empty grid with floating dots — no land masses, no country outlines. Users can't tell where attacks are happening geographically. The map needs actual world continent outlines to be useful.

## Changes

### 1. Add World Map SVG Path Data
Create `src/data/worldMapPaths.ts` containing simplified SVG path outlines for all major continents and key countries (Africa, Europe, Asia, Americas, Middle East detail). These are standard equirectangular-projected SVG paths that render at the 900×450 viewBox scale.

### 2. Update `ThreatMap` in `CyberImmunityModal.tsx`
- Import the world map paths
- Render continent/country outlines as filled SVG `<path>` elements with dark fill (`hsl(var(--muted))` at low opacity) and subtle border strokes **behind** the grid lines
- Add ocean background color to distinguish land from water
- Add country name labels for key nations (Middle East focus)
- Enhance node tooltips to show attack count and severity breakdown on hover
- Add a mini legend showing severity colors

### 3. Enhance Detail Display
- When a country node is hovered, show a tooltip with: country name, total incidents, severity breakdown, top attack types
- Make the country outlines highlight when they're involved in active threats
- Add lat/lng graticule labels on edges (0°, 30°, 60° etc.)

## Files
1. **Create**: `src/data/worldMapPaths.ts` — simplified world outline SVG paths
2. **Edit**: `src/components/dashboard/CyberImmunityModal.tsx` — render world map behind threat data, add tooltips and labels

