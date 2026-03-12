
Goal: implement 3 fixes together on the main dashboard map flow:
1) Add a left-side Gotham-style flight emulation box (civil + military),
2) Stop Orbital Intel from “restarting,”
3) Fix Satellite “Ask AI” and “AI Predict” reliability.

What I found in current code:
- Left flight emulation box does not exist in `IntelMap.tsx` (only map markers + right-side tools).
- `IntelMap` re-renders very frequently (200ms flight interpolation updates), and Orbital modal (`SatelliteGlobe`) is rendered as a child with inline callback; this can cause heavy re-render churn and “restart/flicker” perception.
- Satellite Ask AI in `SatelliteGlobe.tsx` uses `supabase.functions.invoke("war-chat")`, but `war-chat` returns streaming SSE (`text/event-stream`). This mismatch is fragile and currently behaves like a broken request path.
- Orbit predict endpoint works for track/pass math, but AI analysis can come back empty without clear UI reason (rate-limited/unavailable path not surfaced clearly).

Implementation plan:

1) Add new left “Flight Emulation” box (Gotham style) on Intel map
- Files:
  - `src/components/dashboard/FlightEmulationPanel.tsx` (new)
  - `src/components/dashboard/IntelMap.tsx` (wire in)
- Build a compact panel styled with existing terminal theme tokens (`bg-card/90`, `backdrop-blur-xl`, `border-border/60`, `font-mono`).
- Panel content:
  - Total tracked flights
  - Civil count (cyan/blue)
  - Military count (red)
  - Source badge + refresh cadence
  - Filter chips: All / CIV / MIL
  - Scrollable top list with callsign, altitude, speed, type
- Interactions:
  - Click row toggles tracking (`trackedFlightId`) and recenters map
  - Collapse/expand control
- Visibility:
  - Desktop only, shown when `layers.flights` is enabled and data exists.

2) Stabilize Orbital Intel modal so it does not feel like it keeps restarting
- Files:
  - `src/components/dashboard/IntelMap.tsx`
  - `src/components/dashboard/SatelliteGlobe.tsx`
- Prevent unnecessary parent-driven rerenders:
  - Use stable close callback (`useCallback`) for Orbital modal.
  - Memoize Orbital component export (or memoized wrapper at render site) so 2D flight interpolation ticks do not repeatedly re-render Orbital UI.
- Reduce high-frequency UI churn inside Orbital:
  - Throttle `lastPropagated` UI updates (not every propagation tick).
  - Replace random orbit-path refresh trigger with deterministic cadence.
- Keep current Globe init-once behavior, but ensure expensive per-render derived values are minimized.

3) Fix Satellite Ask AI flow (SSE-compatible + clearer error handling)
- Files:
  - `src/components/dashboard/SatelliteGlobe.tsx`
- Replace `supabase.functions.invoke("war-chat")` for Ask AI chat with streaming fetch parser (same SSE pattern already used in `WarChatPanel.tsx`).
- For both initial “ASK AI” and follow-up messages:
  - Stream assistant output incrementally
  - Strip `<think>...</think>` blocks before display
  - Handle 402/429/5xx explicitly and show user-facing recovery message (not generic silent failure).

4) Fix Satellite Predict AI reliability and user feedback
- Files:
  - `supabase/functions/orbit-predict/index.ts`
  - `src/components/dashboard/SatelliteGlobe.tsx`
- Keep orbit mechanics output (positions/passes) always available.
- In edge function:
  - Add robust AI call status handling (429/402/timeout/non-OK).
  - Return structured metadata (`ai_status`, `ai_error`) instead of silently empty analysis.
- In UI:
  - Always render pass/track results.
  - Show explicit badge/message when narrative analysis is rate-limited/unavailable.
  - Keep “AI PREDICT” button behavior intact.

Technical details (implementation constraints and compatibility):
- No database schema/RLS/auth changes required.
- No routing changes required.
- Keep existing map architecture and style system.
- Reuse existing flight data (`interpolatedFlights`, `trackedFlightId`, `flightSource`) to avoid duplicate polling.
- Reuse existing streaming/SSE parsing approach from current chat implementation pattern.
- Preserve existing hover popup behavior and current flight tracking logic already in place.

Validation checklist after implementation:
1) Open main map, enable Flights layer, verify new left panel appears and updates counts/list for CIV/MIL.
2) Click several flights from panel and map markers; confirm tracking toggles and map pans correctly.
3) Open Orbital Intel and keep it open for several minutes while 2D map continues updating; confirm no restart/flicker/reset behavior.
4) In Orbital selected satellite panel:
   - Ask AI returns streamed answer reliably,
   - Follow-up message works,
   - Rate-limit/credit errors show clear UI state.
5) Run AI Predict:
   - Passes/track render every time,
   - AI narrative appears when available,
   - clear fallback message appears when AI is unavailable.
