

# Fix: Flights Not Updating in Gotham 4D

## Root Cause

The `live-flights` edge function returns data as `data.aircraft`, but `FourDMap.tsx` reads `data.flights` — a property that doesn't exist. This means **flights never load** despite the edge function working correctly (confirmed via logs: 60-146 aircraft per call).

**Evidence:**
- Edge function logs show successful returns: `UNIFIED: 146 total (1 MIL, 145 CIV)`
- `IntelMap.tsx` and `UrbanScene3D.tsx` correctly use `data.aircraft` — only `FourDMap.tsx` has the bug

## Fix

### File: `src/components/dashboard/FourDMap.tsx` (line 488)

Change:
```typescript
if (data?.flights?.length) setFlights(data.flights.slice(0, 500));
```
To:
```typescript
if (data?.aircraft?.length) setFlights(data.aircraft.slice(0, 500));
```

Also capture the `source` metadata for display consistency, and reduce the polling interval from 30s to 15s to match other map views for fresher data.

One-line fix, zero risk.

