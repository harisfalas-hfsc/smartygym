---
name: Free Access Mode must be enforced in the database
description: free_access_mode must unlock content in RLS/RPCs, not only in the client
type: feature
---
The `free_access_mode` system setting (Admin → Payments) must be honoured server-side, not only in `AccessControlContext`.

- `public.free_access_mode_enabled()` (security definer) reads the setting.
- `user_has_active_premium_access(_user_id)` returns true for any signed-in user while free access mode is on — this drives RLS on `admin_workouts` / `admin_training_programs`.
- `get_visible_workout_metadata` / `get_visible_program_metadata` unlock content columns when the caller is entitled (free access mode, premium, admin, or purchaser) instead of always stripping premium content.

**Why:** with client-only enforcement, non-premium signed-in users saw empty/partial workouts and programs while admins saw everything.
