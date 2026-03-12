

# Vessel Tracking Panel + Fix Timeline in Right Column

## Two changes

### 1. Vessel Tracking Panel in Globe Bottom Bar (next to Flights)

Add a collapsible "Vessels" button in the Orbital Intelligence bottom bar, right after the Flights toggle, matching the same style.

**File: `src/components/dashboard/SatelliteGlobe.tsx`**
- Import `useAISVessels` hook
- Add `vesselsPanelExpanded` state
- Add a "Vessels" toggle button after the Flights button (same styling: `bg-black/80`, `border-white/15`, Anchor icon, vessel count badge, chevron)
- Expanded state shows upward popup (`absolute bottom-full`) with:
  - Vessel type breakdown (CARGO, TANKER, FISHING, MILITARY counts)
  - Filter chips by type
  - Scrollable vessel list with name, speed, heading, flag
  - Click to fly-to vessel on globe

### 2. Fix Timeline in Right Column

The `TimelineSlider` has no auto-play `useEffect` — pressing Play toggles `isPlaying` state but nothing advances the index. Also `onTimeChange` is never passed from `Index.tsx`.

**File: `src/components/dashboard/TimelineSlider.tsx`**
- Add `useEffect` that runs an interval when `isPlaying` is true, advancing `currentIndex` by 1 every ~1.5s, stopping at the end
- Call `onTimeChange` when auto-advancing