

## Plan: Location-Aware Sensor Feed Filtering

Currently the SENSORS panel shows all feeds statically regardless of where the globe is centered. This change makes feeds dynamically filter and rank based on the current globe view center.

### How It Works

The globe already tracks `viewCenter` (updated every 500ms via POV polling). We pass it to `SensorFusionPanel`, which uses the existing `haversineKm` function to:
1. Filter feeds within a dynamic radius based on zoom level (`viewAlt`)
2. Sort remaining feeds by distance (closest first), then health score
3. Show a location-aware header badge with the current region coordinates

When no `activeContext` is set (no target/event selected), the panel uses `viewCenter` as the spatial filter. When `activeContext` IS set, it takes priority (existing behavior).

### File Changes

#### 1. `src/components/dashboard/SensorFusionPanel.tsx`
- Add `mapCenter` and `mapAltitude` optional props
- When no `activeContext` is set and `mapCenter` is provided, filter feeds by proximity using a zoom-dependent radius:
  - `altitude > 2.0` → 2000km (continental)
  - `altitude > 1.0` → 800km (regional)
  - `altitude > 0.5` → 300km (country)
  - `altitude <= 0.5` → 100km (city)
- Sort filtered feeds by distance ascending, then health score descending
- Show a small "MAP VIEW" badge in the header indicating location-based filtering is active
- Add distance-to-center display on each feed row

#### 2. `src/components/dashboard/FourDMap.tsx`
- Pass `mapCenter={viewCenter}` and `mapAltitude={viewAlt}` to the `<SensorFusionPanel>` component (~line 1882)

### Files Modified
- `src/components/dashboard/SensorFusionPanel.tsx` — location-aware filtering + sorting
- `src/components/dashboard/FourDMap.tsx` — pass viewCenter/viewAlt props

