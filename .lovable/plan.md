

## Problem

When the user clicks **INITIATE CHAIN** (from either a target or an event via the F2T2EA modal), the system creates a `kill_chain_tasks` row at phase `find` / status `in_progress` and then stops. There is no automated progression through the kill chain phases. The user has to manually click ADVANCE repeatedly, which defeats the purpose of the automated F2T2EA system.

## Expected Behavior

After initiation, the kill chain should auto-progress through phases with realistic delays:

```text
FIND (0s) → FIX (3s) → TRACK (5s) → TARGET (8s) → [PAUSE for HITL approval] → ENGAGE → ASSESS → [Auto-generate BDA]
```

Key behaviors:
- Each phase advancement updates the database and shows a toast notification
- At **TARGET** phase, the system pauses and waits for human-in-the-loop (HITL) approval before proceeding to ENGAGE
- S2S engine is invoked at **FIX** phase to auto-match shooters (updates `assigned_platform` and `recommended_weapon`)
- At **ASSESS** phase, BDA is auto-generated via the AEGIS AI (c2-assistant)
- Phase transitions are visible in real-time via the existing realtime subscription

## Implementation Plan

### 1. Add auto-progression logic to `KillChainPanel.tsx`

Create a new function `runKillChainAutomation(taskId)` that:
- Fetches the task after creation
- Advances through FIND → FIX → TRACK → TARGET with staggered `setTimeout` delays (3s, 5s, 8s)
- At FIX phase: invokes `sensor-to-shooter` with `action: "match_shooters"` and updates the task with the best shooter/weapon
- At TARGET phase: sets status to `pending` (waiting for approval) and shows a prominent toast: "⚠ HITL APPROVAL REQUIRED"
- Stops at TARGET — the existing `approveTask` and `advancePhase` buttons handle the rest

### 2. Wire auto-progression after initiation

In both `initiateKillChain()` and `initiateFromEvent()`:
- After the task insert succeeds, call `runKillChainAutomation(newTaskId)` with the returned task ID
- The function runs asynchronously (does not block the UI)

### 3. Auto-BDA at ASSESS phase

In `advancePhase()`:
- When advancing to `assess` phase, automatically trigger `generateBDA(task)` after a short delay
- This completes the kill chain cycle without requiring the user to manually click "GEN BDA"

### 4. Toast notifications per phase

Each auto-advance step shows a phase-specific toast:
- FIND: "🔍 Correlating OSINT sources..."
- FIX: "📌 Geo-locking target — S2S matching..."
- TRACK: "👁 Track custody established"
- TARGET: "🎯 Weaponeering complete — HITL APPROVAL REQUIRED"
- ENGAGE: "💥 Strike committed"
- ASSESS: "📋 Generating BDA via AEGIS..."

### Files to modify

- **`src/components/dashboard/KillChainPanel.tsx`** — Add `runKillChainAutomation()` function, wire it into `initiateKillChain` and `initiateFromEvent`, and add auto-BDA trigger in `advancePhase`

No new files, no database changes, no edge function changes needed.

