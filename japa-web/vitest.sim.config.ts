import { defineConfig } from "vitest/config";

// The balance report (npm run simulate): thousands of simulated playthroughs, printed, not asserted.
export default defineConfig({ test: { environment: "node", include: ["scripts/simulate.test.ts"], testTimeout: 300000 } });
