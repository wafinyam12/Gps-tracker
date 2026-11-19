# SDK 54 Staging for Visit UAT

## Intent

Deliver an installable staging APK for the 16 November 2026 sales UAT while preserving encrypted offline visits. Keep the SDK 58 hardening work in its existing checkout for later crash investigation and production preparation.

## Scope and constraints

- The staging application uses the working Expo SDK 54 and React Native 0.81 package family.
- Only visits are in the pilot scope. The existing role and visit hardening remains.
- Offline queue, store cache, and KYC drafts remain in SQLCipher databases; visit photos are stored as BLOBs in the visit SQLCipher database, using a versioned `sqlcipher-photo://` reference in queue metadata.
- A queued photo is written and read back before the camera source file is removed. Migration from the prior SDK 54 AsyncStorage queue removes plaintext only after the encrypted values are verified.
- Existing SDK 58 AES photo files cannot be read by SDK 54. If encountered, staging keeps the queue and files and reports an error instead of discarding them.
- Keep the Android package and EAS project, raise app version and Android versionCode above the crashed build, and use a distinct app runtime version to prevent incompatible OTA updates.

## Approaches

1. **Chosen: SDK 54 plus SQLCipher BLOB photos.** Uses native encryption already supported by SDK 54 and avoids an additional crypto library. Database size can grow with pending photos, so the pilot needs a queue-size smoke test.
2. SDK 54 plus a separate AES library. Retains file storage but adds another native or JavaScript crypto dependency and more build risk before UAT.
3. Restore the old SDK 54 code unchanged. Fastest build, but the offline queue and photos would remain unencrypted, contrary to the pilot requirement.

## Verification

Check SDK 54 dependency versions, export the production JS bundle, run offline migration tests, build a fresh APK, then smoke test login, check-in, photo offline, restart, reconnect/sync, and admin access on a device. The APK cannot be called ready until the device test passes.
