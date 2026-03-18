

## Plan: GeoAI Object Detection Map Overlay

### What
When the user runs **Object Detection** from the GeoAI panel, detected objects will be rendered as markers directly on the 3D Google Map at the current viewport location.

### How

**1. Add `mapRef` prop to GeoAIPanel**
- Update `GeoAIPanelProps` to accept `mapRef: React.RefObject<any>` (the Google Maps instance)
- Update `UrbanScene3D.tsx` line ~2434 to pass `mapRef={mapRef}` to `<GeoAIPanel>`

**2. Add marker rendering logic in GeoAIPanel**
- After a successful `objects` (or `full`) analysis, scatter detection markers on the map around the current `lat/lng`
- Each detected object gets a Google Maps `Marker` (or `AdvancedMarkerElement`) with:
  - Color-coded icon based on `threat_level` (red=high, orange=medium, yellow=low, gray=none)
  - Label showing the object `label` and `confidence %`
  - Small offset from center (randomized within ~200m radius based on zoom) to simulate spatial distribution
- Store marker references in a `useRef` array; clear previous markers before adding new ones
- Add a "Clear Detections" button in the panel to remove all markers from the map

**3. Marker styling**
- Use styled `google.maps.Marker` with `SymbolPath` or custom SVG icons matching existing threat-level color scheme
- Add an `InfoWindow` on click showing full object details (category, description, threat level, confidence)
- Markers will have a pulsing animation ring for high-threat objects using CSS in the marker label

**4. Detection area overlay**
- Draw a semi-transparent `google.maps.Circle` around the analysis point to indicate the scanned area radius (based on zoom level)
- Circle color matches the overall strategic value (emerald for low, orange for moderate, red for critical)

### Files to modify
- `src/components/dashboard/GeoAIPanel.tsx` — Add `mapRef` prop, marker rendering after analysis, clear function
- `src/components/dashboard/UrbanScene3D.tsx` — Pass `mapRef` to GeoAIPanel

