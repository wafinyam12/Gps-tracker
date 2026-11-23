# Area Manager visit: staging handoff

## Behavior

The `spv` Area Manager sees customers from active Sales accounts in the same branch (`team_id`). If the AM has an own SAP Sales Code, the list also includes customers assigned to that code. Superadmin can fill the optional code in the AM user form; Sales codes remain required for Sales accounts. The card identifies an AM-owned customer as **Area Manager** and a Sales-owned customer as **Sales**. Visit start checks the same boundary for both `store_id` and SAP customer code. The visit belongs to the Area Manager; it does not alter SAP ownership or count toward Sales daily targets. Sales target reports list Sales accounts, while visit logs still include AM visits. An AM without a branch receives no rows from the target summary API, including when passing another `team_id`.

The scheduler and `sap-sync` queue now synchronize the AM's own code as well as Sales codes. An AM without a code still sees the active Sales catalogs in their branch. A new AM code should be entered only after confirming the branch has the correct SAP database (`teams.db_sap`); existing customer assignments are stored on `stores.sap_slp_code`.
The user form prevents two active accounts in the same branch from sharing a code, while allowing the same number in another branch's SAP database.

## Backend files to copy

Copy these files from this workspace to the same paths in staging:

1. `gps-tracker/app/Services/MasterData/StoreCatalogSyncService.php`
2. `gps-tracker/app/Http/Controllers/Api/CheckInController.php`
3. `gps-tracker/app/Services/Visits/VisitAnalyticsService.php`
4. `gps-tracker/app/Http/Controllers/Api/StoreController.php`
5. `gps-tracker/app/Http/Requests/UserRequest.php`
6. `gps-tracker/app/Http/Controllers/Api/UserController.php`
7. `gps-tracker/routes/console.php`

The mobile source changes include `gps-tracker-mobile/src/screens/admin/UserFormScreen.js`, `gps-tracker-mobile/src/screens/StartVisitScreen.js`, and `gps-tracker-mobile/src/components/visit/VisitStoreRow.js`. Publish them through the existing SDK 54 staging OTA for **both runtimes 1.1.5 and 1.1.6 after** the backend is updated; follow [the two-runtime OTA guide](build-staging.md#support-ota-untuk-runtime-115-dan-116). There is no route, migration, Composer, or native module change for this AM addition. The existing `stores.team_id`, `stores.sap_slp_code`, and `users.slpCode` columns must already exist. The AM customer list depends on the existing `SyncSapCustomerCatalog` scheduler and `sap-sync` queue synchronizing both Sales and AM codes.

The prepared JavaScript change was published to Android channel `staging` with EAS environment `preview` on 2026-11-18. Runtime version: `1.1.5`. Update group: `6b3bbbdd-0449-4c9c-944b-ec36678ed4d2`. Android update ID: `01a1ecae-202d-770e-ac23-8e4142b29f07`. EAS Dashboard: `https://expo.dev/accounts/nyma/projects/sales-daily/updates/6b3bbbdd-0449-4c9c-944b-ec36678ed4d2`.

The 2026-11-18 update predates AM-owned SAP customers. On 2026-11-23 the user reported deploying the backend to staging. Android OTA from commit `df79915` was published on channel `staging` for [runtime 1.1.5](https://expo.dev/accounts/nyma/projects/sales-daily/updates/f9b5e007-4bce-48be-b890-786fca9cf0f2) and [runtime 1.1.6](https://expo.dev/accounts/nyma/projects/sales-daily/updates/f6c5ccd9-b73f-4480-b565-f838bf1cde06). EAS lists both groups. The user then confirmed that the changes appeared and an initial device test seemed safe. The backend migration and detailed AM own-customer behavior have not been independently verified; the device runtime was not reconfirmed.

## Staging check

Run `php artisan optimize:clear` after copying. As superadmin, edit one AM with an own SAP Sales Code. Confirm the AM sees both own customers and customers of active Sales in that branch under **Kunjungan > Pilih toko**, with `Area Manager: <name>` or `Sales: <name>` on each card. An AM without a code should still see Sales customers. Check that an AM can visit an authorized own customer while its `sap_slp_code` remains unchanged, and cannot access another branch's customer. A Sales account should still see only its own customers. If the own list is empty, check active `sap_outstanding_receivable` rows matching AM `team_id` and `slpCode`, then confirm the SAP catalog job and `sap-sync` queue are running.

Local verification (2026-11-18): backend `php artisan test --compact` passed 89 tests / 549 assertions; mobile `node --test` passed 75 tests; Expo SDK 54 Android export succeeded. The user reported backend staging ready before OTA publication. EAS `update:view` confirmed branch `staging`, Android, runtime `1.1.5`. The device smoke test was pending at that point; the newer initial device report is recorded above.
