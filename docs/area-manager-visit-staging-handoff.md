# Area Manager visit: staging handoff

## Behavior

The `spv` Area Manager sees customers from the synchronized SAP catalog only when the customer belongs to an active Sales account in the Area Manager's branch (`team_id`). The customer card also shows the assigned Sales name. Visit start checks the same boundary for both `store_id` and SAP customer code. The visit belongs to the Area Manager; it does not alter the Sales assignment or count toward Sales daily targets. Sales target reports list Sales accounts, while visit logs still include AM visits. An AM without a branch receives no rows from the target summary API, including when passing another `team_id`.

## Backend files to copy

Copy these files from this workspace to the same paths in staging:

1. `gps-tracker/app/Services/MasterData/StoreCatalogSyncService.php`
2. `gps-tracker/app/Http/Controllers/Api/CheckInController.php`
3. `gps-tracker/app/Services/Visits/VisitAnalyticsService.php`
4. `gps-tracker/app/Http/Controllers/Api/StoreController.php`

The mobile source changes are `gps-tracker-mobile/src/screens/StartVisitScreen.js` and `gps-tracker-mobile/src/components/visit/VisitStoreRow.js`. Publish those through the existing SDK 54 staging OTA **after** the backend is updated. There is no route, migration, Composer, or native module change. The existing `stores.team_id` and `stores.sap_slp_code` columns must already exist from the customer-scope migration previously deployed. The AM customer list depends on the existing `SyncSapCustomerCatalog` scheduler and `sap-sync` queue having synchronized the Sales catalogs.

The prepared JavaScript change was published to Android channel `staging` with EAS environment `preview` on 2026-11-18. Runtime version: `1.1.5`. Update group: `6b3bbbdd-0449-4c9c-944b-ec36678ed4d2`. Android update ID: `01a1ecae-202d-770e-ac23-8e4142b29f07`. EAS Dashboard: `https://expo.dev/accounts/nyma/projects/sales-daily/updates/6b3bbbdd-0449-4c9c-944b-ec36678ed4d2`.

## Staging check

Run `php artisan optimize:clear` after copying. Log in as an AM with an assigned branch, reopen **Kunjungan > Pilih toko**, and confirm customers of active Sales in that branch appear. After the OTA, each AM customer card should show `Sales: <name>`; Sales accounts should not see this row. Check that the AM can start and complete a visit to an authorized customer, and that the visit appears under the AM account. A Sales account should still see only its own customers. If the list remains empty, check `stores` for active `sap_outstanding_receivable` rows with that `team_id` and the active Sales `slpCode`, then confirm the SAP catalog job and `sap-sync` queue are running.

Local verification (2026-11-18): backend `php artisan test --compact` passed 89 tests / 549 assertions; mobile `node --test` passed 75 tests; Expo SDK 54 Android export succeeded. The user reported backend staging ready before OTA publication. EAS `update:view` confirmed branch `staging`, Android, runtime `1.1.5`. Device smoke test is pending.
