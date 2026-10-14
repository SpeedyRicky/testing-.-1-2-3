import type { CapacitorConfig } from "@capacitor/cli";

// Android (and later iOS) wrapper around the same web game. Build: `npm run android:build` (see docs/ANDROID.md).
const config: CapacitorConfig = {
  appId: "ng.japagame.app",
  appName: "Japa: The Great Escape",
  webDir: "android-web",
  backgroundColor: "#09090b",
  android: { allowMixedContent: false },
};

export default config;
