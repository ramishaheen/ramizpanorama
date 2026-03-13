

# Fix: Flights Only Showing in KSA Area

## Root Cause

The edge function caps the search radius at **250 nautical miles** (~460km). When the frontend sends the full Middle East bbox (`lamin:10, lamax:45, lomin:25, lomax:70`), the center calculates to roughly Riyadh (27.5°N, 47.5°E), and the 250nm cap means only aircraft within ~460km of Riyadh are returned — essentially just KSA.

The bbox spans ~3,500km but the API query only covers ~460km.

## Fix — Split Into Grid Sub-Requests

Modify `supabase/functions/live-flights/index.ts` to:

1. **Detect large bounding boxes** — if the bbox spans more than ~500km in any direction
2. **Split into a grid of sub-queries** — divide the bbox into overlapping tiles (each ~400nm radius), fire them all in parallel
3. **Merge & deduplicate** across all tiles using the existing `mergeAircraft` function
4. **Remove the 250nm cap** or raise it significantly for each tile since tiles will be smaller

For the adsb.fi, adsb.lol, and airplanes.live fetchers:
- Calculate how many tiles are needed (e.g., 2×2 or 3×2 grid for the full Middle East)
- Each tile center gets its own API call with a radius that actually covers its area
- All tile results feed into the existing merge/dedup pipeline

For OpenSky: no change needed — it uses bbox natively, not radius.

For adsb.fi/mil: no change needed — it's already global.

### Estimated tile count for Middle East bbox
- ~6 tiles (3 columns × 2 rows) with 250nm radius each, covering the full region
- All fired in parallel per source, so latency stays similar

## File Changed
- `supabase/functions/live-flights/index.ts`

