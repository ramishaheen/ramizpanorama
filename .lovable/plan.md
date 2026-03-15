

## Plan: Integrate cipher387/osintmap OSINT Links into 4D Globe

The osintmap repository is a curated dataset of **614+ OSINT tools** organized by country/region — covering cadastral maps, business registries, court records, yellow pages, transport maps, vehicle databases, and more. We'll embed this as a new **OSINT tab** in the C2 right panel and as clickable country markers on the globe.

### Architecture

```text
┌─────────────────────────────────────────┐
│  src/data/osintMapData.ts               │  ← Static dataset: ~200 countries
│  { country, lat, lng, links[] }         │     with coordinates + categorized links
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼───────────┐  ┌─────▼──────────────┐
│ FourDMap.tsx  │  │ OSINTLinksPanel.tsx │  ← New right-panel tab
│ (globe layer) │  │ (searchable list)  │
└───────────────┘  └────────────────────┘
```

### File Changes

#### 1. New: `src/data/osintMapData.ts`
- Static TypeScript file containing all ~200 countries/regions from the osintmap README
- Each entry: `{ country: string, lat: number, lng: number, links: { category: string, label: string, url: string }[] }`
- Categories normalized to: `cadastral`, `business_registry`, `court_records`, `yellow_pages`, `transport`, `vehicle_info`, `passenger_lists`, `other`
- Includes coordinate centroids for each country so they can be placed on the globe

#### 2. New: `src/components/dashboard/OSINTLinksPanel.tsx`
- New right-panel tab component showing OSINT resources
- **Location-aware**: Uses `mapCenter` prop to auto-sort countries by proximity to current globe view (same pattern as SensorFusionPanel)
- Search bar to filter by country name or category
- Category filter chips (Business, Courts, Cadastral, etc.)
- Each country expandable to show its links as clickable external links (opens in new tab)
- "FLY TO" button on each country to center the globe there
- Link count badges per country

#### 3. Modified: `src/components/dashboard/FourDMap.tsx`
- Add `"OSINT"` tab to the C2 right panel tab bar (icon: 🌐, label: "OSINT")
- Add `c2RightTab === "OSINT"` render case pointing to `<OSINTLinksPanel>`
- Add `osintLinks` as a toggleable globe layer that renders country markers (🌐 icons) on the globe using `htmlElementsData`
- When layer is active, country centroids appear as small markers; clicking one opens the OSINT panel filtered to that country
- Pass `mapCenter` and `mapAltitude` to `OSINTLinksPanel` for proximity sorting
- Wire `onLocate` to fly globe to country coordinates

### Globe Markers Behavior
- OSINT markers only render when the `osintLinks` layer toggle is ON (follows existing layer toggle pattern)
- Markers scale with zoom like other markers
- At high altitude: show only countries with 5+ links to avoid clutter
- At lower zoom: show all countries in view

### Files Summary
- **New**: `src/data/osintMapData.ts` — Full OSINT dataset (~200 entries)
- **New**: `src/components/dashboard/OSINTLinksPanel.tsx` — Searchable OSINT panel
- **Modified**: `src/components/dashboard/FourDMap.tsx` — New tab + globe layer

