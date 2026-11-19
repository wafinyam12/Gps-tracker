# Released visit support: mobile UI refactor

**Date:** 17 November 2026
**Status:** Approved for implementation on 17 November 2026

## Intent

Finish the mobile presentation of the already released visit pilot. Sales has an
approved calm visual direction; Area Manager, monitoring, administration needed
for Sales setup, and shared account screens should feel like the same product.
The work should reduce searching, cramped controls, inconsistent padding, and
unclear empty or error states without changing visit data, permissions, or SAP
integration.

## Release boundary

Included: `AdminDashboard` for Area Manager, Manager, Admin Cabang, and Super
Admin; `LiveMap`, `TeamSummary`, `SalesDetail`, `Alerts`; `UserList`, `UserForm`,
`TeamList`, `TeamForm`; and shared `Login` and `Profile`. The shared Sales Home,
visit form, camera, history, and location keep the established design and receive
only fixes revealed by cross-role testing. The admin setup screens remain visible
only to their existing roles, and Area Manager's report and map remain scoped to
its assigned branch/team.

Excluded from this release: `CustomerKyc`, `StoreForm`/store administration that
is not in the released menu, payment and receivables sections that are still
hidden, and new reporting or monitoring capabilities. Their existing data and
code are not reworked by this visual pass.

## Approach

1. **Per released journey (selected from the earlier UI decision):** finish
   Area Manager monitoring, then admin account/branch setup, then shared account
   screens. Each journey has local verification before the next begins. This
   carries the approved Sales visual system across real user tasks.
2. **Change every screen and shared theme at once:** fewer intermediate styles,
   but it would couple role permissions, forms, map overlays, and login in one
   risky update close to UAT.
3. **Replace navigation and component architecture first:** could simplify the
   code later, but would change working routes and state while the pilot is
   active.

Use the first approach. Keep existing React Native/Expo SDK 54 packages and
runtime 1.1.5. Extract small presentation components only when two screens use
the same pattern; leave API calls, authorization, offline queue, and map loading
in their existing owners. No new native dependency or rebuild is planned.

## Visual direction

Reuse the approved Sales palette: canvas `#F5F7F8`, surface `#FFFFFF`, ink
`#203237`, muted ink `#66777A`, primary `#386A6A`, primary tint `#E7F0EF`.
Success, warning, and error retain text labels and the existing semantic
colors. Use the system font with the established 24/30 page, 16/22 section,
14/20 body, 13/18 label, and 12/17 caption scale. Page edges are 16 dp;
related items use 8–12 dp; major sections use 20–24 dp. Primary tap targets
are at least 48 dp and secondary ones at least 44 dp. Text wraps on 320–360
dp devices and with larger system text. Each light screen uses readable dark
status-bar icons and respects safe areas and the device keyboard.

Keep the visual emphasis on the next task, not on decorative statistics. Avoid
the current oversized welcome hero, repeated equal-weight cards, and alert red
where no alert exists. Use plain Indonesian labels: `kunjungan`, `Sales`,
`cabang`, `peringatan`, and action text that names the result of a tap.

## Journey 1: Area Manager and visit monitoring

The role-aware dashboard shows the assigned branch/team, one clear monitoring
action, and shorter links to visit summary, personal visit (where authorized),
and profile. Admin roles retain their existing management links. Do not add a
branch selector to Area Manager. In monitoring, the map is the main surface;
back, refresh, customer visibility, legend, branch scope, last refresh, and
Sales chips sit in safe-area-aware overlays that do not cover each other on a
narrow phone. Preserve map viewport requests, 60-second refresh, marker taps,
and API-provided branch scope. Customer visibility remains an explicit toggle.

Summary puts date and the fixed Area Manager branch at the top, followed by
target/progress, warnings, and a readable Sales list. Admin/Manager retain the
existing branch picker. Every existing audit count remains available, with
secondary counts grouped below the main progress rather than six equal tiles.
Sales detail puts current status and recency before the map; its existing GPS,
distance, battery, and location fields remain accessible. Warning list states
the date it covers, distinguishes an empty result from load failure, and keeps
tap-through to Sales detail. The informational full-route action must not look
like it opens a mobile route when it only tells users to use the web dashboard.

Phone sketch:

```text
┌──────────────────────────────┐
│ Halo, Area Manager           │
│ Cabang Surabaya              │
├──────────────────────────────┤
│ Pantau posisi Sales       →  │
│ Ringkasan hari ini           │
│ 3/5 kunjungan · 2 Sales aktif│
│                              │
│ Ringkasan  Peringatan        │
│ Kunjungan saya  Profil       │
└──────────────────────────────┘
```

The sketch shows hierarchy only. It does not authorize new dashboard metrics;
if the existing dashboard has no such response, omit the sample counts instead
of inventing a new request or displaying fabricated values.

## Journey 2: Admin setup for the pilot

Super Admin and Admin Cabang keep the current role restrictions and server-side
validation. Show User and Cabang as the two main setup actions, then monitoring
and profile. User list keeps its current search, filter, pagination, activation,
and edit routes, but presents the active filter and result count together and
uses legible, tappable rows. The form groups identity, access, assignment, and
save/destructive actions; field-specific API errors remain beside fields.
Branch list and form keep DB SAP, UD Portal credentials, coordinates, and
permission behavior; secrets stay masked with the approved eye control.
Keyboard movement must keep the focused field and save action reachable.
No role, branch, customer, or credential is broadened by presentation state.

## Journey 3: Shared account screens

Login and Profile use the same spacing, type, calm colors, password visibility,
and keyboard behavior. Keep cooldown, login errors, photo editing, password
change, session/logout, and offline-sync warnings intact. Profile actions must
be clear without displaying sensitive values. Do not change authentication
storage, tokens, or API payloads.

## Navigation and data invariants

- Preserve all current route names and authorization checks. Area Manager must
  be able to return from visit and monitoring screens to `AdminDashboard`.
- Area Manager only sees its assigned team/cabang data. The UI must not expose
  global branch choices where the role is scoped. Backend authorization stays
  authoritative; hiding a choice in UI is not an access control mechanism.
- Preserve online/offline visit and encrypted photo behavior from the Sales
  phase. Do not alter SAP identifiers, form payloads, geolocation consent, or
  monitoring API query parameters as part of visual work.
- Every screen covers loading, empty, error, long names, and denied location
  where relevant. A refresh or retry remains available for recoverable errors.

## Verification and release

For each journey, compare existing handlers and API calls before/after, run
focused presentation tests and the existing offline regression suite, export
an Android bundle, and check spacing at 320/360 dp. Use an Area Manager test
account and admin test account on the connected Infinix for navigation and role
scope checks; the user enters credentials on the phone. Do not create or alter
real customer visits during visual smoke tests. Publish Android staging OTA
only after local gates pass and immediately inspect the installed SDK 54 APK
after two cold starts. Correct any device-only issue on staging before calling
the journey accepted. Production OTA and SDK 58 are outside this work.

## Builder decisions

Use the existing `visitTheme` presentation tokens for the released pilot rather
than renaming the shared theme during UAT. A future cleanup can rename it once
the visible screens use it. Keep the monitoring map full screen and treat
overlays as controls, while summary and forms use normal scrolling pages.
