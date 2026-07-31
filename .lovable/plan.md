## Goal
Make the iOS payment kill-switch cover both the native iOS app **and** iPhone mobile web browsers, so Apple reviewers see no purchase path when the toggle is off. Keep Android and web behavior unchanged. Clarify the admin UI so the scope of each toggle is obvious.

## Current behavior (verified)
- `Capacitor.isNativePlatform()` returns `true` only inside the native iOS/Android app shell.
- `usePaymentsEnabled()` therefore treats iPhone Safari/Chrome as **web**, so payments stay visible on mobile web even when the iOS toggle is off.
- Admin labels say "iOS", which can be read as native-only.

## Proposed changes

### 1. Detect iPhone mobile web as iOS for payment purposes
Update `src/utils/platform.ts`:
- Add `isIOSDevice()` helper that detects iPhone/iPad/iPod from `navigator.userAgent` (covers native app and mobile web).
- Update `platformHeader()` to send `"x-smarty-platform": "ios"` whenever `isIOSDevice()` is true.
- Keep `isIOSNative()` unchanged for any code that truly needs native-shell-only detection.

Update `src/hooks/usePaymentsEnabled.ts`:
- Update `getPaymentPlatform()` to return `"ios"` when `isIOSDevice()` is true, even if `Capacitor.isNativePlatform()` is false.
- Android mobile web remains "web" (no change).

### 2. Adjust the disabled-purchase message for iPhone web
Update `src/components/PaymentsDisabledNotice.tsx`:
- Accept or detect the current platform.
- When payments are disabled on iOS/iPhone, show a message that does not tell the user to "visit smartygym.com" while they are already on it.
- Proposed copy: "Purchases are not available on iPhone right now. Please use a desktop or Android device to upgrade."

### 3. Clarify admin panel labels
Update `src/components/admin/PaymentsManager.tsx`:
- Rename iOS tab label from "iOS" to "iOS / iPhone".
- Update the toggle label from "In-app purchasing on iOS" to "Purchasing on iOS / iPhone".
- Update the guideline text to state explicitly that this affects the native iOS app **and** Safari/Chrome on iPhone.
- Update the "Purchases visible to" badge label from "Apple" to "Apple / iPhone users".

### 4. Server-side enforcement stays the same
- The existing checkout edge functions already read the `x-smarty-platform` header and reject requests when the matching platform toggle is off.
- Because `platformHeader()` will now send `"ios"` for iPhone mobile web, server-side enforcement will automatically cover mobile web with no edge-function changes.

## Out of scope
- Android mobile web: still treated as "web" and unaffected by the Android toggle.
- Web (desktop): still always enabled.
- No database changes; the existing `payments_enabled_ios` and `payments_enabled_android` rows are reused.

## Verification
- Typecheck passes.
- Manual check: open smartygym.com in iPhone Safari simulator with `payments_enabled_ios = false`; purchase buttons should be replaced by the disabled notice.
- Manual check: open the same URL on Android Chrome or desktop; purchase buttons remain visible.