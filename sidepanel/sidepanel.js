
// Handles auth, composing a clip from a captured selection,
// publishing to Supabase, and rendering the feed / profile.

const cfg = window.CLIPMARGINAL_CONFIG || {};
console.log("ClipRoots config", {
  supabaseUrl: !!cfg.SUPABASE_URL,
  anonKey: !!cfg.SUPABASE_ANON_KEY,
  aiProxyUrl: !!cfg.AI_PROXY_URL,
  webappUrl: !!cfg.WEBAPP_URL
});
const supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const webappUrl = (cfg.WEBAPP_URL || "").replace(/\/$/, "");
const openMainAppLink = document.getElementById("open-main-app");
if (openMainAppLink) {
  if (webappUrl) {
    openMainAppLink.href = webappUrl;
    openMainAppLink.classList.remove("hidden");
  } else {
    openMainAppLink.classList.add("hidden");
  }
}

const { MESSAGE, STORAGE_KEY, LIMITS } = window.ClipMarginalConstants;

let currentUser = null;
let currentProfile = null;
let pendingList = [];
let isSignupMode = false;
let feedScope = "all";
let feedSort = "newest";
let claimTargetClipId = null;

const FAVORITE_STORAGE_PREFIX = "cliproots_favorites_";

const $ = (id) => document.getElementById(id);

function getFavoriteStorageKey() {
  return `${FAVORITE_STORAGE_PREFIX}${currentUser?.id || "anon"}`;
}

function readFavoriteClips() {
  try {
    const raw = window.localStorage.getItem(getFavoriteStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("ClipRoots: failed to read favorites", err);
    return [];
  }
}

function saveFavoriteClips(clips) {
  try {
    window.localStorage.setItem(getFavoriteStorageKey(), JSON.stringify(clips));
  } catch (err) {
    console.warn("ClipRoots: failed to save favorites", err);
  }
}

function isClipFavorited(id) {
  return readFavoriteClips().some((clip) => clip.id === id);
}

function toggleClipFavorite(clip) {
  const favorites = readFavoriteClips();
  const existing = favorites.find((item) => item.id === clip.id);
  let updated;
  if (existing) {
    updated = favorites.filter((item) => item.id !== clip.id);
  } else {
    updated = [...favorites.filter((item) => item.id !== clip.id), clip];
  }
  saveFavoriteClips(updated);
  return !existing;
}

function setSortActive() {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sort === feedSort);
  });
}

function showReviewResult(text) {
  const target = $("review-result");
  if (!target) return;
  target.textContent = text;
  target.classList.remove("hidden");
}

function clearReviewResult() {
  const target = $("review-result");
  if (!target) return;
  target.textContent = "";
  target.classList.add("hidden");
}

function slugify() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function formatClipTime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

const MAX_VIDEO_CLIP_SECONDS = LIMITS.MAX_VIDEO_CLIP_SECONDS;

// ---------- View / tab switching ----------
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("view-" + name).classList.remove("hidden");
}

function setActiveTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
}

function goTo(name) {
  if (!currentUser && name !== "compose") {
    // still allow browsing feed without login
  }
  setActiveTab(name);
  if (name === "compose") {
    renderCompose();
  } else if (name === "feed") {
    showView("feed");
    loadFeed();
  } else if (name === "me") {
    if (!currentUser) {
      showView("auth");
    } else {
      showView("me");
      loadMe();
    }
  } else if (name === "review") {
    if (!currentUser || !currentProfile?.is_admin) {
      showView("auth");
    } else {
      showView("review");
      loadReviewQueue();
    }
  }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => goTo(btn.dataset.tab));
});

// ---------- Auth ----------
$("btn-signup").addEventListener("click", () => {
  isSignupMode = !isSignupMode;
  $("signup-username-field").classList.toggle("hidden", !isSignupMode);
  $("btn-login").textContent = isSignupMode ? "Create account" : "Log in";
  $("btn-signup").textContent = isSignupMode ? "Back to log in" : "Sign up instead";
});

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  $("auth-error").classList.add("hidden");

  try {
    if (isSignupMode) {
      const username = $("auth-username").value.trim();
      if (!username) throw new Error("Pick a username.");
      const { error } = await supabaseClient.auth.signUp({
        email, password, options: { data: { username } }
      });
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    await refreshSession();
    goTo("compose");
  } catch (e) {
    $("auth-error").textContent = e.message || "Something went wrong.";
    $("auth-error").classList.remove("hidden");
  }
});

$("btn-logout").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  const reviewTab = $("tab-review");
  if (reviewTab) reviewTab.classList.add("hidden");
  goTo("feed");
});

async function refreshSession() {
  const { data } = await supabaseClient.auth.getUser();
  currentUser = data?.user || null;
  if (currentUser) {
    const { data: profile } = await supabaseClient
      .from("profiles").select("*").eq("id", currentUser.id).single();
    currentProfile = profile;
  }
  const reviewTab = $("tab-review");
  if (reviewTab) reviewTab.classList.toggle("hidden", !currentProfile?.is_admin);
}

function getExtensionRuntime() {
  if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
    return chrome.runtime;
  }
  if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.sendMessage === "function") {
    return browser.runtime;
  }
  return null;
}

function sendPanelMessage(message, callback) {
  const runtime = getExtensionRuntime();
  if (!runtime) {
    console.warn("ClipRoots: panel runtime unavailable", message);
    if (typeof callback === "function") callback(null);
    return;
  }

  if (typeof chrome !== "undefined" && runtime === chrome.runtime) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("ClipRoots: panel messaging error", chrome.runtime.lastError, message);
          if (typeof callback === "function") callback(null);
          return;
        }
        if (typeof callback === "function") callback(response);
      });
    } catch (err) {
      console.warn("ClipRoots: panel messaging failed", err, message);
      if (typeof callback === "function") callback(null);
    }
    return;
  }

  try {
    const promise = runtime.sendMessage(message);
    if (promise && typeof promise.then === "function") {
      promise.then((response) => {
        if (typeof callback === "function") callback(response);
      }).catch((err) => {
        console.warn("ClipRoots: panel messaging failed", err, message);
        if (typeof callback === "function") callback(null);
      });
    } else {
      if (typeof callback === "function") callback(null);
    }
  } catch (err) {
    console.warn("ClipRoots: panel messaging failed", err, message);
    if (typeof callback === "function") callback(null);
  }
}

function readPendingListFromStorage() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === "function") {
      chrome.storage.local.get([STORAGE_KEY.PENDING_LIST], (result) => {
        resolve(result?.[STORAGE_KEY.PENDING_LIST] || []);
      });
    } else {
      resolve([]);
    }
  });
}

// ---------- Compose ----------
async function loadPendingList() {
  return new Promise((resolve) => {
    sendPanelMessage({ type: MESSAGE.GET_PENDING_LIST }, async (res) => {
      if (Array.isArray(res?.payload)) {
        resolve(res.payload);
        return;
      }
      resolve(await readPendingListFromStorage());
    });
  });
}

function setPrivateToggle(isPrivate) {
  const toggle = $("compose-private-toggle");
  if (!toggle) return;
  toggle.setAttribute("aria-pressed", isPrivate ? "true" : "false");
}

function isPrivateToggleOn() {
  return $("compose-private-toggle")?.getAttribute("aria-pressed") === "true";
}

$("compose-private-toggle")?.addEventListener("click", () => {
  setPrivateToggle(!isPrivateToggleOn());
});

function composeListItemHtml(clip) {
  const isVideo = clip.type === "video";
  const thumbnailBlock = isVideo && clip.thumbnailUrl
    ? `<img class="video-thumbnail" src="${escapeHtml(clip.thumbnailUrl)}" alt="Captured video frame" />`
    : "";
  const quoteBlock = isVideo
    ? `<div class="video-range-badge">▶ ${formatClipTime(clip.videoStartSeconds)} – ${formatClipTime(clip.videoEndSeconds)}</div>`
    : `<blockquote>${escapeHtml(clip.quotedText)}</blockquote>`;
  return `
    <div class="compose-list-item" data-clip-id="${escapeHtml(clip.id)}">
      <button class="compose-list-remove" type="button" aria-label="Remove this clip from the list">×</button>
      ${thumbnailBlock}
      ${quoteBlock}
      <div class="source-line">
        <span class="chip">${escapeHtml(clip.sourceDomain)}</span>
        <a href="${escapeHtml(clip.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>
      </div>
      <div class="compose-item-comment">
        <button class="btn ghost btn-small compose-item-comment-toggle" type="button" data-clip-id="${escapeHtml(clip.id)}">
          💬 Add a comment for this clip
        </button>
        <div class="compose-item-comment-box hidden">
          <textarea
            class="compose-item-comment-input"
            data-clip-id="${escapeHtml(clip.id)}"
            rows="2"
            maxlength="5000"
            placeholder="A note just for this clip — leave blank to use your take for the whole list instead"
          ></textarea>
        </div>
      </div>
    </div>`;
}

async function renderCompose() {
  if (!currentUser) {
    showView("auth");
    return;
  }
  pendingList = await loadPendingList();
  showView("compose");
  $("compose-error").classList.add("hidden");
  $("compose-success").classList.add("hidden");
  setPrivateToggle(false);

  if (!pendingList.length) {
    $("compose-empty").classList.remove("hidden");
    $("compose-form").classList.add("hidden");
    return;
  }
  $("compose-empty").classList.add("hidden");
  $("compose-form").classList.remove("hidden");

  $("compose-count-pill").innerHTML =
    `<span></span> ${pendingList.length} clip${pendingList.length === 1 ? "" : "s"}`;
  $("compose-list").innerHTML = pendingList.map(composeListItemHtml).join("");
  $("compose-list-title").value = "";
  $("compose-commentary").value = "";
}

$("compose-list").addEventListener("click", async (event) => {
  const commentToggle = event.target.closest(".compose-item-comment-toggle");
  if (commentToggle) {
    commentToggle.closest(".compose-item-comment")?.querySelector(".compose-item-comment-box")
      ?.classList.toggle("hidden");
    return;
  }

  const removeBtn = event.target.closest(".compose-list-remove");
  if (!removeBtn) return;

  const clipId = removeBtn.closest(".compose-list-item")?.dataset.clipId;
  if (!clipId) return;

  await new Promise((resolve) => {
    sendPanelMessage({ type: MESSAGE.REMOVE_PENDING_CLIP, payload: { id: clipId } }, resolve);
  });
  renderCompose();
});

// Voice-to-text for "Your take", via the browser's native
// SpeechRecognition API - no server, no new dependency. Feature-detected:
// browsers without support just never see the mic button rather than
// getting one that silently fails. Wired once here rather than inside
// renderCompose(), since that function re-runs on every clip and would
// otherwise stack up duplicate listeners on the same button.
function attachVoiceInput(buttonId, textareaId) {
  const button = $(buttonId);
  const textarea = $(textareaId);
  if (!button || !textarea) return;

  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionImpl) {
    button.hidden = true;
    return;
  }

  const recognition = new SpeechRecognitionImpl();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;

  let listening = false;
  let baseText = "";
  let watchdogTimer = null;

  function showVoiceError(message) {
    $("compose-error").textContent = message;
    $("compose-error").classList.remove("hidden");
  }

  recognition.addEventListener("start", () => {
    clearTimeout(watchdogTimer);
  });

  recognition.addEventListener("result", (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    textarea.value = `${baseText}${baseText && transcript ? " " : ""}${transcript}`;
  });

  recognition.addEventListener("end", () => {
    clearTimeout(watchdogTimer);
    listening = false;
    button.classList.remove("is-listening");
  });

  recognition.addEventListener("error", (event) => {
    clearTimeout(watchdogTimer);
    listening = false;
    button.classList.remove("is-listening");

    // "no-speech"/"aborted" aren't real failures - the mic just picked up
    // nothing, or stop() was called mid-listen. Everything else was
    // previously swallowed with zero feedback, which is exactly what
    // "the mic button doesn't work" looks like from the outside - show
    // what's actually wrong instead.
    if (event.error === "no-speech" || event.error === "aborted") {
      return;
    }

    const VOICE_ERROR_MESSAGES = {
      "audio-capture": "Couldn't access your microphone. Make sure one is connected and not in use by another app.",
      "not-allowed": "Microphone access is blocked. Go to chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2Fcoflhhkdefdhkealolkmfpgpkkljlkoi, allow microphone for this extension, then try again.",
      "network": "Voice input needs an internet connection.",
      "service-not-allowed": "Voice input isn't available right now."
    };
    showVoiceError(VOICE_ERROR_MESSAGES[event.error] || "Voice input failed. You can still type your take.");
  });

  button.addEventListener("click", () => {
    if (listening) {
      try {
        recognition.stop();
      } catch {
        // already stopped/never started - nothing to do
      }
      return;
    }
    baseText = textarea.value.trim();
    listening = true;
    button.classList.add("is-listening");

    // Chrome's mic-permission prompt is anchored to the toolbar, not the
    // side panel itself - if it never renders there (a known rough edge
    // for extension side panels) recognition just hangs with no "start",
    // "result", or "error" event ever firing. Without this, that reads
    // as "the mic button does nothing" no matter how many times it's
    // clicked. If nothing happens within 5s, treat it as failed.
    watchdogTimer = setTimeout(() => {
      listening = false;
      button.classList.remove("is-listening");
      try {
        recognition.abort();
      } catch {
        // ignore - already in a bad state, nothing more to clean up
      }
      showVoiceError(
        "Voice input isn't responding. Chrome may be waiting on a microphone permission prompt outside this panel - check the rest of your browser window, then try again."
      );
    }, 5000);

    try {
      recognition.start();
    } catch {
      clearTimeout(watchdogTimer);
      listening = false;
      button.classList.remove("is-listening");
      showVoiceError("Voice input failed to start. You can still type your take.");
    }
  });
}

attachVoiceInput("compose-mic-btn", "compose-commentary");

$("btn-discard").addEventListener("click", () => {
  sendPanelMessage({ type: MESSAGE.CLEAR_PENDING_LIST });
  pendingList = [];
  renderCompose();
});

$("btn-publish").addEventListener("click", async () => {
  if (!pendingList.length || !currentUser) return;
  const commentary = $("compose-commentary").value.trim();
  const listTitle = $("compose-list-title").value.trim();
  $("compose-error").classList.add("hidden");

  for (const clip of pendingList) {
    if (clip.type !== "video") continue;
    const start = clip.videoStartSeconds;
    const end = clip.videoEndSeconds;
    if (
      typeof start !== "number" || typeof end !== "number" ||
      !(end > start) || end - start > MAX_VIDEO_CLIP_SECONDS + 0.5
    ) {
      $("compose-error").textContent = "One of these clips is longer than the 90-second limit.";
      $("compose-error").classList.remove("hidden");
      return;
    }
  }

  // A single clip publishes exactly as before (list_id stays null); two or
  // more get a shared list_id so the feed can group them into one card.
  const listId = pendingList.length > 1 ? crypto.randomUUID() : null;
  const isPrivate = isPrivateToggleOn();

  // Each clip uses its own comment if someone opted it in via "Add a
  // comment for this clip"; otherwise it falls back to the shared "Your
  // take" text above, exactly like before this per-clip option existed.
  const rows = pendingList.map((clip) => {
    const isVideo = clip.type === "video";
    const ownComment = document
      .querySelector(`.compose-item-comment-input[data-clip-id="${CSS.escape(clip.id)}"]`)
      ?.value.trim();
    return {
      slug: slugify(),
      user_id: currentUser.id,
      source_url: clip.sourceUrl,
      source_title: clip.sourceTitle,
      source_domain: clip.sourceDomain,
      clip_type: isVideo ? "video" : "text",
      quoted_text: isVideo ? "" : clip.quotedText,
      video_start_seconds: isVideo ? clip.videoStartSeconds : null,
      video_end_seconds: isVideo ? clip.videoEndSeconds : null,
      thumbnail_url: isVideo ? clip.thumbnailUrl || null : null,
      commentary: ownComment || commentary,
      is_private: isPrivate,
      list_id: listId,
      list_title: listId ? (listTitle || null) : null
    };
  });

  try {
    const { error } = await supabaseClient.from("clips").insert(rows);
    if (error) throw error;

    sendPanelMessage({ type: MESSAGE.CLEAR_PENDING_LIST });
    pendingList = [];
    $("compose-success").textContent = rows.length > 1
      ? `Published a list of ${rows.length} clips! Check the Feed tab.`
      : "Published! Check the Feed tab.";
    $("compose-success").classList.remove("hidden");
    $("compose-form").classList.add("hidden");
    setTimeout(() => renderCompose(), 1200);
  } catch (e) {
    const raw = e.message || "";
    $("compose-error").textContent = /row-level security policy/i.test(raw)
      ? "You don't have permission to publish this list."
      : raw || "Failed to publish.";
    $("compose-error").classList.remove("hidden");
  }
});

// ---------- Feed ----------
const feedSearchInput = $("feed-search");
const feedSearchButton = $("feed-search-btn");
const meSearchInput = $("me-search");
const meSearchButton = $("me-search-btn");

document.querySelectorAll(".chip-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chip-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    feedScope = btn.dataset.scope;
    loadFeed();
  });
});

feedSearchButton.addEventListener("click", () => {
  loadFeed(feedSearchInput.value.trim());
});

document.querySelectorAll(".sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    feedSort = btn.dataset.sort || "newest";
    setSortActive();
    clearReviewResult();
    loadFeed(feedSearchInput.value.trim());
  });
});

$("btn-topic-review").addEventListener("click", () => {
  reviewTopic(feedSearchInput.value.trim());
});

$("btn-recent-review").addEventListener("click", () => {
  reviewRecentNotes();
});

meSearchButton.addEventListener("click", () => {
  loadMe(meSearchInput.value.trim());
});

function videoSourceLink(c) {
  const url = c.source_url;
  if (!url) return "#";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const isYouTube = host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";

    if (isYouTube && typeof c.video_start_seconds === "number") {
      parsed.searchParams.set("t", `${Math.max(0, Math.floor(c.video_start_seconds))}s`);
      return parsed.toString();
    }

    return url;
  } catch {
    return url;
  }
}

function clipQuoteBlock(c) {
  const isVideo = c.clip_type === "video";
  const thumbnailBlock = isVideo && c.thumbnail_url
    ? `<img class="video-thumbnail" src="${escapeHtml(c.thumbnail_url)}" alt="Captured video frame" />`
    : "";
  const quoteBlock = isVideo
    ? `<a class="video-range-badge" href="${escapeHtml(videoSourceLink(c))}" target="_blank" rel="noopener noreferrer">▶ ${formatClipTime(c.video_start_seconds)} – ${formatClipTime(c.video_end_seconds)}</a>`
    : `<blockquote>"${escapeHtml(c.quoted_text)}"</blockquote>`;
  return `${thumbnailBlock}${quoteBlock}`;
}

function clipCardHtml(c, showDelete = false, isFavorite = false) {
  const claimBadge = c.claim_status === "filed"
    ? '<span class="claim-badge">Claim filed</span>' : "";
  const privateBadge = c.is_private
    ? '<span class="private-badge">🔒 Private</span>' : "";
  return `
    <div class="clip-card" data-clip-id="${escapeHtml(c.id)}">
      <div class="author-row">
        <span class="avatar">${initials(c.author_display_name || c.author_username)}</span>
        ${escapeHtml(c.author_display_name || c.author_username)}
      </div>
      ${clipQuoteBlock(c)}
      ${c.commentary ? `<div class="commentary">${escapeHtml(c.commentary)}</div>` : ""}
      <div class="card-actions">
        <button class="btn ghost summary-btn" type="button">Summarize note</button>
        <button class="btn ghost favorite-btn" type="button">${isFavorite ? 'Unfavorite' : 'Favorite'}</button>
        <button class="btn ghost report-btn" type="button" data-clip-id="${escapeHtml(c.id)}">Report</button>
        ${showDelete && c.is_private ? `<button class="btn ghost share-btn" type="button" data-clip-id="${escapeHtml(c.id)}">Share</button>` : ''}
        ${showDelete ? '<button class="btn ghost delete-btn" type="button">Delete note</button>' : ''}
      </div>
      <div class="summary-block hidden">
        <strong>Summary</strong>
        <p class="summary-text"></p>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(c.source_domain || "")} ${claimBadge}${privateBadge}</span>
      </div>
    </div>`;
}

// Clips published together (see btn-publish's shared list_id) render as
// one card with each clip nested inside, rather than as separate feed
// entries - "make it a list" instead of N disconnected cards.
function listSubclipHtml(c) {
  return `
    <div class="list-subclip" data-clip-id="${escapeHtml(c.id)}">
      ${clipQuoteBlock(c)}
      <div class="list-subclip-footer">
        <span class="chip">${escapeHtml(c.source_domain || "")}</span>
        <button class="btn ghost btn-small report-btn" type="button" data-clip-id="${escapeHtml(c.id)}">Report</button>
      </div>
    </div>`;
}

function listCardHtml(group, showDelete = false, isFavorite = false) {
  const first = group.items[0];
  const privateBadge = first.is_private
    ? '<span class="private-badge">🔒 Private</span>' : "";
  const claimBadge = group.items.some((c) => c.claim_status === "filed")
    ? '<span class="claim-badge">Claim filed</span>' : "";
  const domains = [...new Set(group.items.map((c) => c.source_domain).filter(Boolean))];
  return `
    <div class="clip-card list-card" data-list-id="${escapeHtml(group.listId)}">
      <div class="author-row">
        <span class="avatar">${initials(first.author_display_name || first.author_username)}</span>
        ${escapeHtml(first.author_display_name || first.author_username)}
      </div>
      <div class="list-card-header">
        <span class="list-badge">📋 List · ${group.items.length} clips</span>
        ${group.listTitle ? `<h3 class="list-title">${escapeHtml(group.listTitle)}</h3>` : ""}
      </div>
      <div class="list-subclips">
        ${group.items.map(listSubclipHtml).join("")}
      </div>
      ${first.commentary ? `<div class="commentary">${escapeHtml(first.commentary)}</div>` : ""}
      <div class="card-actions">
        <button class="btn ghost summary-btn" type="button">Summarize note</button>
        <button class="btn ghost favorite-btn" type="button">${isFavorite ? 'Unfavorite' : 'Favorite'}</button>
        ${showDelete && first.is_private ? `<button class="btn ghost share-btn" type="button" data-clip-ids="${escapeHtml(group.items.map((c) => c.id).join(","))}">Share</button>` : ''}
        ${showDelete ? '<button class="btn ghost delete-btn" type="button">Delete note</button>' : ''}
      </div>
      <div class="summary-block hidden">
        <strong>Summary</strong>
        <p class="summary-text"></p>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(domains.join(", "))} ${claimBadge}${privateBadge}</span>
      </div>
    </div>`;
}

// Groups rows sharing a list_id into one entry, in first-seen order;
// rows without a list_id stay standalone. clip_lists has no table of
// its own - list_id/list_title live denormalized on each clips row.
function groupFeedRows(rows) {
  const groups = [];
  const groupByListId = new Map();

  for (const row of rows) {
    if (!row.list_id) {
      groups.push({ isList: false, row });
      continue;
    }

    let group = groupByListId.get(row.list_id);
    if (!group) {
      group = { isList: true, listId: row.list_id, listTitle: row.list_title || "", items: [] };
      groupByListId.set(row.list_id, group);
      groups.push(group);
    }
    group.items.push(row);
  }

  return groups;
}

function renderFeedRows(rows, showDeleteFn, isFavoriteFn) {
  return groupFeedRows(rows)
    .map((group) => group.isList
      ? listCardHtml(group, showDeleteFn(group.items[0]), isFavoriteFn(group.listId))
      : clipCardHtml(group.row, showDeleteFn(group.row), isFavoriteFn(group.row.id)))
    .join("");
}

function buildSearchFilter(searchTerm, query) {
  if (!searchTerm) return query;
  const term = `%${searchTerm.replace(/%/g, "\\%")}%`;
  return query.or(
    `quoted_text.ilike.${term},commentary.ilike.${term}`
  );
}

async function loadFavoriteFeed(searchTerm = "") {
  const favorites = readFavoriteClips();
  const filtered = favorites.filter((clip) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (`${clip.quoted_text || ""} ${clip.commentary || ""}`)
      .toLowerCase().includes(term);
  });
  if (filtered.length === 0) {
    $("feed-list").innerHTML = '<p class="muted">No favorite clips found.</p>';
    clearReviewResult();
    return;
  }
  $("feed-list").innerHTML = renderFeedRows(
    filtered,
    (clip) => Boolean(currentUser) && clip.author_id === currentUser.id,
    () => true
  );
  clearReviewResult();
}

async function loadFeed(searchTerm = "") {
  $("feed-list").innerHTML = '<p class="muted">Loading…</p>';
  clearReviewResult();
  if (feedSort === "favorites") {
    await loadFavoriteFeed(searchTerm);
    return;
  }
  try {
    // clips_feed already hides other users' private clips at the
    // database level, but a signed-in owner still passes that check
    // for their own rows - Discover is public browsing, so private
    // clips (including the viewer's own) are excluded here too; they
    // only ever surface in Me.
    let query = supabaseClient.from("clips_feed").select("*").eq("is_private", false).limit(30);

    if (searchTerm) {
      query = buildSearchFilter(searchTerm, query);
    }

    if (feedScope === "following" && currentUser) {
      const { data: follows } = await supabaseClient
        .from("follows").select("following_id").eq("follower_id", currentUser.id);
      const ids = (follows || []).map((f) => f.following_id);
      if (ids.length === 0) {
        $("feed-list").innerHTML = '<p class="muted">You\'re not following anyone yet.</p>';
        return;
      }
      query = query.in("author_id", ids);
    }

    try {
      if (feedSort === "newest") {
        query = query.order("created_at", { ascending: false });
      } else if (feedSort === "oldest") {
        query = query.order("created_at", { ascending: true });
      }
    } catch (e) {
      console.warn("ClipRoots: could not apply sort order", e);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      $("feed-list").innerHTML = '<p class="muted">No clips match your search.</p>';
      return;
    }
    $("feed-list").innerHTML = renderFeedRows(
      data,
      (clip) => Boolean(currentUser) && clip.author_id === currentUser.id,
      (id) => isClipFavorited(id)
    );
  } catch (e) {
    $("feed-list").innerHTML = `<p class="error">${escapeHtml(e.message || "Failed to load feed.")}</p>`;
  }
}

// ---------- Me ----------
async function loadMe(searchTerm = "") {
  if (!currentProfile) await refreshSession();
  $("me-profile").innerHTML = `
    <div class="profile-card">
      <div class="name">${escapeHtml(currentProfile?.display_name || currentProfile?.username || "")}</div>
      <div class="username">@${escapeHtml(currentProfile?.username || "")}</div>
    </div>`;
  $("me-clips").innerHTML = '<p class="muted">Loading…</p>';
  let query = supabaseClient
    .from("clips_feed").select("*").eq("author_id", currentUser.id).limit(50);

  if (searchTerm) {
    query = buildSearchFilter(searchTerm, query);
  }

  const { data, error } = await query;
  if (error) {
    $("me-clips").innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    return;
  }
  $("me-clips").innerHTML = data.length
    ? renderFeedRows(data, () => true, (id) => isClipFavorited(id))
    : '<p class="muted">You haven\'t published a clip yet.</p>';

  void loadSharedWithMe();
  void loadFollowing();
}

// ---------- Review (admin only) ----------
// Tab button (#tab-review) stays hidden unless currentProfile.is_admin,
// and the underlying RLS policies ("admins can view all clips",
// "admins can update clips under review", "admins can delete clips
// under review") enforce the same thing server-side - a non-admin
// reaching this view some other way would just get empty results, not
// real data, and their delete/update calls would be rejected.
async function loadReviewQueue() {
  const el = $("review-list");
  if (!el) return;
  el.innerHTML = '<p class="muted">Loading…</p>';

  const { data: clips, error } = await supabaseClient
    .from("clips")
    .select("*, profiles(username, display_name)")
    .eq("claim_status", "resolved_removed")
    .order("created_at", { ascending: false });

  if (error) {
    el.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!clips || clips.length === 0) {
    el.innerHTML = '<p class="muted">Nothing under review right now.</p>';
    return;
  }

  const clipIds = clips.map((c) => c.id);
  const { data: claims } = await supabaseClient
    .from("claims")
    .select("*, profiles(username)")
    .in("clip_id", clipIds)
    .order("created_at", { ascending: false });

  const claimsByClip = new Map();
  (claims || []).forEach((c) => {
    if (!claimsByClip.has(c.clip_id)) claimsByClip.set(c.clip_id, []);
    claimsByClip.get(c.clip_id).push(c);
  });

  el.innerHTML = clips.map((c) => reviewCardHtml(c, claimsByClip.get(c.id) || [])).join("");

  el.querySelectorAll(".review-keep-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleReviewKeep(btn.dataset.clipId));
  });
  el.querySelectorAll(".review-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleReviewDelete(btn.dataset.clipId));
  });
}

function reviewCardHtml(c, claims) {
  const author = c.profiles?.display_name || c.profiles?.username || "someone";
  const claimsHtml = claims
    .map((claim) => `<p class="muted">Reported by @${escapeHtml(claim.profiles?.username || "unknown")}: "${escapeHtml(claim.reason)}"</p>`)
    .join("");
  return `
    <div class="clip-card" data-clip-id="${escapeHtml(c.id)}">
      <div class="author-row">
        <span class="avatar">${initials(author)}</span>
        ${escapeHtml(author)}
      </div>
      ${clipQuoteBlock(c)}
      ${c.commentary ? `<div class="commentary">${escapeHtml(c.commentary)}</div>` : ""}
      ${claimsHtml || '<p class="muted">No report on file for this clip.</p>'}
      <div class="card-actions">
        <button class="btn ghost review-keep-btn" type="button" data-clip-id="${escapeHtml(c.id)}">Keep — dismiss report</button>
        <button class="btn ghost review-delete-btn" type="button" data-clip-id="${escapeHtml(c.id)}">Delete permanently</button>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(c.source_domain || "")}</span>
      </div>
    </div>`;
}

async function handleReviewKeep(clipId) {
  if (!confirm("Restore this clip? It will become publicly visible again.")) return;
  const { error } = await supabaseClient.from("clips").update({ claim_status: "resolved_kept" }).eq("id", clipId);
  if (error) {
    alert(error.message || "Couldn't restore this clip. Try again.");
    return;
  }
  loadReviewQueue();
}

async function handleReviewDelete(clipId) {
  if (!confirm("Permanently delete this clip? This cannot be undone.")) return;
  const { error } = await supabaseClient.from("clips").delete().eq("id", clipId);
  if (error) {
    alert(error.message || "Couldn't delete this clip. Try again.");
    return;
  }
  loadReviewQueue();
}

// Following someone happens on the website's profile page (profiles.html)
// so it can be gated behind the same sign-in flow as commenting there -
// this just lists who you already follow, with an unfollow control.
function followingRowHtml(profile) {
  const profileHref = webappUrl ? `${webappUrl}/profiles.html?username=${encodeURIComponent(profile.username)}` : "#";
  return `
    <div class="following-row" data-profile-id="${escapeHtml(profile.id)}">
      <span class="avatar">${initials(profile.display_name || profile.username)}</span>
      <span class="following-row-name">
        <a href="${escapeHtml(profileHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(profile.display_name || profile.username)}</a>
        <span class="following-row-username">@${escapeHtml(profile.username)}</span>
      </span>
      <button class="btn ghost unfollow-btn" type="button" data-profile-id="${escapeHtml(profile.id)}">Unfollow</button>
    </div>`;
}

async function loadFollowing() {
  const el = $("following-list");
  if (!el) return;
  el.innerHTML = '<p class="empty-inline">Loading…</p>';

  const { data: rows, error } = await supabaseClient
    .from("follows").select("following_id").eq("follower_id", currentUser.id);
  if (error) {
    el.innerHTML = `<p class="empty-inline">${escapeHtml(error.message)}</p>`;
    return;
  }

  const ids = (rows || []).map((r) => r.following_id);
  if (!ids.length) {
    el.innerHTML = '<p class="empty-inline">You\'re not following anyone yet — follow people from their profile page on the website.</p>';
    return;
  }

  const { data: profiles, error: profilesError } = await supabaseClient
    .from("profiles").select("id, username, display_name").in("id", ids);
  if (profilesError) {
    el.innerHTML = `<p class="empty-inline">${escapeHtml(profilesError.message)}</p>`;
    return;
  }

  el.innerHTML = (profiles || []).map(followingRowHtml).join("");
}

$("following-list")?.addEventListener("click", async (event) => {
  const btn = event.target.closest(".unfollow-btn");
  if (!btn) return;

  const profileId = btn.dataset.profileId;
  if (!profileId) return;

  btn.disabled = true;
  try {
    const { error } = await supabaseClient
      .from("follows").delete()
      .eq("follower_id", currentUser.id).eq("following_id", profileId);
    if (error) throw error;
    btn.closest(".following-row")?.remove();
    if (!$("following-list").children.length) {
      $("following-list").innerHTML = '<p class="empty-inline">You\'re not following anyone yet — follow people from their profile page on the website.</p>';
    }
  } catch (e) {
    btn.disabled = false;
    alert(e.message || "Couldn't unfollow. Try again.");
  }
});

// ---------- React to new clips captured while panel is open ----------
const panelRuntime = getExtensionRuntime();
if (panelRuntime && panelRuntime.onMessage && typeof panelRuntime.onMessage.addListener === "function") {
  panelRuntime.onMessage.addListener((message) => {
    if (message.type === MESSAGE.PENDING_LIST_UPDATED) {
      pendingList = Array.isArray(message.payload) ? message.payload : [];
      // Only jump to the compose tab for an actual new capture. Publish and
      // discard both clear the list and manage their own compose UI state
      // (including a success message) after sending CLEAR_PENDING_LIST -
      // that message echoes back here as this same update, and unconditionally
      // re-rendering on every echo wiped that success message before it was
      // ever visible.
      if (pendingList.length) {
        goTo("compose");
      }
    }
  });
}

// Card actions (summarize/favorite/delete) are wired once via
// delegation on a stable ancestor instead of re-attaching a fresh
// listener to every button on every render. The old approach called
// attachSummaryButtons() (which itself called attachFavoriteButtons())
// AND attachFavoriteButtons() again from loadFeed()/loadFavoriteFeed(),
// so every favorite button ended up with two click listeners - one
// click fired the toggle twice (add then immediately remove, or vice
// versa), which net out to nothing. That's why "Favorite" looked like
// it didn't work.
function parseVideoRangeText(text) {
  const match = /(\d+):(\d{2})\s*–\s*(\d+):(\d{2})/.exec(text || "");
  if (!match) return { start: null, end: null };
  const [, sm, ss, em, es] = match;
  return {
    start: Number(sm) * 60 + Number(ss),
    end: Number(em) * 60 + Number(es)
  };
}

async function handleSummaryAction(clipCard) {
  const summaryBlock = clipCard.querySelector(".summary-block");
  const summaryText = clipCard.querySelector(".summary-text");
  // A list card nests multiple quotes/video badges - fold them all in so
  // "Summarize note" covers the whole list, not just the first item.
  const quote = [...clipCard.querySelectorAll("blockquote, .video-range-badge")]
    .map((node) => node.textContent.trim())
    .join("\n");
  const commentary = clipCard.querySelector(".commentary")?.textContent || "";
  const noteText = `${quote}\n\n${commentary}`.trim();

  summaryBlock.classList.remove("hidden");
  if (!noteText) {
    summaryText.textContent = "No text available to summarize.";
    return;
  }
  summaryText.textContent = "Summarizing...";

  const prompt = `Summarize this note in one short paragraph and explain its meaning clearly:\n\n${noteText}`;
  try {
    const result = await fetchSummarization(prompt, noteText);
    if (result.html) {
      summaryText.innerHTML = result.text;
    } else {
      summaryText.textContent = result.text;
    }
  } catch (err) {
    console.error("ClipRoots: summarization failed", err);
    summaryText.innerHTML = buildSearchFallbackHtml(noteText);
  }
}

// Builds one favorites-storage row from either a standalone .clip-card
// or a single .list-subclip nested inside a .list-card - shared fields
// (author, commentary, privacy, list grouping) are read from whichever
// ancestor actually carries them.
function scrapeClipFromCard(clipCard, subclipEl) {
  const scope = subclipEl || clipCard;
  const clipId = scope.dataset.clipId;
  const quote = scope.querySelector("blockquote")?.textContent || "";
  const videoRangeText = scope.querySelector(".video-range-badge")?.textContent || "";
  const { start, end } = parseVideoRangeText(videoRangeText);
  return {
    id: clipId,
    quoted_text: quote.replace(/^"|"$/g, ""),
    clip_type: videoRangeText ? "video" : "text",
    video_start_seconds: start,
    video_end_seconds: end,
    commentary: clipCard.querySelector(".commentary")?.textContent || "",
    source_domain: scope.querySelector(".chip")?.textContent
      || clipCard.querySelector(".meta-row span")?.textContent
      || "",
    author_display_name: clipCard.querySelector(".author-row")?.textContent || "",
    author_username: "",
    author_id: "",
    is_private: Boolean(clipCard.querySelector(".private-badge")),
    list_id: clipCard.dataset.listId || null,
    list_title: clipCard.querySelector(".list-title")?.textContent || null,
    slug: ""
  };
}

function handleFavoriteAction(clipCard, button) {
  const subclips = [...clipCard.querySelectorAll(".list-subclip")];
  const clips = subclips.length
    ? subclips.map((el) => scrapeClipFromCard(clipCard, el))
    : [scrapeClipFromCard(clipCard, null)];

  if (!clips.every((clip) => clip.id)) return;

  const wasFavorite = isClipFavorited(clips[0].id);
  const isNowFavorite = !wasFavorite;

  for (const clip of clips) {
    const currentlyFavorite = isClipFavorited(clip.id);
    if (currentlyFavorite !== isNowFavorite) {
      toggleClipFavorite(clip);
    }
  }

  button.textContent = isNowFavorite ? "Unfavorite" : "Favorite";
  if (feedSort === "favorites" && !isNowFavorite) {
    loadFavoriteFeed($("feed-search").value.trim());
  }
}

async function handleDeleteAction(clipCard) {
  const listId = clipCard.dataset.listId;
  const clipId = clipCard.dataset.clipId;
  if (!listId && !clipId) return;

  const confirmMessage = listId
    ? "Delete this whole list for everyone? This cannot be undone."
    : "Delete this note for everyone? This cannot be undone.";
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    let query = supabaseClient.from("clips").delete().eq("user_id", currentUser.id);
    query = listId ? query.eq("list_id", listId) : query.eq("id", clipId);
    const { error } = await query;

    if (error) throw error;
    clipCard.remove();
  } catch (err) {
    alert(err?.message || "Failed to delete note.");
  }
}

document.addEventListener("click", (event) => {
  const summaryBtn = event.target.closest(".summary-btn");
  if (summaryBtn) {
    const clipCard = summaryBtn.closest(".clip-card");
    if (clipCard) void handleSummaryAction(clipCard);
    return;
  }

  const favoriteBtn = event.target.closest(".favorite-btn");
  if (favoriteBtn) {
    const clipCard = favoriteBtn.closest(".clip-card");
    if (clipCard) handleFavoriteAction(clipCard, favoriteBtn);
    return;
  }

  const deleteBtn = event.target.closest(".delete-btn");
  if (deleteBtn) {
    const clipCard = deleteBtn.closest(".clip-card");
    if (clipCard) void handleDeleteAction(clipCard);
    return;
  }

  const reportBtn = event.target.closest(".report-btn");
  if (reportBtn) {
    openClaimModal(reportBtn.dataset.clipId);
    return;
  }

  const shareBtn = event.target.closest(".share-btn");
  if (shareBtn) {
    const clipIds = (shareBtn.dataset.clipId || shareBtn.dataset.clipIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (clipIds.length) void openShareModal(clipIds);
  }
});

// ---------- Report a complaint / issue ----------
function openClaimModal(clipId) {
  if (!clipId) return;
  claimTargetClipId = clipId;
  $("claim-form").reset();
  $("claim-success").classList.add("hidden");
  $("claim-modal-overlay").classList.remove("hidden");

  if (!currentUser) {
    // Filing requires a signed-in account (see the submit handler for
    // why) - tell them that up front instead of after filling the form.
    $("claim-fields").classList.add("hidden");
    $("claim-actions").classList.add("hidden");
    $("claim-error").textContent = "Sign in first (Me tab) to file a claim.";
    $("claim-error").classList.remove("hidden");
    return;
  }

  $("claim-fields").classList.remove("hidden");
  $("claim-actions").classList.remove("hidden");
  $("claim-error").classList.add("hidden");
}

function closeClaimModal() {
  $("claim-modal-overlay").classList.add("hidden");
  claimTargetClipId = null;
}

$("btn-claim-cancel").addEventListener("click", closeClaimModal);

$("claim-modal-overlay").addEventListener("click", (event) => {
  if (event.target === $("claim-modal-overlay")) closeClaimModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("claim-modal-overlay").classList.contains("hidden")) {
    closeClaimModal();
  }
});

$("claim-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!claimTargetClipId) return;

  const claimType = $("claim-type").value;
  const name = $("claim-name").value.trim();
  const email = $("claim-email").value.trim();
  const reason = $("claim-reason").value.trim();

  $("claim-error").classList.add("hidden");

  // Claims now have to come from a recognized account (RLS: "signed-in
  // accounts can file a claim" requires reporter_id = auth.uid()) - same
  // reasoning as comments and follows, a typed name/email alone doesn't
  // prove anything since one email can back several accounts.
  if (!currentUser) {
    $("claim-error").textContent = "Sign in first (Me tab) to file a claim.";
    $("claim-error").classList.remove("hidden");
    return;
  }

  if (!name || !email || !reason) {
    $("claim-error").textContent = "Please fill in every field.";
    $("claim-error").classList.remove("hidden");
    return;
  }

  const submitBtn = $("btn-claim-submit");
  submitBtn.disabled = true;

  try {
    const { error } = await supabaseClient.from("claims").insert({
      clip_id: claimTargetClipId,
      reporter_id: currentUser.id,
      claimant_name: name,
      claimant_email: email,
      reason,
      claim_type: claimType
    });
    if (error) throw error;

    $("claim-fields").classList.add("hidden");
    $("claim-actions").classList.add("hidden");
    $("claim-success").textContent = "Report submitted. This clip is now hidden while our team reviews it.";
    $("claim-success").classList.remove("hidden");
    setTimeout(closeClaimModal, 1800);
  } catch (e) {
    $("claim-error").textContent = e.message || "Failed to submit report.";
    $("claim-error").classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Share a private clip with mutual followers ----------
let shareTargetClipIds = [];

async function getMutualFollowerProfiles() {
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabaseClient.from("follows").select("following_id").eq("follower_id", currentUser.id),
    supabaseClient.from("follows").select("follower_id").eq("following_id", currentUser.id)
  ]);
  const followingIds = new Set((following || []).map((f) => f.following_id));
  const mutualIds = (followers || [])
    .map((f) => f.follower_id)
    .filter((id) => followingIds.has(id));

  if (!mutualIds.length) return [];

  const { data: profiles } = await supabaseClient
    .from("profiles").select("id, username, display_name").in("id", mutualIds);
  return profiles || [];
}

function shareRowHtml(profile, isShared) {
  return `
    <div class="share-row" data-profile-id="${escapeHtml(profile.id)}">
      <span class="avatar">${initials(profile.display_name || profile.username)}</span>
      <span class="share-row-name">${escapeHtml(profile.display_name || profile.username)}</span>
      <button
        class="share-row-toggle"
        type="button"
        role="switch"
        aria-pressed="${isShared ? "true" : "false"}"
        aria-label="Share with ${escapeHtml(profile.display_name || profile.username)}"
      ></button>
    </div>`;
}

async function openShareModal(clipIds) {
  shareTargetClipIds = clipIds;
  $("share-error").classList.add("hidden");
  $("share-list").innerHTML = '<p class="share-empty">Loading mutual followers…</p>';
  $("share-modal-overlay").classList.remove("hidden");

  try {
    const [profiles, { data: existingShares, error }] = await Promise.all([
      getMutualFollowerProfiles(),
      supabaseClient.from("clip_shares").select("shared_with_id, clip_id").in("clip_id", clipIds)
    ]);
    if (error) throw error;

    if (!profiles.length) {
      $("share-list").innerHTML =
        '<p class="share-empty">Follow each other with someone first — only mutual followers can be given access.</p>';
      return;
    }

    // A list's clips are always shared/unshared together, so a person only
    // counts as "shared" here once every clip in this share target has been
    // shared with them.
    const sharedCounts = new Map();
    for (const row of existingShares || []) {
      sharedCounts.set(row.shared_with_id, (sharedCounts.get(row.shared_with_id) || 0) + 1);
    }

    $("share-list").innerHTML = profiles
      .map((p) => shareRowHtml(p, (sharedCounts.get(p.id) || 0) >= clipIds.length))
      .join("");
  } catch (e) {
    $("share-list").innerHTML = "";
    $("share-error").textContent = e.message || "Couldn't load your mutual followers.";
    $("share-error").classList.remove("hidden");
  }
}

function closeShareModal() {
  $("share-modal-overlay").classList.add("hidden");
  shareTargetClipIds = [];
}

$("btn-share-close").addEventListener("click", closeShareModal);

$("share-modal-overlay").addEventListener("click", (event) => {
  if (event.target === $("share-modal-overlay")) closeShareModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("share-modal-overlay").classList.contains("hidden")) {
    closeShareModal();
  }
});

$("share-list").addEventListener("click", async (event) => {
  const toggle = event.target.closest(".share-row-toggle");
  if (!toggle || !shareTargetClipIds.length) return;

  const profileId = toggle.closest(".share-row")?.dataset.profileId;
  if (!profileId) return;

  const nowShared = toggle.getAttribute("aria-pressed") !== "true";
  toggle.setAttribute("aria-pressed", nowShared ? "true" : "false");
  $("share-error").classList.add("hidden");

  try {
    if (nowShared) {
      const rows = shareTargetClipIds.map((clipId) => ({
        clip_id: clipId, owner_id: currentUser.id, shared_with_id: profileId
      }));
      const { error } = await supabaseClient.from("clip_shares").insert(rows);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from("clip_shares")
        .delete()
        .in("clip_id", shareTargetClipIds)
        .eq("shared_with_id", profileId);
      if (error) throw error;
    }
  } catch (e) {
    // Roll the toggle back so the UI never claims a state that didn't stick.
    toggle.setAttribute("aria-pressed", nowShared ? "false" : "true");
    $("share-error").textContent = e.message || "Couldn't update sharing. Try again.";
    $("share-error").classList.remove("hidden");
  }
});

async function loadSharedWithMe() {
  const el = $("shared-with-me-clips");
  if (!el) return;
  el.innerHTML = '<p class="muted">Loading…</p>';
  const { data, error } = await supabaseClient
    .from("clips_feed").select("*").eq("is_private", true).neq("author_id", currentUser.id).limit(50);
  if (error) {
    el.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    return;
  }
  el.innerHTML = data.length
    ? renderFeedRows(data, () => false, (id) => isClipFavorited(id))
    : '<p class="muted">No one has shared a private clip with you yet.</p>';
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
}

const SUMMARIZER_STOPWORDS = new Set([
  "the", "and", "a", "an", "in", "on", "for", "of", "to", "is", "it",
  "that", "this", "with", "as", "at", "by", "from", "or", "are", "was",
  "be", "been", "were", "but", "if", "so", "can", "may", "will", "has",
  "have", "had", "which", "their", "they", "its", "also"
]);

function scoreSentences(text) {
  const normalized = normalizeText(text).toLowerCase();
  const words = normalized.match(/\b[a-z0-9']+\b/g) || [];
  const frequencies = {};
  for (const word of words) {
    if (SUMMARIZER_STOPWORDS.has(word)) continue;
    frequencies[word] = (frequencies[word] || 0) + 1;
  }

  return splitSentences(text).map((sentence) => {
    const sentenceWords = sentence.toLowerCase().match(/\b[a-z0-9']+\b/g) || [];
    let score = 0;
    for (const word of sentenceWords) {
      if (frequencies[word]) score += frequencies[word];
    }
    return { sentence: sentence.trim(), score };
  });
}

function simplifySingleSentenceSummary(text) {
  const lowered = text.toLowerCase();
  if (lowered.includes("can refer to")) {
    return text.replace(/can refer to/gi, "can mean").replace(/,?\s*or it can be an?/gi, ", or");
  }
  if (lowered.includes("can mean")) {
    return text;
  }
  if (lowered.includes(" or ") && text.split(" or ").length <= 3) {
    return text.replace(/\s+or\s+/gi, " or ");
  }
  if (text.length > 120) {
    const cutoff = text.indexOf(",", Math.min(80, text.length - 1));
    return cutoff > 0 ? text.slice(0, cutoff) + "..." : text;
  }
  return text;
}

function truncateText(text, maxLength = 120) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength).replace(/\s+\S*$/, "");
  return truncated + "...";
}

function localSummarize(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { text: "No summary available.", html: false };
  }

  const parts = normalized.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const quote = parts[0] || "";
  const commentary = parts.slice(1).join(" ").trim();

  const scoreText = (input) => {
    const sentences = splitSentences(input).map((s) => s.trim()).filter(Boolean);
    if (sentences.length === 0) return "";
    if (sentences.length === 1) return simplifySingleSentenceSummary(sentences[0]);

    const scored = scoreSentences(input)
      .filter((item) => item.sentence.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((item) => item.sentence);

    return scored.join(" ");
  };

  if (commentary) {
    const summary = scoreText(commentary) || truncateText(commentary, 120);
    if (quote) {
      return {
        text: `This note explains the highlight: ${truncateText(summary, 120)}`,
        html: false
      };
    }
    return { text: `Summary: ${truncateText(summary, 120)}`, html: false };
  }

  const quoteSummary = scoreText(quote || normalized) || truncateText(normalized, 120);
  return { text: `Highlight: ${truncateText(quoteSummary, 120)}`, html: false };
}

function buildSearchFallbackHtml(noteText) {
  const query = noteText
    ? noteText
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .slice(0, 18)
        .join(" ")
    : "find this note";
  const searchUrl = "https://www.google.com/search?q=" + encodeURIComponent(query);
  return `AI summarization failed. <a href="${searchUrl}" target="_blank" rel="noopener">Search for it on Google</a>`;
}

function makeReviewPrompt(topic, notes) {
  const content = notes
    .map((clip, index) => `Clip ${index + 1}: "${clip.quoted_text || ""}" ${clip.commentary || ""}`)
    .join("\n\n");
  return topic
    ? `Give a complete review of the topic ${topic}. Use the notes as examples and explain how they relate to it.\n\nNotes:\n${content}`
    : `Give a complete review of these recent notes, explaining the main trends and key points clearly.\n\nNotes:\n${content}`;
}

async function reviewTopic(searchTerm) {
  clearReviewResult();
  const topic = searchTerm || "the current feed topic";
  const prompt = makeReviewPrompt(topic, []);
  showReviewResult("Review in progress...");
  try {
    const result = await fetchSummarization(prompt, topic);
    showReviewResult(result.text || "No review available.");
  } catch (err) {
    console.error("ClipRoots: topic review failed", err);
    showReviewResult("Topic review failed. Try again later.");
  }
}

async function reviewRecentNotes() {
  clearReviewResult();
  showReviewResult("Preparing recent notes review...");
  try {
    const query = supabaseClient.from("clips_feed").select("*").order("created_at", { ascending: false }).limit(5);
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      showReviewResult("No recent notes available for review.");
      return;
    }
    const prompt = makeReviewPrompt("recent notes", data);
    const result = await fetchSummarization(prompt, prompt);
    showReviewResult(result.text || "No review available.");
  } catch (err) {
    console.error("ClipRoots: recent notes review failed", err);
    showReviewResult("Recent notes review failed. Try again later.");
  }
}

async function callGoogleSummarization(prompt) {
  return localSummarize(prompt).text;
}

function parseSearchResults(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const results = [];
  const anchors = [...doc.querySelectorAll("a[href^='http']")];
  for (const anchor of anchors) {
    const href = anchor.href || anchor.getAttribute("href");
    if (!href || !href.startsWith("http")) continue;
    const text = anchor.textContent.trim();
    if (!text || text.toLowerCase().includes("duckduckgo") || text.toLowerCase().includes("search")) continue;
    results.push({ url: href, snippet: text });
    if (results.length >= 3) break;
  }
  return results;
}

async function fetchPageText(url, charLimit = 4000) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const texts = [...doc.querySelectorAll("p, h1, h2, h3, li")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);
    const combined = texts.join(" ").replace(/\s+/g, " ").trim();
    return combined.slice(0, charLimit);
  } catch (err) {
    return null;
  }
}

async function searchAndSummarize(query) {
  const searchUrl = `https://html.duckduckgo.com/html?q=${encodeURIComponent(query)}`;
  let searchHtml;
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error("Search request failed.");
    searchHtml = await response.text();
  } catch (err) {
    return localSummarize(query);
  }

  const results = parseSearchResults(searchHtml);
  if (!results.length) {
    return localSummarize(query);
  }

  const pageText = await fetchPageText(results[0].url) || results[0].snippet;
  if (!pageText) {
    return localSummarize(query);
  }

  const searchPrompt = `Use the following search result content to answer the query and summarize the main point in one short paragraph:\n\nSearch query: ${query}\n\nResult URL: ${results[0].url}\n\nContent:\n${pageText}`;
  try {
    const summary = await callGoogleSummarization(searchPrompt);
    return { text: summary, html: false };
  } catch (err) {
    return localSummarize(query);
  }
}

async function fetchSummarization(prompt, noteText) {
  const query = noteText || prompt;
  const proxyUrl = cfg.AI_PROXY_URL ? cfg.AI_PROXY_URL.replace(/\/$/, "") : null;

  if (proxyUrl) {
    try {
      const response = await fetch(`${proxyUrl}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, noteText: query })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.summary === "string" && data.summary.trim()) {
          return { text: data.summary.trim(), html: false };
        }
      } else {
        console.warn("ClipRoots: AI proxy responded with error", response.status, await response.text());
      }
    } catch (err) {
      console.warn("ClipRoots: AI proxy request failed", err);
    }
  }

  return localSummarize(query);
}

// ---------- Boot ----------
(async function init() {
  await refreshSession();
  const initialPending = await loadPendingList();
  if (initialPending.length) {
    goTo("compose");
  } else if (currentUser) {
    goTo("feed");
  } else {
    goTo("feed"); // feed is publicly viewable even signed out
  }
})();