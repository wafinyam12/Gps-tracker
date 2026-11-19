# Area Manager Visit Customer Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Area Managers visit customers of active Sales in their own branch, without exposing other branches or changing Sales targets.

**Architecture:** Extend `StoreCatalogSyncService::scopeQuery` for `spv` users to use the existing synchronized SAP `stores` rows and the Sales codes of active Sales in the same team. Make `ensureCatalog` read-only for `spv`, so AM requests cannot fetch dummy or overwrite catalog data. Keep `CheckInController` as the authenticated visit owner, with AM visits excluded from daily target counts. The existing mobile picker and offline cache need no contract change.

**Tech Stack:** Laravel 13, PHP 8.4, MySQL feature tests, Expo SDK 54 mobile client.

**Spec:** `docs/history/designs/2026-11-18-area-manager-visit-customer-scope-design.md`

## Global Constraints

- Area Manager role is `spv`; branch identity is `team_id`.
- Only active users with the `sales` role and a nonempty SAP Sales code grant customer access.
- Customer source is `sap_outstanding_receivable`, never `sap_dummy` for AM.
- No migration or native mobile change.

## Review Focus

- AM with no team: no customer can be listed or visited.
- AM with no team: `target/summary` returns no Sales or visit rows, even with a supplied `team_id`.
- Same-branch customer assigned to an inactive Sales: hidden and rejected.
- Same-branch customer assigned to a non-Sales user: hidden and rejected.
- Customer in another branch with the same SAP code: hidden and rejected.
- Sales still sees only their own customers.

---

### Task 1: AM catalog and visit access

**Files:**
- Modify: `gps-tracker/app/Services/MasterData/StoreCatalogSyncService.php`
- Test: `gps-tracker/tests/Feature/AreaManagerCustomerVisitTest.php`

**Interfaces:**
- Consumes: `scopeQuery(Builder, ?User, bool): Builder`, `ensureCatalog(bool, ?User, bool): void`.
- Produces: AM-scoped catalog reads for the existing list, map, and visit-start endpoints.

- [x] **Step 1:** Write a feature test creating two teams, two active Sales in AM team, inactive Sales, non-Sales, and an outside Sales; seed SAP stores for each plus dummy; assert AM available list/search contains only the two eligible stores.
- [x] **Step 2:** Run the focused test and confirm it fails because the AM list is empty or dummy.
- [x] **Step 3:** In `scopeQuery`, branch on `spv` before individual SAP credential handling. Restrict to AM `team_id` and the normalized SAP codes of active same-team Sales. In `ensureCatalog`, return early for `spv` because AM reads already synchronized rows.
- [x] **Step 4:** Run the focused test and confirm it passes.
- [x] **Step 5:** Add visit-start tests for store ID and external customer code, including denied cross-branch/inactive/non-Sales values and AM without team; verify the AM owns a successful visit and Sales assignment is unchanged.

### Task 2: Target separation and regression

**Files:**
- Modify: `gps-tracker/app/Http/Controllers/Api/CheckInController.php`
- Modify: `gps-tracker/app/Services/Visits/VisitAnalyticsService.php`
- Test: `gps-tracker/tests/Feature/AreaManagerCustomerVisitTest.php`
- Test: `gps-tracker/tests/Feature/CoreApiTest.php`

**Interfaces:**
- Consumes: authenticated `User` and visit-start decision.
- Produces: `counted_as_target = false` for AM visit logs, while other roles' count logic is unchanged.

- [x] **Step 1:** Add a failing test asserting successful AM visit is owned by the AM and does not count toward Sales daily target.
- [x] **Step 2:** Run the focused test and confirm target assertion fails.
- [x] **Step 3:** Exclude `spv` visits from `counted_as_target`, retaining existing location and duplicate conditions for other roles.
- [x] **Step 4:** Update the legacy AM summary test to seed Sales visits and assert only Sales contributes to daily target and warning totals; run red, then restrict `scopeUsers` to Sales and run green. Add red/green coverage for AM without a branch attempting to read another team's target summary.
- [x] **Step 5:** Run the focused test, existing catalog and visit tests, then the full backend suite; inspect every failure.
- [x] **Step 6:** Review diff and staging handoff. No OTA is needed if the mobile API contract remains unchanged.
