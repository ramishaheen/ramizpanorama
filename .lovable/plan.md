

## Plan: Fix Data Sources and Tools in the GeoAnalysis Panel

### Problem
The left sidebar panel in the 3D view has three tabs — **Map Layers**, **Data Sources**, and **Tools** — but two of them are broken:

1. **Data Sources** tab fetches from the `sensor_feeds` database table. If the table is empty or has few rows, users see "Loading feeds..." indefinitely with no useful content.
2. **Tools** tab (Range Ring, Geofence, Ballistic, etc.) silently fails because all 16 tool functions require `window.google.maps` to be loaded. If the Google Maps API key isn't available or hasn't loaded yet, clicking a tool does nothing — no error, no feedback.

### Changes

#### File: `src/components/dashboard/GeoAnalysisToolsPanel.tsx`

**1. Fix Data Sources — add hardcoded OSINT source definitions as fallback**
- Define a `DEFAULT_DATA_SOURCES` array with ~12 known OSINT feeds the system uses (GDELT, OpenSky, NASA FIRMS, USGS, AIS, WarsLeaks Telegram, NVD, ACLED, Sentinel, etc.) with realistic statuses.
- After fetching from `sensor_feeds`, merge with defaults: DB rows take priority, defaults fill gaps.
- Each source shows: name, type, status indicator (green/yellow/red dot), and last-data timestamp.
- This ensures the tab always shows meaningful content even with an empty database.

**2. Fix Tools — add Google Maps availability check with user feedback**
- In each tool's action function (or in the central `toggleTool` dispatcher), check if `window.google?.maps` exists before executing.
- If Google Maps is not loaded, show a toast: "Google Maps not loaded — tool unavailable."
- Add a small status indicator at the top of the Tools tab: a green "MAP READY" or red "MAP OFFLINE" badge so users know tool availability at a glance.
- When a tool is activated but the map isn't ready, visually mark it as "pending" (amber) rather than "active" (primary).

**3. Improve activation clarity on the left bar**
- Add active count badges on each tab trigger (e.g., "Tools (3)" when 3 tools are active).
- Make the Data Sources tab default to open instead of Tools, since sources are always populated and give immediate value.

### Files to modify
- **`src/components/dashboard/GeoAnalysisToolsPanel.tsx`** — All three changes above.

