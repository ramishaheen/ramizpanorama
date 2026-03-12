

# Fix: Left Column Drag-and-Drop Not Working

## Root Cause

**Version mismatch** between `@dnd-kit/sortable@10` and `@dnd-kit/core@6`. The `@dnd-kit/sortable` v10 is a major rewrite that requires `@dnd-kit/core` v7+. With core v6, the sortable hooks silently fail — drag handles appear but dragging does nothing.

## Fix

**Downgrade `@dnd-kit/sortable` to `^9.0.0`** to match `@dnd-kit/core@6` compatibility. No code changes needed — the `useSortable`, `SortableContext`, and `arrayMove` APIs are the same between v9 and v10 for the patterns used here.

### Files Changed
- `package.json` — change `@dnd-kit/sortable` from `^10.0.0` to `^9.0.0`

