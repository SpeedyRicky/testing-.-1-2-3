"use strict";

// Video clip capture: finds a reasonably-sized <video> element on the
// page and lets the user mark a start/end point, up to
// LIMITS.MAX_VIDEO_CLIP_SECONDS, then hands the result to the same
// NEW_CLIP message flow text-capture.js uses.
//
// This only ever records a timestamp range plus the page URL - it never
// reads video.src, never downloads a frame or byte of media, and never
// re-hosts anything. Playback of a published video clip happens through
// the original site's own player (see getYouTubeEmbedUrl() in
// sidepanel/state.js), same as clicking a timestamped link. That's a
// deliberate choice, not an oversight: downloading/re-hosting video is
// both a copyright and a Chrome Web Store policy risk that a
// timestamp-only reference avoids entirely.

(function (root) {
  const BUTTON_ID = "clipmarginal-video-clip-btn";
  const TOAST_ID = "clipmarginal-toast";
  const MIN_VIDEO_WIDTH = 120;
  const MIN_VIDEO_HEIGHT = 80;
  const MIN_CLIP_SECONDS = 1;
  const SCAN_INTERVAL_MS = 500;

  const { MESSAGE, STORAGE_KEY, LIMITS } = root.ClipMarginalConstants;
  const { sendRuntimeMessage, isExtensionContextValid } = root.ClipMarginalRuntime;
  const { set: storageSet } = root.ClipMarginalStorage;
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

  function findCandidateVideo() {
    const videos = Array.from(document.querySelectorAll("video"));

    return (
      videos.find((video) => {
        const rect = video.getBoundingClientRect();
        return rect.width >= MIN_VIDEO_WIDTH && rect.height >= MIN_VIDEO_HEIGHT;
      }) || null
    );
  }

  function positionButton(video) {
    if (!button || !video) {
      return;
    }

    const rect = video.getBoundingClientRect();

    button.style.left = `${Math.max(8, rect.right - 158)}px`;
    button.style.top = `${Math.max(8, rect.bottom - 46)}px`;
  }

  function renderButtonLabel() {
    if (!button) {
      return;
    }

    if (capturing) {
      const elapsed = Math.max(0, Math.round((activeVideo?.currentTime || 0) - startSeconds));
      button.textContent = `⏹ Stop (${elapsed}s)`;
      button.classList.add("recording");
    } else {
      button.textContent = "🎬 Clip video";
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
    const video = activeVideo;

    if (!capturing || !video) {
      resetCaptureState();
      return;
    }

    const { start, end } = clampVideoRange(startSeconds, video.currentTime);

    resetCaptureState();

    if (end - start < MIN_CLIP_SECONDS) {
      showToast("Clip too short — let the video play a bit longer before stopping.");
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
      videoEndSeconds: end
    });

    if (!validateClip(clip)) {
      showToast("Couldn't capture that video clip. Try again.");
      return;
    }

    void storageSet({
      [STORAGE_KEY.PENDING_CLIP]: clip
    });

    const response = await sendRuntimeMessage({
      type: MESSAGE.NEW_CLIP,
      payload: clip
    });

    showToast(
      response?.ok
        ? "Video clip saved — opening ClipMarginal…"
        : "Video clip saved. Open ClipMarginal from the toolbar."
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
    button.setAttribute("aria-label", "Clip this video with ClipMarginal");

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
    const video = findCandidateVideo();

    if (!video) {
      // Don't tear down mid-capture just because the element briefly
      // disappears from the DOM (some players swap the node on
      // fullscreen toggle) - only clear state when we're not capturing.
      if (!capturing) {
        activeVideo = null;
        removeButton();
      }
      return;
    }

    if (video !== activeVideo && !capturing) {
      activeVideo = video;
    }

    createButton();
    positionButton(activeVideo || video);
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
