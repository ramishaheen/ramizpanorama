

# Expand Live Flight Coverage to Include Turkey, Egypt & South Africa

## Current State
The flight tracking bbox in `IntelMap.tsx` is hardcoded to `{ lamin: 10, lamax: 45, lomin: 25, lomax: 70 }`. This covers the core Middle East but:
- **Turkey** is partially cut off (northern Turkey reaches ~42°N, but some cities near the Black Sea are clipped)
- **Egypt** is partially cut off (western border at ~25°E, but the bbox starts at 25°E — Cairo at 31°E is fine, but western desert is clipped)
- **South Africa** is completely missing (latitude ~-35° to -22°, longitude ~16° to 33°)

## Change

### `src/components/dashboard/IntelMap.tsx` — Expand the bounding box
Update the single bbox to cover the full requested area. Since South Africa is far from the Middle East, the most efficient approach is to make **two separate API calls** — one for the Middle East + Turkey + Egypt region and one for South Africa — then merge the results.

- **Middle East + Turkey + Egypt bbox**: `{ lamin: 10, lamax: 42, lomin: 20, lomax: 70 }`
  - `lomin` reduced from 25→20 to capture western Egypt
  - `lamax` stays at 42 (already covers Turkey; bump to 42 to be safe)
- **South Africa bbox**: `{ lamin: -35, lamax: -22, lomin: 16, lomax: 34 }`

Both calls fire in parallel via `Promise.allSettled`, results are merged and deduplicated by `icao24`.

### Files Modified
- `src/components/dashboard/IntelMap.tsx` — update `fetchFlightData` to use two parallel bbox calls and merge results

