# Visit Duration and Radius Verification Implementation Plan

> Rencana ini digantikan oleh `2026-11-17-adaptive-visit-presence-and-battery-plan.md` setelah pengguna meminta sampel GPS berkala, uji baterai, dan perbaikan marker.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure a visit from check-in to checkout, require a trustworthy in-radius check-in, and show Area Managers when and where checkout happened outside the customer radius.

**Architecture:** Laravel remains the authority for GPS classification and stores a per-visit customer center/radius snapshot. The existing encrypted Expo offline queue keeps captured GPS and a cached-store reference for reconciliation; backend responses add audit fields without removing old fields. Sales and Area Manager screens consume read-only audit data, while CRM web enriches its existing checkout map link.

**Tech Stack:** Laravel 11/PHP 8.2+, MySQL spatial `Point`, PHPUnit; Expo SDK 54/React Native, Node test runner, existing encrypted offline storage.

**Spec:** `docs/history/designs/2026-11-17-visit-duration-radius-verification-design.md`

## Global Constraints

- Work in the current folder as previously chosen; preserve the existing unrelated dirty CRM web changes. Stage only feature files deliberately.
- Radius is the store's effective radius capped at **50 m**. A known customer needs GPS accuracy no worse than that radius before an online check-in is classified.
- Unknown customer location can use a provisional first check-in only with accuracy **at most 25 m**, no mock GPS and no duplicate; persist the master point only after a completed visit via the existing flow. A poorer first point remains unverified and does not seed the master; its existing pilot target-count behavior is retained.
- Checkout outside the radius **must still complete**; `counted_as_target` remains the check-in decision. Two endpoints do not prove continuous presence.
- Keep the existing **3-day** offline timestamp rule, idempotent UUID replay, encrypted queue/photos, anti-mock checks, and SDK 54 native dependencies.
- Add nullable columns and response keys; old visits show `legacy_unverified` and retain historical duration.
- Backend migration and API must reach staging before any mobile OTA. No real UAT visit or target is to be mutated during smoke tests; use a dummy customer.

## Review Focus

- Cached customer point changes before offline sync: preserve the visit, mark `reference_changed`, do not count target, and keep the encrypted queue until the server accepts the visit (Tasks 2 and 5).
- GPS accuracy is between radius and existing 300 m integrity limit: known-store start requests retry, checkout completes as `uncertain` (Tasks 2 and 3).
- Checkout capture time precedes check-in: complete the visit with no verified duration instead of displaying a false zero-minute session (Task 3).
- Missing or zero latitude/longitude: treat zero as a valid number, reject missing or out-of-range values, and never render a broken map link (Tasks 1, 3, and 7).
- Area Manager requests another branch's visit ID directly: return 403 and disclose no checkout coordinates, even if that ID was obtained elsewhere (Task 3).

---

### Task 1: Visit audit storage and geofence decisions

**Files:**
- Create: `gps-tracker/database/migrations/2026_11_17_000000_add_radius_audit_to_visit_logs_table.php`
- Create: `gps-tracker/app/Services/VisitGeofenceService.php`
- Modify: `gps-tracker/app/Models/VisitLog.php`
- Test: `gps-tracker/tests/Unit/VisitGeofenceServiceTest.php`

**Interfaces:**
- `VisitGeofenceService::effectiveRadius(?Store $store): int` returns 1–50 m using the existing fallback of 50 m.
- `VisitGeofenceService::distanceMeters(Point $a, Point $b): float` uses the same great-circle distance as current check-in.
- `VisitGeofenceService::startDecision(Store $store, Point $gps, ?float $accuracy, bool $offlineSync, ?array $capturedReference): array` returns `center: ?Point`, `radius_meters: int`, `distance_meters: ?float`, `source: store|initial_checkin|none`, `status: inside_radius|initial_reference|uncertain|reference_changed|outside_radius`, `reject: bool`, `countable: bool`.
- `VisitGeofenceService::checkoutDecision(VisitLog $visit, Point $gps, ?float $accuracy): array` returns `distance_meters: ?float`, `status: inside_radius|outside_radius|uncertain|legacy_unverified`.
- Columns: nullable `geofence_center` Point, `geofence_radius_meters`, `geofence_reference_source`, `checkin_radius_status`, `checkout_accuracy`, `checkout_distance`, `checkout_radius_status`; old rows remain null.

- [ ] **Step 1: Write failing unit tests** for known-store inside 12 m/outside 132 m, accuracy 55 m against radius 50 m, unknown-store accuracy 25/26 m, cache-reference mismatch, checkout inside/outside/uncertain, and `(0, 0)` coordinates. Assert the exact statuses, `reject`, and `countable` values, including the unchanged pilot target count for an unverified first point.
- [ ] **Step 2: Run** `cd gps-tracker; php artisan test tests/Unit/VisitGeofenceServiceTest.php`. **Expected:** FAIL because the service is absent.
- [ ] **Step 3: Implement** the service, additive migration, and model casts/fillable. For offline mismatch compare the device's captured reference to the current master only as audit context; never trust device coordinates as authoritative master. Store the backend's selected center in `geofence_center` so later master edits cannot alter checkout classification.
- [ ] **Step 4: Run** the same unit test command. **Expected:** PASS.
- [ ] **Step 5: Commit** only these four files as `feat: store visit radius audit decisions`.

### Task 2: Enforce start radius and preserve offline captures

**Files:**
- Modify: `gps-tracker/app/Http/Controllers/Api/CheckInController.php`
- Test: `gps-tracker/tests/Feature/VisitRadiusVerificationTest.php`

**Interfaces:**
- Existing `POST /api/v1/visit/start` and `/visit/checkin` accept optional `captured_store_latitude`, `captured_store_longitude`, `captured_store_radius`, `captured_store_has_location` only as offline audit context.
- Online known-store outside/insufficient accuracy returns 422 before inserting a visit; response exposes safe `distance_meters` and `geofence_radius` for the UI. Unknown-store poor accuracy creates an unverified visit without seeding the customer master.
- Offline changed reference creates a reviewable visit with `checkin_radius_status=reference_changed` and `counted_as_target=false`; a matching reference follows normal radius rules. Preserve existing UUID replay.

- [ ] **Step 1: Write failing feature tests** for known-store inside, outside (zero rows), missing/weak accuracy, provisional first point, old-client offline payload without reference, changed cached reference, same UUID replay, and mock GPS rejection. Assert target count and snapshot values.
- [ ] **Step 2: Run** `cd gps-tracker; php artisan test tests/Feature/VisitRadiusVerificationTest.php --filter=start`. **Expected:** FAIL for new radius/status behavior.
- [ ] **Step 3: Wire** `startDecision` into `createVisit`; validate optional audit fields, reject online known-store invalid location before transaction, save snapshot/status, and keep current duplicate/master-location rules. Do not turn a client-supplied center into a trusted store point.
- [ ] **Step 4: Run** the filtered tests plus `php artisan test tests/Feature/CoreApiTest.php --filter='visit|geofence|location'`. **Expected:** PASS, except any pre-existing assertion deliberately expecting an outside-radius start to succeed must be updated to the approved 422 rule.
- [ ] **Step 5: Commit** only controller and focused test changes as `feat: require in-radius visit start`.

### Task 3: Checkout classification, duration and scoped API

**Files:**
- Modify: `gps-tracker/app/Http/Controllers/Api/CheckInController.php`
- Modify: `gps-tracker/app/Http/Controllers/Api/VisitLogController.php`
- Modify: `gps-tracker/app/Http/Controllers/Api/VisitMonitoringController.php`
- Create: `gps-tracker/app/Support/VisitAuditFormatter.php`
- Test: `gps-tracker/tests/Feature/VisitRadiusVerificationTest.php`

**Interfaces:**
- Existing checkout and `GET /api/v1/visits/{visitLog}` add `checkin_radius_status`, `checkout_radius_status`, `geofence_reference_source`, `geofence_radius_meters`, `checkout_accuracy`, `checkout_distance`, `checkout_latitude`, `checkout_longitude`, and `duration_verification_status` (`verified|uncertain|invalid_time|legacy_unverified`).
- `GET /api/v1/target/detail/{user}?date=YYYY-MM-DD` adds only summary status/duration to its scoped visit rows; precise checkout coordinates stay in authorized `GET /visits/{visitLog}`.
- `VisitAuditFormatter::detailFields(VisitLog $visit): array` returns the additive response keys; `summaryFields(VisitLog $visit): array` returns statuses and duration verification without checkout coordinates.
- Use the visit snapshot for checkout distance. If capture time precedes check-in, keep checkout but set new `duration_minutes=null` and `duration_verification_status=invalid_time`; historical records keep their stored duration and `legacy_unverified`.

- [ ] **Step 1: Write failing feature tests** for checkout inside/outside/weak accuracy, changed master after start, inverted time, UUID replay, first customer point saved only on completion, old visit, and AM own-branch versus cross-branch detail access. Assert checkout outside remains HTTP 200 and target flag unchanged.
- [ ] **Step 2: Run** `cd gps-tracker; php artisan test tests/Feature/VisitRadiusVerificationTest.php --filter='checkout|detail|legacy'`. **Expected:** FAIL on new fields/classification.
- [ ] **Step 3: Wire** `checkoutDecision`, snapshot-based fields, and `VisitAuditFormatter` into both response formats. Add summary keys to `VisitMonitoringController` without coordinates. Ensure read-only detail authorization precedes serialization.
- [ ] **Step 4: Run** focused tests and `php artisan test tests/Feature/CoreApiTest.php --filter='checkout|visit'`. **Expected:** PASS.
- [ ] **Step 5: Commit** only these files as `feat: audit visit checkout radius and duration`.

### Task 4: CRM web audit next to the existing map link

**Files:**
- Modify: `gps-tracker/app/Services/Crm/CrmAnalyticsService.php`
- Modify: `gps-tracker/resources/views/crm/dashboard.blade.php`
- Test: `gps-tracker/tests/Feature/CrmWebTest.php`

**Interfaces:**
- `visitDetails()` adds the status, checkout accuracy/distance, and snapshotted radius/source to each authorized CRM visit; the template displays them adjacent to its existing checkout coordinate/map link.

- [ ] **Step 1: Write failing CRM feature assertions** for outside-radius label, distance, accuracy, provisional source, legacy-unverified label, and preservation of the existing checkout map URL. Include AM own-team filtering; cross-team visits stay absent.
- [ ] **Step 2: Run** `cd gps-tracker; php artisan test tests/Feature/CrmWebTest.php --filter='visit|area_manager'`. **Expected:** FAIL on the new audit text.
- [ ] **Step 3: Add** mapping/template text. Inspect `git diff` for the already-dirty CRM web files first; preserve all unrelated changes and avoid bulk reformatting.
- [ ] **Step 4: Run** the filtered CRM tests. **Expected:** PASS.
- [ ] **Step 5: Commit** only intended hunks, using `git add -p` where necessary, as `feat: show checkout radius audit in CRM`.

### Task 5: Sales check-in preflight and encrypted offline context

**Files:**
- Create: `gps-tracker-mobile/src/utils/visitRadiusDecision.js`
- Modify: `gps-tracker-mobile/src/screens/StartVisitScreen.js`
- Modify: `gps-tracker-mobile/src/components/visit/VisitStoreRow.js`
- Test: `gps-tracker-mobile/tests/visitRadiusDecision.test.mjs`

**Interfaces:**
- `evaluateStartRadius(store, gps): { status, distanceMeters, radiusMeters, canStart, message }` mirrors the backend's 50 m/25 m quality gates for immediate UX, without overriding backend authority.
- `capturedStoreReference(store): object` returns the four optional audit fields from the cached store with numeric zero coordinates preserved.
- Start payload/queued encrypted payload includes `captured_store_latitude`, `captured_store_longitude`, `captured_store_radius`, `captured_store_has_location`; current queue serialization and encryption remain unchanged.

- [ ] **Step 1: Read** SDK 54 versioned Expo documentation for the location APIs used here, per `gps-tracker-mobile/AGENTS.md`.
- [ ] **Step 2: Write failing Node tests** for known inside/outside/weak accuracy, unknown provisional 25/26 m, zero coordinate, and captured-reference serialization. Assert the 50 m cap, `canStart` result, and exact snapshot fields.
- [ ] **Step 3: Run** `cd gps-tracker-mobile; node --test tests/visitRadiusDecision.test.mjs`. **Expected:** FAIL because the module is absent.
- [ ] **Step 4: Implement** the pure decision and call it after fresh GPS capture, before online request or offline enqueue. Show distance/radius and refresh-location guidance; pass captured store context with the same encrypted queue path.
- [ ] **Step 5: Run** the new test plus `node --test tests/visitStorePresentation.test.mjs tests/offlineDataMigration.test.mjs`. **Expected:** PASS.
- [ ] **Step 6: Commit** only these files as `feat: guard mobile visit start by customer radius`.

### Task 6: Sales checkout audit without blocking completion

**Files:**
- Create: `gps-tracker-mobile/src/utils/visitDurationPresentation.js`
- Modify: `gps-tracker-mobile/src/components/visit/VisitLocationAudit.js`
- Modify: `gps-tracker-mobile/src/screens/VisitFormScreen.js`
- Test: `gps-tracker-mobile/tests/visitDurationPresentation.test.mjs`

**Interfaces:**
- `getVisitDurationPresentation(visit): { durationLabel, checkinLabel, checkoutLabel, sourceLabel, tone }` handles inside/outside/uncertain/provisional/legacy and never claims continuous presence.
- Checkout success alert includes duration and radius status. Offline success says audit is pending sync; checkout outside remains submitable.

- [ ] **Step 1: Write failing Node tests** for 17-minute inside visit, 132 m outside checkout, weak checkout accuracy, provisional center, invalid-time and legacy visits, and absent checkout coordinates.
- [ ] **Step 2: Run** `cd gps-tracker-mobile; node --test tests/visitDurationPresentation.test.mjs`. **Expected:** FAIL because the module is absent.
- [ ] **Step 3: Implement** the pure presentation and wire it to the existing audit card/detail and checkout success message. Keep form, photos, and offline checkout payload behavior intact.
- [ ] **Step 4: Run** the new test plus `node --test tests/visitLocationAudit.test.mjs tests/visitDashboardPresentation.test.mjs`. **Expected:** PASS.
- [ ] **Step 5: Commit** only these files as `feat: show visit duration and checkout status to Sales`.

### Task 7: Area Manager read-only visit drilldown and map

**Files:**
- Create: `gps-tracker-mobile/src/screens/spv/TeamVisitListScreen.js`
- Create: `gps-tracker-mobile/src/screens/spv/VisitAuditDetailScreen.js`
- Create: `gps-tracker-mobile/src/utils/visitAuditMap.js`
- Modify: `gps-tracker-mobile/src/screens/spv/TeamSummaryScreen.js`
- Modify: `gps-tracker-mobile/App.js`
- Modify: `gps-tracker-mobile/src/api/services/visitService.js`
- Test: `gps-tracker-mobile/tests/visitAuditMap.test.mjs`

**Interfaces:**
- TeamSummary sales row opens `TeamVisitList` with `userId` and selected `date`; list uses existing `reportService.targetDetail(userId, { date })` and opens `VisitAuditDetail` with a visit ID. Detail calls authorized `visitService.getVisit(id)` and is strictly read-only.
- `buildCheckoutMapUrl({ latitude, longitude }): string|null` opens the checkout point, not directions to the customer; no link if coordinates are absent/invalid.

- [ ] **Step 1: Write failing map/presentation tests** for valid checkout point, zero coordinate, missing/invalid coordinate, outside status, and a visit row without checkout. Backend Task 3 tests supply the cross-branch 403 gate.
- [ ] **Step 2: Run** `cd gps-tracker-mobile; node --test tests/visitAuditMap.test.mjs`. **Expected:** FAIL because the helper is absent.
- [ ] **Step 3: Implement** read-only list/detail with loading, empty, 403, and retry states; use the same calm visit theme/padding. Register both routes in the AM/admin navigation stacks and retain the existing GPS detail route from other entry points.
- [ ] **Step 4: Run** the new test and `node --test tests/monitoringSummaryPresentation.test.mjs tests/visitDurationPresentation.test.mjs`. **Expected:** PASS.
- [ ] **Step 5: Commit** only these files as `feat: let Area Manager review visit checkout location`.

### Task 8: Integration, staging handoff, and device smoke test

**Files:**
- Modify: `docs/history/designs/2026-11-17-visit-duration-radius-verification-design.md` only if an implementation decision needs recording
- Create: `docs/visit-radius-staging-rollout.md`

**Interfaces:**
- Staging handoff lists the migration/controller/service/model/API/CRM files and exact order: deploy backend, `php artisan migrate --force`, clear relevant caches, verify routes and one read-only visit, then publish one SDK 54 OTA.

- [ ] **Step 1: Run** focused backend suite and the existing visit regression tests on an isolated local test database. **Expected:** no feature regressions; record any unrelated baseline failures separately.
- [ ] **Step 2: Run** all mobile Node tests and `npx expo export --platform android`. **Expected:** all tests pass and Android JS export succeeds with SDK 54.
- [ ] **Step 3: Write** the staging rollout document, API response example, rollback order, and test matrix for known/unknown store, inside/outside, GPS accuracy, offline replay, and legacy visits.
- [ ] **Step 4: Review** the final diff for secret/customer data, unintended CRM hunks, and native dependency changes. **Expected:** none.
- [ ] **Step 5: After backend staging is verified**, publish staging OTA and use ADB on the Infinix with a dummy Sales/customer to check inside start, outside checkout, AM map, and offline sync. If a dummy customer is unavailable, do read-only device checks and report the missing live scenario; never write a real UAT visit.
- [ ] **Step 6: Commit** rollout documentation as `docs: record visit radius staging rollout` and report backend files/migration plus OTA update ID to the user.
