// Where the game lives. Set NEXT_PUBLIC_SITE_URL on the host (e.g. https://japagame.ng); Vercel's production
// domain is the fallback, then localhost for development.
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");

export const SITE = {
  name: "Japa: The Great Escape",
  short: "Japa",
  title: "Japa: The Great Escape. Can you japa from Nigeria to Canada?",
  description:
    "A free Nigeria → Canada immigration game. Survive Lagos, write IELTS, chase an ITA, gamble 180 days as a tourist, "
    + "and learn the real rules behind 60+ endings. Village People Interference included.",
};

/** The link to share: the page the player is on (if it's a real site), else the configured one, tagged for analytics. */
export function shareUrl(source: string): string {
  let base = SITE_URL;
  if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    base = window.location.origin;
  }
  return `${base}/?utm_source=${encodeURIComponent(source)}&utm_medium=share`;
}
