// Builds one self-contained HTML file (no server, no Next.js runtime) for quick
// sharing as a preview link. Vercel deploys use `next build` instead.
//   node scripts/build-standalone.mjs [out.html]
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = process.argv[2] ?? "out/japa-standalone.html";
const tmp = mkdtempSync(join(tmpdir(), "japa-"));

const js = await build({
  stdin: {
    contents: `import { createRoot } from "react-dom/client";
import { Game } from "./src/components/Game";
createRoot(document.getElementById("root")).render(<Game />);`,
    loader: "tsx",
    resolveDir: process.cwd(),
  },
  bundle: true, minify: true, write: false, format: "iife", jsx: "automatic",
  tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});

const cssOut = join(tmp, "out.css");
execFileSync("npx", ["tailwindcss", "-i", "app/globals.css", "-o", cssOut, "--minify"], { stdio: "ignore" });
const css = readFileSync(cssOut, "utf8");
const code = js.outputFiles[0].text.replace(/<\/script/g, "<\\/script");

const html = `<title>Japa: The Great Escape</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&family=Source+Serif+4:wght@500;600&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark;--font-inter:"Inter";--font-mono:"JetBrains Mono";--font-serif:"Source Serif 4"}html,body{background:#09090b;color:#f4f4f5}</style>
<style>${css}</style>
<div id="root"></div>
<script>${code}</script>
`;
execFileSync("mkdir", ["-p", out.split("/").slice(0, -1).join("/") || "."]);
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
