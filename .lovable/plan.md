

# Fix TODAY Stats Row to Reflect Live Data

## Root Cause

The `todayStart` in `useLiveDashboard.ts` is computed once on mount via `useMemo(() => {...}, [])` with an empty dependency array. While this works within a single day, the core problem is that **simulate-intel only generates geo_alerts, timeline_events, and vessel updates** — it never creates new **airspace_alerts** or **rockets**. So the daily counts for airspace, missiles, and impacts stay at 0 because those DB records have stale timestamps from days ago.

Additionally, the pruning in simulate-intel (keep only 50 geo_alerts) means old alerts get deleted, so accumulated daily counts can actually decrease.

## Changes

### 1. `supabase/functions/simulate-intel/index.ts` — Generate airspace alerts and rockets too

Add two new simulation blocks:
- **Airspace alerts**: Toggle 1-2 existing airspace alerts to `active: true` with current timestamp, or insert new ones (e.g., "NOTAM issued", "Military exercise detected") for random cities. Prune old live airspace alerts (keep last 20).
- **Rockets**: Occasionally (30% chance per poll) insert a new rocket with status `launched`/`in_flight`, then on subsequent polls, transition existing active rockets to `intercepted` or `impact`. Prune old live rockets (keep last 15).

This ensures all stat categories get fresh daily data.

### 2. `src/hooks/useLiveDashboard.ts` — Fix daily filter

- Remove the empty dependency array from `todayStart` memo — recalculate it each render (it's cheap) so it stays correct across midnight boundaries.
- For vessels: count ALL vessels (not just today-timestamped ones) since vessels are persistent entities that get updated in-place. The vessel count should reflect active tracked vessels, not "new today."
- Keep geo_alerts, rockets, and airspace_alerts filtered by today's timestamp.

### 3. Increase geo_alert retention

In simulate-intel, increase the prune threshold from 50 to 100 so daily accumulation is visible throughout the day.

## Files Modified
- `supabase/functions/simulate-intel/index.ts` — add airspace + rocket simulation, increase prune limit
- `src/hooks/useLiveDashboard.ts` — fix todayStart reactivity, adjust vessel count logic

