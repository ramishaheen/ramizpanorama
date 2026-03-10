## Improve Snap Me Geolocation Accuracy

### Problem

The current implementation sends a single prompt in one pass, which can miss important visual details and produce inaccurate coordinates. The image is sent at full resolution which may be too large or too small for optimal analysis.

### Plan

#### 1. Upgrade to Two-Pass Analysis in the Edge Function

**Pass 1 — Visual Evidence Extraction** (using `gemini-2.5-flash or lovable AI in case for fall back`  for speed):

- Extract all visible text, signs, license plates, scripts, brands, road markings, vegetation, architecture details
- Return a structured evidence list (no coordinates yet)

**Pass 2 — Coordinate Pinpointing** (using `gemini-2.5-pro lovable AI in case for fall back` for precision):

- Feed the image AGAIN along with the extracted evidence from Pass 1
- Ask specifically to cross-reference the evidence to determine exact coordinates
- This "chain of thought" approach dramatically improves accuracy because the model has its own extracted clues to reason against

#### 2. Enhanced Prompt Engineering

- Add explicit instructions to look for **Google Maps-searchable landmarks** within 50m of the camera position
- Add instruction to consider **camera angle and perspective** to estimate distance from visible landmarks
- Add **negative constraints**: "Do NOT guess coordinates in the center of a city if you cannot identify the exact neighborhood"
- Add **region-specific forensic cues** (e.g., Middle East stone colors, European window styles, Asian signage patterns)

#### 3. Image Optimization on the Client

- Resize images to **max 2048px** on the longest side before sending (optimal for Gemini vision)
- This reduces payload size, speeds up upload, and stays within the model's sweet spot for detail extraction

#### 4. Progress Feedback in the UI

- Show two-stage progress: "Stage 1: Extracting visual evidence..." → "Stage 2: Pinpointing coordinates..."
- Gives users feedback that a deeper analysis is happening

### Files to Modify

- `supabase/functions/snap-locate/index.ts` — Two-pass AI pipeline with enhanced prompts
- `src/components/dashboard/SnapMeModal.tsx` — Image resize before upload, two-stage loading indicator

### Architecture

```text
Upload Image
    │
    ▼ (client resizes to ≤2048px)
    │
    ▼ Edge Function
    │
    ├─ Pass 1 (gemini-2.5-flash): Extract evidence list
    │       ↓
    ├─ Pass 2 (gemini-2.5-pro): Image + evidence → precise coordinates
    │       ↓
    └─ Return ranked locations
```

Both passes use `GEMINI_API_KEY_2` as primary, Lovable AI Gateway as fallback.