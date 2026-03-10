

## 4D Map Enhancements: Event Feed, Right Panel, Satellite Visualization & X Button

### What Gets Built

#### 1. Real-Time Event Feed Panel (Right side, below attributes)
A scrolling intelligence event feed showing emulated + real events with:
- Severity-colored left border (critical=red, high=orange, medium=yellow, low=cyan)
- Timestamp, event type, location
- Click-to-zoom: clicking an event calls `globe.pointOfView()` to fly to coordinates
- Auto-scrolls as new events appear during timeline playback
- Events filtered by current timeline position

#### 2. Right-Side Attributes Panel (Reference image 1 style)
Palantir/GOTHAM-class control panel with:
- **BLOOM** toggle — post-processing visual effect toggle
- **SHARPEN** toggle with slider (0-100%)
- **HUD** toggle — show/hide telemetry overlays
- **LAYOUT** dropdown — Tactical / Strategic / Minimal presets
- **PANOPTIC** section (green accent) with density slider and sub-toggles for Flights, Satellites, Maritime
- **CLEAN UI** button — hides all panels for clean globe view
- REC timestamp + ORB/PASS counters in top corner
- Satellite labels (WORLDVIEW-3, WV-LEGION-2 style) floating on globe

#### 3. Enhanced Satellite Visualization (Reference image 2 style)
- Satellites rendered with **scan cone lines** — dashed lines from satellite to ground footprint showing imaging swath
- Key ISR satellites (WORLDVIEW, BARS-M, GAOFEN) get named labels floating above them with diamond icons
- Military sats in red, civilian EO in cyan, with connecting scan lines to ground
- Satellite ground footprint visualization (semi-transparent colored rectangles on ground)

#### 4. X Button → Main Screen
Replace current "CLOSE" button with a prominent **X** button that calls `onClose()` to return to the main dashboard.

#### 5. Timeline Connected to All OSINT Sources
Timeline already filters emulated events; extend to also filter:
- Geo-fusion events by timestamp
- Conflict events (use `event_date` field)
- Earthquake events (use `time` field)
- Wildfire events (construct timestamp from `date` + `time`)

### Files to Modify
- `src/components/dashboard/FourDMap.tsx` — All changes in this single file

### Architecture
```text
FourDMap Layout:
┌──────────┬─────────────────────────┬──────────┐
│ Left     │       Globe             │ Right    │
│ Layers   │                         │ Attrs    │
│ Panel    │  [Search Bar]           │ Panel    │
│          │                    [X]  │ ─────── │
│          │  SAT labels floating    │ BLOOM    │
│          │  with scan cones        │ SHARPEN  │
│          │                         │ HUD      │
│          │                         │ LAYOUT   │
│          │                         │ PANOPTIC │
│          │                         │ ─────── │
│          │                         │ EVENT    │
│          │                         │ FEED     │
│          │                         │ (scroll) │
├──────────┴─────────────────────────┴──────────┤
│ Bottom: Timeline + Speed + Orbit + Chips       │
└────────────────────────────────────────────────┘
```

### Key Implementation Details
- Right panel width: `w-64`, same dark style as left panel
- Event feed: sorted by timestamp descending, max ~50 items visible, combines emulatedEvents + geoFusion + conflicts + earthquakes into unified feed
- Satellite scan cones: Use `arcsData` with custom styling — arcs from satellite position to ground center of scan area
- Named satellite labels: Use `objectLabel` with styled HTML showing satellite name + diamond icon
- PANOPTIC density slider controls `pointRadius` multiplier for all points
- CLEAN UI toggle hides left panel, right panel, and bottom bar
- REC indicator: top-right blinking red dot with current UTC timestamp

