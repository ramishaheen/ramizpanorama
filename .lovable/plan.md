

# Fix Live Data on Main Map + Cyber Immunity Map Aggregation

## Problem Analysis

### Issue 1: Main Map shows only historical data
The `simulate-intel` edge function exists and generates live data (vessel drift, geo alerts, timeline events, risk scores) but is **never called from the frontend**. The comment in `useLiveDashboard.ts` line 97 says "Simulation disabled." The DB has stale data — airspace alerts from March 3 (10 days old), only 1 rocket (intercepted), and vessels only update when simulate-intel runs. The dashboard relies on realtime subscriptions, but nothing triggers new DB writes.

**Fix**: Add a periodic call to the `simulate-intel` edge function from `useLiveDashboard.ts` to continuously generate fresh intelligence data. Call it on mount and every 30-60 seconds.

### Issue 2: Cyber Immunity map doesn't aggregate/reflect all data
The `useCyberThreats` hook has a **24-second initial delay** before fetching (line 106), and the Cyber Immunity modal only shows cyber threats from the `cyber-threats` edge function. It doesn't aggregate OSINT data from other sources (earthquakes, conflicts, war updates, etc.) onto its map. The cyber threat map (`CyberThreatMapLeaflet`) only renders `CyberThreat[]` data.

**Fix**: 
1. Remove the 24s delay on `useCyberThreats` — fetch immediately
2. Pass aggregated threat data into the Cyber Immunity modal so the map reflects all intelligence sources, not just cyber threats
3. Ensure `useCyberThreats` accumulates threats across refreshes (like dark web was fixed) instead of replacing

## Changes

### 1. `src/hooks/useLiveDashboard.ts` — Enable live simulation polling
- Remove the "Simulation disabled" comment
- Add a `useEffect` that calls `simulate-intel` edge function every 45 seconds
- First call after 5 seconds to let the UI render first
- This will trigger realtime subscriptions already in place, updating the map live

### 2. `src/hooks/useCyberThreats.ts` — Remove delay + accumulate data
- Change initial delay from 24000ms to 0 (fetch immediately)
- Merge new threats with existing ones (deduplicate by ID) instead of replacing, same pattern as dark web fix
- Reduce cache duration from 5 minutes to 2 minutes for more frequent updates

### 3. `src/components/dashboard/CyberImmunityModal.tsx` — Aggregate OSINT data on map
- Accept optional props for `geoAlerts`, `warUpdates`, `fusionEvents` from the parent
- Convert these into synthetic `CyberThreat`-compatible markers on the Leaflet map
- Add a "SOURCES" indicator showing how many data feeds are active

### 4. `src/pages/Index.tsx` — Pass aggregated data to CyberImmunity
- Pass `geoAlerts`, `warUpdates`, and `fusionEvents` as props when rendering CyberImmunityModal

## Files Modified
- `src/hooks/useLiveDashboard.ts` — add simulate-intel polling
- `src/hooks/useCyberThreats.ts` — remove delay, accumulate threats
- `src/components/dashboard/CyberImmunityModal.tsx` — accept and display aggregated data
- `src/pages/Index.tsx` — pass additional data props to CyberImmunityModal

