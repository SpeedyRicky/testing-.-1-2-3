// Compose flow: pick up a captured clip, let the user add a take,
// publish it, or discard it.

import {
  supabaseClient, currentUser, pendingClip, setPendingClip, $, slugify,
  isProUser, formatSeconds, getYouTubeEmbedUrl, webappUrl
} from "./state.js";
import { showView, showToast } from "./ui.js";

const { MESSAGE, STORAGE_KEY } = window.ClipMarginalConstants;
const { sendRuntimeMessage } = window.ClipMarginalRuntime;
const { get: storageGet } = window.ClipMarginalStorage;
const { validateClip } = window.ClipMarginalClipModel;
const { toUserMessage } = window.ClipMarginalErrors;

export async function loadPendingClip() {
  const res = await sendRuntimeMessage({ type: MESSAGE.GET_PENDING_CLIP });
  if (res?.payload) {
    return res.payload;
  }
  const savedClip = await storageGet(STORAGE_KEY.PENDING_CLIP);
  return savedClip || null;
}

function renderTextClip() {
  $("compose-text-block").classList.remove("hidden");
  $("compose-video-block").classList.add("hidden");
  $("compose-pro-upsell").classList.add("hidden");
  $("compose-fields").classList.remove("hidden");

  $("compose-quote").textContent = pendingClip.quotedText;
  $("compose-source-domain").textContent = pendingClip.sourceDomain;
  $("compose-source-link").href = pendingClip.sourceUrl;
}

function renderVideoClip() {
  $("compose-text-block").classList.add("hidden");

  if (!isProUser()) {
    $("compose-video-block").classList.add("hidden");
    $("compose-fields").classList.add("hidden");
    $("compose-pro-upsell").classList.remove("hidden");
    $("btn-upgrade-pro").href = webappUrl ? `${webappUrl}/pro` : "#";
    return;
  }

  $("compose-pro-upsell").classList.add("hidden");
  $("compose-fields").classList.remove("hidden");
  $("compose-video-block").classList.remove("hidden");

  const embedUrl = getYouTubeEmbedUrl(
    pendingClip.sourceUrl,
    pendingClip.videoStartSeconds,
    pendingClip.videoEndSeconds
  );

  $("compose-video-embed").innerHTML = embedUrl
    ? `<iframe src="${embedUrl}" title="Video clip preview" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    : "";

  $("compose-video-range").textContent =
    `${formatSeconds(pendingClip.videoStartSeconds)} – ${formatSeconds(pendingClip.videoEndSeconds)}`;
  $("compose-video-domain").textContent = pendingClip.sourceDomain;
  $("compose-video-link").href = pendingClip.sourceUrl;
}

export async function renderCompose() {
  if (!currentUser) {
    showView("auth");
    return;
  }
  setPendingClip(await loadPendingClip());
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

  if (pendingClip.type === "video") {
    renderVideoClip();
  } else {
    renderTextClip();
  }

  $("compose-commentary").value = "";
  updateCommentCount();
}

// The "0 / 5000" label next to the textarea existed in the HTML but
// nothing ever updated it - it just always said "0 / 5000" regardless
// of what was typed.
function updateCommentCount() {
  const textarea = $("compose-commentary");
  const counter = $("comment-count");
  if (!textarea || !counter) return;
  const max = Number(textarea.getAttribute("maxlength")) || 5000;
  counter.textContent = `${textarea.value.length} / ${max}`;
}

export function initCompose() {
  $("compose-commentary").addEventListener("input", updateCommentCount);

  // "How it works" existed as a button with no click handler at all -
  // reusing the exact instructional copy already shown in this same
  // empty state, rather than inventing new product copy for it.
  $("compose-help")?.addEventListener("click", () => {
    showToast("Highlight text on any webpage, then click “Clip this” to bring it here.");
  });

  $("btn-discard").addEventListener("click", () => {
    void sendRuntimeMessage({ type: MESSAGE.CLEAR_PENDING_CLIP });
    setPendingClip(null);
    renderCompose();
  });

  // Same discard action, reachable from the Pro upsell screen so a
  // free user who captured a video clip isn't stuck looking at it.
  $("btn-discard-video-upsell")?.addEventListener("click", () => {
    void sendRuntimeMessage({ type: MESSAGE.CLEAR_PENDING_CLIP });
    setPendingClip(null);
    renderCompose();
  });

  const publishButton = $("btn-publish");
  let publishing = false;

  publishButton.addEventListener("click", async () => {
    if (publishing || !pendingClip || !currentUser) return;
    const commentary = $("compose-commentary").value.trim();
    $("compose-error").classList.add("hidden");

    if (!validateClip(pendingClip)) {
      $("compose-error").textContent = "This clip is missing its quote or source - discard it and try again.";
      $("compose-error").classList.remove("hidden");
      return;
    }

    if (pendingClip.type === "video" && !isProUser()) {
      // Belt-and-braces: the UI already gates this in renderCompose(),
      // but publishButton could still be reachable via a stale render.
      // The real enforcement is the RLS policy on clips (see the
      // supabase/migrations video-clips SQL) - this is just a clear
      // error rather than a confusing RLS rejection if it's ever hit.
      $("compose-error").textContent = "Upgrade to Pro to publish video clips.";
      $("compose-error").classList.remove("hidden");
      return;
    }

    publishing = true;
    publishButton.disabled = true;
    publishButton.textContent = "Publishing…";

    const insertPayload = {
      slug: slugify(),
      user_id: currentUser.id,
      source_url: pendingClip.sourceUrl,
      source_title: pendingClip.sourceTitle,
      source_domain: pendingClip.sourceDomain,
      commentary,
      clip_type: pendingClip.type === "video" ? "video" : "text"
    };

    if (pendingClip.type === "video") {
      insertPayload.quoted_text = "";
      insertPayload.video_start_seconds = pendingClip.videoStartSeconds;
      insertPayload.video_end_seconds = pendingClip.videoEndSeconds;
    } else {
      insertPayload.quoted_text = pendingClip.quotedText;
    }

    try {
      const { error } = await supabaseClient.from("clips").insert(insertPayload);
      if (error) throw error;

      void sendRuntimeMessage({ type: MESSAGE.CLEAR_PENDING_CLIP });
      setPendingClip(null);
      $("compose-success").textContent = "Published! Check the Feed tab.";
      $("compose-success").classList.remove("hidden");
      $("compose-form").classList.add("hidden");
      setTimeout(() => renderCompose(), 1200);
    } catch (e) {
      console.error("[ClipMarginal] publish failed:", e);
      $("compose-error").textContent = toUserMessage(e, "Couldn't publish your clip. Please try again.");
      $("compose-error").classList.remove("hidden");
    } finally {
      publishing = false;
      publishButton.disabled = false;
      publishButton.textContent = "Publish clip";
    }
  });
}
