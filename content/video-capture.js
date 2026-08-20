"use strict";

// Video/audio clip capture: finds a reasonably-sized <video> element, or
// any visible <audio> element (podcast/audio embeds), and lets the user
// mark a start/end point, up to LIMITS.MAX_VIDEO_CLIP_SECONDS, then
// hands the result to the same NEW_CLIP message flow text-capture.js
// uses. Both media types share one button/state machine - an audio
// clip is stored exactly like a video clip (same clip_type: "video" DB
// row, same videoStartSeconds/videoEndSeconds range), just without a
// thumbnail, since the schema and feed UI don't distinguish "video" vs
// "audio" as separate first-class types.
//
// This only ever records a timestamp range plus the page URL - it never
// reads video.src/audio.src, never downloads a frame or byte of media,
// and never re-hosts anything. Playback of a published clip happens
// through the original site's own player (see getYouTubeEmbedUrl() in
// sidepanel/state.js), same as clicking a timestamped link. That's a
// deliberate choice, not an oversight: downloading/re-hosting media is
// both a copyright and a Chrome Web Store policy risk that a
// timestamp-only reference avoids entirely.

(function (root) {
  const BUTTON_ID = "clipmarginal-video-clip-btn";
  const TOAST_ID = "clipmarginal-toast";
  const MIN_VIDEO_WIDTH = 120;
  const MIN_VIDEO_HEIGHT = 80;
  const MIN_AUDIO_WIDTH = 100;
  const MIN_AUDIO_HEIGHT = 20;
  const MIN_CLIP_SECONDS = 1;
  const SCAN_INTERVAL_MS = 500;

  const { MESSAGE, LIMITS } = root.ClipMarginalConstants;
  const { sendRuntimeMessage, isExtensionContextValid } = root.ClipMarginalRuntime;
  const { appendPendingClip } = root.ClipMarginalStorage;
  const { createVideoClip, validateClip } = root.ClipMarginalClipModel;
  const { clampVideoRange } = root.ClipMarginalValidation;

  let attached = false;
  let button = null;
  let activeVideo = null;
  let capturing = false;
  let startSeconds = 0;
  let autoStopTimer = null;

  function showToast(message) {
    const existing = document.getElementById(TOAST_ID);

    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");

    toast.id = TOAST_ID;
    toast.textContent = message;

    document.documentElement.appendChild(toast);

    setTimeout(() => {
      try {
        toast.remove();
      } catch {}
    }, 2800);
  }

  // A still frame is enough to show what was clipped without re-hosting
  // any video bytes (see the header comment above for why we never
  // download/store the media itself). YouTube's player pixels are
  // DRM/MSE-protected and can't be read into a canvas at all, so YouTube
  // gets its own public video-thumbnail image instead; every other site
  // gets a genuine downscaled capture of the current frame, best-effort
  // since a cross-origin, non-CORS video will also throw.
  function getYouTubeVideoId() {
    try {
      const url = new URL(window.location.href);
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        return url.pathname.slice(1) || null;
      }
      if (host === "youtube.com" || host === "m.youtube.com") {
        return url.searchParams.get("v");
      }
    } catch {}
    return null;
  }

  function captureThumbnail(media) {
    if (media.tagName !== "VIDEO") {
      // Audio has no frame to capture - the feed/compose UI already
      // treats a missing thumbnailUrl as "no thumbnail" for video
      // clips, so this falls back to the same timestamp-badge-only
      // rendering an audio clip should have.
      return null;
    }

    const youtubeId = getYouTubeVideoId();
    if (youtubeId) {
      return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    if (!media.videoWidth) {
      return null;
    }

    try {
      const MAX_WIDTH = 320;
      const scale = Math.min(1, MAX_WIDTH / media.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(media.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(media.videoHeight * scale));

      const ctx = canvas.getContext("2d");
      ctx.drawImage(media, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL("image/jpeg", 0.6);
    } catch {
      // Cross-origin video without permissive CORS headers taints the
      // canvas - toDataURL() throws a SecurityError. Fall back to no
      // thumbnail rather than blocking the clip on it.
      return null;
    }
  }

  function isVisibleMedia(el, minWidth, minHeight) {
    const rect = el.getBoundingClientRect();
    return rect.width >= minWidth && rect.height >= minHeight;
  }

  function findCandidateMedia() {
    const videos = Array.from(document.querySelectorAll("video"));
    const candidateVideo = videos.find((video) => isVisibleMedia(video, MIN_VIDEO_WIDTH, MIN_VIDEO_HEIGHT));
    if (candidateVideo) {
      return candidateVideo;
    }

    const audios = Array.from(document.querySelectorAll("audio"));
    return audios.find((audio) => isVisibleMedia(audio, MIN_AUDIO_WIDTH, MIN_AUDIO_HEIGHT)) || null;
  }

  function positionButton(media) {
    if (!button || !media) {
      return;
    }

    const rect = media.getBoundingClientRect();

    button.style.left = `${Math.max(8, rect.right - 158)}px`;
    button.style.top = `${Math.max(8, rect.bottom - 46)}px`;
  }

  function isAudio(media) {
    return media?.tagName === "AUDIO";
  }

  function renderButtonLabel() {
    if (!button) {
      return;
    }

    const label = isAudio(activeVideo) ? "audio" : "video";

    if (capturing) {
      const elapsed = Math.max(0, Math.round((activeVideo?.currentTime || 0) - startSeconds));
      button.textContent = `⏹ Stop (${elapsed}s)`;
      button.classList.add("recording");
    } else {
      button.textContent = label === "audio" ? "🎧 Clip audio" : "🎬 Clip video";
      button.classList.remove("recording");
    }
  }

  function resetCaptureState() {
    capturing = false;
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
    renderButtonLabel();
  }

  async function finishCapture() {
    const media = activeVideo;

    if (!capturing || !media) {
      resetCaptureState();
      return;
    }

    const label = isAudio(media) ? "Audio" : "Video";
    const { start, end } = clampVideoRange(startSeconds, media.currentTime);

    resetCaptureState();

    if (end - start < MIN_CLIP_SECONDS) {
      showToast("Clip too short — let it play a bit longer before stopping.");
      return;
    }

    if (!isExtensionContextValid()) {
      showToast("ClipMarginal was updated. Please reload this page.");
      return;
    }

    const clip = createVideoClip({
      sourceUrl: window.location.href,
      sourceTitle: document.title?.trim().slice(0, 500) || window.location.hostname,
      sourceDomain: window.location.hostname,
      videoStartSeconds: start,
      videoEndSeconds: end,
      thumbnailUrl: captureThumbnail(media)
    });

    if (!validateClip(clip)) {
      showToast(`Couldn't capture that ${label.toLowerCase()} clip. Try again.`);
      return;
    }

    // Append first so the clip is never lost even if the background
    // worker is momentarily unreachable - the message below is what
    // wakes the panel up, but the list itself lives in storage.
    await appendPendingClip(clip);

    const response = await sendRuntimeMessage({
      type: MESSAGE.NEW_CLIP,
      payload: clip
    });

    showToast(
      response?.ok
        ? `${label} clip added to your list — opening ClipMarginal…`
        : `${label} clip added to your list. Open ClipMarginal from the toolbar.`
    );

    void sendRuntimeMessage({
      type: MESSAGE.OPEN_PANEL
    });
  }

  function startCapture() {
    if (!activeVideo) {
      return;
    }

    capturing = true;
    startSeconds = activeVideo.currentTime || 0;
    renderButtonLabel();

    // Auto-stop at the max clip length so a forgotten "recording" state
    // can't silently grow into an invalid (too-long) clip.
    autoStopTimer = setTimeout(() => {
      void finishCapture();
    }, LIMITS.MAX_VIDEO_CLIP_SECONDS * 1000);
  }

  function createButton() {
    if (button) {
      return;
    }

    button = document.createElement("button");

    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "Clip this video or audio with ClipMarginal");

    renderButtonLabel();

    button.addEventListener(
      "mousedown",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (capturing) {
        void finishCapture();
      } else {
        startCapture();
      }
    });

    document.documentElement.appendChild(button);
  }

  function removeButton() {
    if (!button) {
      return;
    }

    try {
      button.remove();
    } catch {}

    button = null;
  }

  function tick() {
    const media = findCandidateMedia();

    if (!media) {
      // Don't tear down mid-capture just because the element briefly
      // disappears from the DOM (some players swap the node on
      // fullscreen toggle) - only clear state when we're not capturing.
      if (!capturing) {
        activeVideo = null;
        removeButton();
      }
      return;
    }

    if (media !== activeVideo && !capturing) {
      activeVideo = media;
    }

    createButton();
    positionButton(activeVideo || media);
    renderButtonLabel();
  }

  function attach() {
    if (attached) {
      return;
    }
    attached = true;

    setInterval(tick, SCAN_INTERVAL_MS);

    window.addEventListener("scroll", () => positionButton(activeVideo), { passive: true });
    window.addEventListener("resize", () => positionButton(activeVideo), { passive: true });
  }

  root.ClipMarginalVideoCapture = Object.freeze({
    attach
  });
})(self);
