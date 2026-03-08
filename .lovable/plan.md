
Goal: Ensure Crisis Intelligence always renders above every dashboard surface, and make the backend AI call sequence try Gemini first.

What I found:
- `CrisisIntelModal` currently uses `fixed inset-0 z-[999999]`, but it is rendered inside `IntelMap` (center panel subtree). In this layout (resizable panels + multiple overlays), local stacking contexts can still let sibling UI appear above it.
- `crisis-intel` function currently tries Lovable AI first, then falls back to direct Gemini API. This is opposite of your requested order.

Implementation plan:

1) Make Crisis Intel modal render at document root (true global overlay)
- Update `src/components/dashboard/CrisisIntelModal.tsx` to render with `createPortal(..., document.body)` (same pattern used by `LiveCamerasModal`).
- Keep full-screen fixed wrapper and raise to a guaranteed top level (`z-[2147483647]`), plus `isolate` to prevent blending/stacking bleed.
- Keep backdrop covering viewport so underlying widgets (Citizen Security, Sector Predictions, War Intelligence, Intel Feed) are visually and interactively behind it.

2) Harden overlay dominance across app screens
- Ensure modal root container includes:
  - `fixed inset-0`
  - max z-index utility/class
  - `pointer-events-auto`
- Add body lock while open (optional but recommended):
  - on mount: `document.body.style.overflow = "hidden"`
  - on unmount: restore
This prevents background scroll and accidental interaction while modal is open.

3) Switch AI provider priority to Gemini-first
- Update `supabase/functions/crisis-intel/index.ts`:
  - Attempt 1: direct Gemini API (`GEMINI_API_KEY`) first.
  - Attempt 2: fallback to Lovable AI gateway (`LOVABLE_API_KEY`) if Gemini fails.
- Keep existing tool-calling schema and output normalization unchanged so frontend contract remains stable.
- Preserve 402/429 handling behavior and clear error messages.

4) Improve AI call resilience (same response shape)
- Refactor edge function call logic into small helpers:
  - `callGemini()`
  - `callLovableGateway()`
  - shared `parseToolCallArguments()`
- Keep final output shape exactly as now (`events`, `city`, `city_coords`, `city_summary`, `threat_level`, `timestamp`) to avoid frontend regressions.

5) Verify function config and invocation path
- Confirm `supabase/config.toml` still has `[functions.crisis-intel] verify_jwt = false`.
- No frontend invoke changes needed (`supabase.functions.invoke("crisis-intel")` remains).

Acceptance checks (after implementation):
- Opening “CRISIS INTEL” always overlays every panel/widget/modal in the app (including Citizen Security, AI Sector Predictions, War Intelligence, Intel feed).
- Background UI is not clickable while Crisis Intel is open.
- Network behavior shows Gemini request attempted first; only if it fails, gateway fallback is attempted.
- Crisis map still loads events with same UI fields (source count, confidence, verification, timestamps).
