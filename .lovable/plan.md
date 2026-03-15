

## Plan: Convert Right Sidebar Tabs to Button Grid + Fullscreen Popup with Tabs

### Change Summary
Replace the inline tab strip (lines 1695–1756) in `FourDMap.tsx` with a compact 2×4 button grid. Clicking any button opens a fullscreen `createPortal` popup containing all 8 panels as horizontal tabs, with the clicked one active. The sidebar no longer renders panel content inline.

### File: `src/components/dashboard/FourDMap.tsx`

**1. Add state**: `c2PopupOpen` boolean (default false)

**2. Replace lines 1695–1756** (tab strip + panel content) with:
- A button grid: 8 styled buttons in a flex-wrap layout (icons + short labels: FEED, TARGETS, KC, C2, SENSORS, ONTO, S2S, LINKS)
- Clicking any button sets `c2RightTab` to that tab AND sets `c2PopupOpen = true`
- No panel content rendered inline below the buttons

**3. Add fullscreen portal** (after the sidebar div, before bottom timeline):
```
{c2PopupOpen && createPortal(
  <div className="fixed inset-0 z-[99999] bg-[hsl(220,20%,5%)] flex flex-col">
    {/* Top bar: 8 tab buttons + X close */}
    {/* Body: active panel component */}
  </div>,
  document.body
)}
```

- Top bar: horizontal row of all 8 tabs styled consistently with existing Gotham theme, active tab highlighted with `bg-primary/20 text-primary border-primary/40`
- Close button (X) top-right sets `c2PopupOpen = false`
- Body: same switch logic currently at lines 1748–1755, rendered fullscreen
- The FEED tab content (lines 1711–1746) moves into the popup as well

**4. Import** `createPortal` from `react-dom`

### Files to Modify
- **`src/components/dashboard/FourDMap.tsx`** — single file change

