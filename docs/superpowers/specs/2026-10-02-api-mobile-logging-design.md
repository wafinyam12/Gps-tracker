# API and Mobile Diagnostic Logging Design

**Status:** Draft for review

**Date:** 2026-10-02

## Goal

Make future bug reports diagnosable from operational logs, without requiring the first response to inspect source code. Cover every HTTP API request and response, plus named high-value mobile operations that can fail before or after an API call.

The application is Laravel 11 and Expo SDK 54. Keep current app and dependency versions unchanged.

## Current state

- Laravel already has `stack`, `single`, and `daily` log channels in `gps-tracker/config/logging.php`; `.env.example` selects `stack`, whose default is `single` unless `LOG_STACK` is set.
- `gps-tracker/bootstrap/app.php` registers global middleware and API error rendering, but no middleware records API request lifecycle details.
- Mobile API calls use an Axios instance in `gps-tracker-mobile/src/api/client.js`. Its interceptor logs a partial bearer token and there are scattered `console.log` calls, but no consistent persisted diagnostic log or export action.
- The mobile app already depends on `expo-file-system` and uses its legacy API in `src/utils/offlineQueue.js`; React Native provides a built-in Share API.

## Design

### 1. Backend API request log

Add a Laravel middleware for API routes. It records one structured completion event for each API request, including public login and signed photo-preview routes:

- timestamp and severity;
- request ID;
- HTTP method and route template/action (not the query string);
- authenticated user ID and role when available;
- response status and elapsed time;
- request field names and validation-failed field names, without their submitted values;
- exception type and a concise sanitized message when a request fails.

Accept an incoming `X-Request-ID` only when it matches `^[A-Za-z0-9._-]{1,64}$`; otherwise create a UUID. Return the selected value as `X-Request-ID` on the response. Keep Laravel's normal exception reporting for stack traces, with the request ID attached as log context so an API event can be connected to the detailed exception record.

Do not log request or response bodies, query parameter values, headers, cookies, authorization values, file contents, or signed URLs. In particular, never log passwords, tokens, email/phone values, coordinates, payment data, or photo metadata. Logging failures must not change the API response or prevent the request from completing.

Use Laravel's existing daily channel with 14-day retention as the default production file sink. Keep the current channel configuration available for environments that override it. Do not add a database table or third-party logging service.

### 2. Mobile diagnostic log

Add a small logging utility used by the existing Axios client and by named high-value operation boundaries. For each API call, record:

- local timestamp, request ID, method, route path without query values;
- app version/build and OS/platform;
- elapsed time and HTTP status, or sanitized error class/code;
- a stable operation name when the caller supplies one.

Add named events for the major flows that need context outside HTTP, such as login/logout, visit and offline-queue transitions, background tracking start/stop/failure, photo selection/upload, and admin user/team save actions. Do not instrument every pure helper or internal function: that would create high-volume noise without adding useful diagnostics. Every API call remains covered automatically.

Persist logs as newline-delimited JSON in the app's private document directory using the already installed `expo-file-system/legacy` API. Keep at most seven days and 1 MiB of recent entries; trim oldest entries when either limit is reached. Logging and file I/O failures must be swallowed/reported safely and must never block app actions.

Add a user-triggered **Bagikan log diagnostik** action to Profile. It reads the retained, already-redacted log text and opens React Native's built-in share sheet. Sharing remains manual; do not upload diagnostics automatically. The screen should show a clear message if no logs are available or sharing fails.

Remove the current partial-token log from `src/api/client.js` and route existing authentication diagnostics through the redacting logger. Never persist authentication secrets or raw error request configurations.

### 3. Correlation and support workflow

The mobile app creates a request ID per API call and sends it as `X-Request-ID`. The server echoes that ID and records it in its structured request event and exception context. A bug report can then include the exported mobile log and the matching server request ID, allowing support to find the server-side record without reading source code.

Backend logs remain accessible to operators on the server under Laravel's normal log directory. Do not expose server logs through a public API or make admin users able to read them in-app.

## Data lifecycle and privacy

| Location | Data | Retention/limit | Access |
|---|---|---|---|
| Backend daily log | API route, actor ID/role, request ID, status, duration, sanitized error metadata | 14 days | Server operators |
| Mobile private file | API events and selected operation events, sanitized metadata | 7 days and 1 MiB | Current device user; explicit share action |

The same redaction policy applies before a record is written, not only before export. Request/response bodies and sensitive values are out of scope even in development builds.

## Alternatives considered

1. **Manual logging in every function:** rejected. It creates noise, requires updates to every refactor, and encourages logging sensitive local values.
2. **Backend API middleware only:** provides server-side request coverage but cannot explain failures that occur on-device before an API call or preserve the mobile request ID for a user report.
3. **External hosted logging service:** deferred. It adds credentials, network/data-retention decisions, service cost, and a dependency outside the current application.

The selected design combines automatic API-boundary logging with a small number of named mobile operation events and manual local export.

## Out of scope

- Changing business behavior, API payload schemas, or database tables.
- Logging every internal function call or every SQL query.
- Automatic upload of logs, remote log search UI, or a hosted observability vendor.
- Adding/upgrading packages or changing Expo, Laravel, app, or build versions.
- Recording full request/response bodies, credentials, personal contact data, exact locations, payment values, or image data.

## Acceptance criteria

1. Each API request has one backend request record with route/action, status, elapsed time, actor when authenticated, and a request ID; validation and exception failures remain correlated.
2. Every mobile API call is recorded locally with the same request ID and sanitized outcome.
3. Key non-API mobile operation failures have a stable operation name and safe error context.
4. A user can manually share retained mobile diagnostics from Profile; no log upload occurs automatically.
5. Retention limits are enforced and log-writing failures do not affect application behavior.
6. Automated scans/review show no token, password, raw body, photo, coordinate, phone, email, or payment value in diagnostic records.
7. Existing app and dependency versions remain unchanged.

## Documentation references

- Laravel 11 middleware: <https://laravel.com/docs/11.x/middleware>
- Laravel 11 logging: <https://laravel.com/docs/11.x/logging>
- Expo SDK 54 FileSystem legacy API: <https://docs.expo.dev/versions/v54.0.0/sdk/filesystem-legacy/>
- React Native Share API: <https://reactnative.dev/docs/share>
