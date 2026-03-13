

# Fix Scouting Tiles Disappearing After Data Loads

## Problem
When data loads in the Scouting overlay, tiles without large content collapse because there's no `min-height` on `.scouting-tile`. The flex layout allows tiles to shrink to zero, making most boxes invisible — only CitizenSecurity and SectorPredictions remain visible because they have enough content to maintain height.

The root cause is the combination of:
1. `.scouting-overlay` has `overflow: hidden` — prevents scrolling at the top level
2. `.scouting-grid-container` has `flex: 1` with `overflow-y: auto` — but tiles inside have no guaranteed minimum height
3. `.scouting-tile` uses `display: flex` with no `min-height` — tiles with less content collapse when siblings expand

## Fix

### `src/index.css` — 3 changes:

1. **`.scouting-tile`**: Add `min-height: 200px` so every tile always stays visible regardless of content size
2. **`.scouting-grid-row`**: Change from implicit height to explicit `grid-auto-rows: minmax(220px, auto)` so rows never collapse
3. **`.scouting-civil-tile`**: Add `min-height: 180px` for the bottom row tiles
4. **`.scouting-tile-body`**: Add `overflow-y: auto` with `flex: 1; min-height: 0` to ensure content scrolls within the tile rather than pushing other tiles away

### `src/components/dashboard/ScoutingModal.tsx` — No structural changes needed
The component structure is correct; only the CSS needs fixing to prevent tile collapse.

