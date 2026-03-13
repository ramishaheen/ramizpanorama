

# Audit: Live Data Across All Map Views

## Current Status

| Data Layer | 2D Intel Map | Orbital Globe | Urban 3D |
|---|---|---|---|
| Flights | ✅ 15s poll, dual bbox | ⚠️ Props from 2D — empty if flights layer off | ✅ 15s poll, viewport bbox |
| Satellites (TLE) | N/A | ✅ CelesTrak + 500ms propagation | N/A |
| AIS Vessels | ✅ useAISVessels hook | ✅ useAISVessels hook | ✅ 30s poll ais-vessels |
| Geo Alerts | ✅ Realtime (props) | ❌ Static OSINT markers only | ✅ LiveIncidentsOverlay 30s |
| Rockets/Missiles | ✅ Realtime (props) | ❌ Missing entirely | ✅ 10s poll from DB |
| Earthquakes | ✅ useEarthquakes hook | ❌ Missing entirely | ✅ 5min poll USGS |
| Conflict Heatmap | ✅ useConflictEvents | ❌ Missing | ✅ 5min poll |
| Weather Radar | ✅ Overlay tiles | N/A | ✅ WeatherRadarOverlay |
| Wildfires | ✅ useWildfires hook | ❌ Missing | N/A |

## Issues Found

### 1. Orbital Globe — Flights depend on 2D layer toggle
`SatelliteGlobe` receives `flights` as a prop from `IntelMap`. The `fetchFlightData` function early-returns when `!layers.flights`, so if the user hasn't toggled on the flights layer in the 2D map, the globe gets an empty array. The globe should fetch its own flights independently.

### 2. Orbital Globe — No live geo-alerts, rockets, earthquakes, or wildfires
The globe only renders hardcoded `OSINT_MARKERS`. It has no connection to the `geo_alerts`, `rockets`, or earthquake/wildfire data that the other two views display live.

### 3. Urban 3D — Missing wildfires
The Urban 3D view fetches earthquakes but not wildfire data (NASA FIRMS), which the 2D map supports.

## Plan

### Fix 1: Independent flight fetching for Orbital Globe
**`SatelliteGlobe.tsx`** — Add its own `fetchFlights` with the same dual-bbox strategy (ME + SA), 15s interval, merge & dedup. Remove the `flights` prop dependency. This ensures the globe always has live flight data regardless of 2D layer state.

### Fix 2: Add live geo-alerts ring layer to Orbital Globe
**`SatelliteGlobe.tsx`** — Fetch `geo_alerts` from DB every 30s. Render them as pulsing ring markers on the globe (similar to existing OSINT markers but data-driven). Critical alerts get larger/faster pulse rings. Merge with static OSINT markers in `htmlElementsData`.

### Fix 3: Add live rockets to Orbital Globe
**`SatelliteGlobe.tsx`** — Fetch `rockets` from DB every 10s. Render active rockets as animated arcs on the globe using `arcsData` (origin → current position, colored by status). Show impact/intercepted as static markers.

### Fix 4: Add live earthquakes to Orbital Globe
**`SatelliteGlobe.tsx`** — Invoke `usgs-earthquakes` edge function every 5min. Render as pulsing ring markers sized by magnitude, merged into `htmlElementsData` or `ringsData`.

### Fix 5: Add wildfires to Urban 3D
**`UrbanScene3D.tsx`** — Invoke `nasa-wildfires` edge function every 5min. Render as fire markers on the Google Maps 3D view, similar to earthquake markers but with flame styling.

### Files Modified
- `src/components/dashboard/SatelliteGlobe.tsx` — Add independent flights fetch, live geo-alerts, rockets, earthquakes
- `src/components/dashboard/UrbanScene3D.tsx` — Add wildfire layer

