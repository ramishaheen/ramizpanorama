
Goal: make the Gotham 4D right column reliably scrollable for both the Attributes stack and the bottom tab panels (FEED, TARGETS, KILLCHAIN, C2 INTEL, SENSORS, ONTOLOGY), so users can reach all content on small/medium heights.

1) Root-cause fix in right column layout (`src/components/dashboard/FourDMap.tsx`)
- Restructure the right sidebar into explicit flex sections with `min-h-0` to prevent scroll trapping:
  - Sidebar root: `flex flex-col min-h-0 overflow-hidden` (remove competing root `overflow-y-auto`).
  - Attributes region: dedicated scroll container (`overflow-y-auto scrollbar-thin`) so long controls remain reachable.
  - Tab bar: fixed (non-scrolling) divider.
  - Tab content region: `flex-1 min-h-0 overflow-hidden` so active tab panels can scroll correctly.
- Keep the ergonomic scrollbar position on the left side for the right column by using `direction-rtl` on the scrolling wrapper + inner `direction-ltr` content wrapper.

2) Make each tab panel shrink-and-scroll correctly
- Add `min-h-0` to panel roots and scrollable list containers in:
  - `src/components/dashboard/C2TargetingPanel.tsx`
  - `src/components/dashboard/KillChainPanel.tsx`
  - `src/components/dashboard/C2ChatTab.tsx`
  - `src/components/dashboard/SensorFusionPanel.tsx`
  - `src/components/dashboard/OntologyPanel.tsx`
- Ensure each panel uses:
  - root: `flex flex-col h-full min-h-0`
  - list/content area: `flex-1 min-h-0 overflow-y-auto scrollbar-thin`
- Keep existing behavior (e.g., FEED auto-scroll, tab-specific controls) unchanged.

3) Scrollbar visibility/styling consistency (`src/index.css`)
- Reuse existing `.scrollbar-thin` utility for all right-panel scroll containers.
- If needed for visibility in this dark theme, slightly increase contrast of thumb color while preserving current look.

4) Validation checklist (viewport-specific)
- Test at current preview size (889x574):
  - Attributes section scrolls to reveal all controls.
  - Each tab (FEED/TARGETS/KILLCHAIN/C2 INTEL/SENSORS/ONTOLOGY) can scroll to last item.
  - Scrollbars visibly appear when content exceeds height.
  - Left column scrolling remains functional and unchanged.
  - No overlap/regression with bottom timeline strip.

Technical notes
- Main issue is nested overflow + missing `min-h-0` in flex chains; this prevents child `overflow-y-auto` from activating.
- Fix is structural (layout constraints), not data-related.
- No backend/database changes required.
