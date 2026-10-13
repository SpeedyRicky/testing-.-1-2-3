// Builds one self-contained HTML file (no server, no Next.js runtime) for quick
// sharing as a preview link. Vercel deploys use `next build` instead.
//   node scripts/build-standalone.mjs [out.html]
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const out = process.argv[2] ?? "out/japa-standalone.html";
// Inside node_modules so the Tailwind CLI resolves "tailwindcss" from the project.
const tmp = join("node_modules", ".cache", "japa-standalone");
mkdirSync(tmp, { recursive: true });

const js = await build({
  stdin: {
    contents: `import { createRoot } from "react-dom/client";
import { Game } from "./app/components/Game";
import { SoundProvider } from "./app/components/Sound";
createRoot(document.getElementById("root")).render(<SoundProvider><Game /></SoundProvider>);`,
    loader: "tsx",
    resolveDir: process.cwd(),
  },
  bundle: true, minify: true, write: false, format: "iife", jsx: "automatic",
  tsconfig: "tsconfig.json", define: {
    "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_SITE_URL": "undefined",
    "process.env.VERCEL_PROJECT_PRODUCTION_URL": "undefined", "process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN": "undefined",
    "process.env.NEXT_PUBLIC_POSTHOG_KEY": "undefined", "process.env.NEXT_PUBLIC_POSTHOG_HOST": "undefined",
  },
  logLevel: "error",
});

// Tailwind v4 scans the project for class names; the Lagos stage CSS is plain CSS.
const entry = join(tmp, "in.css");
writeFileSync(entry, `@import "tailwindcss" source("${process.cwd()}");\n` +
  readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', ""));
const cssOut = join(tmp, "out.css");
execFileSync("npx", ["@tailwindcss/cli", "-i", entry, "-o", cssOut, "--minify"], { stdio: ["ignore", "ignore", "inherit"] });
const css = readFileSync(cssOut, "utf8") + readFileSync("app/lagos-2d.css", "utf8") + readFileSync("app/canada-2d.css", "utf8")
  + readFileSync("app/cinematic.css", "utf8") + readFileSync("app/avatar.css", "utf8");
const code = js.outputFiles[0].text.replace(/<\/script/g, "<\\/script");

const html = `<title>Japa: The Great Escape</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;900&family=Geist+Mono:wght@400;600;700&family=Source+Serif+4:wght@500;600&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark;--font-geist-sans:"Geist",ui-sans-serif,system-ui,sans-serif;--font-geist-mono:"Geist Mono",ui-monospace,monospace;--font-source-serif:"Source Serif 4"}html,body{background:#07060c;color:#f8f5ff}</style>
<style>${css}</style>
<div id="root"></div>
<script>${code}</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
