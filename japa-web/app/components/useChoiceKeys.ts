"use client";

import { useEffect } from "react";

/** Number keys 1-9 pick the matching choice on screen (ignored while typing or when inactive). */
export function useChoiceKeys(choices: { index: number; enabled: boolean }[], pick: (index: number) => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > choices.length) return;
      const c = choices[n - 1];
      if (!c.enabled) return;
      e.preventDefault();
      pick(c.index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, pick, active]);
}
