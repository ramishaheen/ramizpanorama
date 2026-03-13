

# Add Date Histogram + Critical Ultra Analysis to Cyber Immunity Timeline

## Changes

### 1. Date Histogram — above timeline slider (`CyberImmunityModal.tsx`)

Insert a 28-bar mini histogram between the main content area and the timeline slider (above line 1739).

- Compute `dailyBuckets` via `useMemo`: 28 entries, each counting threats per day and tracking peak severity
- Render as a row of 28 thin vertical bars (`flex-1`), height proportional to max count, colored by peak severity (red=critical, orange=high, yellow=medium, cyan=low)
- A vertical line overlay showing current `timelinePos` position
- Tooltip on hover: date + count
- Compact height: `h-[32px]`

### 2. Critical Ultra Analysis — below the histogram, same area

Add a collapsible "CRITICAL ULTRA ANALYSIS" strip between the histogram and the slider:

- Filters `threats` for `critical` severity only
- Shows: count of critical incidents, top attacker, top target, most exploited CVE
- For each critical threat (max 3 shown inline): attacker→target with CVE badge and a one-line AI-style assessment
- Red/destructive color scheme with `Skull` icon
- If no critical threats: "No critical incidents in window"
- Compact single-row layout that expands to show details on click

### Files Modified
- `src/components/dashboard/CyberImmunityModal.tsx` — add `dailyBuckets` memo, histogram bars, critical analysis section

