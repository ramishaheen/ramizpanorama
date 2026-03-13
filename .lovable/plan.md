

# Default Cyber Immunity to Jordan + 4-Week Operational Feed

## Changes

### 1. Default country filter to "Jordan" (line 887)
Change `useState("All")` → `useState("Jordan")` so when Cyber Immunity opens, it immediately filters all data to show Jordan-related threats.

### 2. Expand timeline window from 24h to 4 weeks (28 days)
Currently the timeline slider maps 0–100 to a 24-hour window. Change:
- `windowMs` from `24 * 60 * 60 * 1000` → `28 * 24 * 60 * 60 * 1000` (lines 942, 1011)
- Update tick labels from `0h–24h` to `4w–0` (week markers) in the timeline footer (lines 1387, 1396–1401)
- Update the "hours ago" label to show days/weeks instead (lines 1016–1020)
- Update the "24h Attack Frequency" label to "4-Week Attack Frequency" (line 1302)
- Update the "Live Operations Feed" label text reference (line 1420–1421)

### 3. Update edge function prompt to emphasize Jordan
In `supabase/functions/cyber-threats/index.ts`, boost Jordan prominence in the AI prompt (line 116):
- Move Jordan to the top of the actor list with expanded detail: "Jordanian cyber landscape — NCSC defense operations, banking/telecom infrastructure threats, APT targeting of government systems, cross-border cyber operations"
- Request more Jordan-specific incidents (at least 3–4 of the 12–18)

### Files Changed
- `src/components/dashboard/CyberImmunityModal.tsx` — default filter, timeline window, labels
- `supabase/functions/cyber-threats/index.ts` — prompt emphasis on Jordan

