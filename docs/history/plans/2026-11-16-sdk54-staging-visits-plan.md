# SDK 54 Visit Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a staging SDK 54 APK source that retains encrypted offline visits for the 16 November sales UAT.

**Architecture:** Start from the last SDK 54 package set in an isolated Git worktree and port the completed visit hardening. Store queued visit photos as BLOBs in the same SQLCipher database as the queue metadata. Keep the SDK 58 checkout intact for later investigation.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-sqlite 16 with SQLCipher, expo-file-system 19, EAS Build.

**Spec:** `docs/history/designs/2026-11-16-sdk54-staging-visits-design.md`

## Global Constraints

- Offline visits and photos must remain encrypted.
- No deletion of legacy plaintext until encrypted values are verified.
- Preserve queued data on any migration or decryption failure.
- Raise Android versionCode above 5 and use a new app version.

## Review Focus

- Interrupted migration keeps the legacy queue and photo files.
- Repeated migration does not duplicate or overwrite pending photos.
- A photo queued offline can be materialized for upload after restart.
- SDK 58 AES photo references fail safely without deleting data.
- Startup reaches login with an empty queue and with a legacy queue.

---

### Task 1: SDK 54 staging configuration

**Files:** `gps-tracker-mobile/package.json`, `gps-tracker-mobile/package-lock.json`, `gps-tracker-mobile/app.json`, `gps-tracker-mobile/AGENTS.md`

- [ ] Pin the SDK 54 package family and add compatible `expo-crypto` and `expo-sqlite`.
- [ ] Set app version 1.1.4 and Android versionCode 7; enable SQLCipher.
- [ ] Install from the lock file and run `expo install --check`.

### Task 2: Encrypted photo storage

**Files:** `gps-tracker-mobile/src/utils/secureOfflineVisitStorage.js`, `gps-tracker-mobile/tests/offlineDataMigration.test.mjs`

- [ ] Replace SDK 58 AES file storage with SDK 54 SQLCipher BLOB storage under stable photo references.
- [ ] Verify each stored photo before releasing its plaintext source; keep retry behavior.
- [ ] Run offline migration tests and Android production JS export.

### Task 3: Pilot handoff

**Files:** `docs/release/build-staging.md`, `gps-tracker-mobile/README.md`

- [ ] Document exact staging build and device smoke test steps.
- [ ] Check final diff for unintended SDK 58 dependencies and sensitive data.
- [ ] Attempt EAS build if credentials are available; otherwise provide the build command and state the device validation still required.
