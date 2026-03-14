
Goal: make the Inline 3D screen match your previously requested “complete tools” experience (not the stripped-down sidebar), fix usability issues, and surface the missing panels directly from this screen.

1) What is currently wrong (from code review)
- `Inline3DView` now uses `urban3d/Inline3DSidebar.tsx`, which only has a small subset of controls (1 tool + basic layers/sources).
- The full implementation with sectioned tools + instructions exists in `GeoAnalysisToolsPanel.tsx` (15+ tool actions, layer groups, intelligence overlays, source list), but it is no longer mounted.
- Range-ring placement is tied to initial `lat/lng` props, so after map movement it can appear “at the bottom”/off-focus.

2) Redesign approach (easy-to-use + complete)
- Replace the current minimal sidebar content with a “complete operations sidebar” that restores the full tools catalog and instructions.
- Keep the stable shell from the new sidebar (clear tabs + pinned footer), but wire in:
  - Full Tools section set (range/intervisibility/ballistic/geofence/terrain/heatmap/GRG/etc.)
  - Full Layers section (base + overlays + intelligence layers)
  - Full Sources section (live feed health/status)
- Preserve persistent `Back to Globe` footer and coordinate strip.

3) Structural implementation plan
- `Inline3DView.tsx`
  - Upgrade sidebar region to a robust 4-row layout:
    - header tabs
    - scrollable content (`min-h-0`, `overflow-y-auto`)
    - action footer
    - status/footer strip
  - Keep existing map controls (rotate/reset/weather/incidents) but remove duplicate toggles from multiple places.
  - Add optional callbacks for opening missing major panels from this screen:
    - `onOpenKillChainBoard`
    - `onOpenAIMetrics`
- `urban3d/Inline3DSidebar.tsx`
  - Expand into full-feature sidebar (or compose from shared blocks) instead of minimal 3 cards.
  - Add per-tool instruction text under each section title (“what it does / how to use”).
  - Add “Mission Panels” quick actions:
    - Open Kill Chain Board
    - Open AI Metrics Prioritizer
- `FourDMap.tsx`
  - Pass handlers to `Inline3DView` so those two panels open from Inline 3D (matching your requested on-screen parts).

4) Range-ring and overlay correctness fixes
- Center rings using map live center or an explicit selected point (not frozen initial props).
- Add overlay registry by tool id so turning one tool off doesn’t wipe all others unexpectedly.
- Ensure cleanup on close/unmount for circles, marker labels, traffic/transit, and intel markers.
- Keep ring labels visible and anchored near ring edge.

5) Technical hardening
- Ensure Google Maps script includes all libraries needed by restored tools (visualization/marker support where used).
- Add clear empty/error states (instead of black/blank panels):
  - “Loading data sources…”
  - “No sources available”
  - “Tool unavailable until map is ready”
- Keep tab content mounted with explicit height constraints to prevent zero-height collapse.

6) Validation checklist (end-to-end)
- Open Inline 3D at current viewport (889x574): Tools/Layers/Sources must render populated.
- Verify at least one tool from each category renders overlays correctly.
- Pan map, then enable Range Rings: rings must center correctly.
- Open Kill Chain Board and AI Metrics from Inline 3D quick actions.
- Close and reopen Inline 3D: no black panel, no stale overlay artifacts.
