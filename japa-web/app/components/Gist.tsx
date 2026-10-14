"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, MessagesSquare, X } from "lucide-react";
import { gistFor, type GistKind } from "@/game/gist";
import type { RouteId } from "@/game/types";
import { usePlayer } from "./Player";
import { track } from "../launch/analytics";

const TAG: Record<GistKind, string> = {
  news: "bg-sky-400/15 text-sky-200", tip: "bg-emerald-400/15 text-emerald-200",
  myth: "bg-amber-400/15 text-amber-200", scam: "bg-rose-500/20 text-rose-200",
};
const today = () => Math.floor(Date.now() / 86_400_000);

/** Header chip "Gist": today's japa timeline for the route you're on, with Community notes on myths and scams. */
export function GistButton({ route }: { route: RouteId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); track("gist_open", { route }); }}
        className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:text-white">
        <MessagesSquare className="h-3.5 w-3.5 text-sky-300" /> Gist
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-400" aria-hidden />
      </button>
      {open ? <GistFeed route={route} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GistFeed({ route, onClose }: { route: RouteId; onClose: () => void }) {
  const { t } = usePlayer();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = window.setTimeout(() => setMounted(true), 0); return () => window.clearTimeout(id); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;
  const posts = gistFor(route, today());
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Gist feed" onClick={onClose}>
      <div className="animate-scene-in h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Gist</h2>
            <p className="text-xs text-zinc-500">What the japa timeline is saying today. Not everything on it is true.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <ul className="mt-5 space-y-3">
          {posts.map((p) => (
            <li key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-600 text-xs font-black text-white">
                  {p.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{p.name}</p>
                  <p className="text-xs text-zinc-500">@{p.handle}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TAG[p.kind]}`}>{p.kind}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-200">{t(p.text)}</p>
              {p.note ? (
                <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/5 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200"><Info className="h-3.5 w-3.5" /> Community note</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-300">{t(p.note)}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[11px] leading-5 text-zinc-500">Posts are fictional. Rules change: check canada.ca before you act.</p>
      </div>
    </div>,
    document.body,
  );
}
