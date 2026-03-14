

## Plan: Add horizontal + vertical scrollbars to 4D Map left and right columns

### Problem
The left panel (layer toggles) and right panel (attributes + feed) in the GOTHAM 4D Map lack horizontal scrollbars. Content that overflows horizontally is clipped. The left panel uses `overflow-hidden` and the right panel only has `overflow-y-auto` in subsections.

### Changes — `src/components/dashboard/FourDMap.tsx`

**Left panel (line ~1359):**
- Change the outer container from `overflow-hidden` to `overflow-auto scrollbar-thin` so both horizontal and vertical scrollbars appear when content exceeds the panel width/height.

**Right panel (line ~1564):**
- Add `overflow-auto scrollbar-thin` to the outer right panel container so horizontal overflow is scrollable.
- Update the attributes subsection (line ~1576) from `overflow-y-auto` to `overflow-auto` for horizontal scroll support.
- Update the tab content area (line ~1714) from `overflow-hidden overflow-y-auto` to `overflow-auto` for both axes.

All four touch points are class string updates only — no structural or logic changes.

