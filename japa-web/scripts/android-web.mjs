// Prepares the folder Capacitor wraps into the Android app: the single-file offline game plus its icons.
// The standalone file has every script, style and sound inlined, so the app works with no network from first launch.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";

const out = "android-web";
mkdirSync(`${out}/icons`, { recursive: true });
copyFileSync("out/japa-standalone.html", `${out}/index.html`);
for (const f of readdirSync("public/icons")) copyFileSync(`public/icons/${f}`, `${out}/icons/${f}`);
console.log(`Wrote ${out}/index.html for Capacitor`);
