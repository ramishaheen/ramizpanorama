

# Icon Size Scaling Based on Zoom Level

## Approach
The globe already polls `pointOfView().altitude` every 500ms into `viewAlt` state. Use this to compute a scale factor and apply it to all HTML marker elements via CSS transform, avoiding re-creating DOM elements on every zoom change.

## Changes — Single File: `src/components/dashboard/FourDMap.tsx`

### 1. Add a zoom-based scale factor effect
After the existing POV polling effect (~line 325), add a new effect that watches `viewAlt` and applies a CSS scale transform to all marker elements inside the globe's HTML elements container. The scaling formula:
- `altitude >= 3` (zoomed out): scale ~0.5 (small icons)
- `altitude ~1.5` (mid): scale ~1.0 (normal)
- `altitude <= 0.3` (zoomed in): scale ~1.8 (large icons)
- Interpolated linearly between these breakpoints

Implementation: Use a CSS variable on the globe container (`--marker-scale`) updated when `viewAlt` changes, then inject a `<style>` tag once that targets all marker wrapper divs with `transform: scale(var(--marker-scale))`.

### 2. Modify `createMarkerEl` to add a class
Add a stable CSS class (e.g., `globe-marker`) to each wrapper element so the injected style rule can target them uniformly. Also add `transform-origin: center center` so scaling is centered.

### 3. Inject global style once on mount
In the globe init effect (~line 500), inject a `<style>` element with:
```css
.globe-marker { transition: transform 0.3s ease; transform-origin: center center; }
```

### 4. Scale update effect
```typescript
useEffect(() => {
  const container = globeContainerRef.current;
  if (!container) return;
  // altitude ranges: 0.1 (close) to 5 (far)
  const scale = viewAlt <= 0.3 ? 1.8 
    : viewAlt <= 1.5 ? 1.8 - (viewAlt - 0.3) / 1.2 * 0.8  // 1.8 → 1.0
    : viewAlt <= 3.0 ? 1.0 - (viewAlt - 1.5) / 1.5 * 0.5   // 1.0 → 0.5
    : 0.5;
  container.querySelectorAll('.globe-marker').forEach((el: Element) => {
    (el as HTMLElement).style.transform = `scale(${scale.toFixed(2)})`;
  });
}, [viewAlt]);
```

This avoids rebuilding HTML elements on zoom — it just re-styles existing DOM nodes, keeping performance smooth. The hover `scale(1.4)` effect compounds on top for interactivity.

