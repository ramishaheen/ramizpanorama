

# Unified Gotham/Palantir Bottom Command Bar

## Overview
Consolidate all map controls (bottom bar + top-right satellite/layers + top-right map tools) into a single horizontal **command strip** at the bottom of the map, styled with sharp Gotham/Palantir military aesthetics — uniform button sizes, 1px borders, monospace typography, no rounded corners, cyan accent highlights.

## Current State
- **Bottom bar** (absolute bottom-3): UP42, Legend, History, MapStyle, Bookmarks, spacer, Chokepoint, TotalLaunches, Intel Tools — all with inconsistent sizes and `rounded-lg` styling
- **Top-right**: ImageryLayerPanel (satellite/layers selector) — `absolute top-3 right-3`
- **Top-right below**: MapToolbar (pin/danger/intel/troop tools) — `absolute top-14 right-3`

## Target Layout
One unified bottom strip with consistent Gotham-styled buttons, grouped into logical sectors:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ▎IMAGERY        ▎MAP TOOLS       ▎ANALYSIS                ▎INTEL         │
│ [OSM][ESRI]     [Pin][Danger]    [UP42][Legend][History]   [Orbital]      │
│ [GSAT][+Layers] [Intel][Troop]   [Style][Bookmarks]       [Urban3D]      │
│                                  [Chokepoint][Launches]    [CCTV][+more]  │
│                                                            [Scouting]     │
└────────────────────────────────────────────────────────────────────────────┘
```

All buttons are uniform: sharp corners (rounded-none), 1px cyan/border, same height (h-7), monospace 8-9px text.

## File Changes

### 1. `src/components/dashboard/IntelMap.tsx`
- Remove `<ImageryLayerPanel />` from top-right position
- Remove `<MapToolbar />` from top-right position  
- Replace the entire bottom bar `div` with a new unified `<MapCommandBar />` component
- Pass all props (layers, imagery, tools, bookmarks, etc.) to `MapCommandBar`

### 2. New: `src/components/dashboard/MapCommandBar.tsx`
- Single horizontal bar: `absolute bottom-0 left-0 right-0` with sharp Gotham styling
- **Structure**: Flex row with 4 grouped sections separated by 1px vertical dividers:
  1. **IMAGERY** — Base layer buttons (OSM/ESRI/GSAT) + overlay expand button (moved from ImageryLayerPanel)
  2. **MAP TOOLS** — Pin/Danger/Intel/Troop buttons (moved from MapToolbar) 
  3. **ANALYSIS** — UP42, Legend, History slider, MapStyle, Bookmarks, Chokepoint, TotalLaunches (existing bottom bar items)
  4. **INTEL** — Intel Tools dropdown items (Orbital, Urban3D, CCTV, Response Map, Crisis Intel, Iran FIR, Snap Me, Scouting)
- Each section has a tiny uppercase label at top (8px, cyan, left-border accent)
- All buttons uniform: `h-7 px-2 text-[8px] font-mono uppercase tracking-wider rounded-none border border-border/40`
- Active states: `bg-primary/15 text-primary border-primary/40`
- Expanded panels (Legend detail, History slider, UP42 search, Imagery overlays) pop upward from their button position
- Background: `bg-[#0a0d12]/95 backdrop-blur-xl border-t border-[hsl(190,60%,18%)]`

### 3. `src/index.css`
- Add `.gotham-cmd-btn` utility class for uniform button styling
- Add `.gotham-section-divider` for vertical separators
- Add `.gotham-cmd-bar` for the bar background

### 4. Remove standalone positioning from:
- `ImageryLayerPanel.tsx` — make it accept inline rendering (remove `absolute top-3 right-3` wrapper, export inner content)
- `MapToolbar.tsx` — make it accept inline rendering (remove `absolute top-14 right-3` wrapper)

