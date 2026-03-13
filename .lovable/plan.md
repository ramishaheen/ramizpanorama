

# Add "Components" Toggle Panel to Map Command Bar

## What it does
A new **COMP** button in the DATA section of the MapCommandBar. When clicked, a floating panel appears **above the command bar** (like the existing IMAGERY OVERLAYS and INTEL TOOLS panels) listing all major dashboard components with on/off toggles. Users can hide/show components while keeping the map visible.

## Toggleable Components
These are the dashboard-level components that overlay or surround the map:

| Component | Default | Description |
|-----------|---------|-------------|
| Header | ON | Top navigation bar (DashboardHeader) |
| Stats Bar | ON | Live statistics strip below header |
| Left Sidebar | ON | Intel widgets panel |
| Right Sidebar | ON | Notifications, war updates, layers |
| Bottom Row | ON | Citizen Security + Sector Predictions + Social Sentiment |
| Holographic Overlay | ON | Corner HUD overlay on map |
| Disclaimer | ON | Bottom disclaimer bar |

## UI Design
- Button: `COMP` with a `LayoutGrid` icon in the DATA section, between LAUNCH and the section divider
- Panel: Opens **above** the command bar (`absolute bottom-full`), positioned center-right, z-index 1002 (above all other panels at 1001)
- Panel width: ~240px, styled identically to the existing IMAGERY OVERLAYS expanded panel (`.gotham-expanded-panel`)
- Each row: component name + toggle switch, matching the existing gotham aesthetic
- Badge on COMP button shows count of hidden components (if any)

## Architecture
- **Component visibility state** lives in `Index.tsx` (since it controls DashboardHeader, StatsBar, sidebars, bottom row)
- New interface `ComponentVisibility` with boolean fields for each toggleable component
- State passed down to `IntelMap` → `MapCommandBar` as a prop
- Toggle callbacks passed down the same way
- The panel itself is rendered inside `MapCommandBar.tsx` as a new expanded panel (same pattern as `overlayExpanded` and `intelExpanded`)

## Files Changed

### 1. Edit: `src/components/dashboard/MapCommandBar.tsx`
- Import `LayoutGrid` icon
- Add `componentsExpanded` local state
- Add new props: `componentVisibility` (record of booleans) and `onToggleComponent` callback
- Add COMP button in DATA section
- Add expanded panel (same pattern as overlay/intel panels) with toggle rows for each component
- Panel renders at `absolute bottom-full` with z-[1002]

### 2. Edit: `src/components/dashboard/IntelMap.tsx`
- Pass through new `componentVisibility` and `onToggleComponent` props to MapCommandBar
- Accept them from parent and forward
- Toggle HolographicOverlay visibility based on `componentVisibility.holographic`

### 3. Edit: `src/pages/Index.tsx`
- Add `componentVisibility` state with all defaults ON
- Add `toggleComponent` handler
- Conditionally render DashboardHeader, StatsBar, left sidebar, right sidebar, bottom row, Disclaimer based on visibility state
- Pass state + handler to IntelMap

