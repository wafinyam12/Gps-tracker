# Area Manager Target Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an Area Manager set a visit target for selected or all active Sales in their own branch over one date or an inclusive date range.

**Architecture:** Add a scoped read endpoint and one atomic range-write endpoint to the existing DailyTarget API. Keep existing single-day endpoints and the fallback for unconfigured dates. Add a visit-themed mobile form reachable from Area Manager summary, then refresh summary after a successful save.

**Tech Stack:** Laravel 13 / PHP 8.4, Spatie roles, `daily_targets` unique `(user_id,target_date)`, PHPUnit, Expo SDK 54 / React Native 0.81, Node test runner, EAS Update runtime 1.1.5.

**Spec:** `docs/history/designs/2026-11-17-area-manager-target-range-design.md`

## Global Constraints

- New GET and POST routes are `spv` only. Never accept `team_id` from client; derive it from authenticated user.
- Only active users with `sales` role and the same `team_id` may receive new targets. Reject all invalid selected IDs before any write.
- `date_from` and `date_to` are inclusive, at most 31 days; `target_visits` is integer 1–100. A second submission upserts the same user/date rows. Preserve `set_by`.
- Backend deploy precedes mobile OTA. No native dependency, Android permission, package, SDK, or runtime change. Staging only.
- Do not submit real target changes during device smoke testing. Use dummy Sales and dates.

## Review Focus

1. A crafted cross-branch ID in selected mode cannot change another branch's target or reveal their Sales list.
2. A non-Sales user in the same branch cannot be targeted.
3. Any invalid recipient or a reversed/32-day range leaves the database unchanged.
4. Repeating an accepted request updates existing targets once per `(user_id,target_date)` and records the setter.
5. After saving, the Area Manager summary refreshes; Sales dashboard reads the new target on the selected date.

---

### Task 1: Scoped backend target range API

**Files:**
- Modify: `gps-tracker/routes/api.php`
- Modify: `gps-tracker/app/Http/Controllers/Api/DailyTargetController.php`
- Modify: `gps-tracker/tests/Feature/CoreApiTest.php`
- Optional create: `gps-tracker/app/Http/Requests/TargetRangeRequest.php` if validation is clearer outside the controller.

**Interfaces:**
- `GET /api/v1/target/eligible-sales` → `data.sales: [{id,name}]`, active own-branch Sales only.
- `POST /api/v1/target/range-set` consumes `{selection,user_ids?,date_from,date_to,target_visits}`; returns `data: {sales_count,days_count,targets_written}` with HTTP 201.
- Existing `POST /target/set` and `/target/bulk-set` remain compatible but reject non-Sales targets.

- [ ] Add failing feature tests for scoped eligible list, selected and all modes, cross-branch and non-Sales rejection, no partial write, inclusive date range, max 31 days, and idempotent overwrite.
- [ ] Run `php artisan test --filter=DailyTarget` or focused test names; expected FAIL for missing routes/guard.
- [ ] Implement validation, scoped selection, and chunked upsert inside one DB transaction. Keep existing routes compatible and tighten recipient role check.
- [ ] Run focused tests; expected PASS. Run `php artisan test --filter=CoreApiTest`, `php artisan route:list --path=target`, `git diff --check`; expected success. Commit only backend target files.

### Task 2: Area Manager target form

**Files:**
- Modify: `gps-tracker-mobile/App.js`
- Modify: `gps-tracker-mobile/src/api/services/reportService.js`
- Modify: `gps-tracker-mobile/src/screens/spv/TeamSummaryScreen.js`
- Create: `gps-tracker-mobile/src/screens/spv/TargetRangeScreen.js`
- Create: `gps-tracker-mobile/src/utils/targetRangePresentation.js`
- Create: `gps-tracker-mobile/tests/targetRangePresentation.test.mjs`

**Interfaces:**
- New route `TargetRange` in AdminStack only. Visible entry action only for role `spv`.
- Form fetches `eligible-sales`; sends one `range-set` request after confirmation. No offline queue.
- `validateTargetRangeDraft` returns field errors and inclusive day count using date-only strings without timezone drift.

- [ ] Write failing pure tests for one date, 31-day range, reversed/32-day range, selected-empty, target 0/101, and safe request payload (no `team_id`).
- [ ] Run focused test; expected FAIL from missing helper.
- [ ] Implement service calls and form with branch label, all/selected Sales, date pickers, numeric target, keyboard-safe layout, loading/error/empty states, confirmation, and one save action. Add summary entry and focus refresh.
- [ ] Run focused tests and compare API request shape to spec; expected PASS. Run `npm.cmd run test:offline`, Android export, `git diff --check`; expected success. Commit only mobile target files.

### Task 3: Staging integration and documentation

**Files:**
- Update: `docs/release/build-staging.md`
- Update: backend API documentation in `docs/reference/target-range-api.md`.

- [ ] Run backend focused/full relevant tests, `node --test tests/*.test.mjs`, offline suite, Expo dependency check, Android export, and diff check; expected success.
- [ ] Provide exact backend files/deployment order for staging. Confirm new GET and POST return expected scoped responses in staging before publishing mobile OTA.
- [ ] On connected Infinix, log in with AM test account, inspect only own Sales, selected/all, date range, confirmation, keyboard, Back, and a dummy save. Verify summary updates and no crash/JS error.
- [ ] Publish Android OTA to `staging` runtime 1.1.5 after backend staging is ready; cold-start twice and record update group URL, tests, and scope outcome. Production rollout remains separate.
