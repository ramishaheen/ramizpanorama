

## Plan: Integrate WarsLeaks Telegram into 4D Map Event Feed + Remove Stale Static Events

### Problem
The 4D Map event feed contains **hardcoded static emulated events** (lines 691-709) that never update. Additionally, WarsLeaks Telegram intelligence — already fetched via `useTelegramIntel` hook — is **not connected** to the 4D Map at all, despite being the project's primary OSINT source for the target countries (Jordan, Iran, Israel, UAE, KSA, Bahrain, Kuwait, Qatar).

### Changes — `src/components/dashboard/FourDMap.tsx`

**1. Import and invoke `useTelegramIntel` hook**
- Add import for `useTelegramIntel` alongside existing hooks
- Call the hook to get `markers` (WarsLeaks data) and `refresh`

**2. Add "Telegram OSINT" layer toggle**
- Add a new layer config entry: `{ id: "telegramOSINT", label: "Telegram OSINT", icon: <Radio />, color: "#10b981", count: telegramMarkers.length }`
- Default enabled

**3. Inject Telegram markers into `unifiedFeed`**
- In the `unifiedFeed` useMemo, add a new block that iterates `telegramMarkers` and converts each to the feed format with proper severity colors, category-based icons, and `source: "WARLEAKS"`
- Add `telegramMarkers` to the dependency array

**4. Replace static `emulatedEvents` with empty array**
- The hardcoded 17 fake events (lines 691-709) are stale and misleading on a "single source of truth" OSINT map
- Replace with `const emulatedEvents = useMemo(() => [], []);` so only real data flows through

**5. Render Telegram markers on the globe**
- In the globe's `pointsData`, include telegram markers when the `telegramOSINT` layer is active
- Each marker gets a pulsing dot colored by severity

**6. Add layer state default**
- In the initial `activeLayers` state, include `telegramOSINT: true`

### Result
- Event feed will show live WarsLeaks intelligence for all 8 target countries
- Static fake events removed — feed is 100% real data
- New "Telegram OSINT" layer toggle in the left panel
- Markers appear on globe with proper icons and severity

### Files to modify
- **`src/components/dashboard/FourDMap.tsx`** — All changes above (import hook, add layer, inject into feed, remove static events, render on globe)

