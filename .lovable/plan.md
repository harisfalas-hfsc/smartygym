# Restore the Sisters Project announcement

## Changes
- Limit the announcement panel to SmartyDiet and SmartyMove only.
- Re-enable the existing announcement switch in the database without changing any other announcements.
- Verify the panel appears and contains only those two projects.

## Technical details
- Remove SmartyWorkout from the existing sister-app list.
- Set `sister_announcement_enabled` to enabled.
- Run the relevant checks and inspect the rendered panel.
