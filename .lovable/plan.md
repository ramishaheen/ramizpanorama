

## Problem Diagnosis

The YouTube Live Channels feature is broken because:

1. **Edge function not deployed**: `youtube-channels` is missing from `supabase/config.toml`, so all add/delete/refresh calls return 404.
2. **Read path works** (uses `supabase.from("youtube_channels")` directly), but there's no data because nothing can be added.
3. **No channels in DB** — confirmed via query: the table is empty.

## Plan

### 1. Register the edge function in config.toml
Add `[functions.youtube-channels]` with `verify_jwt = false` to `supabase/config.toml`.

### 2. Fix the frontend to bypass the broken edge function for CRUD
Since the `youtube_channels` table already has service-level RLS policies for insert/update/delete, and the edge function uses the service role key, we need the edge function. But the simpler fix is:

- **Keep the edge function** for add/delete/refresh (it uses service role key which bypasses RLS).
- Just ensure it's registered in config.toml so it deploys.

### 3. Update CORS headers in edge function
The current CORS headers are missing some required headers. Update to include the full set.

### 4. Fix the "add channel" flow to work without edge function as fallback
Since the RLS policies on `youtube_channels` are `PERMISSIVE: No` (restrictive) for insert/update/delete with `true` check — these are actually service-role-only. The edge function approach is correct, it just needs to be deployed.

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/config.toml` | Add `[functions.youtube-channels]` with `verify_jwt = false` |
| `supabase/functions/youtube-channels/index.ts` | Update CORS headers to include full required set |

This is a **one-line config fix** plus a minor CORS update. Once `config.toml` registers the function, it will auto-deploy and the add/delete/refresh actions will work, channels will appear, and the YouTube player will load.

