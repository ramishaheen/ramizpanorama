

## Plan: Feed-Driven Globe Imagery Switching

When the user clicks a sensor feed in the SENSORS tab, the globe texture and visual style will update to match the feed's source type, providing contextual imagery appropriate to the sensor modality.

### How It Works

**Feed Type → Globe Texture Mapping:**

```text
Feed Type        Globe Image                          Atmosphere
─────────────────────────────────────────────────────────────────
satellite_eo     earth-blue-marble.jpg (default)      cyan
satellite_sar    earth-dark.jpg (radar/SAR look)      orange
satellite_ir     earth-night.jpg (thermal/IR)         red
drone            earth-blue-marble.jpg                green
cctv             earth-blue-marble.jpg (no change)    cyan
sigint           earth-dark.jpg (dark ops)            purple
osint            earth-blue-marble.jpg                cyan
ground/radar     earth-topology.png (terrain)         amber
iot              earth-blue-marble.jpg                cyan
```

### File Changes

#### 1. `src/components/dashboard/SensorFusionPanel.tsx`
- Add `onSelectFeed` callback prop: `(feed: SensorFeed) => void`
- When user clicks a sensor feed row, call `onSelectFeed(feed)` in addition to existing `onLocate`
- Add visual indicator showing which feed is currently "active" (highlighted border)

#### 2. `src/components/dashboard/FourDMap.tsx`
- Add `activeSensorFeed` state to track the selected sensor feed
- Create a `FEED_IMAGERY_MAP` constant mapping feed type prefixes to globe texture URLs + atmosphere colors (using freely available three-globe textures from unpkg)
- Add a `useEffect` that watches `activeSensorFeed` and calls `globeRef.current.globeImageUrl(...)` and `.atmosphereColor(...)` to swap the globe's appearance
- Pass `onSelectFeed` handler to `SensorFusionPanel` that sets the active feed, flies to its location, and swaps imagery
- Show a small HUD badge on the globe indicating the active sensor source name + feed type with a reset button

### Available Globe Textures (from unpkg/three-globe)
- `earth-blue-marble.jpg` — default EO/optical
- `earth-night.jpg` — night lights / IR thermal view  
- `earth-dark.jpg` — dark/minimal for SIGINT/SAR
- `earth-topology.png` — terrain relief for ground sensors
- `earth-water.png` — ocean emphasis for maritime/AIS

These are all free, no API key needed, hosted on unpkg CDN.

### Files Modified
- `src/components/dashboard/SensorFusionPanel.tsx` — add `onSelectFeed` prop + active feed highlight
- `src/components/dashboard/FourDMap.tsx` — imagery switching logic + HUD badge

