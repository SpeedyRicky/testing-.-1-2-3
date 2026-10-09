// Copies the dialogue content from the Godot project so both games share one source.
// Run after editing ../japa/data/japa_nodes.json:  npm run sync-content
import { copyFileSync, existsSync } from "node:fs";
const src = new URL("../../japa/data/japa_nodes.json", import.meta.url);
const dst = new URL("../src/content/japa_nodes.json", import.meta.url);
if (!existsSync(src)) {
  console.error("Godot project not found next to japa-web; keeping the committed copy.");
  process.exit(0);
}
copyFileSync(src, dst);
console.log("Synced japa_nodes.json from the Godot project.");
