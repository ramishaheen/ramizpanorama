

# Fix Legend Panel Not Showing Content

## Root Cause

The `MapLegend` component has a dual-state visibility problem:

1. **External toggle**: `IntelMap.tsx` controls `cmdLegendOpen` which mounts/unmounts the `MapLegend` component
2. **Internal toggle**: `MapLegend` has its own `expanded` state (defaults to `false`) that controls whether the dropdown panel appears

When the user clicks LEGEND in the command bar, `cmdLegendOpen` becomes `true` and `MapLegend` mounts — but only shows the small "Legend" button. The user must click it **again** to expand. This is confusing and feels broken.

Additionally, the portal-based positioning with `createPortal` to `document.body` using fixed coordinates is fragile — the panel may render off-screen or behind other elements.

## Fix

### `src/components/dashboard/MapLegend.tsx`
- Remove the internal `expanded` toggle button entirely
- Always render the legend content directly (no portal, no second click needed)
- Remove `createPortal`, `useRef`, `pos` state, and the `useEffect` for positioning
- The component becomes a simple panel that shows marker types, severity, and indicators whenever it's mounted
- Keep all existing content (LEGEND_ITEMS, SEVERITY_ITEMS, indicators section)
- Wrap in `ScrollArea` with `max-h-[60vh]` for overflow

This way, when the user clicks LEGEND in the command bar, the panel immediately appears above the bar with all content visible — no second click required.

