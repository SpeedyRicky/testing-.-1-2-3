# Android: build, Play Store launch, and testing on budget phones

The Android app is a thin Capacitor wrapper around the same game. It loads the single-file offline build
(`out/japa-standalone.html`, about 1 MB, with every script, style and sound inlined), so it works with no network
from the first launch and the download stays tiny.

## Build

Local (needs Android Studio / the Android SDK and Java 21):

```bash
cd japa-web
npm ci
npm run android:sync          # builds the offline file into android-web/ and syncs the Android project
npx cap open android          # open in Android Studio to run on a phone or emulator
npm run android:bundle        # release .aab in android/app/build/outputs/bundle/release/
```

CI: push a tag like `v0.24.0` (or run the "Japa CI" workflow manually with "Build the Android App Bundle"). The workflow
uploads `japa-android-aab` as an artifact and fails if it's over 50 MB.

**Signing (once):** create an upload key, then add four repository secrets in GitHub → Settings → Secrets → Actions:

```bash
keytool -genkey -v -keystore upload.jks -alias japa -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks   # paste into ANDROID_KEYSTORE_BASE64
```

`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`japa`), `ANDROID_KEY_PASSWORD`.
Never commit the keystore. Turn on Play App Signing so Google holds the app-signing key.

**SDK levels:** `minSdkVersion 23` (Android 6, the Capacitor 7 minimum) and `targetSdkVersion 35` (Google Play's
current requirement for new apps). The design doc's 21/34 would be rejected by Play today.

## Play Console checklist (West Africa)

1. **App content:** privacy policy URL (required), Data safety form (we collect anonymous gameplay events only if you
   turn analytics on; no names, contacts or location), content rating questionnaire, target audience 18+ is simplest
   given the immigration and asylum themes, and a note that it's educational fiction, not legal advice.
2. **Store listing:** use `store/listing.md` and the images in `store/`. Replace the placeholder icon and feature
   graphic with a designer's versions before launch.
3. **Countries:** start with Nigeria, Ghana and Canada (the diaspora shares to home). Add more once reviews come in.
4. **Pricing:** the game is free with no in-app purchases today. If you add purchases later, set NGN and GHS prices by
   hand to round numbers (e.g. ₦500, ₦1,000) instead of auto-conversion.
5. **Payments:** digital goods sold *inside* a Play-distributed app must use Google Play Billing (unless enrolled in an
   approved alternative-billing program). Don't wire Paystack into the Play build for in-app purchases; it's fine on
   the website.
6. **Release tracks:** internal testing (your phone) → closed testing (20+ testers for 14 days is required for new
   personal developer accounts) → production.

## Bug-hunting on real budget phones (Tecno, Infinix, itel)

The app is a WebView, so the Godot advice in the design doc maps to these checks instead:

1. **Remote debugging:** enable Developer options (tap Build number 7 times) → USB debugging. Connect the phone and open
   `chrome://inspect` on your computer. You get the full DevTools console, network and performance tabs for the app.
   Over Wi-Fi: `adb tcpip 5555` then `adb connect PHONE_IP:5555`.
2. **Frame drops:** Developer options → "Profile HWUI rendering: on screen as bars". In DevTools → Performance, record
   a run of choices; long tasks over 50 ms are the ones to fix. If the 2D stage stutters, the in-game
   **Animations: Reduced** toggle turns most motion off.
3. **Memory leaks:** DevTools → Memory → take a heap snapshot, play 20 choices, take another. Detached DOM nodes that
   keep growing are a leak (React normally cleans up; listeners added without cleanup are the usual cause).
4. **Audio:** the game ships no audio files; music and ambience are synthesised. If audio crackles on a slow phone,
   lower Music/Ambience in the mixer, or set Sound to "Effects only".
5. **Battery and heat:** the game only animates while something changes, and the music scheduler wakes every 25 ms.
   Test 20 minutes of play with the screen on and check the phone isn't warm; if it is, reduced animations should fix it.
6. **Storage pressure:** saves are a few KB in local storage. On low-storage phones, check the save survives killing
   the app from the task switcher (it flushes on background).
7. **2 GB RAM devices:** keep at most one game tab open; the whole app uses well under 100 MB in testing.
