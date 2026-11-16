# Sales Daily mobile staging SDK 54

This branch is the temporary SDK 54 staging candidate for visit UAT. It keeps
offline visits and queued photos encrypted with SQLCipher. The Android APK is
version 1.1.4, versionCode 7. See [BUILD_STAGING.md](BUILD_STAGING.md) for the
exact build and device test steps.

The SDK 58 investigation remains on the original hardening branch. Merge or
deploy only this branch for the temporary staging APK; do not publish an SDK 58
OTA update on the staging channel while SDK 54 is installed.
