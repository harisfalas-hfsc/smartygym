# Make workout creation resilient and honest

## Confirmed current behavior

### Model and workout quality
- Both **Admin → Create New Workout** and **Create Your Own Workout** call the same shared workout engine.
- Both currently use **`openai/gpt-6-astra`** with **priority serving** and medium reasoning.
- The live model catalogue confirms this model is available, not deprecated, and supports priority serving.
- Keep this model and the complete shared coaching, library, equipment, category, format, difficulty, enforcement, scoring, validation, and deterministic-fallback rules unchanged.

### The three-call issue
- I have **not fixed this**. The previous request was inspection-only.
- The code says “one model call only,” but its loop can make up to three calls.
- A valid first answer returns immediately, so the normal successful case costs one call.
- If the answer is structurally invalid, it immediately asks the model again. Some network and gateway failures also repeat immediately.
- This is not compliant with the required recovery policy: only rate limits and temporary server failures may retry, and only after bounded backoff. Other failures must stop.

### What the customer experiences now
- The customer is initially held in a generation window and told to stay there.
- After 90 seconds, **Leave it with us** becomes available. The server continues building if they close the window, change page, refresh, or close the browser.
- If they remain on the page, it checks every three seconds and opens the completed workout automatically.
- After four minutes, that page stops checking and shows a timeout even when the server may still finish successfully.
- The workout identifier is not saved for recovery, so refresh or browser closure loses automatic tracking.
- **My Own Workouts** reads the saved rows, but its current list does not distinguish a workout that is still being built from a completed one.
- The generation window promises an email when the workout is ready, but the completion process currently sends **neither that email nor an in-app ready message**. That promise is incorrect today.
- If generation fails, its reserved row is deleted. This prevents a false workout from being delivered, but also removes the status needed for clear recovery and diagnosis.

## Implementation plan

### 1. Correct model-call recovery without weakening quality
- Keep `openai/gpt-6-astra`, priority serving, medium reasoning, and the existing prompt/rules.
- Make one normal model call.
- Treat validation rejection as a deterministic-fallback event rather than immediately buying another full generation.
- Treat 400, 401, 402, 403, 404, provider refusal, and empty/refused output as terminal; preserve the safe reason and do not retry.
- Retry only 429 and temporary 5xx responses, with `Retry-After` support or exponential backoff with jitter, a strict attempt cap, and no immediate replay.
- After retry exhaustion, run the existing deterministic fallback once. Never return structurally invalid content.
- Preserve the paused state required for credit or policy blocks so refreshes and background entry points cannot restart spending automatically.

### 2. Persist member generation progress
- Save the active workout identifier in the browser as soon as the background build is reserved.
- Restore tracking after refresh, navigation, sign-in restoration, or reopening the app.
- Remove the misleading four-minute failure. Waiting may hand off to background mode, but tracking continues until a real completed or failed state exists.
- Clear the saved identifier only when the job reaches a terminal state.
- Keep the two-workout daily limit and prevent duplicate generation calls while one request is already active.

### 3. Let customers leave immediately
- Change the generation window from a blocking wait into a clear choice: **Keep waiting** or **Continue using Smarty Gym**.
- Allow leaving as soon as the server has reserved the workout; do not require a 90-second wait.
- If the customer stays, open the workout automatically when ready.
- If they leave, show the active build in **My Own Workouts** as **Building**, disable player actions until ready, and update it automatically when completed.

### 4. Deliver truthful completion and failure messages
- On successful completion, create one idempotent in-app message containing the workout name and a direct link to open it.
- Send the ready email through the existing delivery system and respect the member’s notification preferences and suppression rules.
- If the member is actively using the app, also show a one-time ready notice and refresh the unread-message count and workout list.
- On failure, retain a terminal failed status instead of silently deleting the row, show a safe reason, do not count it against the daily allowance, and offer a fresh manual retry.
- Ensure repeated workers, refreshes, or status checks cannot send duplicate messages or emails.

### 5. Apply the same error truthfulness to Admin
- Keep Admin’s persistent background job and refresh recovery.
- Surface the exact safe terminal reason instead of a generic failure.
- Keep Admin output as a reviewable draft; no automatic save, publishing, image generation, Stripe change, or member announcement.

## Technical safeguards
- Extend the member workout job state only as needed for `generating`, `created`, and `failed`, with a safe error field and notification timestamps/idempotency markers.
- Keep every new database field private to its owner under the existing access rules; include explicit authenticated and service grants in the migration.
- Never start another model request merely because the browser refreshed or polling restarted.
- Do not modify training-program generation, workout doctrine, exercise selection, pricing, Stripe, visibility, or the existing workout library.

## Verification without wasting credits
1. Unit-test the retry classifier: terminal statuses never retry; 429/5xx wait and stop at the cap; validation rejection goes directly to deterministic fallback.
2. Test successful, refused, credit-blocked, rate-limited, temporary-server-error, invalid-output, and fallback paths using mocked gateway responses only.
3. Test refresh, navigation, browser closure/reopen, two tabs, four-minute-plus completion, and failure recovery with mocked/background job states.
4. Verify **Building**, **Ready**, and **Failed** states in My Own Workouts and confirm incomplete rows cannot open in the player.
5. Verify exactly one in-app message and one preference-compliant email per completed workout, with no duplicates after refresh or worker replay.
6. Run the shared coaching-rule, player/parser, type, and build checks.
7. Make at most **one explicitly approved live end-to-end generation** only if requested after all no-credit tests pass; otherwise report the live paid call as intentionally unverified.

## Completion standard
- One normal AI call, bounded delayed retries only for 429/5xx, deterministic fallback after eligible exhaustion, and no automatic repeat spending.
- Customers can leave immediately, always recover the active job, see its true state, and receive a real ready message matching the screen promise.
- Both entry points continue using the same `openai/gpt-6-astra` workout engine and return only validated workouts.
