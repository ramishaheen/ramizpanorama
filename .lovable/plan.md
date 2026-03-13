

# Add Hover Descriptions to All Map Icons

## Problem
Several marker types on the 2D Intel Map only show popups on **click**. The user wants **hover** to show descriptions for every icon/object.

## Current State
- `bindHoverPopup()` (line 211) adds mouseover/mouseout listeners but only works with `L.Marker`
- Already using hover: War updates, Telegram, Conflicts, Flights, Nuclear, Air Quality, AIS Vessels, CCTV, Weather, Google POIs
- **Missing hover** (click-only via `bindPopup`): Airspace alerts, Maritime vessels, Geo alerts, Rockets, Chokepoints, Earthquakes, Wildfires, City landmarks, User items

## Plan

### 1. Extend `bindHoverPopup` to work with any Leaflet layer
The current function signature accepts `L.Marker` only. Create a generic version that works with `L.Circle`, `L.CircleMarker`, `L.Polyline`, and `L.Marker` — all support `bindPopup`, `mouseover`, and `mouseout`.

### 2. Convert all click-only markers to hover popups

**Airspace alerts** (circles, ~line 1019): Replace `circle.bindPopup(...)` with hover version
**Maritime vessels** (mock data, ~line 1035): Replace `marker.bindPopup(...)` with `bindHoverPopup()`
**Geo alerts** (circleMarkers, ~line 1057): Replace with hover version
**Rockets** (~line 1096): Replace `marker.bindPopup(...)` with `bindHoverPopup()`
**Chokepoints** (circles, ~line 1139): Replace `circle.bindPopup(...)` with hover version
**Earthquakes** (circleMarkers, ~line 1189): Replace with hover version
**Wildfires** (~line 1239): Replace `marker.bindPopup(...)` with `bindHoverPopup()`
**City landmarks** (~line 1529): Replace `.bindPopup()` with hover listeners (keep the rich image popup)
**User items** (~line 936): Add hover listeners to the existing `bindPopup`

### 3. All popups use `autoPan: false`
Per existing project conventions, hover popups must never trigger map panning.

### File Changes
- `src/components/dashboard/IntelMap.tsx` — Single file, ~9 edits converting `bindPopup` calls to hover-based popups

