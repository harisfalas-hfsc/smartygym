ALTER TABLE public.user_custom_workouts
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_viewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz;

ALTER TABLE public.user_custom_workouts
  ADD CONSTRAINT user_custom_workouts_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));