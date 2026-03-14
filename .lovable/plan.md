

# GUI Clarity Improvements

## Current Issues

After reviewing the codebase and session replay, the main clarity problems are:

1. **Header is cramped** — Too many buttons of identical style crammed into one row. Live Channels, Cyber Immunity, 4D Map, Language, Mute, Notifications all look the same with tiny 9px text. Hard to distinguish priority actions from secondary ones.

2. **StatsBar is overwhelming** — 7 stat cards + 8 war cost cards + country cost row + commodity marquee ticker all stacked vertically. This consumes ~25% of vertical screen space before the map even starts. Text sizes (7px, 9px, 10px) are at legibility limits.

3. **Left sidebar widget overload** — 10 widgets stacked with no grouping or sections. Rockets, Risk, Ransomware, Weather, Escalation, Commodities, News, Predictions, Telegram — all presented equally with no visual hierarchy.

4. **Right sidebar lacks structure** — Notifications, War Updates, Layers, Timeline, Cyber all crammed without section dividers or priority indicators.

5. **Commodity ticker readability** — The marquee scrolls too fast on smaller screens and all items use the same yellow icon, making them hard to scan.

## Plan

### 1. Header: Group actions by priority (`DashboardHeader.tsx`)
- **Primary actions** (left): Logo, AI Chat — keep as-is
- **Secondary actions** (right): Group into two visual clusters separated by a thin divider:
  - **Portals group**: Live Channels, Cyber Immunity, 4D Map — add subtle colored left-border accent per button (red for Live, cyan for Cyber, blue for 4D)
  - **Controls group**: Language, Notifications, Mute, Status, Clock
- Add a thin `border-l border-border` separator between the two groups
- Increase button padding slightly from `px-1.5` to `px-2` and icon size from `h-3 w-3` to `h-3.5 w-3.5`

### 2. StatsBar: Collapsible sections + better spacing (`StatsBar.tsx`)
- Wrap the "War Cost Estimate" section in a collapsible accordion (default collapsed) with a single summary line: "War Cost: $X.XXB/day — $XXX.XB total"
- Wrap the "Country Costs" row in the same collapsible
- Increase stat card text from 7px → 8px for labels, 10px → 11px for values
- Add subtle section labels: "OPERATIONAL STATUS" above stats, keep "WAR COST ESTIMATE" label
- Reduce commodity ticker to single-line with slightly larger text (11px → 12px)

### 3. Left sidebar: Section headers + collapse groups (`Index.tsx`)
- Add section dividers between widget groups:
  - **THREAT STATUS**: Rockets, Risk, Ransomware
  - **SITUATIONAL AWARENESS**: Geo-Fusion, Weather, Escalation
  - **INTELLIGENCE**: Commodities, News, Predictions, Telegram
- Each section has a tiny header label (9px mono uppercase) and a collapse chevron
- Collapsed sections show only the header

### 4. Right sidebar: Visual hierarchy (`Index.tsx`)
- Add colored left-border accents to distinguish widget types:
  - Notifications: red accent border
  - War Updates: amber accent border  
  - Layers/Timeline: cyan accent border
  - Cyber: purple accent border
- Add section labels above each widget

### 5. Global typography bump
- In `index.css`: increase minimum readable size from 7px → 8px across utility classes
- Ensure all interactive elements have minimum 28px touch targets

## Files Modified
- `src/components/dashboard/DashboardHeader.tsx` — Button grouping + sizing
- `src/components/dashboard/StatsBar.tsx` — Collapsible war costs + text sizing
- `src/pages/Index.tsx` — Sidebar section headers + accent borders
- `src/index.css` — Typography minimum sizes

