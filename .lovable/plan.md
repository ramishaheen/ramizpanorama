

# Move Flight Emulation into Bottom Bar Next to SAT Types

Currently the `FlightEmulationPanel` is rendered as a floating overlay (top-left, absolute positioned) inside the Orbital Intelligence portal. The user wants it placed in the bottom bar, right next to the "SAT Types" collapsible button — same row, same style.

## Changes — single file: `SatelliteGlobe.tsx`

1. **Remove** the standalone `<FlightEmulationPanel>` render block (lines 1832-1840).

2. **Add a new collapsible "Flights" button** in the bottom bar Row 1 (line 1998, right after the SAT Types `</div>`), styled identically to SAT Types:
   - Same compact button: `bg-black/80 backdrop-blur-md border border-white/15`, `text-[9px] font-mono`, with a Plane icon, flight count badge, and chevron toggle.
   - Width ~150px to match SAT Types.
   - Expanded state opens upward (`absolute bottom-full`) showing CIV/MIL counts, filter chips (ALL/CIV/MIL), and scrollable flight list — reusing the same data/logic from `FlightEmulationPanel` but rendered inline (no separate component import needed, or keep using the component but repositioned).

3. **Simplest approach**: Keep importing `FlightEmulationPanel` but wrap it in a collapsible container in the bottom bar, matching SAT Types positioning:
   - Add `flightsPanelExpanded` state
   - Render a toggle button after SAT Types
   - When expanded, render `<FlightEmulationPanel>` in an `absolute bottom-full` popup, same as SAT Types' expanded dropdown

### Layout result
```text
Bottom bar Row 1:
[SAT Types ▾] [Flights ▾] ----[Style Presets]---- [Nav Controls]
```

