

# Implement Kill Chain Event Modal (F2T2EA Phase Review)

## Current State
The `KillChainPanel` is fully functional — it has target/event pickers, S2S integration, phase advancement, BDA generation. However, clicking an event **immediately** calls `initiateFromEvent()` without showing the operator what each kill chain phase entails.

## What to Build
A **KillChainEventModal** popup that appears when clicking an event in the EVENTS tab. It shows a vertical stepper of all 6 F2T2EA phases with event-specific actions, then the operator confirms to initiate.

## Implementation — Single File Change

**File**: `src/components/dashboard/KillChainPanel.tsx`

### 1. Add `KillChainEventModal` component (inline)
- Dark HUD-styled modal overlay
- Header: event title, type emoji, severity badge, coordinates
- Vertical stepper with 6 phases, each showing:
  - **FIND**: "Correlate OSINT at {lat},{lng} • Cross-ref SIGINT/IMINT • Assign ISR asset"
  - **FIX**: "Confirm position via multi-sensor fusion • Validate classification: {derived class}"
  - **TRACK**: "Maintain track custody • Monitor for repositioning"
  - **TARGET**: "Match shooter via S2S engine • Calculate Pk & collateral"
  - **ENGAGE**: "HITL authorization required • ROE compliance check"
  - **ASSESS**: "Generate BDA via AEGIS AI • Confirm functional kill"
- Actions are dynamically populated using event type/severity
- Phase icons and colors from existing `PHASE_COLORS`/`PHASE_ICONS`
- "INITIATE CHAIN" button calls existing `initiateFromEvent()`
- "CANCEL" button closes modal

### 2. Wire event click → modal
- Add state: `selectedEventForModal: EventOption | null`
- Change event button `onClick` from `initiateFromEvent(ev)` to `setSelectedEventForModal(ev)`
- Modal's confirm calls `initiateFromEvent(selectedEventForModal)` then closes

### UI Details
- Full overlay with backdrop blur, matching existing HUD dark aesthetic
- Each phase step: colored left border, icon, phase name, bullet-pointed actions
- Severity-colored header badge
- Coordinates and timestamp displayed prominently

