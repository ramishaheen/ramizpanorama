

# Fix Cyber Immunity: Loading Screen with WAROS Logo + Fix Black Map

## Two Issues

### 1. Loading screen is generic
The current loading state (lines 1096-1110) shows a `ShieldAlert` icon and text. User wants the WAROS logo (`src/assets/waros-logo.png`) with a proper loading animation.

### 2. Map shows black
The `cyber-threat-map` CSS class (line 1051-1053 in `index.css`) applies `brightness(0.5) contrast(1.3) saturate(0.4)` to the Leaflet tile pane. CartoDB Dark Matter tiles are already very dark — this filter makes them nearly invisible (black). Additionally, the Leaflet `MapContainer` may not get proper height inside the flex layout.

## File Changes

### 1. Edit: `src/components/dashboard/CyberImmunityModal.tsx`
**Loading screen** (lines 1096-1110): Replace `ShieldAlert` icon with the WAROS logo image (`warosLogo` import), add a spinning ring animation around it, show a progress bar that fills as sources connect, and display source names with animated check marks appearing sequentially.

Also replace the "no data" state (lines 1112-1127) with the same WAROS logo treatment.

### 2. Edit: `src/index.css`
**Fix the CSS filter** (lines 1050-1053): Change `brightness(0.5)` to `brightness(0.85)` and reduce `saturate` to `0.6` so tiles are visible but still dark/tactical. This keeps the aesthetic without making tiles invisible.

### 3. Edit: `src/components/dashboard/cyber/CyberThreatMapLeaflet.tsx`
Add explicit `height: 100%` on the MapContainer wrapper to ensure Leaflet renders properly inside the flex layout. Ensure the `.leaflet-container` has a minimum height.

