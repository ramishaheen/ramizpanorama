

# Add "Disable All Layers" Button in Gotham 4D

## Change

Add a small "DISABLE ALL" button next to the `{totalActive}/{layerConfigs.length} LAYERS ACTIVE` text in the FourDMap layer panel. Clicking it sets all layers to `false`. A second click (when all are off) re-enables all layers ("ENABLE ALL").

## Implementation

**File**: `src/components/dashboard/FourDMap.tsx`

**Line ~1049-1051** — Update the `LAYERS ACTIVE` strip to include a toggle button:

```tsx
<div className="px-3 py-1.5 border-b border-[hsl(190,60%,10%)] flex items-center justify-between">
  <span className="text-[9px] text-muted-foreground font-mono tracking-wider">
    {totalActive}/{layerConfigs.length} LAYERS ACTIVE
  </span>
  <button
    onClick={() => setLayers(prev => {
      const allOff = Object.values(prev).every(v => !v);
      const newVal: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) newVal[k] = allOff;
      return newVal;
    })}
    className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors"
  >
    {totalActive === 0 ? "Enable All" : "Disable All"}
  </button>
</div>
```

Single file, single edit — no other changes needed.

