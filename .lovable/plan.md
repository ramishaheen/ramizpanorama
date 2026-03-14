

# Convert All Globe Markers from Particles to Styled Icon Elements

## Problem
All intelligence layers (earthquakes, wildfires, conflicts, nuclear, maritime, flights, air quality, GPS jamming, blue/red force, targets, sensors, OSINT events) render as **3D sphere particles** via `globe.pointsData()`. Only satellites use `globe.htmlElementsData()` with proper emoji icons, labels, pulse rings, and hover effects. The user wants all layers to match the satellite icon style.

## Solution
Migrate every layer from the `points[]` array (`pointsData`) to the `htmlElements[]` array (`htmlElementsData`), using the same DOM-based icon rendering pattern already used for satellites.

## File: `src/components/dashboard/FourDMap.tsx`

### Changes in the main data update effect (lines 789–1114)

1. **Replace `points[]` accumulation with `htmlElements[]`** — instead of pushing `{ lat, lng, pointAlt, color, radius, label }` objects, push `{ lat, lng, alt, el }` objects where `el` is a styled DOM element.

2. **Create a reusable `createMarkerEl()` helper** that builds the HTML element for any layer item:
   - Accepts: `{ icon, color, label, size, pulse, sublabel, category }`
   - Renders: emoji icon with `drop-shadow` glow in the layer's color, optional pulse ring for critical/high severity, compact monospace sublabel beneath
   - Hover: scales up to 1.4x and shows full tooltip (reusing existing label HTML)
   - Click: triggers existing `onPointClick` / feed click behavior
   - Matches the satellite element pattern (lines 943–973)

3. **Layer-specific icon mapping** (already defined in the code, just needs to render as HTML elements):

   | Layer | Icons (already in code) | Size | Pulse condition |
   |---|---|---|---|
   | Earthquakes | 🔴🟠🟡 by magnitude | 16-20px | M5+ |
   | Wildfires | 💨🔥 | 14-16px | FRP > 50 |
   | Conflicts | ⚔️💥✊🔥⚠️🎯 | 16-18px | critical/high |
   | Nuclear | ☢️⚛️ | 16-18px | always |
   | Maritime | ⚓🛢📦🎣🚢 | 14-18px | military type |
   | Flights | ✈️🎖📡🚁👁📦⛽🔍🔴 | 12-16px | military |
   | Air Quality | 🌬 | 14px | AQI > 150 |
   | Geo-Fusion | 📡 | 16px | sev ≥ 4 |
   | GPS Jamming | 🟥 | 18px | always |
   | OSINT Events | per-type emoji | 16px | critical |
   | Blue Force | 🪖🔵🛡⚓👁💥⭐🗡📦 | 16-18px | never |
   | Red Force | 🪖🔴🎯⚓👁🚀⚠️ | 16-18px | always |
   | Target Tracks | 🪖🎯🚀📡💥🏛⚠️ | 18-20px | critical |
   | Sensors | 🛰👁📹📡📊 | 14px | degraded |
   | AI Scan | 🎯👁 | 16px | critical |

4. **Merge all HTML elements with satellites** into a single `globe.htmlElementsData([...satElements, ...layerElements])` call, replacing the current split between `pointsData` and `htmlElementsData`.

5. **Set `globe.pointsData([])` permanently** — no more particle rendering.

6. **Performance cap**: Limit total HTML elements to ~500. Satellites get priority (up to 200), then remaining 300 slots filled by severity-ranked layer items. Starlink satellites downgraded to smallest size (8px).

7. **Preserve existing tooltip HTML** — each element's `title` attribute or hover-expand uses the same rich HTML label strings already defined in the code. The only change is the rendering method (DOM element vs 3D sphere).

8. **Preserve click behavior** — the `wrapper.onclick` on each element triggers the same `handleFeedClick` / target workbench open logic currently wired through `onPointClick`.

### No other files need changes
This is a single-file refactor inside the main globe data update effect.

