

# Enhance Cyber Threat Operations Center HUD Overlays

## Problem
The HUD elements (title, live stats, severity legend, classification banner) on the Leaflet threat map are too small (6-7px fonts), low opacity, and get lost behind/within the map tiles. They look like afterthoughts rather than a proper command center overlay.

## Changes — `src/components/dashboard/cyber/CyberThreatMapLeaflet.tsx`

### 1. Title Bar (lines 296-303)
- Increase font from `text-[7px]` → `text-[10px]`
- Add a left cyan accent bar `border-l-2 border-primary`
- Increase padding, add a subtle `backdrop-blur-md` and stronger background opacity
- Add a pulsing green dot "LIVE" indicator next to the title
- Raise z-index to `z-[450]` so it sits firmly above all map layers

### 2. Live Stats Panel (lines 305-313)
- Increase all fonts from `text-[6px]/text-[6.5px]` → `text-[9px]/text-[10px]`
- Add `backdrop-blur-md`, stronger bg opacity (`bg-[hsl(220,30%,6%)]/95`)
- Increase min-width, add left cyan border accent
- Add a subtle scanline/grid overlay inside the panel

### 3. Severity Legend (lines 315-326)
- Scale up dot sizes from `w-1.5 h-1.5` → `w-2.5 h-2.5`
- Scale up text from `text-[6.5px]` → `text-[9px]`
- Add `backdrop-blur-md`, match styling with stats panel

### 4. Classification Banner (lines 328-335)
- Scale up from `text-[6px]` → `text-[9px]`
- Increase padding, raise opacity from 0.7 → 0.95
- Add `backdrop-blur-md`

### 5. Corner Brackets (lines 288-294)
- Increase size from `w-5 h-5` → `w-8 h-8`
- Increase border opacity from `border-primary/30` → `border-primary/50`

### 6. Hover Tooltip (lines 337-350)
- Scale up text sizes proportionally

All panels get `backdrop-blur-md` and raised z-indices to ensure they render cleanly above the Leaflet tile layers.

### File Changed
- `src/components/dashboard/cyber/CyberThreatMapLeaflet.tsx`

