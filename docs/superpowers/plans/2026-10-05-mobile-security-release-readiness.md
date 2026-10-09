# Mobile Security Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining mobile/backend data-at-rest, photo-access, privacy-disclosure, and Play Store verification gaps without changing the app version or current staging configuration.

**Architecture:** Move sensitive offline records into an explicitly opened SQLCipher database whose key is held in SecureStore, and protect offline photo attachments with the same encrypted storage design after a bounded-size device spike. Verify server photo/object access and external upload/error paths separately from app storage. Finalize policy and Play Console declarations from observed data flows, then inspect a production-candidate Android bundle and dependency audit.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo SecureStore 15, Expo SQLite 16 / SQLCipher, Laravel 11, Flysystem local/S3-compatible storage, EAS Android App Bundle, Google Play Console.

**Spec:** `docs/security/mobile-security-hardening-execution.md`; original assessment and implemented hardening: `docs/superpowers/plans/2026-10-05-mobile-security-hardening.md`.

## Global Constraints

- Keep `gps-tracker-mobile/app.json` app version at `1.1.0` and Android `versionCode` at `3` during this hardening task; resolve any Play upload version-code requirement as a separate release decision.
- Do not change the current staging API host/profile as part of this plan. Production host and package ID are release inputs; the existing EAS `production` profile currently points at staging and must not be submitted as production unchanged.
- Do not migrate the old visit photos: the user confirmed they are test photos and are not needed. Do not delete remote/local objects without identifying the exact test-only target first.
- Do not store encryption keys in source, AsyncStorage, logs, or the encrypted database they protect. Do not silently fall back to plaintext storage if key retrieval, database opening, or migration fails.
- Do not add a home-grown cipher or perform bulk dependency upgrades. Add only a dependency/configuration required by a verified design and compatible with Expo SDK 54.
- Keep secrets, authorization headers, photo bytes/URLs, coordinates, and personal data out of diagnostic and application logs.
- Preserve existing offline queue behavior and user ownership rules; migration failure must not silently discard or cross-sync pending visits.

## Review Focus

- A SecureStore key is missing, inaccessible, or mismatched while an encrypted database still exists; app behavior must preserve the database and never initialize a blank plaintext replacement.
- Legacy AsyncStorage queue contains pending records/photos during upgrade; migration must be atomic and only remove source data after destination verification.
- A large offline photo attachment approaches the server limit (5 photos x 5 MB); encryption and multipart replay must not exhaust memory, expose persistent plaintext, or lose the queue item.
- A signed visit-photo preview URL is copied, modified, cached, or used after expiry; it may reveal only its one authorized photo for the intended short lifetime and must not be cached by a CDN.
- The Play review disclosure, privacy page, Data Safety form, and the declared background-location feature must all describe the same observed behavior and recipients.

---

## Phase 0: Documentation and release-input discovery

**Finding:** The current repository has no production host or hosting account configuration. `gps-tracker-mobile/eas.json` profile `production` still points to the staging API; `app.json` package ends in `.staging`. The final production URL, package ID, listing entity/contact, retention rules, and external data-recipient details must come from the release owner.

**Allowed APIs / documented patterns:**

- Expo SDK 54 documents `expo-sqlite` `openDatabaseAsync`, SQLCipher through config plugin `useSQLCipher`, and setting `PRAGMA key` immediately after opening the database. SQLCipher is unavailable in Expo Go and needs a native build: [Expo SQLite SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/).
- Expo documents SecureStore `getItemAsync` / `setItemAsync` for small secrets; large values may fail on native platforms: [Expo SecureStore SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).
- Expo describes AsyncStorage as unencrypted: [Expo data storage guidance](https://docs.expo.dev/develop/user-interface/store-data/).
- Google Play requires a background-location declaration, prominent in-app disclosure, review video, and privacy policy when the bundle requests background location: [Background location policy](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en).
- Google Play Data Safety answers must represent collection, sharing, and data practices: [Data Safety form guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- Laravel documents local and public filesystem behavior: [Laravel 11 filesystem](https://laravel.com/docs/11.x/filesystem). R2 checks apply only if deployment confirms Cloudflare R2: [R2 data security](https://developers.cloudflare.com/r2/reference/data-security/), [presigned URL behavior](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

**Anti-pattern guards:** Do not use `expo-sqlite/kv-store` as encrypted storage unless an explicit supported way to supply the SQLCipher key is verified. Do not assume Expo Crypto in SDK 54 provides AES file encryption. Do not treat a signed preview URL as non-sensitive; it is a bearer capability until expiry.

### Task 1: Confirm product and deployment inputs

**Files:** No source changes. Read `gps-tracker-mobile/eas.json`, `gps-tracker-mobile/app.json`, `gps-tracker/.env.example`, `gps-tracker/resources/views/privacy-policy.blade.php`, and current data flows listed below.

- [ ] Record intended production API host, Android application ID, Play listing developer/legal entity, official privacy-policy contact, and reviewer/test account owner.
- [ ] Confirm background location is a core feature with one clear user-facing purpose. If it is not core/eligible, select removal of background permission/task instead of preparing a declaration.
- [ ] Confirm server retention/deletion owner and whether the organization provisions accounts or permits account creation in the app; use this to determine the applicable account-deletion flow.
- [ ] Inventory recipients for visit photos, cash-payment images/payloads, SAP data, UD Portal, map tiles, and diagnostics from actual deployment configuration. Mark any recipient/retention fact that cannot yet be verified as a release blocker.
- [ ] Keep staging settings untouched. Do not edit production EAS host/package values until the owner supplies the production values.

**Verification:** A release-input checklist names each value, owner, and source. No secret values are copied into this document.

## Phase 1: Encrypt offline records and photo attachments

**Files:**

- Modify: `gps-tracker-mobile/package.json`, `gps-tracker-mobile/package-lock.json`, `gps-tracker-mobile/app.json`.
- Create: `gps-tracker-mobile/src/utils/secureOfflineStore.js` (or equivalent focused storage module).
- Modify: `gps-tracker-mobile/src/utils/offlineQueue.js`, `gps-tracker-mobile/src/screens/CustomerKycScreen.js`, and the user-scoped cache/draft call sites.
- Tests: mobile tests for encrypted storage adapter, queue migration, attachment replay, account switching, and key failure behavior.

**Interfaces:**

- Produces a storage adapter with explicit open/migrate/read/write/transaction/clear operations; queue code must not access AsyncStorage directly for sensitive records after migration.
- Database key lifecycle uses SecureStore for one random database key; key material is never returned to UI or logged.
- Sensitive records include queue entries, offline visit-ID map, cached stores, sync notices, and KYC drafts. Diagnostic logs remain in their separate sanitized seven-day store.

- [ ] Add an implementation spike using SDK 54 compatible `expo-sqlite` / SQLCipher (`~16.0.10`) and the config plugin. Prove key initialization order, native Android build support, encrypted raw database contents, and expected migration behavior.
- [ ] Put queue JSON, owner metadata, cache/draft records, and their migrations behind the secure storage adapter. Use transactions so a partially migrated item cannot be replayed or removed from the old store.
- [ ] Store queued photo bytes inside SQLCipher as BLOBs unless the device spike proves the maximum payload (5 x 5 MB per upload) is not viable; if it fails, pause and select a maintained, SDK 54 compatible native file-encryption package before proceeding. Do not invent crypto APIs.
- [ ] Materialize an attachment as a temporary upload file only when building a multipart request; delete it in success, failure, cancellation, logout, and crash-recovery cleanup paths. Clean app-owned camera/cache copies only after the encrypted copy is verified; never delete an original gallery asset.
- [ ] Generate the key from a cryptographically secure random source, store it in SecureStore, apply SQLCipher key immediately after database open, and define explicit behavior for missing/wrong key or corrupt DB. Preserve the encrypted database and show a recoverable error; never recreate it as plaintext.
- [ ] Migrate existing AsyncStorage records and app-owned queued photo files. Verify counts/IDs/owners and representative payload hashes before deleting old keys/files. If migration fails, retain originals and block sync until user-visible recovery is possible.
- [ ] Keep logout semantics: offer sync or explicit queue deletion, clear only the current user's records/photos, and ensure account switching cannot see or send another user's records.

**Verification:**

- Unit/integration tests: correct key opens the DB; missing/wrong key does not produce plaintext fallback; database inspection cannot read queue/KYC values; migration success is idempotent; injected migration failure leaves original records intact.
- Device tests: restart while offline, enqueue and replay visit/photo, 25 MB aggregate photo boundary, sync failure/retry, logout and explicit deletion, switch users, revoke/recreate key, and inspect app-owned files after all cleanup paths.
- Native build: verify SQLCipher plugin is applied; Expo Go is not used as proof of SQLCipher behavior.

**Anti-pattern guards:** Never place photo bytes or database key in AsyncStorage. Never use a fixed key, source-code key, silent fresh-database fallback, or plaintext temporary attachment with no cleanup owner.

## Phase 2: Close backend photo, integration, and server-log gaps

**Files:**

- Review/modify: `gps-tracker/config/filesystems.php`, `gps-tracker/app/Services/Visits/VisitPhotoUrlService.php`, `gps-tracker/app/Http/Controllers/Api/VisitPhotoController.php`, `gps-tracker/routes/api.php`.
- Review/modify profile images: `gps-tracker/app/Http/Resources/UserResource.php`, `gps-tracker/app/Http/Controllers/Api/LocationController.php`, `gps-tracker/app/Http/Controllers/Api/AuthController.php`, relevant profile-photo UI.
- Review/modify payment path: `gps-tracker/app/Http/Controllers/Api/CashPaymentController.php`, `gps-tracker/app/Services/` UD Portal service, `gps-tracker/config/udportal.php`, `.env.example`.
- Review/modify log paths: `gps-tracker/app/Http/Controllers/Api/LocationController.php`, `gps-tracker/app/Services/MasterData/StoreCatalogSyncService.php`, visit-photo and cash-payment error handlers.
- Add/adjust: backend feature tests for preview signature/scope, upload validation, log redaction, and integration URL checks.

- [ ] Treat visit-photo preview URLs as bearer links. Verify signature validity, photo-ID binding, expiry clamp (maximum 15 minutes), rate limit, and response/proxy/CDN cache behavior. Ensure caches expire before the signed link and no public object URL bypasses the controller.
- [ ] Verify storage at the deployment boundary: effective cached config without printing credentials, selected driver/root/bucket, private ACL/bucket policy, app key and secret-manager ownership, TLS, `APP_DEBUG=false`, trusted proxy HTTPS, backups/retention, and anonymous direct-object access. Run R2-specific checks only if R2 is confirmed.
- [ ] Keep test visit photos out of migration. If cleanup is requested later, inventory the exact test-only object prefix/records and confirm scope before deleting anything.
- [ ] Decide whether profile photos are intentionally public. If not, replace `public` disk/static `storage/` URLs with an authenticated or short-lived private preview path and update all serializers/callers. If intentionally public, document the exposure and include it in the privacy page/Data Safety assessment.
- [ ] Require HTTPS for production UD Portal integration; restrict outbound target to the configured provider host, keep feature disabled until credentials/recipient are confirmed, validate response fields before returning them, and include cash-payment image transfer in privacy disclosures. Preserve local/test HTTP config and staging host as-is.
- [ ] Remove raw exception details, exception objects, filesystem paths, and remote response messages from user responses and broadly accessible logs at the identified call sites. Keep only request ID, operation, status, provider/error category; store any necessary diagnostics in the restricted server log channel without secrets or payloads.

**Verification:**

- Anonymous, altered-signature, expired, wrong-photo, wrong-branch, and wrong-user checks deny access; valid permitted preview works only for the short window.
- Upload rejects invalid MIME, over-limit count/size, and cross-user visit IDs; authorized upload and delete work; direct bucket/object URL is not public.
- Profile-photo access follows the approved private/public decision. UD Portal production URL rejects non-HTTPS and unexpected hosts; response does not reflect raw provider exceptions or unreviewed response fields.
- Inject failures and inspect API response/log output for exception text, credentials, coordinates, file paths, image bytes, signed URL query values, and personal data.

**Anti-pattern guards:** Do not migrate/delete the user's test photos. Do not call the signed preview route an authentication bypass; it is an intentional time-limited bearer URL whose leakage/caching must be controlled.

## Phase 3: Finalize privacy policy and Google Play data disclosures

**Files:**

- Modify: `gps-tracker/resources/views/privacy-policy.blade.php` after owner inputs are available.
- Review: `gps-tracker-mobile/src/context/AuthContext.js`, `gps-tracker-mobile/src/api/client.js`, `gps-tracker-mobile/src/screens/ProfileScreen.js`, `gps-tracker-mobile/app.json`, `gps-tracker-mobile/eas.json`.
- External artifacts: Play Console Data Safety form, background-location permission declaration, store listing text/screenshots, reviewer credentials, and review video.

- [ ] Replace the policy's organization/contact notice with the exact entity matching the Play listing and a working contact. Document data categories, purposes, recipients (including map tile requests and confirmed SAP/UD Portal flows), retention/deletion paths, security, and account/data request procedure.
- [ ] Test the public HTML policy over the eventual production domain: active, globally reachable, non-editable, named as the Sales Daily policy, linked in-app and in Play listing. Keep the current dynamic `/privacy-policy` route; do not hard-code the staging host in mobile code.
- [ ] Reconcile every disclosed field with the actual deployed paths: account/profile fields, precise/background location, visit/customer records, visit photos and EXIF, profile photos, cash-payment images, local diagnostics/export, map providers, and all backend recipients. Include only confirmed behavior, mark unresolved recipient/retention data as a release blocker.
- [ ] Complete Data Safety using the app plus SDK/WebView/backend behavior. Confirm collection, sharing, purpose, encryption in transit, deletion-request mechanism, and whether account creation/deletion policy applies to admin-provisioned accounts.
- [ ] For background location, declare exactly one eligible core feature with its user value; make the in-app prominent disclosure appear before runtime prompts, say location is collected in the background/when app is closed, name the feature and relevant data, offer affirmative consent, and preserve a usable decline path.
- [ ] If the declared feature is not core/eligible, plan removal of `ACCESS_BACKGROUND_LOCATION`, location foreground service configuration, and background tracking code instead of seeking Play approval.
- [ ] Prepare valid Play reviewer credentials and a short demo video showing the feature, prominent disclosure, runtime permission, and background behavior. Align store listing description/screenshots with the declared feature.

**Verification:** A reviewer can follow the disclosure from first launch to OS prompt, decline without losing unrelated functionality, open the same policy in app and listing, and match each Play declaration to a verified data flow. Review official [background-location requirements](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en) and [Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

**Anti-pattern guards:** Do not publish the existing organization/contact notice as if it were the final policy. Do not claim no sharing while map tiles or confirmed payment/business integrations send data to external providers. Do not assume the current disclosure alone guarantees Play approval for background location.

## Phase 4: Dependency audit and release artifact verification

**Files:**

- Review: `gps-tracker-mobile/package.json`, `gps-tracker-mobile/package-lock.json`, `gps-tracker/composer.json`, `gps-tracker/composer.lock`, `gps-tracker-mobile/eas.json`, `gps-tracker-mobile/app.json`.
- Build artifacts: production-candidate `.aab`, generated/merged Android manifest, Play Console pre-launch report.

- [ ] Run `npm audit` and `composer audit` in CI or a registry-enabled environment. Triage findings by affected path, exploitability, and fixed version; patch only verified relevant findings, without bulk upgrade or app version change.
- [ ] After production host/package ID are supplied, make a dedicated production EAS profile use those values; retain the staging profile unchanged. Do not submit the current `production` profile while it still targets staging.
- [ ] Build a signed Android App Bundle with the release pipeline. Inspect the built manifest for target API, `ACCESS_BACKGROUND_LOCATION`, foreground-service location type/permissions, camera, absence of `RECORD_AUDIO`, and `allowBackup=false`; config JSON alone is not proof.
- [ ] Check Google Play's current target API requirement and the actual bundle. As of the planning date, the official target API policy and Expo SDK 54 documentation indicate API 36 support, but verify the produced bundle and current Play Console requirement at release time.
- [ ] Validate startup, login/session expiry, location allow/deny/revoke, background notification/tracking, offline encryption and sync, photo upload/preview expiry, and logout on a real Android release build/API level. Review Play pre-launch report and resolve security/privacy findings.
- [ ] Confirm `version` remains `1.1.0` and `versionCode` remains `3` during this plan; if Google Play requires a newer code for upload, stop at that release gate and get a separate version decision.

**Verification:** Archive audit reports, AAB hash, manifest inspection output, pre-launch report, policy URL check, and completed Play Console declarations. No release is marked ready while production host/package ID, privacy owner/contact, background-location eligibility, or deployment storage controls remain unresolved.

**Anti-pattern guards:** Do not use the `.staging` package/API profile as a production submission. Do not claim Play approval from source inspection alone. Do not raise package/app versions as part of the hardening changes.

## Suggested execution order

1. Complete Task 1 owner inputs; the production-specific values may remain pending while code work proceeds.
2. Implement Phase 1 in a dedicated hardening branch and review the SQLCipher/photo-storage spike before migrating user data.
3. Complete Phase 2 source changes and hosted-environment checks; code and remote configuration are separate deliverables.
4. Finalize Phase 3 only after recipient, retention, contact, and background-feature decisions are known.
5. Run Phase 4 in CI/release environment and make a go/no-go checklist from its artifacts.

## Final acceptance checklist

- Sensitive queue, KYC drafts, store cache, and offline photos are encrypted at rest; no plaintext fallback; legacy data migration is recoverable and verified.
- Visit-photo objects are private and only accessible through authorized data paths or short-lived signed previews; caches cannot outlive access links.
- Profile-image exposure and cash-payment image recipients are explicitly approved and disclosed; production integrations use HTTPS and validated hosts.
- Mobile/backend diagnostics do not expose secrets, payloads, raw provider exceptions, photo paths, or signed URL values.
- The hosted privacy page is complete and matches listing entity/contact, backend/vendor flows, retention, and Play Data Safety declarations.
- Background-location use is either approved through the documented core-feature path or removed from the production artifact.
- Dependency scan, signed AAB manifest, pre-launch review, and device checks are archived; app version remains unchanged unless a separate release approval changes it.
