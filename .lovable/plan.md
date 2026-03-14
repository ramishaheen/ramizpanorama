

## Plan: AI-Powered Ontology Manager — Cross-Layer Relation Discovery

### Problem
The current Ontology Manager only correlates entities with each other based on proximity and type. It has no awareness of **events** (`intel_events`, `geo_alerts`), **effects** (`action_logs`), **impacts** (`target_tracks`, `rockets`), or other active map layers. The "DISCOVER RELATIONS" button runs a basic `auto_correlate` that only looks at `ontology_entities` with confidence < 0.8.

### Solution
Transform the Ontology Manager into an AI-driven intelligence fusion engine that ingests data from **all active map layers** and uses Gemini to discover semantic relationships between entities, events, effects, and impacts.

### Changes

#### 1. New Edge Function: `supabase/functions/ontology-ai-fuse/index.ts`
- Queries 6 tables in parallel: `ontology_entities`, `intel_events`, `geo_alerts`, `target_tracks`, `force_units`, `action_logs` (limit 50 each, most recent)
- Builds a combined intelligence snapshot text block
- Calls Gemini (`google/gemini-3-flash-preview`) with tool-calling to extract structured output:
  - `discovered_entities`: new entities implied by events but not yet in the ontology (e.g., a strike event implies a weapon system)
  - `discovered_relations`: cross-layer links like "event X **impacts** entity Y", "entity A **caused** event B", "action_log C **assessed** target D"
- Inserts new entities into `ontology_entities` and new relationships into `ontology_relationships`
- Returns a summary of what was discovered

#### 2. Update `OntologyManagerModal.tsx`
- Replace the "DISCOVER RELATIONS" button logic to call `ontology-ai-fuse` instead of `sensor-ingest/auto_correlate`
- Add a new **"AI FUSION"** button in the header that runs the full cross-layer analysis
- Add a 4th section in Column 1: **"CROSS-LAYER SOURCES"** showing counts from each ingested table (events, alerts, targets, forces, BDA logs)
- Expand relationship type palette with new types: `impacts`, `caused_by`, `assessed_by`, `observed_at`, `threatens`, `defends_against`
- Add an **"AI ANALYSIS"** panel in Column 3 below entity detail: shows the AI's reasoning for each discovered relationship (stored in `metadata.ai_reason`)
- Show a streaming progress indicator during fusion ("Scanning intel_events... geo_alerts... correlating...")

#### 3. Update `OntologyPanel.tsx` (sidebar)
- Update the "CORRELATE" button to call the new `ontology-ai-fuse` function
- Show new relationship types in the detail view

#### 4. Update `useOntology.ts` hook
- Add a `runAIFusion` method that invokes `ontology-ai-fuse`
- Return fusion results (new entities count, new relations count, AI reasoning)

### New Relationship Types Added
| Type | Meaning | Example |
|------|---------|---------|
| `impacts` | Event affects entity | Strike event → S-300 battery |
| `caused_by` | Entity caused an event | IRGC unit → missile launch event |
| `assessed_by` | BDA log assessed a target | Action log → target track |
| `observed_at` | Entity detected at event location | Equipment → geo_alert location |
| `threatens` | Entity threatens another | SAM battery → Blue Force FOB |
| `defends_against` | Entity defends against threat | Iron Dome → rocket track |

### Files to Create
- **`supabase/functions/ontology-ai-fuse/index.ts`** — AI fusion edge function

### Files to Modify
- **`src/hooks/useOntology.ts`** — Add `runAIFusion` method
- **`src/components/dashboard/OntologyManagerModal.tsx`** — New AI Fusion button, cross-layer source counts, expanded relationship types, AI reasoning display
- **`src/components/dashboard/OntologyPanel.tsx`** — Update correlate button to use fusion

