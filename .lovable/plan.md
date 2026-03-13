

# Add Flight Count Badge with Tiles Info to Live Airspace Sidebar

## What
Add a badge row in the Live Airspace sidebar header showing total aircraft tracked and number of API tiles used, sourced from the edge function response.

## Changes

### 1. `src/components/dashboard/UrbanScene3D.tsx`

**Add state** for tiles count:
- Add `const [tilesUsed, setTilesUsed] = useState(0);` near line 146

**Capture tiles from API response** (~line 1971):
- Add `if (data.tiles_used) setTilesUsed(data.tiles_used);` after the existing `setFlightSource` call

**Add badge row in sidebar header** (between the CIV/MIL counts at ~line 3002 and the refresh text at ~line 3011):
- Add a compact badge showing `🛰 {aircraft.length} TOTAL` and `📡 {tilesUsed} TILES` styled as small rounded pills with monospace font, matching the existing HUD aesthetic

### 2. No other files need changes
The edge function already returns `tiles_used` in its response — just needs to be consumed by the frontend.

