

# Implement the Global Intel Map (`/intel` page)

The `/intel` page is currently a placeholder. This plan replaces it with a full Leaflet-based intelligence map inside the `IntelLayout`, pulling live data from the database (intel_events, geo_alerts, target_tracks) and rendering clustered markers with severity coloring, click-to-inspect popups, and layer toggles.

## Architecture

Rather than reusing the 2,400-line dashboard `IntelMap.tsx` (which requires many props from the parent dashboard), this will be a **self-contained** map component that fetches its own data and focuses on the SENTINEL intel workflow (sources, events, incidents).

## Implementation

### 1. Create `src/components/intel/IntelGlobalMap.tsx`
A standalone Leaflet map component that:
- Initializes a dark-themed Leaflet map (CartoDB dark_all tiles) filling the parent container
- Fetches data on mount from 3 tables: `intel_events`, `geo_alerts`, `target_tracks`
- Uses `leaflet.markercluster` for density management
- Renders markers with severity-based colors (critical=red, high=orange, medium=yellow, low=green)
- Click popup shows: title, type, severity, coordinates, timestamp, source
- Right sidebar toggle panel with layer checkboxes: Events, Alerts, Targets
- Auto-refreshes every 30 seconds
- Responds to `useMapSync` for cross-map coordination (highlight coords, selected event)

### 2. Update `src/pages/intel/IntelMap.tsx`
- Replace the placeholder with `<IntelGlobalMap />` filling the content area
- Add a small top bar with: event count badge, refresh button, fullscreen toggle

### 3. Data Layer Details
Each data source maps to a marker cluster group:
- **intel_events**: `📡` icon, colored by severity, popup with title + event_type + confidence
- **geo_alerts**: `⚠️` icon, colored by severity, popup with title + source + description
- **target_tracks**: `🎯` icon, colored by priority, popup with track_id + classification + confidence

### 4. Layer Control Panel
A small floating panel (top-right) with toggles for each layer, total count per layer, and a "Fit All" button to zoom to bounds of all visible markers.

## Files
- **New**: `src/components/intel/IntelGlobalMap.tsx` (~250 lines)
- **Modified**: `src/pages/intel/IntelMap.tsx` (replace placeholder)

## No database or edge function changes needed
All tables (`intel_events`, `geo_alerts`, `target_tracks`) already exist with the required columns.

