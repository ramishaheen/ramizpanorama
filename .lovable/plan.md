## 4D Map — Full-Screen Globe with All Intel Layers + Radio Toggle Panel

### Overview

Add a "4D MAP" button next to the AI Chat circle in the header. Clicking it opens a full-screen globe (reusing `globe.gl`) that aggregates ALL intelligence data from existing hooks (flights, satellites, earthquakes, wildfires, conflicts, maritime, nuclear, rockets, geo-fusion events, etc.). A left-side radio/checkbox panel lets users toggle each data layer on/off, similar to the reference screenshot's layer controls.

### What Gets Built

#### 1. New Component: `FourDMap.tsx`

A full-screen overlay containing:

- **Globe** (globe.gl) with earth textures, atmosphere, auto-rotation
- **Left panel** with toggleable layer checkboxes styled like the reference (dark, compact, with colored indicators):
  - Commercial Flights
  - Military Flights  
  - Satellites (orbital tracks)
  - Maritime / AIS Vessels
  - Earthquakes
  - Wildfires / Fire Hotspots
  - Conflict Events (ACLED-style)
  - Rockets / Missiles
  - Nuclear Monitors
  - Air Quality
  - Geo-Fusion Events (airstrikes, drones, etc.)
  - Country Borders
  - OSINT Arcs (threat corridors)
  - GPS Jamming
- Each layer toggle dynamically adds/removes data from the globe
- Close button to return to dashboard

#### 2. Data Integration

The component will import and call existing hooks:

- `useEarthquakes` → point markers (sized by magnitude)
- `useWildfires` → fire hotspot markers
- `useConflictEvents` → conflict markers with emoji-coded types
- `useNuclearMonitors` → radiation station markers
- `useAISVessels` → vessel markers on sea
- `useGeoFusion` → fusion events as colored markers
- `useLiveDashboard` → rockets, airspace alerts, vessels, geo alerts
- Live flights via existing edge function
- Satellites via TLE fetch (reuse `parseTLEFull` + `propagateSatellite` from SatelliteGlobe)

Data rendered on globe using:

- `pointsData` for static markers (earthquakes, wildfires, conflicts, nuclear)
- `objectsData` for satellites (with sprites)
- `arcsData` for OSINT threat corridors and rocket trajectories
- `pathsData` for orbital tracks
- `polygonsData` for country borders

#### 3. Header Button

Add a "4D MAP" button in `DashboardHeader.tsx` right after the chat circle button, styled consistently with the existing header buttons.

### Files to Create/Modify

- **Create** `src/components/dashboard/FourDMap.tsx` — the full-screen 4D globe component
- **Modify** `src/components/dashboard/DashboardHeader.tsx` — add 4D MAP button + state + render

### Architecture

```text
DashboardHeader
  └─ [4D MAP] button → opens FourDMap overlay
       ├─ Left Panel: Layer toggles (checkboxes)
       ├─ Globe (globe.gl)
       │   ├─ pointsData: earthquakes, wildfires, conflicts, nuclear, AQ, vessels
       │   ├─ objectsData: satellites (TLE propagated)
       │   ├─ arcsData: OSINT corridors, rocket trajectories
       │   ├─ pathsData: satellite orbital tracks
       │   └─ polygonsData: country borders
       └─ Close button (X)
```