# Sales Visit Mobile UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a calm, readable Sales visit journey with consistent padding and controls while preserving all visit, GPS, SAP, and encrypted offline behavior.

**Architecture:** Add a visit-scoped visual token layer and small presentation components, then migrate existing screens in journey order. Keep API/state orchestration in the current screens and perform one Android staging OTA only after the complete Sales journey passes a device smoke test.

**Tech Stack:** React Native 0.81, Expo SDK 54, React Navigation 7, existing lucide icons, EAS Update runtime 1.1.5.

**Spec:** `docs/history/designs/2026-11-17-sales-visit-mobile-ui-refactor-design.md`

## Global Constraints

- Keep the existing SDK 54 runtime, Android package, and native dependencies; all UI changes must remain OTA compatible.
- Preserve visit API payloads, SAP customer lookup, validation, GPS disclosure, offline queue, SQLCipher photos, and sync behavior.
- Page edges 16 dp; major section spacing 20–24 dp; card interior 14–16 dp; primary touch target at least 48 dp; secondary icon target at least 44 dp.
- Use the spec palette: canvas `#F5F7F8`, surface `#FFFFFF`, ink `#203237`, muted ink `#66777A`, primary `#386A6A`, primary tint `#E7F0EF`, border `#DCE5E5`, success `#336E52`/`#E6F2EB`, caution `#875E26`/`#F7F0E3`, and error `#A33F45`/`#FBEDEF`.
- Use the spec type scale: page title 24/30 semibold, section title 16/22 semibold, body 14/20 regular, field label 13/18 semibold, caption/status 12/17 medium.
- Use the existing system font, Indonesian sentence case, text labels with every status, and responsive safe-area/keyboard spacing.
- Keep partial visual work local during Sales UAT; publish one staging OTA after the complete Sales journey is verified. Do not publish production OTA or upgrade SDK.
- Preserve existing uncommitted work. Stage only owned hunks if committing; do not include unrelated backend files.

## Review Focus

1. A long store name/address on a 320–360 dp phone must wrap without hiding the start action; verify in Task 3.
2. A focused visit form field with the keyboard open must remain visible and checkout must remain reachable without accidental submission; verify in Task 4.
3. A denied GPS permission or missing store coordinates must still leave search/list usable and explain the state; verify in Task 3.
4. An offline visit with a queued photo must survive restart and reconnect without data loss; verify in Task 7.
5. Returning from visit screens must preserve both Sales Home and Area Manager dashboard paths; verify in Tasks 2, 3, and 4.

---

### Task 1: Visit visual foundation

**Files:**
- Create: `gps-tracker-mobile/src/styles/visitTheme.js`
- Create: `gps-tracker-mobile/src/components/visit/VisitHeader.js`
- Create: `gps-tracker-mobile/src/components/visit/VisitStatusBadge.js`
- Read/compare: `gps-tracker-mobile/src/styles/theme.js`, `gps-tracker-mobile/src/components/ui/AppScreen.js`, `gps-tracker-mobile/src/components/ui/PageHeader.js`

**Interfaces:**
- `visitColors`, `visitSpacing`, `visitRadii`, `visitType` exported from `visitTheme.js`; exact color and spacing values come from Global Constraints.
- `VisitHeader({ title, subtitle, onBack, right, status })` renders a compact white header; its parent screen owns the safe-area inset, so the component must not add a second top inset. `onBack` is optional for Sales root.
- `VisitStatusBadge({ label, tone })` supports `success`, `warning`, `danger`, and `neutral` with visible text labels.

- [ ] Read the SDK 54 source documentation for the SafeAreaView/keyboard APIs used, plus the existing component implementations.
- [ ] Create tokens and the two presentation components without changing shared admin styles or native packages.
- [ ] Check 320 dp and 360 dp mock renders for 16 dp edges, readable type, and 44–48 dp touch targets; adjust the components if either clips.
- [ ] Run `npx.cmd expo export --platform android --output-dir "D:\gps tracker\tmp\sales-ui-task1-export"` and `git diff --check`; both must exit 0.
- [ ] Review only owned files and commit the foundation if the index contains no unrelated changes.

### Task 2: Sales visit dashboard

**Files:**
- Modify: `gps-tracker-mobile/src/screens/HomeScreen.js` (render tree and styles; preserve data hooks/actions)
- Modify: `gps-tracker-mobile/App.js` (AdminStack `Home` header configuration)
- Create: `gps-tracker-mobile/src/components/visit/VisitHistoryRow.js`

**Interfaces:**
- `VisitHistoryRow({ visit, onOpen, onRoute, onPhotoPress })` receives normalized visit data already present in Home/MySummary; it does not call APIs.
- `HomeScreen` continues to use `reportService.targetToday`, existing open visit and photo preview handlers, and role flags.

- [ ] Capture/read baseline Home on Infinix and note both Area Manager and Sales header states.
- [ ] Replace the large hero and equal-weight action grid with a compact greeting, one primary visit CTA, one progress panel, short active-visit row, secondary links, and compact history rows.
- [ ] Hide the duplicate native header only for AdminStack `Home`; show an explicit custom back affordance for monitoring roles using `navigation.popTo('AdminDashboard')` while Sales root has no back control. Use the existing `AppScreen` content style to avoid a second Android top gap.
- [ ] Verify loading, empty, warnings, active visit, completed/duplicate statuses, route button, and photo preview on the screen; long names wrap in the row without swallowing its action.
- [ ] Verify Android back and custom back follow `AdminDashboard > Home` for Area Manager and remain at `Home` for Sales.
- [ ] Run the Android export, offline regression suite (`npm.cmd run test:offline`), and `git diff --check`; inspect before/after screenshots at 360 dp.
- [ ] Review only owned hunks and commit if the index contains no unrelated changes.

### Task 3: Store search and optional map

**Files:**
- Modify: `gps-tracker-mobile/src/screens/StartVisitScreen.js` (presentation and `viewMode` only)
- Create: `gps-tracker-mobile/src/components/visit/VisitStoreRow.js`
- Reuse: `gps-tracker-mobile/src/components/visit/VisitHeader.js`

**Interfaces:**
- `VisitStoreRow({ store, selected, starting, distanceMeters, onSelect, onStart, onRoute })` displays the data already normalized by `StartVisitScreen`.
- `viewMode` is `'list' | 'map'`; list is the default. `map` reveals `OpenStreetMapView` above the same selectable list; it never changes the selected store or starts a visit.

- [ ] Keep search, pagination, selected-store state, location disclosure, integrity checks, offline cache, and existing start handler intact.
- [ ] Move search/GPS state above the list; make map optional behind the switch. Show route only for stores with coordinates and keep address/SAP code readable.
- [ ] Check long names and addresses at 320/360 dp, GPS denied, no coordinates, loading, empty results, and keyboard open; verify list and start action remain usable.
- [ ] Verify `StartVisit` back returns to `Home`, with Area Manager dashboard still below it.
- [ ] Run Android export, offline regression suite, and `git diff --check`; review device screenshots before committing owned hunks.

### Task 4: Visit form hierarchy and keyboard

**Files:**
- Modify: `gps-tracker-mobile/src/screens/VisitFormScreen.js` (presentation only; preserve save/cancel/checkout functions)
- Create: `gps-tracker-mobile/src/components/visit/VisitStoreSummary.js`
- Create: `gps-tracker-mobile/src/components/visit/VisitLocationAudit.js`
- Reuse: `VisitHeader`, `VisitStatusBadge`, and visit tokens

**Interfaces:**
- `VisitStoreSummary({ storeName, storeAddress, branch, timeline, status, onRoute })` is read-only.
- `VisitLocationAudit({ visit, locationStatus, locationStatusLabel, checkinDistance, checkinRadius, store })` shows a short verdict and an expandable detail list; it does not calculate validity.
- Existing `form`, `save`, `cancel`, checkout, online/offline, and photo actions stay in `VisitFormScreen`.

- [ ] Mark current render sections and preserve every enabled field and handler. Keep hidden payment/receivables sections hidden.
- [ ] Extract store summary and location audit UI; group results, notes, photos, and checkout with consistent labels, inputs, and spacing.
- [ ] Make the checkout action reachable above the keyboard and safe area; test first/middle/last fields with a long store name and larger system text. Confirm no tap submits during scroll.
- [ ] Verify detail mode, active mode, offline mode, cancellation, and back navigation; compare payload construction before/after to ensure no API fields changed.
- [ ] Run Android export, offline regression suite, `git diff --check`, and an on-device form visual pass; commit only reviewed hunks.

### Task 5: Camera and photo review

**Files:**
- Modify: `gps-tracker-mobile/src/screens/CameraScreen.js` (camera chrome and preview presentation)
- Modify: `gps-tracker-mobile/src/screens/VisitPhotoGalleryScreen.js` (header, grid spacing, loading/empty/error states)
- Read/compare: `gps-tracker-mobile/src/components/PhotoPreviewModal.js`

**Interfaces:**
- Keep `takePicture`, photo limit 5, remove, upload/queue, encrypted storage, temporary cleanup, and gallery delete API unchanged.

- [ ] Place close, count, shutter, preview, remove, and save controls with at least 44–48 dp targets and legible contrast on the dark camera surface.
- [ ] Match the gallery and photo preview spacing/status labels to the visit design system without moving photo data between stores.
- [ ] Check zero, one, and five photos; processing disabled state; permission denied; offline queue path; and navigation back to the form.
- [ ] Run Android export, offline regression suite, and `git diff --check`; review device screenshots and commit owned hunks.

### Task 6: History and location

**Files:**
- Modify: `gps-tracker-mobile/src/screens/MySummaryScreen.js`
- Modify: `gps-tracker-mobile/src/screens/MyLocationScreen.js`
- Reuse: `VisitHistoryRow`, `VisitHeader`, `VisitStatusBadge`

**Interfaces:**
- Keep summary report API, visit-detail navigation, GPS tracking consent and location actions unchanged.

- [ ] Reuse compact history rows, status labels, and padding in summary; keep photo preview and open-visit actions.
- [ ] Clarify accuracy, last update, and tracking state in location; preserve existing consent text and tracking semantics.
- [ ] Check empty/loading/error, long names, photo count, no GPS, denied permission, and back navigation at 320/360 dp.
- [ ] Run Android export, offline regression suite, and `git diff --check`; review screenshots and commit owned hunks.

### Task 7: End-to-end Sales gate and OTA staging

**Files:**
- Verify: all files from Tasks 1–6 and `gps-tracker-mobile/app.json` / `eas.json` (runtime/channel unchanged)
- Update: user-facing release notes in existing mobile documentation if the release changes visible wording

**Interfaces:**
- A Sales test account and dummy store are available, as confirmed by the user. The user logs in on the HP. No credentials are stored in the repository or sent through chat.

- [ ] Run `npm.cmd run test:offline`, Android export, `npx.cmd expo install --check`, and `git diff --check`; inspect every exit code and stop for failures.
- [ ] On Infinix, verify Sales login, dashboard, search and select dummy store, location disclosure, online check-in, form keyboard, photo save, checkout, history, and back navigation.
- [ ] Repeat the affected path offline: check-in, photo capture, app restart, reconnect, queue sync, and confirmation that encrypted data/photo survives until sent. Use only test data.
- [ ] Confirm Area Manager can still return from the shared Home screen to `AdminDashboard`; do not alter monitoring permissions.
- [ ] Publish one Android OTA to `staging` for runtime 1.1.5 only after the above gates pass. Confirm EAS channel points to its update group and inspect the device after two cold starts.
- [ ] Record the OTA group URL, tests, device outcome, and any remaining limitations in the handoff. Production publication is out of scope.
