# AM Visit Card Sales Owner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the Sales owner on each customer card in the Area Manager visit picker.

**Architecture:** The existing SAP Sales code and branch scope determine eligible owners. The available-stores API adds a name label for AM only. The mobile picker retains the field through normalization and encrypted cache and renders it in the existing card component.

**Tech Stack:** Laravel 13, PHP 8.4, MySQL feature tests, Expo SDK 54, React Native.

**Spec:** `docs/history/designs/2026-11-18-am-visit-card-sales-owner-design.md`

## Global Constraints

- Preserve authenticated branch and active Sales boundary.
- Keep `stores/available` response shape and existing fields.
- No migration, route, dependency, or native module change.

## Review Focus

- Duplicate `slpCode` in a branch must not misidentify one person as sole owner.
- Different branch with same code must not contribute a name.
- Inactive Sales and non-Sales must not contribute a name.
- Sales account must not receive other Sales names.
- Older offline cache lacking the field must render safely.

---

### Task 1: API owner label

**Files:** `gps-tracker/app/Services/MasterData/StoreCatalogSyncService.php`, `gps-tracker/app/Http/Controllers/Api/StoreController.php`, `gps-tracker/tests/Feature/AreaManagerCustomerVisitTest.php`

**Interface:** `StoreCatalogSyncService::areaManagerSalesOwnerNames(?User): array` returns normalized SAP code to display name; `GET /api/v1/stores/available` adds `sales_owner_name` for AM only.

- [x] Add a failing feature test for paginated and plain results, duplicate owners, and Sales response privacy.
- [x] Run the focused test and confirm the absent field fails.
- [x] Implement one shared eligible-owner lookup in the catalog service and map the label into AM available-store rows. The test also caught numeric coercion between SAP codes `47` and `047`; codes remain strings in the query.
- [x] Run focused tests and the backend suite.

### Task 2: Mobile card

**Files:** `gps-tracker-mobile/src/screens/StartVisitScreen.js`, `gps-tracker-mobile/src/components/visit/VisitStoreRow.js`

- [x] Preserve `sales_owner_name` through normalization and account-scoped offline cache.
- [x] Pass AM-only display flag to the card and render a compact owner row using current visit theme spacing and colors.
- [x] Run mobile tests and Android export; review code for old-cache fallback and narrow-screen wrapping.
- [x] Publish OTA after backend staging is ready. The user reported backend ready; EAS update group `6b3bbbdd-0449-4c9c-944b-ec36678ed4d2` was published and verified through `update:view`. Device smoke test is pending.
