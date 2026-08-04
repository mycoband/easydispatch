# EasyDispatch store wrappers (Phase D)

These Capacitor projects wrap the **same** production UI at
`https://easydispatch.vercel.app`. There is no second design system.

## Prerequisites

- Node 20+
- Xcode (iOS) / Android Studio (Android)
- Apple Developer + Google Play accounts for store submission

## Setup

```bash
cd native
npm install
npm run add:ios      # once
npm run add:android  # once
npm run sync
```

Open platforms:

```bash
npm run open:ios
npm run open:android
```

## Icons & splash

Copy branded icons from `../public/icons/` into the iOS asset catalog and
Android `mipmap-*` folders before store submission. Splash background is
`#0f172a` (see `capacitor.config.json`).

## Permissions

Enable camera / microphone / photo library in the native projects if
walkthrough capture fails inside the WebView (Safari/Chrome PWA usually
already prompts).

## Deep links

Production URL: `https://easydispatch.vercel.app`  
Optional custom scheme can be added later via Capacitor App plugin.

## Important

Ship store builds only after PWA parity QA (install, calendar drag, dispatch
drag, tech phases, safe areas) passes on Win / Mac / Android / iOS browsers.
