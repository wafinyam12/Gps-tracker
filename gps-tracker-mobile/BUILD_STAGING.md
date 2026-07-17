# Build Staging Android

Staging API:

```env
EXPO_PUBLIC_API_BASE_URL=https://crm-sales.utomo-dev.xyz/api/v1
EXPO_PUBLIC_OSM_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Android package staging:

```text
xyz.utomodev.salesdaily.staging
```

Current staging `versionCode`: `2`

## Check Project

```bash
npm run check
```

## Build APK With EAS

Run EAS from the mobile app folder, not from the repository root:

```bash
cd "D:\gps tracker\gps-tracker-mobile"
```

Login once:

```bash
npx eas-cli login
```

Configure EAS project if this is the first build:

```bash
npx eas-cli build:configure
```

Build installable Android APK:

```bash
npx eas-cli build -p android --profile preview
```

EAS will return an APK download link after the build completes.

If EAS fails while packing `gps-tracker/public/storage`, the command was likely run from the repository root or EAS included backend files. The root `.easignore` excludes the Laravel backend; rerun the build from `gps-tracker-mobile`.

Maps use OpenStreetMap tiles through a WebView + Leaflet component, so Android builds do not need a Google Maps API key.

## Install APK

Download the APK on the Android device and install it manually, or install with USB debugging:

```bash
adb install path/to/sales-daily.apk
```

## Smoke Test

- Login with an active sales user.
- Open store list or available stores.
- Send location ping.
- Try check-in and checkout.
- Upload a visit photo.
