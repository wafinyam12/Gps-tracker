# Admin visit setup mobile UI refactor implementation plan

**Goal:** Bring the released User and Cabang setup screens into the approved visit UI while preserving account and branch permissions, validation, SAP settings, and current routes.

**Spec:** `docs/superpowers/specs/2026-11-17-released-visit-support-mobile-ui-refactor-design.md`

**Tech:** Expo SDK 54, React Native 0.81, React Navigation 7, existing `visitTheme`, `AppScreen`, `VisitHeader`, Node test runner, Android staging OTA runtime 1.1.5.

## Constraints

- Scope: `UserList`, `UserForm`, `TeamList`, `TeamForm` only. Do not change backend, KYC, offline queue, SAP identifiers, native dependencies, or route names.
- Preserve API requests, filter/search/pagination semantics, activation, create/edit/delete guards, field validation, show-password controls, DB SAP and UD Portal fields, coordinates, and role permissions.
- Use 16 dp page edges, 8–12 dp related spacing, 20–24 dp section spacing, 48 dp primary/44 dp secondary targets, dark status-bar text, safe-area and keyboard adjustment.
- Test with dummy data only; do not create or delete real users or branches for visual checks.

## Task 1 — User list

**Files:** `gps-tracker-mobile/src/screens/admin/UserListScreen.js`; optional small presentation helper and test if filter summary logic is extracted.

- Read current request lifecycle, pagination, filter, edit, activation, and focus refresh handlers; record them before editing.
- Add a compact header and one clear “Tambah user” action. Put search and active filter/result count together; keep advanced filters collapsible. Make user rows wrap and show role, branch, active status, and last seen without truncating critical meaning.
- Keep the existing `getUsers`, `getTeams`, toggle-active, and navigation inputs identical. Verify the filter, result count, empty, error, and loading states.
- Run focused tests if logic changes, offline suite, Android export, `git diff --check`; commit Task 1 files.

## Task 2 — User form

**Files:** `gps-tracker-mobile/src/screens/admin/UserFormScreen.js` and existing password/keyboard components only if required.

- Compare create/edit payload and role/branch restrictions before editing. Keep field-specific server errors beside fields and password visibility on the current input.
- Reorder only presentation into identity, login and contact, role and branch, then save/delete. Align labels, helper text, picker height, and error text with the visit theme. Keep Save reachable while the keyboard is open and avoid duplicate top/bottom safe padding.
- Verify create and edit screens with dummy values and keyboard on the Infinix, without submitting. Run offline suite, Android export, and diff check; commit Task 2 files.

## Task 3 — Cabang list and form

**Files:** `gps-tracker-mobile/src/screens/admin/TeamListScreen.js`, `gps-tracker-mobile/src/screens/admin/TeamFormScreen.js`.

- Keep list fetch/search, superadmin create/delete, admin read/edit restrictions, coordinates, DB SAP, UD Portal username/password and location permission behavior.
- Make list rows readable and expose status with text. Group form fields into branch identity, SAP/Portal connection, location, then status/actions. Keep the password masked by default with the existing eye control. Ensure keyboard follows focused fields.
- Run relevant tests, offline suite, Android export, and diff check; commit Task 3 files.

## Task 4 — Device and staging OTA

- Run `node --test tests/*.test.mjs`, offline suite, Expo SDK dependency check (offline check acceptable if network is unavailable), Android export, and diff check.
- On Infinix, inspect superadmin User/Cabang list and forms, password eye, keyboard, Back, and role-visible actions without saving/deleting real data. Check an admin-cabang account if available.
- Publish Android staging OTA for runtime 1.1.5 only after gates; cold-start twice and inspect crash/JS logs. Record update URL and device outcome in `gps-tracker-mobile/BUILD_STAGING.md`.

## Review focus

1. Presentation cannot expose global branch/user actions to Area Manager or Sales.
2. Admin cabang stays inside its assigned branch and cannot edit its own protected role/status.
3. No field loses a validation error or becomes hidden behind the keyboard.
4. Portal password remains masked except while the user explicitly holds the visibility state.
