# 0006 — iOS push notifications out of scope (no Apple Developer account)

- **Status:** Accepted
- **Date:** 2026-11-04

## Context
F20 shipped push notifications for **Android** (Expo + FCM) and the **web** (Web Push + VAPID) — both free to set up and run. Extending push to Apple needs an **Apple Developer Program** membership (~$99/year): APNs keys for the native iOS app, and even Safari web push only works for installed PWAs. For a portfolio project that is deployed on demand and otherwise torn down, a recurring paid membership isn't justified right now — the push story is already demonstrable on Android and the web.

## Decision
**Do not implement iOS push** (native APNs or Safari-PWA web push) for now. The existing push code stays cross-platform and **degrades gracefully** on Apple devices rather than being special-cased out:
- **iOS mobile app:** `registerForPush` (`client/mobile/src/push.ts`) is best-effort inside a try/catch — without APNs the token request simply fails and is swallowed, so the app runs normally and the in-app 🔔 bell still works; the device just never registers for OS push.
- **iOS Safari web:** the "Enable browser notifications" control is gated on `isWebPushSupported()` (feature-detects `PushManager`), so it doesn't render in a normal iOS Safari tab. The rest of the web app is unaffected.

Revisit if the project gains an Apple Developer account or targets the App Store.

## Consequences
- **+** No recurring cost; push is still shown end-to-end on Android + web.
- **+** No breakage on Apple devices — graceful, feature-detected degradation, not a crash or an error path.
- **−** iPhone/iPad users get in-app notifications but no OS-level push until this is revisited.
- **−** The cross-platform push code carries inert Apple branches; kept deliberately so re-enabling is config + an Apple account, not a rewrite (same philosophy as [0004](0004-defer-authentication.md)).

## Alternatives considered
- **Pay for Apple Developer now** — rejected for now: recurring cost not justified for a deploy-on-demand showcase.
- **Strip push from iOS builds entirely** — rejected: feature-detected degradation is simpler, keeps one codebase, and leaves a clean re-enable path.
