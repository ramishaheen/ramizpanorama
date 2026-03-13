

# Enhance Map Legend — Wider, Scrollable, Layer Toggle

## Changes — `src/components/dashboard/MapLegend.tsx`

### 1. Wider Panel
- Increase width from `w-[230px]` → `w-[320px]`
- Switch grid from `grid-cols-2` → single column list for better readability and larger click targets

### 2. Proper Scrollbar
- Wrap the content inside a `ScrollArea` component (from `@radix-ui/react-scroll-area`) instead of raw `overflow-y-auto`
- Set `max-h-[50vh]` on the scroll viewport so the legend never overflows the screen
- This gives a styled right-side scrollbar that matches the app theme

### 3. Active Toggle per Item
- Each legend item already maps to a `layerKey` and calls `onToggleLayer` — this is wired correctly
- Enhance visual feedback: active items get a colored left border + full opacity; disabled items get `opacity-30`, strikethrough text, and grayscale emoji
- Add a subtle background highlight (`bg-primary/10`) on active items so the on/off state is unmistakable
- Increase item padding for easier click targets (`py-1.5 px-2`)

### 4. Eye Icon Enhancement
- Scale eye icons from `h-2 w-2` → `h-3 w-3` for visibility

### File Changed
- `src/components/dashboard/MapLegend.tsx`

