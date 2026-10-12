// Prints the balance report: npm run simulate
import { it } from "vitest";
import { DB } from "../game/engine";
import { PLAYABLE_ROUTES, simulate, unreached, type RouteReport } from "../game/simulate";

it("balance report", () => {
  const reports: RouteReport[] = [];
  const rows: string[] = ["route            policy   win%  neutral%  fail%  stuck%  moves  traps"];
  for (const route of PLAYABLE_ROUTES) {
    for (const policy of ["random", "careful", "smart"] as const) {
      const r = simulate(DB, route, policy, 2000);
      reports.push(r);
      const pct = (n: number) => ((100 * n) / r.runs).toFixed(0).padStart(5);
      rows.push(`${route.padEnd(16)} ${policy.padEnd(8)} ${pct(r.win)} ${pct(r.neutral)}    ${pct(r.fail)}  ${pct(r.stuck)}  ${r.avgMoves.toFixed(1).padStart(5)}  ${r.avgTraps.toFixed(2)}`);
    }
  }
  console.log(rows.join("\n"));
  console.log("Unreached endings:", unreached(DB, reports));
  for (const r of reports.filter((x) => x.policy !== "random")) {
    const col = Object.entries(r.collapses).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(100 * v / r.runs).toFixed(0)}%`);
    if (col.length) console.log(`  collapses (${r.policy}) ${r.route}:`, col.join(", "));
    const top = Object.entries(r.endings).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k.split(":")[1]} ${(100 * v / r.runs).toFixed(0)}%`);
    console.log(`  ${r.policy} ${r.route}:`, top.join(", "));
  }
});
