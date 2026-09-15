# Shared Workouts — members can publish their own workouts

Yes, this is very doable. Everything needed already exists: members' workouts are stored with the same fields as your own workouts (name, category, format, focus, level, duration, equipment, content), the categories page and its filters are built, and the image generator used when a workout is created can be reused.

## What members will get

**On "My Own Workouts"** — each workout gets a "Share with the community" switch. Sharing shows a short confirmation: it becomes visible to active premium members, it is never sold, their first name is shown, and they can unshare at any time. Unsharing removes it everywhere immediately.

**A new "Shared Workouts" category** in Smarty Workouts — same card, picture and layout as Strength, Cardio, Pilates and the rest, placed last in the grid and in the mobile carousel.

**Inside the category page** — the same look and the same filters as every other category (equipment, format, level, duration, status, search, newest first), plus two extras that fit member-made sessions:
- Category filter (Strength, Cardio, Metabolic, Mobility, Challenge, Pilates, Recovery, Micro)
- Focus filter using exactly the Smarty Coach options (full body, upper body, lower body, arms, core, glutes, back, etc.)

**Each shared workout opens** like any other workout — header, badges, content, reader's mode, workout player — with "Shared by [first name]" on the card and on the page. No price, no buy button, ever.

**Community page** — a new "Shared Workouts" card in the same style as the other cards, showing the latest shared sessions and linking to the full category.

**Picture** — when a workout is shared, an image is generated for it automatically, the same way your own workouts get one. Until it finishes, the card shows the category picture, so no card is ever empty.

**Who can see them** — active premium members only. (While Free Access Mode is on, everyone sees them, like all other premium content.)

**Your control** — sharing is instant, no approval queue. In the admin panel you get a "Shared Workouts" list where you can unshare or delete any of them, and members can report a workout.

## Technical notes

Database (one migration on `user_custom_workouts`):
- `is_shared boolean default false`, `shared_at timestamptz`, `shared_by_name text`, `image_url text`, `share_report_count int default 0`
- New read policy: a row is readable by others when `is_shared = true` AND (`user_has_active_premium_access(auth.uid())` OR `free_access_mode_enabled()`); owner-only policies stay as they are. Update policy limited so a member can only flip their own `is_shared`.
- Admin read/update policy via `has_role(auth.uid(),'admin')`.
- Index on `(is_shared, shared_at desc)`.

Frontend:
- `src/pages/SharedWorkouts.tsx` — modelled on `WorkoutDetail.tsx`, reusing `CompactFilters`, `PageBreadcrumbs` (Home → Smarty Workouts → Shared Workouts) and the standard card grid; category + focus filters added from `src/constants/workoutCategories.ts` and the coach options list.
- `src/pages/SharedWorkoutDetail.tsx` — read-only version of `MyOwnWorkoutDetail`, wrapped in `ParqWaiverGate` and the premium `AccessGate`.
- Routes `/workout/shared` and `/workout/shared/:id`; new category entry + background image in `WorkoutFlow.tsx` (desktop grid and mobile carousel), counted by the existing category-count badge.
- Share toggle in `MyOwnWorkouts.tsx` and `MyOwnWorkoutDetail.tsx`.
- Community card in `Community.tsx`, same stacked-card pattern and green border as the neighbouring cards.

Backend:
- Small edge function `share-custom-workout`: validates ownership, sets the share fields, stores the sharer's first name from their profile, and kicks off image generation with the existing workout-image function.
- New category background image generated for the card.

## Out of scope

No price, no standalone purchase, no Stripe product for shared workouts. Existing workouts, categories and the Workout of the Day system are untouched.
