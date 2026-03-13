

# Make Legend Items Toggle Map Layers On/Off

## Problem
The Legend popup is display-only. Clicking items does nothing. User wants each legend item to toggle its corresponding marker type on/off on the map.

## Solution
Make `MapLegend` accept `layers` and `onToggleLayer` props from `IntelMap`, then map each legend item to a `LayerState` key. Clicking an item toggles that layer. Disabled items show dimmed/strikethrough styling.

### Mapping: Legend Item → Layer Key
| Legend Item | LayerState key |
|---|---|
| Military, Diplomatic, Economic, Humanitarian, General News | (news markers — no individual toggle exists; group under a new pseudo-toggle or skip) |
| Missile / Special | `rockets` |
| Airstrike, Explosion, Drone, Naval, Protest, WarsLeaks Intel | (telegram markers — all share one group) |
| Wildfire | `wildfires` |
| Earthquake | `earthquakes` |
| Vessel | `maritime` + `aisVessels` |

Since news markers and telegram markers don't have individual layer toggles, we need to either:
- Add `news` and `telegram` keys to `LayerState`, or
- Toggle the entire group for all items that share a source

**Approach**: Add two new layer keys (`news` and `telegram`) to `LayerState` so legend items for AI Intel and WarsLeaks can be toggled. This requires minimal changes since the marker render effects already exist — just wrap them with a `layers.news` / `layers.telegram` check.

### File Changes

#### 1. `src/components/dashboard/LayerControls.tsx`
- Add `news: boolean` and `telegram: boolean` to `LayerState` interface

#### 2. `src/pages/Index.tsx` (or wherever `layers` state is initialized)
- Add `news: true` and `telegram: true` to the default layer state

#### 3. `src/components/dashboard/IntelMap.tsx`
- In the news markers `useEffect` (~line 432): add early return if `!layers.news`
- In the telegram markers `useEffect` (~line 476): add early return if `!layers.telegram`
- Pass `layers` and `onToggleLayer` to `<MapLegend />`

#### 4. `src/components/dashboard/MapLegend.tsx`
- Accept `layers: LayerState` and `onToggleLayer: (key: keyof LayerState) => void` props
- Define a mapping from each legend item label to its `LayerState` key(s)
- Make each item clickable — on click, call `onToggleLayer(mappedKey)`
- Show dimmed opacity + line-through text when the corresponding layer is off
- Add a small eye/eye-off icon indicator per item
- Keep severity and indicators sections as-is (non-interactive)

