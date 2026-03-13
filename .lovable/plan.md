

# Add Missing Countries to Cyber Immunity Filters & Data Collection

## Problem
The `COUNTRY_FILTERS` array on line 66 of `CyberImmunityModal.tsx` is missing **Jordan, Oman, Qatar, and Bahrain**. These countries already have coordinates defined in `COUNTRY_COORDS` (line 31) but aren't selectable as filters, and the AI prompt in the `cyber-threats` edge function doesn't explicitly request intelligence covering them.

## Changes

### 1. Update `COUNTRY_FILTERS` in `CyberImmunityModal.tsx`
Add Jordan, Oman, Qatar, and Bahrain to the filter list:
```
const COUNTRY_FILTERS = ["All", "Israel", "Iran", "Jordan", "Oman", "Qatar", "Bahrain", "USA", "Russia", "China", "Saudi Arabia", "UAE", "Turkey", "Syria"];
```

### 2. Update AI Prompt in `cyber-threats/index.ts`
Expand the AI system prompt (line 104) to explicitly request intelligence covering Jordan, Oman, Qatar, and Bahrain alongside existing Gulf states. This ensures the AI generates incidents involving these countries. Update the coverage list from:
- `"Gulf state operations (UAE, Saudi Arabia, Qatar)"`
to:
- `"Gulf state operations (UAE, Saudi Arabia, Qatar, Bahrain, Oman, Jordan)"`

Also add a bullet requesting Jordanian cyber defense operations and Bahraini/Omani infrastructure monitoring.

### 3. Add to `COUNTRY_LABELS` in `worldMapPaths.ts`
Add Jordan, Oman, Qatar, and Bahrain labels so they appear on the threat map with proper positioning. Jordan and Bahrain coords are already in `COUNTRY_COORDS` but missing from the map labels list.

## Files Changed
1. **Edit**: `src/components/dashboard/CyberImmunityModal.tsx` — add 4 countries to `COUNTRY_FILTERS`
2. **Edit**: `supabase/functions/cyber-threats/index.ts` — expand AI prompt coverage
3. **Edit**: `src/data/worldMapPaths.ts` — add country labels for map display

