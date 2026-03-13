

# Orbital Intelligence — Specialized Satellite AI + Coverage Visualization

## What Changes

### 1. New Edge Function: `supabase/functions/satellite-chat/index.ts`
A dedicated AI chat function with a satellite-specialized system prompt replacing the generic `war-chat` for orbital queries.

**System prompt focus:**
- Expert satellite orbital mechanics, TLE interpretation, NORAD catalog knowledge
- Sensor capabilities by satellite type (EO resolution, SAR modes, SIGINT collection)
- Coverage analysis, revisit rates, ground swath calculations
- Operator/mission history, constellation architecture
- Can answer ANY satellite question: "What camera does this carry?", "When was it launched?", "What's its revisit time over Tehran?"

Uses Lovable AI Gateway (`google/gemini-2.5-flash`) — no extra API key needed. Includes the selected satellite's full orbital parameters + current position in every request as context.

### 2. Edit `SatelliteGlobe.tsx` — Ask AI Integration
- Replace `war-chat` URL with `satellite-chat` in both `openAiChat` and `sendAiMessage` functions
- Update the initial prompt to be satellite-focused (mission, sensors, capabilities, coverage)
- Pass full satellite metadata (all TLE params, category, country, operator, orbit type) as structured context in every message

### 3. Edit `SatelliteGlobe.tsx` — Click Behavior Enhancement
When a satellite is clicked (`onObjectClick` / `onLabelClick`):
- **Already works**: Shows orbit trail (30% behind, 70% ahead), zooms to satellite, shows detail panel
- **Add**: Holographic coverage cone visualization using Globe.gl's `ringsData` — a pulsing, translucent ring on Earth's surface centered at the satellite's sub-satellite point
  - Ring radius calculated from altitude + sensor FOV: `coverageRadius = alt * tan(halfFOV)` converted to degrees
  - Different FOVs by category: EO/ISR ~narrow (1-3°), SAR ~medium (5-8°), Comms ~wide (15-20°)
  - Animated pulsing ring with satellite's category color at 30% opacity
  - Ring follows the satellite as it moves (updated every propagation tick)
  - Shows coverage diameter in km in the detail panel

### 4. Coverage Ring Implementation
- Add state: `coverageRing` — `{lat, lng, radiusKm, color}` for the selected satellite
- Use Globe.gl's `ringsData` to render the coverage footprint as an animated expanding ring on the globe surface
- Compute coverage radius: `R_earth * arccos(R_earth / (R_earth + alt))` for horizon-limited sensors, or FOV-based for imaging sats
- The ring pulses with `propagationSpeed: 2` and `repeatPeriod: 1500` for holographic effect
- Ring color matches satellite category color with lower opacity
- Clear ring when satellite is deselected

## Files Changed
1. **Create**: `supabase/functions/satellite-chat/index.ts` — specialized satellite AI
2. **Edit**: `src/components/dashboard/SatelliteGlobe.tsx` — coverage ring + rewire AI chat

