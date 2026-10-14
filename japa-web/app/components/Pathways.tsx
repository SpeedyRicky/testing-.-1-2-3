"use client";

import { createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gamepad2, Lock, Pencil, X } from "lucide-react";
import { DB } from "@/game/engine";
import type { Access } from "@/game/eligibility";
import type { RouteId } from "@/game/types";

type AccessMap = Record<RouteId, Access>;

const PathwaysContext = createContext<AccessMap | null>(null);
export const PathwaysProvider = PathwaysContext.Provider;

/** Access per route; null outside a game (everything open). */
export const usePathways = () => useContext(PathwaysContext);

const PLAYABLE = (Object.keys(DB.routes) as RouteId[]).filter((r) => DB.routes[r].status === "playable");

/** Every pathway with open / locked / earned, and why. Used at the end of sign-up and in the header. */
export function PathwayList({ access, compact = false }: { access: AccessMap; compact?: boolean }) {
  return (
    <ul className="space-y-2">
      {PLAYABLE.map((r) => {
        const a = access[r];
        return (
          <li key={r} data-route={r} data-open={a.ok ? "yes" : "no"}
            className={`rounded-xl border px-3 py-2.5 ${a.ok ? "border-emerald-300/25 bg-emerald-300/5" : "border-white/10 bg-black/30"}`}>
            <p className="flex items-center gap-2 text-sm font-bold text-white">
              {a.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <Lock className="h-4 w-4 shrink-0 text-zinc-500" />}
              <span className={a.ok ? "" : "text-zinc-300"}>{DB.routes[r].title}</span>
              {a.earned ? <span className="rounded bg-amber-300/15 px-1.5 py-px text-[10px] uppercase tracking-wider text-amber-200">Earned</span> : null}
            </p>
            {!compact || !a.ok ? <p className="mt-1 pl-6 text-xs leading-5 text-zinc-400">{a.reason}</p> : null}
            {!a.ok && a.viaPlay ? (
              <p className="mt-1 flex items-start gap-1.5 pl-6 text-xs leading-5 text-sky-200">
                <Gamepad2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a.viaPlay}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export const openCount = (access: AccessMap) => PLAYABLE.filter((r) => access[r].ok).length;
export const PLAYABLE_COUNT = PLAYABLE.length;

/** Why a pathway is locked, with a way to fix the profile or a way to earn it. */
export function LockedModal({ route, access, onClose, onEdit }: {
  route: RouteId | "all";
  access: AccessMap;
  onClose: () => void;
  onEdit: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const one = route === "all" ? null : access[route];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md"
      role="dialog" aria-modal="true" aria-labelledby="pathways-title" onClick={onClose}>
      <div className="animate-scene-in my-8 w-full max-w-lg rounded-[2rem] border border-white/15 bg-zinc-950 p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">{one ? "Locked pathway" : "Your pathways"}</p>
            <h2 id="pathways-title" className="mt-1 text-xl font-black text-white">
              {one ? DB.routes[route as RouteId].title : `${openCount(access)} of ${PLAYABLE_COUNT} open for your profile`}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {one ? (
          <div className="mt-4 space-y-3 text-sm leading-6">
            <p className="flex items-start gap-2 text-zinc-200"><Lock className="mt-1 h-4 w-4 shrink-0 text-zinc-500" /> {one.reason}</p>
            {one.viaPlay ? <p className="flex items-start gap-2 text-sky-200"><Gamepad2 className="mt-1 h-4 w-4 shrink-0" /> {one.viaPlay}</p> : null}
          </div>
        ) : (
          <div className="mt-4"><PathwayList access={access} compact /></div>
        )}
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Simplified game rules based on who each real pathway is for. Not an eligibility check: use IRCC&apos;s
          &quot;Come to Canada&quot; tool on canada.ca for that. Updating your profile restarts your runs; routes you
          earned by winning stay open.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-white/30">Close</button>
          <button type="button" onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-amber-200">
            <Pencil className="h-3.5 w-3.5" /> Update my profile
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
