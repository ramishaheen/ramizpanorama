

# Fix Satellite Selection, Trail, Camera Follow + Speed Up AI

Three issues to fix:

## 1. Satellite Camera Follow + Trail Visibility

**Problem**: When you click a satellite, the globe zooms once (`pointOfView` at altitude 1.5) but never follows it as it moves. The orbit trail renders but at a distant zoom it's hard to see.

**Fix in `SatelliteGlobe.tsx`**:
- Add a `useEffect` that runs every ~500ms: when `selectedSat` is set, update `pointOfView` to the satellite's current interpolated position (from `satsRef.current`) at a closer zoom (altitude ~0.8 for LEO, ~1.2 for MEO/GEO). This creates a smooth "camera lock" that follows the satellite.
- On satellite click, zoom closer (altitude 0.6-0.8 instead of 1.5) so the orbit trail is clearly visible.
- Increase orbit path refresh rate from every 20th tick to every 5th tick (~2.5s) so the trail stays accurate.

## 2. AI Predictions Too Slow

**Problem**: 10-second initial delay before first fetch, plus the edge function makes an AI call that can take 20-30s.

**Fix in `AIPredictions.tsx`**:
- Remove the 10s initial delay — fetch immediately on mount.
- Show a skeleton/placeholder immediately with "Analyzing..." text.
- Cache last successful result in `localStorage` so returning users see stale data instantly while fresh data loads in background.

**Fix in `supabase/functions/ai-predictions/index.ts`**:
- Switch to `gemini-2.5-flash-lite` (faster model) since predictions don't need heavy reasoning.
- Reduce the AI timeout from 30s to 15s.

## 3. Ask AI Not Working

**Problem**: The `war-chat` edge function calls Gemini API but may be hitting rate limits or key issues. The client silently fails if the response is non-SSE JSON error.

**Fix in `SatelliteGlobe.tsx` (`openAiChat`)**: 
- The current code checks `resp.ok` and handles 429/402, but if the response is a JSON error body (not SSE stream), the SSE reader loop silently produces nothing. Add a check: if `Content-Type` is `application/json` (error response), parse the JSON and show the error message directly instead of trying to stream it.

## Summary of file changes

| File | Change |
|------|--------|
| `SatelliteGlobe.tsx` | Add camera-follow effect for selected satellite; closer zoom on click; faster orbit refresh; fix Ask AI error handling |
| `AIPredictions.tsx` | Remove 10s delay; add localStorage cache for instant display |
| `ai-predictions/index.ts` | Switch to `gemini-2.5-flash-lite`; reduce timeout to 15s |

