

# Move Live Data Feed Indicator to Header (Next to ONLINE Status)

## What Changes

### 1. `src/components/dashboard/DashboardHeader.tsx`
- Add `lastPollAt`, `activeSources`, and `dataFresh` props to `DashboardHeaderProps`
- Insert an inline version of the indicator right before the ONLINE status block (line ~150), styled to match the header's `text-[10px] font-mono` pattern — pulse dot + source count + time-ago, no border/background (it's already inside the header bar)

### 2. `src/pages/Index.tsx`
- Pass `lastPollAt`, `activeSources`, and `dataFresh` to `DashboardHeader`
- Remove both `<LiveDataFeedIndicator>` instances from inside the map containers

### 3. `src/components/dashboard/LiveDataFeedIndicator.tsx`
- Keep the file but repurpose it as a compact inline component (no absolute positioning, no background/border/shadow) so it fits naturally in the header row next to the ONLINE indicator

