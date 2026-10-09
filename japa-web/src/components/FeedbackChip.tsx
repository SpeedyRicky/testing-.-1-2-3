import { formatTag } from "../engine/dialogue";

export function FeedbackChip({ feedback }: { feedback: { tag: string; text: string } | null }) {
  if (!feedback) return null;
  return (
    <div key={feedback.tag + feedback.text} className="animate-fade-in rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
      {feedback.tag && <span className="mr-2 font-semibold text-amber-300">{formatTag(feedback.tag)}:</span>}
      <span className="text-zinc-300">{feedback.text}</span>
    </div>
  );
}
