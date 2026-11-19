# Hosted Android binary

`afyapulse.apk` is the current Capacitor **debug** build, signed with the Android
debug key and installable by sideloading.

| | |
|---|---|
| Size | 5.5 MB (5749564 bytes) |
| SHA-256 | `9076a237a27040c5c438f0602c3aa89de535e73008b8144a88b77846658b3a44` |
| Built from | `main` by the *Build Android APK* workflow |
| Package | `ke.afyapulse.clinic` |

The Settings → APK centre probes this file, checks the ZIP (`PK`) header and
offers a one-tap download. Refresh it by running the workflow manually — the
build parks the binary on the `apk-artifact` branch — then copy it here and
redeploy.

```bash
git fetch origin apk-artifact
git show FETCH_HEAD:public/downloads/afyapulse.apk > public/downloads/afyapulse.apk
npm run build
```

For a store-ready build use a release keystore:

```bash
npm run apk:release
# android/app/build/outputs/apk/release/app-release.apk
```
