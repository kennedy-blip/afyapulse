# Android binary drop-point

The Settings → APK centre checks `./downloads/afyapulse.apk` for a compiled
Capacitor package (it validates the ZIP/APK signature before offering the
download). Deployment options:

1. Run the **Build Android APK** GitHub Action, download the artifact and copy it
   here as `afyapulse.apk`, then redeploy.
2. Or publish the APK as a GitHub release asset and set `VITE_APK_URL` to that
   asset URL in the Vercel project.

Build locally with:

```bash
npm install
npm run build
npx cap add android
npm run cap:sync
npm run apk:debug
```
