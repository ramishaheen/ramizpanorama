

## Plan: Real-time Crisis Map + Expanded Arab City Coverage

### Problem
1. Crisis map only refreshes every 3 minutes via polling — no real-time updates when new incidents or rockets are inserted.
2. The city list is limited to 12 cities — missing many Arab capitals and major cities.
3. Database incidents (geo_alerts, rockets) inserted for Jordan etc. don't appear live on the crisis map without a manual refresh.

### Changes

**1. Add Supabase Realtime subscriptions to `useCrisisIntel.ts`**
- Subscribe to `postgres_changes` on `geo_alerts` and `rockets` tables.
- On any INSERT/UPDATE/DELETE, re-run `fetchDbIncidents(city)` and merge into current state.
- This makes new incidents appear on the crisis map within seconds, no polling needed.
- Keep the 3-minute polling as a safety net but the primary update path becomes realtime.

**2. Expand city list to cover all Arab capitals + key conflict cities**
- Add to both `CrisisIntelModal.tsx` (CITIES array + CITY_COORDS) and `useCrisisIntel.ts` (CITY_COORDS):
  - **Gulf**: Kuwait City, Doha, Muscat, Manama, Abu Dhabi
  - **North Africa**: Algiers, Tunis, Rabat
  - **Levant**: Jerusalem, Tel Aviv, Mosul, Aleppo, Aden, Erbil
  - **Horn of Africa**: Mogadishu, Djibouti
  - Total ~28 cities covering all Arab League capitals plus conflict hotspots.

**3. Auto-populate geo_alerts and timeline_events for all cities**
- Update the `simulate-intel` edge function to cycle through all Arab cities/capitals when generating new geo alerts and timeline events.
- Each generated alert gets coordinates within the city's metro area (small random offset from city center).
- This ensures every city has active incidents that appear on the crisis map when selected.

**4. Feed crisis incidents into active alerts & timeline**
- In `simulate-intel`, for every geo_alert inserted, also insert a corresponding `timeline_events` entry so the main dashboard timeline reflects crisis activity across all cities.
- Ensure the `geo_alerts` region field matches the city name for proper filtering.

### Files Modified
- `src/hooks/useCrisisIntel.ts` — Add realtime channel subscription, expanded CITY_COORDS
- `src/components/dashboard/CrisisIntelModal.tsx` — Expanded CITIES array and CITY_COORDS
- `supabase/functions/simulate-intel/index.ts` — Cycle alerts through all Arab cities with proper coords

