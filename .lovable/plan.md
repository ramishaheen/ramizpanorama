

# Fix: Map Auto-Scrolling / Drifting Upward on Mouse Hover

## Root Cause

The map jumps upward whenever the mouse moves over markers because of **two compounding issues**:

1. **`autoPan: true` on hover popups** — Every time you hover a marker, Leaflet opens a popup and auto-pans the map to make sure the popup fits in view. Since popups appear *above* markers, the map shifts upward. With dozens of markers visible, moving the mouse across the map triggers a chain of open-popup → auto-pan-up → hover-new-marker → auto-pan-up again.

2. **Flight tracking panTo every 200ms** — When a flight is being tracked, the `panTo` runs on every interpolation tick (200ms), which can conflict with user interaction.

## Fix Plan

### 1. Disable `autoPan` on hover popups (`IntelMap.tsx`)
- Change `popupOptions.autoPan` from `true` to `false`
- This is the primary fix — hover popups should never move the map

### 2. Throttle flight tracking panTo (`IntelMap.tsx`)
- Only pan to tracked aircraft when positions change significantly (e.g. > 0.01 degrees), not on every 200ms tick
- This prevents subtle drift when tracking

### Files Changed
- `src/components/dashboard/IntelMap.tsx` — two small edits (popup options + tracked flight effect)

