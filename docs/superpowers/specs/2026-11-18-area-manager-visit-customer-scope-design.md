# Area Manager visits to Sales customers in one branch

## Goal

An Area Manager (the `spv` role) can choose and visit customers assigned to active Sales accounts in the Area Manager's own branch. The Area Manager cannot list or start a visit for customers assigned to another branch, an inactive Sales account, or a non-Sales account.

## Existing behavior and cause

`StartVisitScreen` already allows Area Managers and calls `GET /api/v1/stores/available`. `StoreCatalogSyncService` scopes the SAP catalog to the signed-in user's own Sales SAP code. Area Managers normally have no such code, so this service selects the dummy catalog and the actual branch customers do not appear. The same service validates `store_id` and customer code on visit start, so a list-only change would still reject check-in.

## Approach

Use the synchronized SAP customer catalog already stored in `stores`. For an authenticated Area Manager, scope all store reads used by visits to `master_source = sap_outstanding_receivable`, the Area Manager's `team_id`, and SAP Sales codes belonging to active `sales` users in that team. An Area Manager without a branch or eligible Sales sees an empty catalog. Do not fetch SAP or populate dummy stores on an Area Manager request; the existing Sales scheduler remains responsible for catalog synchronization. Keep Sales behavior unchanged.

The Area Manager starts and completes the visit under their own user ID, with the existing geofence, photo, offline, and checkout rules. The customer's Sales assignment is unchanged. Area Manager visits are recorded separately and do not count toward any Sales daily target. Target summaries list Sales only, while visit logs and CRM visit details still include Area Manager activity. An Area Manager without an assigned branch receives no Sales or visit rows in the target summary, even if they supply a `team_id` parameter. The existing mobile customer picker and encrypted offline cache can consume the widened server response without a new native build; no mobile code change is expected.

## Verification

Feature tests cover list, search, and visit start by store ID and customer code; same-branch active Sales are visible, while another branch, an inactive Sales assignment, a non-Sales assignment, and dummy data are denied. Test an Area Manager without a branch, and preserve the existing Sales catalog tests. Run the backend suite and mobile regression checks if mobile code changes. Stage the backend service first, then verify with an Area Manager account in staging before considering an OTA.
