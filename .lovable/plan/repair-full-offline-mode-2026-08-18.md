# Repair Full Offline Mode

## Goal
Make SmartyGym genuinely boot and remain usable without internet across the installed PWA and native Capacitor builds, while preserving each member's exact cached entitlement level and keeping accounts isolated on shared devices.

## Implementation
1. **Fix the offline app shell**
   - Keep the guarded production service worker for published web/PWA installs and ensure all route chunks, styles, fonts, icons, and required images can load during a cold offline start.
   - Remove the native startup behavior that destroys caches, and ensure Capacitor builds use their bundled `dist` shell rather than a remote website URL.
   - Add an explicit offline loading/error shell so a failed remote request can never become a blank WebView error page.

2. **Make authentication work offline**
   - Restore the cached session before route/auth checks run.
   - Keep PBKDF2 password verification device-local without storing the raw password.
   - Scope saved credentials and sessions by account/email so multiple users on one device cannot restore another user's session.
   - Keep signed-out offline login available after a prior successful online login, and expose credential clearing through account settings.

3. **Complete user-scoped offline data coverage**
   - Audit every customer-facing read path and route it through the shared offline-first layer or a matching cached-key adapter.
   - Expand background synchronization to include full detail records, comments/threads, profile/settings, logbook/history, progress, saved/owned content, notifications, community data, and required reference/media records.
   - Preserve protected member data during cache trimming and evict only expendable detail/media records.

4. **Enforce entitlement-safe offline behavior**
   - Cache only content the signed-in member is entitled to at the last successful online sync.
   - When Free Access Mode or a subscription changes while online, immediately overwrite formerly accessible paid bodies with locked metadata and invalidate in-memory copies.
   - Never elevate or silently downgrade access merely because the device is offline.

5. **Read-only behavior and honest states**
   - Disable network-only creation, generation, payment, subscription, and server actions offline with one consistent explanation.
   - Queue only safe local mutations and replay them after reconnection.
   - Distinguish genuinely empty data from a device that has never downloaded a copy.

## Verification
- Run targeted offline/auth/cache tests and the project test suite required by the changed areas.
- Build the production PWA and verify the generated service worker contains the application shell and lazy route chunks.
- Use browser automation for online sign-in/sync followed by offline reload and navigation through protected cached pages.
- Validate user-scope isolation with two synthetic local account scopes.
- Validate Capacitor configuration/build output so native cold start loads bundled assets without a network URL.

## Technical constraint
This project can be repaired and verified here. The same implementation must be applied and independently tested inside each separate project repository; one project's source changes cannot automatically modify the others.
