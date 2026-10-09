import { useEffect, useRef, useState } from "react";

type Tone = "emerald" | "sky" | "amber" | "rose" | "violet" | "gold";

const FILL: Record<Tone, string> = {
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  amber: "bg-amber-400",
  rose: "bg-rose-500",
  violet: "bg-violet-400",
  gold: "bg-gradient-to-r from-amber-300 to-yellow-500",
};

interface Props {
  label: string;
  value: number;
  max?: number;
  tone?: Tone;
  /** Draws a tick at the pass mark, e.g. the Letter of Support threshold. */
  threshold?: number;
  suffix?: string;
  /** When true, a rise is bad news (e.g. desperation), so deltas flip colour. */
  invert?: boolean;
}

/** A labelled meter that animates to its new value and briefly shows the change. */
export function StatBar({ label, value, max = 100, tone = "emerald", threshold, suffix = "", invert = false }: Props) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null);

  useEffect(() => {
    const d = Math.round(value - prev.current);
    prev.current = value;
    if (d === 0) return;
    setDelta((old) => ({ n: d, key: (old?.key ?? 0) + 1 }));
    const t = setTimeout(() => setDelta(null), 1800);
    return () => clearTimeout(t);
  }, [value]);

  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const good = delta ? (delta.n > 0) !== invert : false;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-zinc-400">{label}</span>
        <span className="flex items-baseline gap-2">
          {delta && (
            <span key={delta.key} className={`animate-fade-in font-mono text-[11px] ${good ? "text-emerald-400" : "text-rose-400"}`}>
              {delta.n > 0 ? "+" : ""}
              {delta.n}
            </span>
          )}
          <span className="font-mono text-sm tabular-nums text-zinc-100">
            {Math.round(value)}
            {suffix}
          </span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${FILL[tone]} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
        {threshold !== undefined && (
          <div
            className="absolute inset-y-0 w-px bg-white/70"
            style={{ left: `${Math.min(100, (threshold / max) * 100)}%` }}
            title={`Needs ${threshold}`}
          />
        )}
      </div>
    </div>
  );
}
