

## Plan: Context-Aware Sensor Panel + Click-to-Navigate

### What Changes

When a feed event or target is selected (via Action-Chain or direct selection), the **SENSORS** tab will:
1. Filter sensors by geographic proximity to the selected event/target (sensors whose coverage radius overlaps the event location)
2. Show a context banner at top indicating what event/target is being correlated
3. Each sensor row gets a "📡 FEED" or "🎯 TGT" button that switches to the FEED or TARGETS tab and flies the map to that event/target

When clicking a sensor that was shown in proximity context, it navigates back to the originating event in the FEED tab.

### File Changes

#### 1. `src/components/dashboard/SensorFusionPanel.tsx`
- **Add props**: `activeContext` (the selected event/target context with lat/lng/title/type) and `onNavigateToEvent` callback
- **Proximity filter**: When `activeContext` is set, show a banner with context details and a "CLEAR" button. Filter feeds to show only sensors within coverage range of the context coordinates using Haversine distance check: `distance(sensor.lat, sensor.lng, context.lat, context.lng) <= sensor.coverage_radius_km`
- **Show all toggle**: Add a "SHOW ALL / NEARBY ONLY" toggle when context is active so user can switch between filtered and full view
- **Navigate button**: On each sensor row, add a clickable button that calls `onNavigateToEvent` with the context info (event type, coordinates) to switch back to FEED or TARGETS tab

#### 2. `src/components/dashboard/FourDMap.tsx`
- **Pass context to SensorFusionPanel**: Wire `c2IntelContext` as `activeContext` prop on the `<SensorFusionPanel>` line (~1829)
- **Add `onNavigateToEvent` callback**: When called, sets `c2RightTab` to "FEED" or "TARGETS" and calls `handleFeedClick(lat, lng)` to fly the map to the event
- **Auto-switch to SENSORS**: When an Action-Chain is initiated (context set), also provide a "📡 SENSORS" button in the Action-Chain panel that switches to SENSORS tab with context pre-loaded

### Implementation Details

**Haversine helper** (inline in SensorFusionPanel):
```typescript
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

**Context banner** (top of SensorFusionPanel when activeContext is set):
- Shows event/target title, type, severity, coordinates
- "CLEAR FILTER" button to show all sensors
- "NEARBY ONLY" / "ALL SENSORS" toggle

**Sensor row navigation button**: Each sensor gets a small button that triggers `onNavigateToEvent({ tab: "FEED"|"TARGETS", lat, lng })` using the context's original coordinates.

### Files Modified
- `src/components/dashboard/SensorFusionPanel.tsx` — add context filtering + navigation
- `src/components/dashboard/FourDMap.tsx` — wire context and navigation callback

