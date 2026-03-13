

# Fix Vessel Positioning in Orbital Intelligence

## Problem
1. **Database vessels have drifted onto land** — the `simulate-intel` drift function has no water boundary validation, so over time vessels wander inland (e.g., LIAONING is currently in Turkey, HMS QUEEN ELIZABETH is in central Africa)
2. **SatelliteGlobe doesn't filter vessels** — unlike `UrbanScene3D.tsx` which applies `sanitizeVesselsToWater()`, the globe view shows all vessels including those on land
3. **No location labels** — clicking a vessel shows no sea/region name, just raw coordinates

## Changes

### 1. Fix `simulate-intel/index.ts` — Water-Validated Drift
- Add the same `MARITIME_CORRIDORS` bounding boxes from `constants.ts` into the edge function
- Before committing a vessel position update, check that the new lat/lng falls within a maritime corridor
- If the new position is on land, reverse heading by 180° and retry, or clamp to nearest corridor boundary
- This prevents future drift onto land

### 2. Fix DB Vessel Seed Positions — Migration
- Run a one-time SQL update to reset all vessels to valid sea positions within known maritime corridors (Persian Gulf, Red Sea, Mediterranean, Arabian Sea, Suez Canal)
- Each vessel gets a realistic position matching its name/type (e.g., military vessels in the Persian Gulf, cargo in shipping lanes)

### 3. Fix `SatelliteGlobe.tsx` — Add Water Filtering
- Import or duplicate the `MARITIME_CORRIDORS` water check
- Apply `sanitizeVesselsToWater()` filter to `aisVessels.data` before rendering on the globe
- This is the same pattern already used in `UrbanScene3D.tsx`

### 4. Add Location Labels to Vessel Markers
- Add a `getSeaRegionName(lat, lng)` utility that returns the name of the maritime region (e.g., "Persian Gulf", "Red Sea", "Gulf of Aden", "Arabian Sea", "Mediterranean Sea", "Suez Canal")
- Display this region name in the vessel tooltip/label on the globe
- Show it in the vessel click popup alongside coordinates

## Files Changed
1. **Edit**: `supabase/functions/simulate-intel/index.ts` — add water validation to drift logic
2. **Edit**: `src/components/dashboard/SatelliteGlobe.tsx` — filter vessels to water + add region labels
3. **Migration**: Reset vessel positions to valid sea coordinates

