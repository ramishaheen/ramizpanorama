

# C2 Battlefield Operating System — MSS Integration into 4D Map

## Overview
Integrate a JADC2-class Command & Control system into the existing 4D Map, adding force tracking (blue/yellow COP), AI target recognition, kill-chain workflow, and LLM-powered decision support. This builds on the existing globe, data fusion hooks, and AI infrastructure.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    4D MAP (FourDMap.tsx)                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ COP Layer│  │ Targeting    │  │ Kill-Chain Panel  │  │
│  │ Blue/Red │  │ Engine Panel │  │ Sensor→Shooter    │  │
│  │ Icons    │  │ AI ATR + CV  │  │ Approval Workflow │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │ Force Ontology   │  │ C2 AI Assistant (LLM)       │  │
│  │ DB Tables        │  │ BDA, Mission Planning, Chat  │  │
│  └──────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                    │                │
    DB Tables           Edge Functions    AI Gateway
    force_units         c2-targeting      Gemini/GPT
    target_tracks       c2-assistant
    kill_chain_tasks
```

## Phase 1: Data Ontology & Force Tracking (Database + COP)

### Database Tables
Create 3 new tables via migration:

**`force_units`** — Blue (friendly) and Red (enemy) force tracking
- `id`, `name`, `unit_type` (infantry, armor, artillery, air_defense, naval, drone, logistics), `affiliation` (blue/red/neutral/unknown), `lat`, `lng`, `heading`, `speed_kph`, `status` (active/destroyed/retreating/unknown), `echelon` (team/squad/platoon/company/battalion/brigade/division), `parent_unit_id`, `icon_sidc` (MIL-STD-2525D symbol code), `last_updated`, `source` (humint/sigint/imint/osint)

**`target_tracks`** — AI-detected targets from CV pipeline
- `id`, `track_id`, `classification` (tank/truck/missile_launcher/apc/radar/sam_site/artillery/command_post/supply_depot), `confidence`, `lat`, `lng`, `detected_at`, `source_sensor` (satellite/drone/sigint), `image_url`, `status` (detected/confirmed/engaged/destroyed/bda_pending), `priority` (critical/high/medium/low), `analyst_verified` (boolean), `analyst_notes`, `ai_assessment`

**`kill_chain_tasks`** — Sensor-to-shooter workflow
- `id`, `target_track_id` (FK), `phase` (find/fix/track/target/engage/assess), `status` (pending/in_progress/approved/rejected/complete), `assigned_platform`, `recommended_weapon`, `requested_by`, `approved_by`, `created_at`, `updated_at`, `notes`, `bda_result`

All tables get RLS policies (authenticated users only). Seed with realistic emulated Middle East force data (friendly coalition + adversary positions).

### Globe COP Layer
In `FourDMap.tsx`, add a new `forces` layer toggle. Render:
- **Blue icons** (▢ blue squares) for friendly force_units
- **Red/Yellow icons** (◇ red diamonds) for enemy/unknown tracks
- MIL-STD-2525D-inspired symbology using HTML elements on the globe
- Fetch from DB every 10s, merge into `htmlElementsData`

## Phase 2: AI Targeting Engine

### Edge Function: `c2-targeting`
- Accepts an image (base64 from drone/satellite) + coordinates
- Uses Gemini 2.5 Flash (via Lovable AI Gateway) for automatic target recognition
- Returns: detected objects with classifications, bounding boxes, confidence scores
- Stores results in `target_tracks` table
- Prompt engineered for military vehicle recognition (tanks, APCs, SAM sites, artillery)

### Targeting Panel Component: `C2TargetingPanel.tsx`
- Slide-out panel on the 4D Map (similar to existing right panel)
- Shows list of AI-detected targets sorted by priority
- Each target card shows: classification, confidence %, coordinates, source sensor, thumbnail
- "Verify" / "Reject" buttons for human-in-the-loop feedback
- "Prioritize" dropdown to set target priority based on commander objectives
- Click-to-zoom on globe to target location

## Phase 3: Kill-Chain & Decision Support

### Kill-Chain Workflow Panel: `KillChainPanel.tsx`
- Visual pipeline showing F2T2EA phases (Find → Fix → Track → Target → Engage → Assess)
- Each phase is a column with task cards that can be advanced
- Drag or click to advance targets through the kill chain
- "Recommend Strike" button uses AI to suggest optimal platform/weapon
- Approval workflow: tasks require "APPROVED" status before advancing to Engage

### Edge Function: `c2-assistant`
- LLM-powered C2 assistant (Gemini 3 Flash via gateway, streaming)
- System prompt: Joint Force C2 analyst specializing in targeting, BDA, and mission planning
- Capabilities: semantic search over force data, generate BDA reports, recommend COAs (courses of action), summarize threat picture
- Accessible via a chat interface embedded in the 4D Map right panel (new tab alongside Event Feed)

### C2 AI Chat Tab
- Add a tab to the 4D Map right panel: "EVENT FEED" | "C2 INTEL"
- The C2 tab opens a streaming chat similar to WarChatPanel
- Auto-includes current force disposition, active targets, and kill-chain status as context
- Can generate formatted BDA documents and mission summaries

## Phase 4: Integration into 4D Map UI

### Left Panel Additions
- New layer toggles: "Blue Force", "Red Force", "Target Tracks", "Kill Chain"
- Stats row additions: BLU (blue count), RED (red count), TGT (target count)

### Bottom Bar
- Kill-chain phase summary chips showing count per phase
- "TARGETING" mode button that enables click-on-globe to designate new targets

### Globe Rendering
- Blue force units: blue squares with echelon markers, pulsing when active
- Red targets: red diamonds with confidence rings, size scaled by priority
- Kill-chain arcs: animated arcs from sensor platform → target for active engagements
- BDA markers: green checkmarks for destroyed, yellow for pending assessment

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase migration` | Create `force_units`, `target_tracks`, `kill_chain_tasks` tables with RLS + seed data |
| `supabase/functions/c2-targeting/index.ts` | Create — AI ATR engine using Gemini Vision |
| `supabase/functions/c2-assistant/index.ts` | Create — LLM C2 decision support with streaming |
| `src/components/dashboard/C2TargetingPanel.tsx` | Create — Target list, verify/reject, prioritize |
| `src/components/dashboard/KillChainPanel.tsx` | Create — F2T2EA workflow visualization |
| `src/components/dashboard/C2ChatTab.tsx` | Create — AI assistant chat for BDA/COA |
| `src/components/dashboard/FourDMap.tsx` | Modify — Add COP layers, force rendering, C2 panels, targeting mode |

## Security Note
All tables use RLS requiring authentication. The system is OSINT/analytical only per the project's usage policy — no operational targeting capability. All data is simulated for demonstration purposes.

