

# Fix Intel Layers Position + 4-Week Timeline Data Coverage

## Problem 1: Intel Layers Panel Position
The `MapLayersPanel` in the Cyber Immunity map is positioned at `top-2 left-2`, overlapping with the "CYBER THREAT OPERATIONS CENTER" HUD title. It needs to move to `bottom-left`.

## Problem 2: Timeline Shows No Historical Data
The timeline slider covers 4 weeks, but the edge function's AI prompt instructs generating incidents with "today or very recent dates" only. This means all 12-18 incidents cluster at the same date, so scrubbing backwards shows nothing. The fix is to instruct the AI to spread incidents across the full 4-week window with realistic historical dates.

---

## Changes

### 1. `src/components/dashboard/cyber/MapLayersPanel.tsx`
- Change collapsed button position from `top-2 left-2` to `bottom-2 left-2`
- Change expanded panel position from `top-2 left-2` to `bottom-2 left-2`

### 2. `supabase/functions/cyber-threats/index.ts`
- Update the AI prompt to generate **25-35 incidents spread across the last 4 weeks** instead of 12-18 with today's date
- Change the date instruction from "use today or very recent dates" to "distribute dates across the last 28 days, with more incidents in recent days"
- This ensures timeline playback reveals incidents progressively as it scrubs forward through the 4-week window

### 3. `src/hooks/useCyberThreats.ts`
- Increase cache duration or keep as-is (5 min cache is fine since more data will now be returned per fetch)

