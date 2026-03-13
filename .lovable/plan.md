

# Upgrade Cyber Immunity Map to Realistic Leaflet-Based Map

## Problem
The current Cyber Immunity threat map uses simplified SVG polygon outlines (`worldMapPaths.ts`) — just rough continent shapes with flat fills. It looks basic and unrealistic.

## Solution
Replace the SVG-only map with a **Leaflet map** (already installed) using **dark satellite/tactical tiles**, and overlay the attack corridors, targeting reticles, and HUD elements on top using Leaflet's built-in SVG overlay layer. This gives a photorealistic dark basemap while keeping all the animated cyber attack visualizations.

## How It Works

### Map Base
- Use **CartoDB Dark Matter** tiles (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`) — free, no API key, dark tactical look
- Set default zoom to show the full world (~2.5) centered on Middle East region
- Disable scroll zoom by default (toggle with ctrl+scroll), keep drag pan
- Dark background matches the existing `hsl(220 30% 4%)` aesthetic

### Attack Overlays (Leaflet Layers)
- **Attack Corridors**: Render as Leaflet `Polyline` with curved coordinates (interpolated bezier-like points) using the same severity colors and animated dash arrays via CSS
- **Targeting Reticles**: Render as Leaflet `CircleMarker` + `DivIcon` custom markers at country coordinates with the same pulsing animations (CSS-based instead of SVG `<animate>`)
- **Country Labels**: Leaflet `DivIcon` markers with the same monospace styling

### HUD Overlay (HTML, not on map)
- Keep the corner brackets, title bar, live stats, severity legend, and classification banner as **absolute-positioned HTML divs** over the map container (same as current but using divs instead of SVG elements)
- This ensures HUD stays crisp and doesn't pan/zoom with the map

### Scan Line Effect
- CSS animation overlay (`pointer-events: none`) on top of the map container for the scan line sweep

## File Changes

### 1. Edit: `src/components/dashboard/CyberImmunityModal.tsx`
- Replace the `ThreatMap` component internals:
  - Remove the SVG `<svg viewBox>` with `WORLD_REGIONS` paths
  - Add a Leaflet `MapContainer` with `TileLayer` (CartoDB Dark Matter)
  - Create attack corridor polylines using Leaflet
  - Create targeting reticle markers using custom `DivIcon`s with CSS animations
  - Move HUD elements (title, stats, legend, classification) to absolute-positioned HTML divs
  - Keep the same props interface (`threats`, `onSelect`, `selectedId`)

### 2. Add: `src/components/dashboard/cyber/CyberThreatMapLeaflet.tsx` (new)
- Extract the new Leaflet-based threat map into its own component for cleanliness
- Includes: map setup, corridor rendering, reticle markers, HUD overlays
- Handles click-to-select on corridors/nodes
- Animated CSS classes for pulse effects and dash animations

### 3. Edit: `src/index.css`
- Add CSS keyframes for cyber map pulse animations and dashed-line movement (replacing SVG `<animate>` elements)

