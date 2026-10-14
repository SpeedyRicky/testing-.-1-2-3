"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import { track } from "../launch/analytics";

// English or Nigerian Pidgin. The Pidgin dictionary (English sentence → Pidgin sentence) loads only when chosen,
// so English players never download it. Lines without a translation stay in English.
export type Lang = "en" | "pcm";
const KEY = "japa.lang.v1";

let lang: Lang = "en";
let dict: Record<string, string> | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function ensureDict() {
  if (dict) return;
  dict = (await import("@/game/i18n/pcm.json")).default as Record<string, string>;
  emit();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { if (window.localStorage.getItem(KEY) === "pcm") { lang = "pcm"; void ensureDict(); } } catch { /* storage blocked */ }
}

export function setLang(next: Lang) {
  lang = next;
  try { window.localStorage.setItem(KEY, next); } catch { /* ignore */ }
  track("language", { lang: next });
  if (next === "pcm") void ensureDict();
  emit();
}

const snapshot = () => `${lang}:${dict ? 1 : 0}`;
const store = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: snapshot,
  server: () => "en:0",
};

/** The current language, and a translator for scenario text (English in, Pidgin out when chosen and available). */
export function useLang(): { lang: Lang; tr: (text: string) => string } {
  useEffect(load, []);
  const snap = useSyncExternalStore(store.subscribe, store.get, store.server);
  const current: Lang = snap.startsWith("pcm") ? "pcm" : "en";
  const ready = snap.endsWith(":1");
  const tr = useCallback((text: string) => (current === "pcm" && ready && dict ? dict[text] ?? text : text), [current, ready]);
  return { lang: current, tr };
}

/** Header chip: English ⇄ Pidgin. */
export function LanguageToggle() {
  const { lang: current } = useLang();
  const next: Lang = current === "en" ? "pcm" : "en";
  return (
    <button type="button" onClick={() => setLang(next)} aria-label={`Language: ${current === "en" ? "English" : "Pidgin"}. Switch to ${next === "en" ? "English" : "Pidgin"}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:border-amber-300/60 hover:text-white ${
        current === "pcm" ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/5 text-zinc-200"}`}>
      <Languages className="h-3.5 w-3.5" /> {current === "en" ? "English" : "Pidgin"}
    </button>
  );
}
