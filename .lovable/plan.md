

# WarsLeaks Live Intelligence on Main Map — Improvements

## Current State
- WarsLeaks Telegram markers **already render** on the main map (purple/red emoji markers with popup details)
- The `telegram-intel` edge function scrapes WarsLeaks and uses Gemini AI to geolocate events
- **Problem 1**: Cache TTL is **24 hours** — data stays stale all day, not "up to date"
- **Problem 2**: The `useTelegramIntel` hook **replaces** markers on each fetch instead of accumulating
- **Problem 3**: The edge function uses direct Gemini API only (no Lovable AI fallback)
- **Problem 4**: 2-minute client polling is pointless since the server returns the same 24h-cached data

## Changes

### 1. `supabase/functions/telegram-intel/index.ts` — Reduce cache, add fallback, improve accuracy
- Reduce `CACHE_TTL_HOURS` from 24 to **1 hour** so data refreshes frequently
- Add Lovable AI Gateway (`google/gemini-2.5-flash`) as fallback when Gemini API key fails
- Add a `force` parameter to bypass cache when the user manually refreshes
- Improve the AI prompt to emphasize **current date context** and request the post's original date for accuracy

### 2. `src/hooks/useTelegramIntel.ts` — Accumulate markers + faster refresh
- Merge new markers with existing ones (deduplicate by ID), same pattern as dark web fix
- Reduce polling interval from 120s to **90s**
- Support `force` parameter in refresh to bypass server cache
- Fetch immediately on mount (no delay)

### 3. `src/components/dashboard/IntelMap.tsx` — Enhanced WarsLeaks marker styling
- Add a distinct "📡 LIVE" badge for markers less than 2 hours old
- Add timestamp display in popup showing how recent the event is (e.g., "2h ago")
- Make fresh markers (< 1 hour) pulse more aggressively to draw attention

## Files Modified
- `supabase/functions/telegram-intel/index.ts` — reduce cache TTL, add AI fallback
- `src/hooks/useTelegramIntel.ts` — accumulate data, faster refresh
- `src/components/dashboard/IntelMap.tsx` — enhanced marker freshness indicators

