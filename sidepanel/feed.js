// Feed, profile ("Me"), favorites, and the AI summarize/review panel.

import {
  supabaseClient, currentUser, currentProfile, cfg,
  $, escapeHtml, initials, formatSeconds, getYouTubeEmbedUrl
} from "./state.js";
import { refreshSession } from "./auth.js";

let feedScope = "all";
let feedSort = "newest";

const FAVORITE_STORAGE_PREFIX = "clipper_favorites_";

// ---------- Favorites (per-browser-profile, not synced) ----------
function getFavoriteStorageKey() {
  return `${FAVORITE_STORAGE_PREFIX}${currentUser?.id || "anon"}`;
}

function readFavoriteClips() {
  try {
    const raw = window.localStorage.getItem(getFavoriteStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Clipper: failed to read favorites", err);
    return [];
  }
}

function saveFavoriteClips(clips) {
  try {
    window.localStorage.setItem(getFavoriteStorageKey(), JSON.stringify(clips));
  } catch (err) {
    console.warn("Clipper: failed to save favorites", err);
  }
}

function isClipFavorited(id) {
  return readFavoriteClips().some((clip) => clip.id === id);
}

function toggleClipFavorite(clip) {
  const favorites = readFavoriteClips();
  const existing = favorites.find((item) => item.id === clip.id);
  const updated = existing
    ? favorites.filter((item) => item.id !== clip.id)
    : [...favorites.filter((item) => item.id !== clip.id), clip];
  saveFavoriteClips(updated);
  return !existing;
}

// ---------- Review panel ----------
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

function setSortActive() {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sort === feedSort);
  });
}

// ---------- Card rendering ----------
function videoClipBodyHtml(c) {
  const embedUrl = getYouTubeEmbedUrl(c.source_url, c.video_start_seconds, c.video_end_seconds);
  const range = `${formatSeconds(c.video_start_seconds)} – ${formatSeconds(c.video_end_seconds)}`;

  if (embedUrl) {
    return `
      <div class="video-badge">🎬 Video clip · ${range}</div>
      <div class="video-embed">
        <iframe src="${embedUrl}" title="Video clip" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>`;
  }

  return `
    <div class="video-badge">🎬 Video clip · ${range}</div>
    <a class="video-fallback-link" href="${escapeHtml(c.source_url || "#")}" target="_blank" rel="noopener noreferrer">
      ▶ Watch this clip on ${escapeHtml(c.source_domain || "the source site")}
    </a>`;
}

function clipCardHtml(c, showDelete = false, isFavorite = false) {
  const claimBadge = c.claim_status === "filed"
    ? '<span class="claim-badge">Claim filed</span>' : "";
  const isVideo = c.clip_type === "video";
  const bodyHtml = isVideo
    ? videoClipBodyHtml(c)
    : `<blockquote>"${escapeHtml(c.quoted_text)}"</blockquote>`;

  return `
    <div class="clip-card" data-clip-id="${escapeHtml(c.id)}" data-clip-type="${isVideo ? "video" : "text"}" data-source-url="${escapeHtml(c.source_url || "")}" data-video-start="${c.video_start_seconds ?? ""}" data-video-end="${c.video_end_seconds ?? ""}">
      <div class="author-row">
        <span class="avatar">${initials(c.author_display_name || c.author_username)}</span>
        ${escapeHtml(c.author_display_name || c.author_username)}
      </div>
      ${bodyHtml}
      ${c.commentary ? `<div class="commentary">${escapeHtml(c.commentary)}</div>` : ""}
      <div class="card-actions">
        <button class="btn ghost" type="button" data-action="summary">Summarize note</button>
        <button class="btn ghost" type="button" data-action="favorite">${isFavorite ? 'Unfavorite' : 'Favorite'}</button>
        ${showDelete ? '<button class="btn ghost" type="button" data-action="delete">Delete note</button>' : ''}
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

// ---------- Loading ----------
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
  clearReviewResult();
}

export async function loadFeed(searchTerm = "") {
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

    if (feedSort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (feedSort === "oldest") {
      query = query.order("created_at", { ascending: true });
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
  } catch (e) {
    $("feed-list").innerHTML = `<p class="error">${escapeHtml(e.message || "Failed to load feed.")}</p>`;
  }
}

export async function loadMe(searchTerm = "") {
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
}

// ---------- Local (non-AI) summarizer, used when the AI proxy is
// unreachable/unconfigured ----------
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
        console.warn("Clipper: AI proxy responded with error", response.status, await response.text());
      }
    } catch (err) {
      console.warn("Clipper: AI proxy request failed", err);
    }
  }

  return localSummarize(query);
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
    console.error("Clipper: topic review failed", err);
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
    console.error("Clipper: recent notes review failed", err);
    showReviewResult("Recent notes review failed. Try again later.");
  }
}

// ---------- Card actions, wired once via delegation instead of
// re-attaching a listener per button on every render (the old
// per-render attachSummaryButtons()/attachFavoriteButtons() pair
// double-attached favorite listeners - attachSummaryButtons called
// attachFavoriteButtons internally, and loadFeed called both). ----------
async function handleSummaryAction(clipCard) {
  const summaryBlock = clipCard.querySelector(".summary-block");
  const summaryText = clipCard.querySelector(".summary-text");
  // Video clips have no blockquote - querySelector() returns null, so
  // this has to be optional-chained rather than assumed present.
  const quote = clipCard.querySelector("blockquote")?.textContent || "";
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
    console.error("Clipper: summarization failed", err);
    summaryText.innerHTML = buildSearchFallbackHtml(noteText);
  }
}

function handleFavoriteAction(clipCard, button) {
  const clipId = clipCard.dataset.clipId;
  if (!clipId) return;
  const quote = clipCard.querySelector("blockquote")?.textContent || "";
  const commentary = clipCard.querySelector(".commentary")?.textContent || "";
  const clip = {
    id: clipId,
    clip_type: clipCard.dataset.clipType || "text",
    quoted_text: quote.replace(/^"|"$/g, ""),
    commentary,
    source_url: clipCard.dataset.sourceUrl || "",
    source_domain: clipCard.querySelector(".meta-row span")?.textContent || "",
    author_display_name: clipCard.querySelector(".author-row")?.textContent || "",
    author_username: "",
    slug: "",
    video_start_seconds: clipCard.dataset.videoStart ? Number(clipCard.dataset.videoStart) : null,
    video_end_seconds: clipCard.dataset.videoEnd ? Number(clipCard.dataset.videoEnd) : null
  };
  const isNowFavorite = toggleClipFavorite(clip);
  button.textContent = isNowFavorite ? "Unfavorite" : "Favorite";
  if (feedSort === "favorites" && !isNowFavorite) {
    loadFavoriteFeed($("feed-search").value.trim());
  }
}

async function handleDeleteAction(clipCard) {
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
}

export function initFeed() {
  const feedSearchInput = $("feed-search");
  const feedSearchButton = $("feed-search-btn");
  const meSearchInput = $("me-search");
  const meSearchButton = $("me-search-btn");
  const feedRefreshButton = $("feed-refresh");

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

  // Neither search input lives inside a <form>, so pressing Enter did
  // nothing at all before this - not even the reload-the-page bug the
  // auth form had, just silently no-op. Wire it to match what typing
  // in a search box and hitting Enter should do.
  feedSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadFeed(feedSearchInput.value.trim());
    }
  });

  feedRefreshButton?.addEventListener("click", () => {
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

  meSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadMe(meSearchInput.value.trim());
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const clipCard = button.closest(".clip-card");
    if (!clipCard) return;

    const action = button.dataset.action;
    if (action === "summary") {
      void handleSummaryAction(clipCard);
    } else if (action === "favorite") {
      handleFavoriteAction(clipCard, button);
    } else if (action === "delete") {
      void handleDeleteAction(clipCard);
    }
  });
}
