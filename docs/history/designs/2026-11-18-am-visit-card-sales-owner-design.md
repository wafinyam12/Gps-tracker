# Sales owner on Area Manager visit cards

The Area Manager customer picker shows who owns each customer before a visit starts. Each card adds a compact `Sales: <name>` row below the branch. Long names wrap naturally. Sales users continue to see the existing card layout.

The `GET /api/v1/stores/available` response adds `sales_owner_name` only for `spv` accounts. The backend derives this field from active Sales users in the authenticated AM's `team_id` whose `slpCode` matches the customer's `sap_slp_code`. It uses the same eligible Sales lookup as the catalog boundary, so a different branch cannot supply a name. If several active Sales share one code, show their distinct names together. The field is omitted for other roles and does not change visit ownership, SAP assignment, or targets.

`StartVisitScreen` carries the field into the encrypted, account-scoped offline customer cache. `VisitStoreRow` shows it only to AM users, with a plain fallback label for older cached rows. This is a JavaScript-only SDK 54 change, suitable for OTA after the backend files are on staging.

Verify paginated and unpaginated API responses, duplicate SAP Sales code, inactive Sales and cross-branch exclusion, Sales response privacy, mobile normalization, and Android bundle export.
