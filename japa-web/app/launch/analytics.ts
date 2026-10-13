// Anonymous play stats. One `track()` call, two optional providers, configured by environment variables:
//   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=japagame.ng           Plausible (cookieless; the script is added in layout.tsx)
//   NEXT_PUBLIC_POSTHOG_KEY=phc_...  [+ NEXT_PUBLIC_POSTHOG_HOST]   PostHog, via its HTTP capture API (no SDK)
// With neither set (local dev, the standalone file), track() does nothing. We never send the username, avatar,
// state, age or any free text: only route ids, ending ids, counts and coarse flags.

export type Props = Record<string, string | number | boolean>;

const PLAUSIBLE = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
const ID_KEY = "japa.anon.v1";

export const analyticsEnabled = () => Boolean(PLAUSIBLE || POSTHOG_KEY);

function optedOut(): boolean {
  try {
    const n = navigator as Navigator & { globalPrivacyControl?: boolean };
    return n.doNotTrack === "1" || n.globalPrivacyControl === true || localStorage.getItem("japa.noStats") === "1";
  } catch { return false; }
}

/** A random id for this browser, so PostHog can count returning players. Not linked to any profile data. */
function anonId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) { id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(ID_KEY, id); }
    return id;
  } catch { return "anon"; }
}

/** Events seen this page load, for the browser QA and for debugging (`window.__japaEvents`). */
const seen: { event: string; props?: Props }[] = [];

export function track(event: string, props?: Props): void {
  if (typeof window === "undefined") return;
  seen.push({ event, props });
  (window as unknown as { __japaEvents?: typeof seen }).__japaEvents = seen;
  if (optedOut()) return;
  try {
    const w = window as unknown as { plausible?: (e: string, o?: { props?: Props }) => void };
    if (PLAUSIBLE && w.plausible) w.plausible(event, props ? { props } : undefined);
    if (POSTHOG_KEY) {
      void fetch(`${POSTHOG_HOST}/capture/`, {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: POSTHOG_KEY, event, distinct_id: anonId(),
          properties: { ...props, $current_url: location.origin + location.pathname, $process_person_profile: false } }),
      }).catch(() => {});
    }
  } catch { /* stats must never break the game */ }
}

/** Where this visit came from: ?utm_source=x, the installed app, or direct. */
export function visitSource(): string {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("source") === "pwa" || matchMedia("(display-mode: standalone)").matches) return "installed";
    return q.get("utm_source") ?? (document.referrer ? new URL(document.referrer).hostname : "direct");
  } catch { return "unknown"; }
}
