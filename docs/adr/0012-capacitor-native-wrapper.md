# ADR-0012: Capacitor (not Tauri) as the native mobile wrapper

## Status

Accepted

## Context

The [PRD](../../Baby%20Tracking%20App%20PRD.md) requires a minimal native wrapper around the
existing React codebase even for the MVP, because push notifications are delivered per-platform
through the wrapper rather than via Web Push (see PRD section 5.3 and section 7). PRD section 7
explicitly left the **Capacitor vs. Tauri** choice open, and the root `CLAUDE.md` "Native wrapper"
architecture bullet has carried that as an unresolved decision ever since. [Phase 5's
roadmap](../roadmap/phase-5-export-wrapper-push.md) makes resolving it a task, listing four decision
criteria: **push-notification support, maintenance effort, team experience, and bundle size.**

Both candidates wrap a web frontend into an installable native app:

- **Capacitor** (Ionic) — a Node/TypeScript-centric wrapper that hosts the web app in the OS-native
  WebView and exposes native capabilities through a plugin ecosystem. Android/iOS builds use the
  standard Android Studio / Xcode toolchains.
- **Tauri** — a Rust-centric wrapper, historically desktop-focused (a lightweight alternative to
  Electron), with mobile (Android/iOS) support added in its 2.0 line. Native capabilities are
  exposed through Rust plugins.

This decision only concerns the wrapper choice and its immediate consequences for auth and push. It
does **not** cover the actual push send/trigger backend logic or the settings UI — those are
separate Phase 5 slices with their own decisions.

## Decision

Use **Capacitor**, with `appId: me.jkoschke.babytracker`. **Android is the primary target platform**
for the roadmap's "builds and installs on at least one platform" Definition-of-Done item, since an
Android build needs only Android Studio / the Android SDK and no macOS/Xcode dependency.

The criteria weighed as follows, decisive one first.

### 1. Push-notification support (decisive)

Capacitor has an official, Ionic-maintained
[`@capacitor/push-notifications`](https://capacitorjs.com/docs/apis/push-notifications) plugin with a
documented FCM (Android) / APNs (iOS) setup path. This is a first-party, versioned plugin tracking
the core Capacitor release line.

Tauri has **no official mobile push-notification plugin.** The upstream feature request
[`tauri-apps/tauri#11651` ("[feat] Push Notifications")](https://github.com/tauri-apps/tauri/issues/11651),
opened Nov 2024, was **re-checked on 2026-08-15** for this ADR and is **still open** — labeled only
`type: feature request`, last updated 2026-01-08, with no official plugin shipped and no committed
roadmap. The only options for Tauri push today are fragile, sub-1.0, single-maintainer community
crates used as a workaround. For an app whose _entire reason_ for having a native wrapper at all is
push notifications (PRD 5.3), shipping on a stack with no official, maintained push path would put
the core deliverable on the least-supported part of the stack. This alone is decisive.

### 2. Maintenance effort and team experience

Capacitor requires **zero Rust**: the toolchain is pure Node/TypeScript plus the standard
Xcode / Android Studio SDKs — matching the team's existing skillset (the whole codebase is
TypeScript/Node already, see root `CLAUDE.md`). Tauri mobile adds Rust, the Android NDK, and mobile
Rust targets on top of that same Xcode/Android Studio requirement, and Tauri's own documentation
notes that not all desktop plugins are available on mobile yet — i.e. a larger, less-familiar
surface to maintain for no offsetting benefit here.

### 3. Bundle size

Nominally favors Tauri (its headline selling point vs. Electron). But that comparison is a
_desktop_ one: on desktop Tauri uses the OS WebView instead of bundling a whole Chromium, which is a
large win over Electron. **On mobile, both Capacitor and Tauri use the OS-native WebView** (Android
System WebView / WKWebView) rather than bundling a browser engine, so the real-world install-size gap
between them on mobile is much smaller than Tauri's Electron-comparison marketing implies. For an
internal, self-hosted family app distributed outside public app stores, there is no app-store
size pressure making a small remaining difference decisive.

## Consequences

**Positive:**

- The core Phase 5 deliverable (push notifications) sits on an official, maintained, documented
  plugin (`@capacitor/push-notifications`) with a first-party FCM/APNs path — not a community
  workaround.
- The wrapper toolchain matches the team's existing TypeScript/Node skillset; no Rust/NDK ramp-up.
- The existing mobile-first React SPA is reused as-is inside the WebView; no UI rebuild (satisfies
  the roadmap's "Mobile-first-UI ohne Neubau im Wrapper" item).

**Negative / tradeoffs:**

- Capacitor is WebView-based, so the app runs in the OS WebView rather than a lighter/more native
  runtime — an accepted tradeoff given criterion 3 above (no size pressure for this distribution
  model).
- Building the native apps requires Xcode (iOS) and Android Studio (Android) installed locally;
  iOS specifically requires macOS. CI is deliberately **not** set up to build the native apps this
  phase (no SDKs/signing available on the runners) — the same posture already used for the deferred
  PWA-installability manual check in [`docs/known-issues.md`](../known-issues.md). This scope
  boundary is stated in the Phase 5 roadmap.
- The native platform project folders (`apps/frontend/android/`, `apps/frontend/ios/`) are generated
  and **committed** (Capacitor's own recommendation), because they carry native config that isn't
  fully regenerable — most importantly push-notification entitlements/`google-services.json`
  placement. Only their build-output subdirectories are gitignored.

**Deliberate deviation from the "self-hosted only, no SaaS/cloud" architecture principle:**

Root `CLAUDE.md` states the app is **self-hosted only, with no cloud/SaaS dependency.** Native mobile
push notifications make that impossible to hold _strictly_: **both** FCM (Android) **and** APNs
(iOS) are cloud relays operated by Google and Apple respectively, and every native mobile push — on
Android, on iOS, and regardless of whether the wrapper is Capacitor or Tauri — must pass through
those provider relays. There is no self-hostable substitute for a native OS push channel. This is
therefore an **unavoidable, explicit exception** to the self-hosted principle, not an incidental one:
push delivery specifically depends on an external cloud relay.

To keep the rest of the self-hosted posture intact, the exception is scoped as narrowly as possible:
each self-hosting operator supplies **their own** Firebase service-account credential via
`config.yml` (following the existing OIDC-provider config pattern — see
[ADR-0004](0004-oidc-authentication.md)), so there is no shared/central push service run by this
project, and an operator who does not configure `push:` simply gets no push notifications rather than
depending on anyone else's infrastructure. FCM is used as the single backend send path for both
platforms (FCM relays to APNs under the hood for iOS), so the backend has one sending integration
rather than two.

## Related

- [PRD](../../Baby%20Tracking%20App%20PRD.md) sections 5.3 and 7 — the native-wrapper requirement
  and the open Capacitor-vs-Tauri question this ADR resolves.
- [Phase 5 roadmap](../roadmap/phase-5-export-wrapper-push.md) — the wrapper-decision and
  push-notification tasks, and the CI scope boundary.
- [ADR-0004](0004-oidc-authentication.md) — the `config.yml` per-provider secret pattern reused for
  the Firebase service-account credential.
- [ADR-0008](0008-pwa-basics-via-vite-plugin-pwa.md) — the PWA/service-worker slice; Capacitor wraps
  the same built frontend, and the deferred-manual-verification posture here mirrors that ADR's.
- [`docs/known-issues.md`](../known-issues.md) — where the wrapper's real-device build/install, the
  cookie/origin auth smoke test, and end-to-end push delivery are tracked as deferred manual
  verification.
