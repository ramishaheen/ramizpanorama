

# Move TotalLaunchesWidget Next to Intel Tools + Compact Size

## Current layout (bottom bar)
```text
[Legend][History][Style][Bookmarks] --[TotalLaunches (centered)]-- [Chokepoint][Intel Tools]
```

## Target layout
```text
[Legend][History][Style][Bookmarks] --spacer-- [Chokepoint][TotalLaunches (compact)][Intel Tools]
```

## Changes

### File: `src/components/dashboard/IntelMap.tsx`
- Remove the `<div className="flex-1 flex justify-center">` wrapper around `TotalLaunchesWidget` (lines 1954-1956)
- Add a `<div className="flex-1" />` spacer in its place
- Place `<TotalLaunchesWidget>` between `ChokepointMonitor` and the Intel Tools div

### File: `src/components/dashboard/TotalLaunchesWidget.tsx`
Compact everything significantly:
- **Container**: Remove rounded-xl, use rounded-lg. Reduce padding from `px-3.5 py-2.5` to `px-2 py-1.5`
- **Pulsing icon**: Shrink from w-9/h-9 to w-6/h-6, icon from w-4/h-4 to w-3/h-3
- **Main count**: Reduce from `text-xl` to `text-sm`
- **Label text**: Keep at 8px (already tiny)
- **Mini breakdown**: Reduce icon sizes from w-2.5/h-2.5 to w-2/h-2, font from 9px to 8px, gap from 1.5 to 1
- **Expand icon**: Shrink from w-3.5/h-3.5 to w-3/h-3
- **Expanded chart width**: Reduce from 420px to 320px
- **Chart heights**: Reduce from 120px to 90px, bar chart from 70px to 50px
- **Overall gap**: Reduce from gap-3 to gap-2

This makes the widget match the compact style of Intel Tools and Chokepoint Monitor in the bottom bar.

