

# Layout Fixes: Legend Size, History+Views Grouping, Right Column Drag

## Three changes requested

### 1. Legend button same size as History button
Currently the Legend collapsed button (`px-3 py-2`, icon wrapper `w-6 h-6`) is taller/wider than the History collapsed button (`px-2.5 py-1.5`). Will match Legend's padding and icon sizing to History's compact style.

**File:** `src/components/dashboard/MapLegend.tsx`
- Change button padding from `px-3 py-2` to `px-2.5 py-1.5`
- Remove the `w-6 h-6` icon wrapper div, use bare icon like History does
- Match text size to `text-[9px]` (same as History)

### 2. History box and Views (MapStyleToggle) grouped together
Currently MapStyleToggle is positioned `absolute top-3 right-3` (top-right corner of map). Will move it into the bottom bar next to History so they sit side-by-side.

**Files:**
- `src/components/dashboard/MapStyleToggle.tsx` — Remove absolute positioning, make it an inline flex element (same button style as History/Legend collapsed buttons)
- `src/components/dashboard/IntelMap.tsx` — Move `<MapStyleToggle>` from its standalone absolute position into the bottom bar, placed next to `<MapHistorySlider>`

### 3. Right column boxes draggable with lock/unlock toggle
The right column already has `DndContext` and `DraggableWidget` wired up, but it lacks a visible lock/unlock toggle in its header (left column has one). Will add the same lock/unlock button to the right sidebar header.

**File:** `src/pages/Index.tsx`
- Add lock/unlock button to the right sidebar header (line ~489-495), matching the left sidebar's lock button style
- Both sidebars share the same `layoutLocked` state so one toggle controls both

### Files to edit
- `src/components/dashboard/MapLegend.tsx` — shrink collapsed button
- `src/components/dashboard/MapStyleToggle.tsx` — convert to inline button style
- `src/components/dashboard/IntelMap.tsx` — move MapStyleToggle into bottom bar
- `src/pages/Index.tsx` — add lock/unlock to right sidebar header

