# API and Mobile Diagnostic Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every API request and key mobile operation in safe, correlated logs that can be reviewed without reading source code.

**Architecture:** Laravel middleware logs one structured record per API request and returns a request ID. The Axios client sends the same ID and writes sanitized events to a bounded private mobile log; named operation events cover failures outside HTTP. Users can manually share retained logs from Profile.

**Tech Stack:** Laravel 11 logging/middleware; React Native Axios; Expo SDK 54 `expo-file-system/legacy`; built-in React Native `Share` API.

**Spec:** `docs/superpowers/specs/2026-10-02-api-mobile-logging-design.md`

## Global Constraints

- Do not change app, build, Laravel, Expo, or dependency versions; do not add dependencies.
- Never log secrets, raw request/response bodies, query values, files, exact coordinates, contact fields, payment values, or signed URLs.
- Logging failures must never block business operations or alter API responses.
- Keep mobile logs private, manually shared, limited to seven days and 1 MiB; keep server logs daily for 14 days.
- Preserve unrelated pre-existing changes in the shared working tree; stage only logging files and intended hunks.

## Review Focus

- Public login and signed photo-preview routes have no authenticated actor but still receive request IDs and completion records.
- Invalid, oversized, or malformed inbound request IDs are replaced with a safe generated ID.
- API paths, validation errors, and Axios errors contain no query values or submitted field values.
- Disk-full, missing document directory, and file-write errors do not fail the user operation.
- Export with empty, capped, or long log history remains usable and does not upload logs automatically.

## File Map

- Create `gps-tracker/app/Http/Middleware/ApiRequestLog.php`: request ID validation/generation, response correlation, and structured API lifecycle record.
- Modify `gps-tracker/routes/api.php`: put the middleware around the complete `v1` route group, including public routes.
- Modify `gps-tracker/config/logging.php` and `gps-tracker/.env.example`: select daily API log output and 14-day retention without removing environment overrides.
- Create `gps-tracker-mobile/src/utils/diagnosticLogger.js`: redacted JSONL logging, bounded retention, request IDs, and read-for-export function.
- Modify `gps-tracker-mobile/src/api/client.js`: attach/echo-correlate request IDs and record each API result; remove token logging.
- Modify `gps-tracker-mobile/src/context/AuthContext.js`, `src/utils/offlineQueue.js`, and `src/utils/backgroundTracker.js`: add named auth, queue, and tracking events; replace unsafe auth diagnostics.
- Modify relevant handlers in `gps-tracker-mobile/src/screens/CameraScreen.js`, `src/screens/VisitFormScreen.js`, `src/screens/ProfileScreen.js`, `src/screens/admin/UserFormScreen.js`, and `src/screens/admin/TeamFormScreen.js`: add named failure/transition events where no API request captures the operation.
- Modify `gps-tracker-mobile/src/screens/ProfileScreen.js`: add explicit manual share action using React Native `Share.share`.
- Update `README.md` or the mobile README with server log location, retention, export steps, and request-ID support workflow.

## Tasks

### Task 1: Log backend API request lifecycle

**Files:** create `gps-tracker/app/Http/Middleware/ApiRequestLog.php`; modify `gps-tracker/routes/api.php`, `gps-tracker/config/logging.php`, `gps-tracker/.env.example`.

**Interfaces:** Middleware receives Laravel `Request`, passes it through unchanged, and returns the same `Response` with `X-Request-ID`. Log route action/template, method, authenticated ID/role if present, status, elapsed milliseconds, and safe field-name/error metadata only.

- [x] Generate a UUID unless inbound `X-Request-ID` matches `^[A-Za-z0-9._-]{1,64}$`.
- [x] Capture completion status and duration for successful, validation, authorization, and server-error responses; include the request ID in Laravel exception context without persisting request values.
- [x] Apply the middleware to every `v1` route, including login and signed preview; exclude query strings from logged paths.
- [x] Make daily rotation the documented default with 14-day retention while preserving `LOG_CHANNEL`/`LOG_STACK` overrides.
- [x] Run `php -l` on the middleware, route, and config files; review sample record fields for redaction.

### Task 2: Add bounded mobile diagnostic logger

**Files:** create `gps-tracker-mobile/src/utils/diagnosticLogger.js`.

**Interfaces:** export `createRequestId()`, `logEvent(eventName, metadata = {})`, `logApiOutcome(entry)`, and `readDiagnosticLogs()`. Each writer accepts only an explicit safe metadata shape. Persist newline-delimited JSON using `expo-file-system/legacy`; keep a serialized write queue and bounded chunks so each write does not rewrite an unbounded file.

- [x] Add safe event serialization with timestamp, app version/build, platform, event name, and allowlisted metadata.
- [x] Enforce seven-day and 1 MiB caps by pruning oldest chunks/records.
- [x] Swallow storage errors without affecting callers or business operations.
- [x] Parse the logger with Babel and inspect the redaction allowlist/retention logic.

### Task 3: Correlate and log each mobile API call

**Files:** modify `gps-tracker-mobile/src/api/client.js`.

**Consumes:** `createRequestId()` and `logApiOutcome(entry)` from Task 2.
**Produces:** every Axios call sends `X-Request-ID`, records start time, and appends exactly one sanitized outcome on response or error.

- [x] Attach a generated request ID when one is not already present; preserve/log that request ID from Axios config, and record only a mismatch flag if the response header unexpectedly differs.
- [x] Record method, path without query, elapsed time, status, sanitized error code, and optional stable operation name; never serialize Axios config or body.
- [x] Remove the existing partial bearer-token log and route global auth error diagnostics through `logEvent`.
- [x] Keep current logout-on-401/inactive-account behavior unchanged.
- [x] Parse the client with Babel; inspect all diagnostics for authorization/header/body serialization.

### Task 4: Add named mobile operation events

**Files:** modify `gps-tracker-mobile/src/context/AuthContext.js`, `src/utils/offlineQueue.js`, `src/utils/backgroundTracker.js`, and relevant handlers in `src/screens/CameraScreen.js`, `src/screens/VisitFormScreen.js`, `src/screens/ProfileScreen.js`, `src/screens/admin/UserFormScreen.js`, `src/screens/admin/TeamFormScreen.js`.

**Consumes:** `logEvent()` from Task 2. Keep event names stable and metadata allowlisted; API outcome records remain automatic.

- [x] Record auth outcomes without username, password, or token.
- [x] Record offline queue state transitions and background tracking start/stop/failure without queued payloads or coordinates.
- [x] Record photo selection/upload and admin user/team save transitions with operation name, outcome, and safe error/status metadata only.
- [x] Replace any existing auth console diagnostics that include secrets or personal values.
- [x] Parse each changed JavaScript file with Babel; search changed code for raw error objects, auth headers, payload dumps, coordinates, or contact values passed to the logger.

### Task 5: Expose manual diagnostic sharing and support instructions

**Files:** modify `gps-tracker-mobile/src/screens/ProfileScreen.js`; update README documentation.

**Consumes:** `readDiagnosticLogs()` from Task 2. Use built-in React Native `Share.share`; do not add a package or network upload.

- [x] Add **Bagikan log diagnostik** to Profile, with clear no-log and share-failure messages.
- [x] Share only the already-redacted retained log text; make sharing explicitly user initiated.
- [x] Document `storage/logs/laravel-*.log`, retention, mobile export steps, and how to correlate server/mobile records using `X-Request-ID`.
- [x] Parse ProfileScreen with Babel and inspect documentation against the implemented paths/settings.

### Task 6: Review and commit only this work

- [x] Review every spec acceptance criterion against the changed files.
- [x] Run `git diff --check`, PHP/JavaScript syntax checks, and a redaction scan; do not stage unrelated existing modifications.
- [x] Stage only the logging implementation, documentation, and this plan; inspect `git diff --cached` before committing.
- [x] Commit with `feat: add correlated API and mobile diagnostic logs`.

## Documentation References

- Laravel 11 middleware: <https://laravel.com/docs/11.x/middleware>
- Laravel 11 logging: <https://laravel.com/docs/11.x/logging>
- Expo SDK 54 FileSystem legacy API: <https://docs.expo.dev/versions/v54.0.0/sdk/filesystem-legacy/>
- React Native Share API: <https://reactnative.dev/docs/share>
