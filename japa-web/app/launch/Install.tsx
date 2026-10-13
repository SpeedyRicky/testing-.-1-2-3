"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { track } from "./analytics";

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

/** Registers the service worker (offline play) on real sites. */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (!/^https:$/.test(location.protocol) && location.hostname !== "localhost") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Header chip: "Install" when the browser offers it (Android, desktop Chrome/Edge); a how-to on iPhone Safari. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [tip, setTip] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const t = window.setTimeout(() => setIos(isIos()), 0);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallEvent); track("install_available"); };
    const onInstalled = () => { setPrompt(null); track("app_installed"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!prompt && !ios) return null;
  const click = async () => {
    track("install_click", { platform: prompt ? "prompt" : "ios" });
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      track("install_choice", { outcome });
      setPrompt(null);
    } else setTip(true);
  };
  return (
    <div className="relative">
      <button type="button" onClick={click}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300/70">
        <Download className="h-3.5 w-3.5" /> Install
      </button>
      {tip ? (
        <div role="dialog" aria-label="Install on iPhone"
          className="animate-scene-in absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-white/15 bg-zinc-950/95 p-4 text-sm text-zinc-200 shadow-2xl backdrop-blur-xl">
          <button type="button" aria-label="Close" onClick={() => setTip(false)} className="absolute right-2 top-2 rounded-full p-1 text-zinc-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          <p className="font-semibold text-white">Play it like an app</p>
          <p className="mt-1.5 leading-6">In Safari, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>. It works offline too.</p>
        </div>
      ) : null}
    </div>
  );
}
