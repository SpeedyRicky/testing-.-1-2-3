// Shared state and tiny cross-module helpers for the side panel.
// Owns the mutable session/compose state; other modules read the
// exported live bindings and write through the setters below rather
// than each keeping their own copy.

export const cfg = window.CLIPMARGINAL_CONFIG || {};

console.log("ClipMarginal config", {
  supabaseUrl: !!cfg.SUPABASE_URL,
  anonKey: !!cfg.SUPABASE_ANON_KEY,
  aiProxyUrl: !!cfg.AI_PROXY_URL,
  webappUrl: !!cfg.WEBAPP_URL
});

export const supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
export const webappUrl = (cfg.WEBAPP_URL || "").replace(/\/$/, "");

export let currentUser = null;
export let currentProfile = null;
export let pendingClip = null;

export function setCurrentUser(user) {
  currentUser = user;
}

export function setCurrentProfile(profile) {
  currentProfile = profile;
}

export function setPendingClip(clip) {
  pendingClip = clip;
}

export const $ = (id) => document.getElementById(id);

export function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

export function slugify() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

// ---------- Pro plan ----------
// profiles.plan defaults to "free" (see the plan-column migration in
// supabase/migrations). This is a client-side check only - the real
// gate has to live in a Postgres RLS policy too, since anyone could
// otherwise call the Supabase API directly and skip the extension's UI
// entirely. See the migration file for that policy.
const { PLAN } = window.ClipMarginalConstants;

export function isProUser() {
  return currentProfile?.plan === PLAN.PRO;
}

// ---------- Video clip helpers ----------
export function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

function getYouTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;
    if (host === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

// Only YouTube gets a real embed today, via YouTube's own official
// iframe player - never a downloaded copy of the video. Other sites
// fall back to a plain timestamped link (see feed.js/compose.js),
// rather than attempting to iframe an arbitrary page that will likely
// refuse to render anyway (X-Frame-Options).
export function getYouTubeEmbedUrl(sourceUrl, startSeconds, endSeconds) {
  const videoId = getYouTubeVideoId(sourceUrl);
  if (!videoId) return null;

  const start = Math.max(0, Math.round(Number(startSeconds) || 0));
  const end = Math.max(start, Math.round(Number(endSeconds) || start));

  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?start=${start}&end=${end}`;
}
