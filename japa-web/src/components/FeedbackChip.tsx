import { formatLabel } from "@/game/engine";

export function FeedbackChip({ choice }: { choice: { label: string; feedback: string } | null }) {
  if (!choice || (!choice.label && !choice.feedback)) return null;
  return (
    <div key={choice.label + choice.feedback} className="animate-fade-in rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
      {choice.label && <span className="mr-2 font-semibold text-amber-300">{formatLabel(choice.label)}:</span>}
      <span className="text-zinc-300">{choice.feedback}</span>
    </div>
  );
}
