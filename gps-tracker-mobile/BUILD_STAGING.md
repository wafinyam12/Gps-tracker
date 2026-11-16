# Build Staging Android

## EAS Environment

Profil build `staging` memakai channel EAS Update `staging` dan EAS Environment
`preview`. Nama environment `staging` kustom tidak tersedia pada paket EAS
saat ini, sedangkan channel tetap dapat bernama `staging`.

Variabel berikut sudah dibuat pada EAS project untuk environment `preview`:

```env
EXPO_PUBLIC_API_BASE_URL=https://crm-sales.utomo-dev.xyz/api/v1
EXPO_PUBLIC_OSM_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Android package staging:

```text
xyz.utomodev.salesdaily.staging
```

Current staging version: `1.1.3` (Expo SDK 54)
Current staging `versionCode`: `6`

The queue, store cache, KYC drafts, and queued visit photos are encrypted in
SQLCipher. Queued photos are BLOBs in `offline-visits-encrypted.db`. This needs
a **new APK**; an OTA update cannot add SQLCipher to an older APK.

This source is in the `staging/sdk54-uat` Git worktree. The original
`security/mobile-security-hardening-followup` checkout retains SDK 58 for
investigating its startup crash. Do not mix their `node_modules` or lock files.

## Check Project

```bash
npm ci
npm run check
npm run test:offline
```

## Build APK With EAS

Run EAS from the mobile app folder, not from the repository root:

```bash
cd "D:\gps tracker\tmp\sdk54-staging\gps-tracker-mobile"
```

Login once:

```bash
npx eas-cli login
```

Build installable Android APK:

```bash
npx eas-cli build -p android --profile staging
```

EAS will return an APK download link after the build completes.

If EAS fails while packing `gps-tracker/public/storage`, the command was likely run from the repository root or EAS included backend files. Run the build from `gps-tracker-mobile`; EAS will retrieve the staging values from its `preview` environment.

The mobile API client also defaults to staging when no environment variable is embedded. Local development requires an explicit `EXPO_PUBLIC_API_BASE_URL` override.

Maps use OpenStreetMap tiles through a WebView + Leaflet component, so Android builds do not need a Google Maps API key.

## Publish OTA Update

Build and install the staging APK at least once before sending an OTA update.
Use the staging channel with the matching EAS Environment:

```bash
npx eas-cli update --channel staging --environment preview --message "Deskripsi perubahan"
```

Changes to native dependencies, Android permissions, runtime version, or app
version require a new APK build; they cannot be delivered through OTA.

## Install APK

Download the APK on the Android device and install it manually, or install with USB debugging:

```bash
adb install path/to/sales-daily.apk
```

## Smoke Test

- Login with an active sales user.
- Open store list or available stores.
- Send location ping.
- Turn off mobile data and Wi-Fi, then check in and take a photo.
- Force close and reopen the app while offline; confirm the queued visit remains.
- Reconnect, wait for sync, and confirm the visit and photo appear once on the backend.
- Check out and confirm the result on the backend.
- Repeat login and visit access with an admin account.

Do not clear application data or uninstall an existing APK if it has unsynced
visits. A device with photo files created by the SDK 58 AES implementation
cannot upload them from this SDK 54 APK; leave that data intact and use an
SDK 58 recovery build.
