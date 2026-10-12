import { Dices } from "lucide-react";

/** The chance a risky choice works, shown on its button: green when likely, amber when even, red when a long shot. */
export function OddsChip({ odds }: { odds?: number }) {
  if (odds === undefined) return null;
  const pct = Math.round(odds * 100);
  const tone = odds >= 0.66 ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : odds >= 0.4 ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-rose-400/40 bg-rose-400/10 text-rose-200";
  return (
    <span className={`ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 align-middle font-mono text-[11px] font-bold ${tone}`}
      title="Chance this works, from how prepared you are">
      <Dices className="h-3 w-3" aria-hidden /> {pct}%<span className="sr-only"> chance</span>
    </span>
  );
}
