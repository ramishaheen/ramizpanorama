
Goal

Make the bell reliably open a visible notification panel above the map, and make sure the panel always shows its content instead of appearing blank.

What I found

- The bell state is toggling: after click, the bell becomes active.
- Runtime logs show a ref warning tied to `NotificationCenter`, which means the current portal/ref/outside-click setup is unstable.
- The dropdown is manually positioned with `fixed right-4 top-14`, so it is not actually anchored to the bell and can behave inconsistently with the dashboard layout.
- The notification list uses `ScrollArea` with only `max-h-[400px]`; with this Radix wrapper, that can result in a collapsed/blank content area unless the height is explicitly controlled.
- The current setup mixes custom portal logic, manual outside-click handling, and animated content, which is the most likely reason you see the bell react but no usable panel content.

Implementation plan

1. Replace the manual bell dropdown behavior with a proper anchored overlay
- Refactor `NotificationCenter` to use the existing Radix-based overlay primitives already in the project (`Popover` or `DropdownMenu`).
- Anchor the panel directly to the bell instead of using hardcoded `fixed right-4 top-14`.
- Keep portal rendering, but let the UI primitive handle positioning, focus, and outside-click dismissal.

2. Remove the fragile custom outside-click/ref logic
- Delete the current `panelRef` / `dropdownRef` dependency for closing.
- Remove the manual `document.addEventListener("mousedown", ...)` handler.
- This should also eliminate the current ref warning and prevent the open state from conflicting with the rendered panel.

3. Fix the blank content area
- Give the notification list container an explicit height, for example a fixed/hybrid height like `h-[320px] max-h-[60vh]`.
- Keep `ScrollArea`, but use it inside a sized container so the viewport cannot collapse.
- Ensure the header stays visible and the list area scrolls independently.

4. Keep the panel above all map layers
- Preserve a strong z-index on the overlay content.
- Apply it on the popover/dropdown content rather than on a custom `motion.div`.
- Validate that it stays above the map, side widgets, and any Leaflet/3D overlays.

5. Preserve existing notification behavior
- Keep the current notification generation logic for rockets and WarsLeaks alerts.
- Keep unread count, clear all, dismiss item, severity colors, and sound behavior.
- If needed, slightly adjust “mark all read” so it happens after open is confirmed, not during the same click that triggers rendering.

Technical details

- Main file to change: `src/components/dashboard/NotificationCenter.tsx`
- Likely primitives to reuse: existing UI overlay components from `src/components/ui/*`
- Key structural change:
  - Bell button becomes trigger
  - Panel becomes overlay content aligned to the bell
  - Scroll area gets explicit height
- Likely removed code:
  - `createPortal(...)`
  - manual outside-click `useEffect`
  - `dropdownRef` and related logic
- Likely retained code:
  - notification state
  - generation/deduplication logic
  - rendering of each notification row

Validation after implementation

- Click the bell when unread count is present: panel should open next to the bell.
- Confirm the header and the list of notifications are visible immediately.
- Confirm the panel overlays the map and right sidebar content.
- Confirm scrolling works when many notifications exist.
- Confirm clicking outside closes it, and clicking dismiss/clear works.
- Test on the current desktop viewport and on a narrower width to ensure the anchored panel still stays onscreen.
