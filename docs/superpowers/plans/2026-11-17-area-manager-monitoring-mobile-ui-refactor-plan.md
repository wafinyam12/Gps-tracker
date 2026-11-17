# Area Manager Monitoring Mobile UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the released Area Manager and visit-monitoring mobile journey match the approved Sales visual system while preserving role scope and API behavior.

**Architecture:** Keep existing screens as data owners and reuse `visitTheme`, `VisitHeader`, and small presentation helpers. Refactor dashboard, map overlays, summary, Sales detail, and warning list in journey order; change no native package, API contract, or offline data code.

**Tech Stack:** React Native 0.81.5, Expo SDK 54, React Navigation 7, OpenStreetMap WebView, Node test runner, EAS Update staging runtime 1.1.5.

**Spec:** `docs/superpowers/specs/2026-11-17-released-visit-support-mobile-ui-refactor-design.md`

## Global Constraints

- Target only released visit support: `AdminDashboard`, `LiveMap`, `TeamSummary`, `SalesDetail`, `Alerts`; admin forms and shared account screens get separate plans.
- Reuse canvas `#F5F7F8`, surface `#FFFFFF`, ink `#203237`, muted ink `#66777A`, primary `#386A6A`, tint `#E7F0EF`, and existing status colors.
- Use 16 dp page edges, 20–24 dp major section spacing, 48 dp primary/44 dp secondary tap targets, wrapping text on 320–360 dp widths, safe-area/keyboard support.
- Preserve route names, role checks, API query parameters, 60-second map refresh, viewport debounce, marker actions, and server-provided team scope.
- Keep SDK 54, runtime 1.1.5, package name, and native dependencies. Android staging OTA only; no production OTA.
- Do not create or alter customer visits while visually checking monitoring screens. User enters test credentials on the connected Infinix.

## Review Focus

1. Area Manager with a server-scoped team must never get a global branch choice in dashboard, summary, or map. Test the pure role/scope presentation helpers and check the device screen.
2. A long Area Manager name and branch at 320 dp with larger system text must keep monitoring and Back controls tappable. Check a narrow mock render and device screenshot.
3. Map customer toggle and a rapid viewport change must keep last-request-wins behavior; compare request and sequence code before/after and test on device.
4. A failed monitoring/summary/warning request must show retry rather than a false empty success state. Test presentation helpers and inspect on device with a controlled failed response if feasible.
5. Nested navigation `AdminDashboard → LiveMap/TeamSummary → SalesDetail/Alerts → Back` must return to the expected screen without duplicate headers. Check route config and device taps.

---

### Task 1: Role-aware released dashboard

**Files:**
- Create: `gps-tracker-mobile/src/utils/monitoringDashboardPresentation.js`
- Create: `gps-tracker-mobile/tests/monitoringDashboardPresentation.test.mjs`
- Modify: `gps-tracker-mobile/src/screens/admin/AdminDashboardScreen.js`
- Reuse: `gps-tracker-mobile/src/components/visit/VisitHeader.js`, `gps-tracker-mobile/src/styles/visitTheme.js`

**Interfaces:**
- `getMonitoringDashboardActions(roleName)` returns ordered route keys from the already authorized set: `Home` only when `canVisitStores`, `UserList`/`TeamList` only for admin/superadmin, and `LiveMap`, `TeamSummary`, `Profile` for monitoring roles. No API request.
- `AdminDashboard` maps those route keys to existing labels/icons and keeps `logout`, `navigation.navigate`, and role checks intact.

- [ ] Write failing tests for Sales-excluded dashboard routes, Area Manager actions without User/Team management, and Admin/Super Admin setup actions.
- [ ] Run `node --test tests/monitoringDashboardPresentation.test.mjs`; expected FAIL because the helper does not exist.
- [ ] Implement the pure action helper and refactor dashboard into a compact branch-aware header, one primary `LiveMap` action, and readable secondary links. Show no fabricated counts; preserve each role's existing navigation options.
- [ ] Run the focused test; expected all PASS. Check 320/360 dp, long names, 44/48 dp targets, dark status-bar text, and no double top inset.
- [ ] Run `npm.cmd run test:offline`, Android export to `D:\gps tracker\tmp\monitor-ui-task1-export`, and `git diff --check`; expected zero failures, successful export, clean diff. Commit only Task 1 files.

### Task 2: Monitoring map controls

**Files:**
- Modify: `gps-tracker-mobile/src/screens/spv/LiveMapScreen.js`
- Create: `gps-tracker-mobile/src/utils/monitoringMapPresentation.js`
- Create: `gps-tracker-mobile/tests/monitoringMapPresentation.test.mjs`
- Reuse: `visitTheme` and safe-area context already installed with SDK 54.

**Interfaces:**
- `getMonitoringMapScope({ scopeTeamId, selectedTeamId, selectedBranchName, canAccessAllBranches })` returns visible scope label and whether `Semua cabang` can be shown; a scoped role cannot return to global.
- Existing `fetchLocations`, `fetchCustomerLayer`, `scheduleCustomerLayer`, `handleViewportChange`, and marker handlers keep their current signatures and request parameters.

- [ ] Write failing tests for scoped Area Manager, global admin, and selected branch states.
- [ ] Run the focused test; expected FAIL from missing helper.
- [ ] Implement helper and lay out a safe-area-aware map: explicit Back, compact legend/refresh/customer switch, nonoverlapping scope/status surface, and accessible Sales chips. Keep the map full screen and preserve loading/empty/error distinctions.
- [ ] Run focused tests; expected PASS. Compare all monitoring API calls, timer cleanup, viewport debounce, and sequence guards against the base commit to confirm behavior is unchanged.
- [ ] Run offline suite, Android export, and `git diff --check`; expected success. Inspect 320/360 dp layouts and commit only Task 2 files.

### Task 3: Team summary hierarchy

**Files:**
- Modify: `gps-tracker-mobile/src/screens/spv/TeamSummaryScreen.js`
- Create: `gps-tracker-mobile/src/utils/monitoringSummaryPresentation.js`
- Create: `gps-tracker-mobile/tests/monitoringSummaryPresentation.test.mjs`

**Interfaces:**
- `getMonitoringSummaryMetrics(summaryData)` normalizes all existing target, unique, duplicate, completion, mock-GPS, invalid-checkin, and warning counts without dropping fields; `0` is a valid displayed value.
- Existing date filter, `team_id` query, and fixed Area Manager branch versus admin/manager picker remain unchanged.

- [ ] Write failing tests for missing data, zero counts, and nonzero anomaly counts; ensure Area Manager scope has no branch-picker action.
- [ ] Run focused tests; expected FAIL from missing helper.
- [ ] Implement helper and reorganize summary as date/branch, target progress, warnings, then Sales rows with secondary audit details. Use text status, loading/empty/error with retry, and consistent padding.
- [ ] Run focused tests; expected PASS. Compare `reportService.targetSummary` parameters and branch role conditions before/after.
- [ ] Run offline suite, Android export, and `git diff --check`; expected success. Inspect long Sales names and large text, then commit Task 3 files.

### Task 4: Sales detail and warning list

**Files:**
- Modify: `gps-tracker-mobile/src/screens/spv/SalesDetailScreen.js`
- Modify: `gps-tracker-mobile/src/screens/spv/AlertListScreen.js`
- Create: `gps-tracker-mobile/src/utils/monitoringDetailPresentation.js`
- Create: `gps-tracker-mobile/tests/monitoringDetailPresentation.test.mjs`

**Interfaces:**
- `getSalesLocationPresentation(userData, history)` returns explicit online/offline, last-seen, missing-GPS, distance, speed, and battery text from current data; location coordinates are never fabricated.
- `getWarningListPresentation({ loading, error, warnings, date })` distinguishes loading, error/retry, empty, and results. Warning detail continues to navigate to `SalesDetail` with `userId`.

- [ ] Write failing tests for absent GPS, zero battery/speed, empty warnings, and request error. Confirm a failed fetch is not presented as “no warnings.”
- [ ] Run focused tests; expected FAIL from missing helpers.
- [ ] Implement helpers; put Sales status and last update before the map, retain all current detail fields and trail, and replace the nonfunctional full-route CTA with honest explanatory copy. Make warnings readable with a clear date and retry.
- [ ] Run focused tests; expected PASS. Compare `getSalesLocation`, `getLocationHistory`, and `targetSummary` call inputs and navigation parameters before/after.
- [ ] Run offline suite, Android export, and `git diff --check`; expected success. Inspect 320/360 dp, no-GPS and warning-empty states; commit Task 4 files.

### Task 5: Area Manager device gate and staging OTA

**Files:**
- Verify: all Task 1–4 files plus `gps-tracker-mobile/app.json` and `eas.json`
- Update: `gps-tracker-mobile/BUILD_STAGING.md` with release note and device outcome

**Interfaces:** No new API/native interface. Android staging channel and runtime remain 1.1.5.

- [ ] Run all `node --test tests/*.test.mjs`, `npm.cmd run test:offline`, `npx.cmd expo install --check`, Android export, and `git diff --check`; expected all pass.
- [ ] Ask the user to log in as an Area Manager test account on the connected Infinix, without sending credentials. Check dashboard, map, customer toggle, branch scope, summary date/branch, Sales detail, warnings, and nested Back paths. Use only read-only monitoring actions.
- [ ] Check the admin/superadmin dashboard retains User/Branch management links, and that Area Manager has neither. Verify the server-provided scope with the visible branch and no global selector.
- [ ] Publish Android OTA to `staging` with EAS Environment `preview` only after local gates pass; cold-start twice on the device, inspect the new UI and logcat, and publish a corrective staging OTA if device-only defects appear.
- [ ] Record update group URL, tests, scope/navigation outcome, and any remaining limitations in `BUILD_STAGING.md`; commit documentation. Production rollout is outside this plan.
