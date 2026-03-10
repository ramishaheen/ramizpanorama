

## "Snap Me" — AI Image Geolocation Feature

### What It Does
A "SNAP ME" button on the map toolbar that opens a modal where the user uploads a photo. The AI (Gemini) analyzes visual cues (landmarks, architecture, vegetation, signage, terrain) to estimate the most likely geographic locations where the photo was taken. Results are pinned on the map and listed alongside the image with AI reasoning.

### Architecture

**1. New Edge Function: `supabase/functions/snap-locate/index.ts`**
- Accepts a base64-encoded image
- Sends it to Gemini 2.5 Flash via the direct API (using existing `GEMINI_API_KEY`) with a vision prompt
- Prompt instructs Gemini to identify landmarks, architecture style, language on signs, vegetation, terrain, sky, and return structured JSON:
  ```json
  {
    "locations": [
      { "name": "Amman Citadel", "city": "Amman", "country": "Jordan", "lat": 31.9539, "lng": 35.9340, "confidence": 0.85, "reasoning": "Roman columns and limestone..." },
      ...
    ],
    "overall_analysis": "The image shows..."
  }
  ```
- Returns up to 5 candidate locations ranked by confidence
- Register in `config.toml` with `verify_jwt = false`

**2. New Component: `src/components/dashboard/SnapMeModal.tsx`**
- Full-screen modal with dark command-center styling
- File upload area (drag-and-drop + click) — accepts JPG/PNG/WEBP
- Converts uploaded image to base64, sends to the edge function
- Displays results: uploaded image on the left, list of candidate locations on the right with confidence bars and AI reasoning
- "Pin on Map" button for each result — closes modal and flies the map to that location, dropping a marker

**3. Integration into `IntelMap.tsx`**
- Add a `Camera` (or `Aperture`) icon button labeled "SNAP ME" in the existing right-side button column (after IRAN FIR button, around line 1896)
- New state: `showSnapMe` boolean
- On pin selection from SnapMeModal, fly the Leaflet map to the coordinates and add a marker with a popup showing the AI analysis

### Files Changed
| File | Change |
|------|--------|
| `supabase/functions/snap-locate/index.ts` | New — Gemini vision edge function |
| `supabase/config.toml` | Add `[functions.snap-locate]` entry |
| `src/components/dashboard/SnapMeModal.tsx` | New — upload + results UI |
| `src/components/dashboard/IntelMap.tsx` | Add SNAP ME button + state + modal + map pin callback |

### No database changes needed — this is a stateless analyze-and-display feature.

