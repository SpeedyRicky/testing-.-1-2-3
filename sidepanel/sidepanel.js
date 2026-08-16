
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

let currentUser = null;
let currentProfile = null;
let pendingClip = null;
let isSignupMode = false;
let feedScope = "all";
let feedSort = "newest";

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

const MAX_VIDEO_CLIP_SECONDS = 90;

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

function readPendingClipFromStorage() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === "function") {
      chrome.storage.local.get(["cliproots_pending_clip"], (result) => {
        resolve(result?.cliproots_pending_clip || null);
      });
    } else {
      resolve(null);
    }
  });
}

// ---------- Compose ----------
async function loadPendingClip() {
  return new Promise((resolve) => {
    sendPanelMessage({ type: "CLIPROOTS_GET_PENDING_CLIP" }, async (res) => {
      if (res?.payload) {
        resolve(res.payload);
        return;
      }
      const savedClip = await readPendingClipFromStorage();
      resolve(savedClip || null);
    });
  });
}

async function renderCompose() {
  if (!currentUser) {
    showView("auth");
    return;
  }
  pendingClip = await loadPendingClip();
  showView("compose");
  $("compose-error").classList.add("hidden");
  $("compose-success").classList.add("hidden");

  if (!pendingClip) {
    $("compose-empty").classList.remove("hidden");
    $("compose-form").classList.add("hidden");
    return;
  }
  $("compose-empty").classList.add("hidden");
  $("compose-form").classList.remove("hidden");

  const isVideo = pendingClip.clipType === "video";
  $("compose-video-badge").classList.toggle("hidden", !isVideo);
  $("compose-quote").classList.toggle("hidden", isVideo);
  const thumbnail = $("compose-video-thumbnail");
  if (isVideo && pendingClip.thumbnailUrl) {
    thumbnail.src = pendingClip.thumbnailUrl;
    thumbnail.classList.remove("hidden");
  } else {
    thumbnail.classList.add("hidden");
    thumbnail.src = "";
  }
  if (isVideo) {
    $("compose-video-badge").textContent =
      `▶ ${formatClipTime(pendingClip.videoStartSeconds)} – ${formatClipTime(pendingClip.videoEndSeconds)}`;
  } else {
    $("compose-quote").textContent = pendingClip.quotedText;
  }

  $("compose-source-domain").textContent = pendingClip.sourceDomain;
  $("compose-source-link").href = pendingClip.sourceUrl;
  $("compose-commentary").value = "";
}

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
  sendPanelMessage({ type: "CLIPROOTS_CLEAR_PENDING_CLIP" });
  pendingClip = null;
  renderCompose();
});

$("btn-publish").addEventListener("click", async () => {
  if (!pendingClip || !currentUser) return;
  const commentary = $("compose-commentary").value.trim();
  $("compose-error").classList.add("hidden");

  const isVideo = pendingClip.clipType === "video";

  if (isVideo) {
    const start = pendingClip.videoStartSeconds;
    const end = pendingClip.videoEndSeconds;
    if (
      typeof start !== "number" || typeof end !== "number" ||
      !(end > start) || end - start > MAX_VIDEO_CLIP_SECONDS + 0.5
    ) {
      $("compose-error").textContent = "This clip is longer than the 90-second limit.";
      $("compose-error").classList.remove("hidden");
      return;
    }
  }

  try {
    const { error } = await supabaseClient.from("clips").insert({
      slug: slugify(),
      user_id: currentUser.id,
      source_url: pendingClip.sourceUrl,
      source_title: pendingClip.sourceTitle,
      source_domain: pendingClip.sourceDomain,
      clip_type: isVideo ? "video" : "text",
      quoted_text: isVideo ? "" : pendingClip.quotedText,
      video_start_seconds: isVideo ? pendingClip.videoStartSeconds : null,
      video_end_seconds: isVideo ? pendingClip.videoEndSeconds : null,
      thumbnail_url: isVideo ? pendingClip.thumbnailUrl || null : null,
      commentary
    });
    if (error) throw error;

    sendPanelMessage({ type: "CLIPROOTS_CLEAR_PENDING_CLIP" });
    pendingClip = null;
    $("compose-success").textContent = "Published! Check the Feed tab.";
    $("compose-success").classList.remove("hidden");
    $("compose-form").classList.add("hidden");
    setTimeout(() => renderCompose(), 1200);
  } catch (e) {
    const raw = e.message || "";
    $("compose-error").textContent = /row-level security policy/i.test(raw)
      ? "You don't have permission to publish this clip."
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

function clipCardHtml(c, showDelete = false, isFavorite = false) {
  const link = `${webappUrl}/clip.html?slug=${encodeURIComponent(c.slug)}`;
  const claimBadge = c.claim_status === "filed"
    ? '<span class="claim-badge">Claim filed</span>' : "";
  const isVideo = c.clip_type === "video";
  const thumbnailBlock = isVideo && c.thumbnail_url
    ? `<img class="video-thumbnail" src="${escapeHtml(c.thumbnail_url)}" alt="Captured video frame" />`
    : "";
  const quoteBlock = isVideo
    ? `<a class="video-range-badge" href="${escapeHtml(videoSourceLink(c))}" target="_blank" rel="noopener noreferrer">▶ ${formatClipTime(c.video_start_seconds)} – ${formatClipTime(c.video_end_seconds)}</a>`
    : `<blockquote>"${escapeHtml(c.quoted_text)}"</blockquote>`;
  return `
    <div class="clip-card" data-clip-id="${escapeHtml(c.id)}">
      <div class="author-row">
        <span class="avatar">${initials(c.author_display_name || c.author_username)}</span>
        ${escapeHtml(c.author_display_name || c.author_username)}
      </div>
      ${thumbnailBlock}
      ${quoteBlock}
      ${c.commentary ? `<div class="commentary">${escapeHtml(c.commentary)}</div>` : ""}
      <div class="card-actions">
        <button class="btn ghost summary-btn" type="button">Summarize note</button>
        <button class="btn ghost favorite-btn" type="button">${isFavorite ? 'Unfavorite' : 'Favorite'}</button>
        ${showDelete ? '<button class="btn ghost delete-btn" type="button">Delete note</button>' : ''}
      </div>
      <div class="summary-block hidden">
        <strong>Summary</strong>
        <p class="summary-text"></p>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(c.source_domain || "")} ${claimBadge}</span>
      </div>
    </div>`;
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
  $("feed-list").innerHTML = filtered
    .map((clip) => clipCardHtml(clip, currentUser && clip.author_id === currentUser.id, true))
    .join("");
  attachSummaryButtons();
  attachFavoriteButtons();
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
    let query = supabaseClient.from("clips_feed").select("*").limit(30);

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
    $("feed-list").innerHTML = data
      .map((clip) => clipCardHtml(clip, currentUser && clip.author_id === currentUser.id, isClipFavorited(clip.id)))
      .join("");
    attachSummaryButtons();
    attachFavoriteButtons();
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
    ? data.map((clip) => clipCardHtml(clip, true)).join("")
    : '<p class="muted">You haven\'t published a clip yet.</p>';
  attachSummaryButtons();
}

// ---------- React to new clips captured while panel is open ----------
const panelRuntime = getExtensionRuntime();
if (panelRuntime && panelRuntime.onMessage && typeof panelRuntime.onMessage.addListener === "function") {
  panelRuntime.onMessage.addListener((message) => {
    if (message.type === "CLIPROOTS_PENDING_CLIP_UPDATED") {
      pendingClip = message.payload;
      goTo("compose");
    }
  });
}

function attachSummaryButtons() {
  document.querySelectorAll(".summary-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const clipCard = event.target.closest(".clip-card");
      if (!clipCard) return;
      const summaryBlock = clipCard.querySelector(".summary-block");
      const summaryText = clipCard.querySelector(".summary-text");
      const quote = clipCard.querySelector("blockquote")?.textContent
        || clipCard.querySelector(".video-range-badge")?.textContent
        || "";
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
    });
  });

  attachFavoriteButtons();

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const clipCard = event.target.closest(".clip-card");
      if (!clipCard) return;
      const clipId = clipCard.dataset.clipId;
      if (!clipId) return;

      if (!confirm("Delete this note for everyone? This cannot be undone.")) {
        return;
      }

      try {
        const { error } = await supabaseClient
          .from("clips")
          .delete()
          .eq("id", clipId)
          .eq("user_id", currentUser.id);

        if (error) throw error;
        clipCard.remove();
      } catch (err) {
        alert(err?.message || "Failed to delete note.");
      }
    });
  });
}

function attachFavoriteButtons() {
  document.querySelectorAll(".favorite-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const clipCard = event.target.closest(".clip-card");
      if (!clipCard) return;
      const clipId = clipCard.dataset.clipId;
      if (!clipId) return;
      const quote = clipCard.querySelector("blockquote")?.textContent || "";
      const videoRange = clipCard.querySelector(".video-range-badge")?.textContent || "";
      const commentary = clipCard.querySelector(".commentary")?.textContent || "";
      const clip = {
        id: clipId,
        quoted_text: quote.replace(/^"|"$/g, ""),
        clip_type: videoRange ? "video" : "text",
        commentary,
        source_domain: clipCard.querySelector(".meta-row span")?.textContent || "",
        author_display_name: clipCard.querySelector(".author-row")?.textContent || "",
        author_username: "",
        slug: "",
      };
      const isNowFavorite = toggleClipFavorite(clip);
      button.textContent = isNowFavorite ? "Unfavorite" : "Favorite";
      if (feedSort === "favorites" && !isNowFavorite) {
        loadFavoriteFeed($("feed-search").value.trim());
      }
    });
  });
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
  const initialPending = await loadPendingClip();
  if (initialPending) {
    goTo("compose");
  } else if (currentUser) {
    goTo("feed");
  } else {
    goTo("feed"); // feed is publicly viewable even signed out
  }
})();