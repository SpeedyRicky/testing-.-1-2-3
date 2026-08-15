"use strict";

(() => {
  const BUTTON_ID = "cliproots-clip-btn";
  const TOAST_ID = "cliproots-toast";
  const MEDIA_WIDGET_ID = "cliproots-media-widget";
  const PENDING_CLIP_STORAGE_KEY = "cliproots_pending_clip";
  const MAX_VIDEO_CLIP_SECONDS = 90;

  let clipButton = null;
  let lastSelectedText = "";
  let toastTimer = null;

  function getRuntime() {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        typeof chrome.runtime.sendMessage === "function"
      ) {
        return chrome.runtime;
      }
    } catch {
      return null;
    }

    return null;
  }

  // Reloading/updating the extension invalidates chrome.runtime for any
  // tab whose content script was injected before the reload - sending a
  // message then silently fails (chrome.runtime.lastError, undefined
  // response), which previously still showed "Clip saved" even though
  // nothing reached the background. This lets us tell the difference and
  // say what's actually true: reload the page to reconnect.
  function isExtensionContextValid() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function sendMessage(message, callback) {
    const runtime = getRuntime();

    if (!runtime) {
      callback?.(null);
      return;
    }

    try {
      runtime.sendMessage(message, (response) => {
        try {
          void chrome.runtime.lastError;
        } catch {}

        callback?.(response ?? null);
      });
    } catch {
      callback?.(null);
    }
  }

  function removeButton() {
    if (!clipButton) {
      return;
    }

    try {
      clipButton.remove();
    } catch {}

    clipButton = null;
  }

  function showToast(message) {
    const existing = document.getElementById(TOAST_ID);

    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");

    toast.id = TOAST_ID;
    toast.textContent = message;

    document.documentElement.appendChild(toast);

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      try {
        toast.remove();
      } catch {}
    }, 2800);
  }

  function getSelectionText() {
    try {
      const selection = window.getSelection();

      if (!selection) {
        return "";
      }

      return selection.toString().trim();
    } catch {
      return "";
    }
  }

  function buildTextClip() {
    const text = lastSelectedText.trim();

    if (!text) {
      return null;
    }

    const url = window.location.href;

    try {
      new URL(url);
    } catch {
      return null;
    }

    return {
      clipType: "text",
      quotedText: text.slice(0, 20000),
      sourceUrl: url,
      sourceTitle:
        document.title?.trim().slice(0, 500) ||
        window.location.hostname,
      sourceDomain: window.location.hostname
    };
  }

  function saveFallback(clip) {
    try {
      chrome.storage.local.set(
        {
          [PENDING_CLIP_STORAGE_KEY]: clip
        },
        () => {
          try {
            void chrome.runtime.lastError;
          } catch {}
        }
      );
    } catch {}
  }

  function sendClip(clip, savedMessage) {
    saveFallback(clip);

    if (!isExtensionContextValid()) {
      showToast("ClipRoots was updated. Please reload this page to keep clipping.");
      return;
    }

    sendMessage(
      {
        type: "CLIPROOTS_NEW_CLIP",
        payload: clip
      },
      (response) => {
        if (response?.ok) {
          showToast(savedMessage);
        } else if (!isExtensionContextValid()) {
          showToast("ClipRoots was updated. Please reload this page to keep clipping.");
        } else {
          showToast("Clip saved. Open ClipRoots from the toolbar.");
        }
      }
    );

    sendMessage({
      type: "CLIPROOTS_OPEN_PANEL"
    });
  }

  function clipSelection() {
    const clip = buildTextClip();

    if (!clip) {
      showToast("Select some text first.");
      return;
    }

    sendClip(clip, "Clip saved — opening ClipRoots…");

    removeButton();

    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }

  function positionButton(rect) {
    if (!clipButton || !rect) {
      return;
    }

    const buttonWidth = 112;
    const buttonHeight = 40;
    const padding = 8;

    let left =
      rect.left +
      rect.width / 2 -
      buttonWidth / 2;

    let top =
      rect.top -
      buttonHeight -
      10;

    left = Math.max(
      padding,
      Math.min(
        left,
        window.innerWidth -
          buttonWidth -
          padding
      )
    );

    if (top < padding) {
      top = rect.bottom + 10;
    }

    top = Math.max(
      padding,
      Math.min(
        top,
        window.innerHeight -
          buttonHeight -
          padding
      )
    );

    clipButton.style.left = `${left}px`;
    clipButton.style.top = `${top}px`;
  }

  function createButton(rect) {
    removeButton();

    clipButton = document.createElement("button");

    clipButton.id = BUTTON_ID;
    clipButton.type = "button";

    clipButton.setAttribute(
      "aria-label",
      "Clip selected text with ClipRoots"
    );

    clipButton.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M16 3a3 3 0 0 1 3 3v5h-2V6a1 1 0 0 0-1-1h-3V3h3ZM8 21a3 3 0 0 1-3-3v-5h2v5a1 1 0 0 0 1 1h3v2H8Zm8-15H8a2 2 0 0 0-2 2v8h2V8h8v8h2V8a2 2 0 0 0-2-2Z"
        />
      </svg>

      <span>Clip this</span>
    `;

    clipButton.addEventListener(
      "mousedown",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    clipButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        clipSelection();
      }
    );

    document.documentElement.appendChild(
      clipButton
    );

    positionButton(rect);
  }

  function handleSelection() {
    setTimeout(() => {
      const text = getSelectionText();

      if (!text) {
        removeButton();
        return;
      }

      if (text.length < 2) {
        removeButton();
        return;
      }

      lastSelectedText = text;

      try {
        const selection = window.getSelection();

        if (
          !selection ||
          selection.rangeCount === 0
        ) {
          removeButton();
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (
          !rect ||
          (!rect.width && !rect.height)
        ) {
          removeButton();
          return;
        }

        createButton(rect);
      } catch {
        removeButton();
      }
    }, 20);
  }

  document.addEventListener(
    "mouseup",
    (event) => {
      if (
        clipButton &&
        (
          event.target === clipButton ||
          clipButton.contains(event.target)
        )
      ) {
        return;
      }

      handleSelection();
    },
    false
  );

  document.addEventListener(
    "mousedown",
    (event) => {
      if (
        clipButton &&
        (
          event.target === clipButton ||
          clipButton.contains(event.target)
        )
      ) {
        return;
      }

      removeButton();
    },
    false
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        removeButton();
      }
    },
    false
  );

  window.addEventListener(
    "scroll",
    removeButton,
    {
      passive: true
    }
  );

  window.addEventListener(
    "resize",
    removeButton,
    {
      passive: true
    }
  );

  // ==========================================================
  // Video / podcast (audio) clip capture.
  //
  // Works on any page whose player exposes a plain HTML5
  // <video> or <audio> element in this document (YouTube watch
  // pages, Vimeo, Udemy lecture pages, most podcast embeds).
  // It cannot reach into a *cross-origin* iframe (e.g. a
  // YouTube/Spotify embed dropped into someone else's blog) —
  // the browser doesn't allow that from a content script either,
  // same-origin iframes are still covered via all_frames.
  // ==========================================================

  const PLATFORM_LABELS = [
    [/(^|\.)youtube\.com$/, "YouTube"],
    [/(^|\.)youtu\.be$/, "YouTube"],
    [/(^|\.)vimeo\.com$/, "Vimeo"],
    [/(^|\.)udemy\.com$/, "Udemy"]
  ];

  function platformLabel() {
    const host = window.location.hostname.replace(/^www\./, "");
    for (const [pattern, label] of PLATFORM_LABELS) {
      if (pattern.test(host)) return label;
    }
    return null;
  }

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

  // A still frame is enough to show what was clipped without re-hosting
  // any video/audio bytes (see the video-capture.js header comment for
  // why we never download/store the media itself). YouTube's player
  // pixels are DRM/MSE-protected and can't be read into a canvas at all,
  // so YouTube gets its own public video-thumbnail image instead; every
  // other site gets a genuine downscaled capture of the current frame,
  // best-effort since a cross-origin, non-CORS video will also throw.
  function captureThumbnail(videoEl) {
    const youtubeId = getYouTubeVideoId();
    if (youtubeId) {
      return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    if (!videoEl || !videoEl.videoWidth) {
      return null;
    }

    try {
      const MAX_WIDTH = 320;
      const scale = Math.min(1, MAX_WIDTH / videoEl.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(videoEl.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(videoEl.videoHeight * scale));

      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL("image/jpeg", 0.6);
    } catch {
      // Cross-origin video without permissive CORS headers taints the
      // canvas - toDataURL() throws a SecurityError. Fall back to no
      // thumbnail rather than blocking the clip on it.
      return null;
    }
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 60 && rect.height > 40;
  }

  function findPrimaryMedia() {
    const videos = Array.from(document.querySelectorAll("video"))
      .filter((v) => v.readyState >= 1 && v.duration > 0 && isVisible(v));

    if (videos.length > 0) {
      const playing = videos.find((v) => !v.paused && !v.ended);
      if (playing) return { el: playing, kind: "video" };
      videos.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      });
      return { el: videos[0], kind: "video" };
    }

    const audios = Array.from(document.querySelectorAll("audio"))
      .filter((a) => a.readyState >= 1 && a.duration > 0);

    if (audios.length > 0) {
      const playing = audios.find((a) => !a.paused && !a.ended);
      return { el: playing || audios[0], kind: "audio" };
    }

    return null;
  }

  let mediaWidget = null;
  let mediaState = null; // { el, kind, startTime, endTime, capped }
  let mediaTickHandle = null;

  function removeMediaWidget() {
    if (mediaTickHandle) {
      clearInterval(mediaTickHandle);
      mediaTickHandle = null;
    }
    if (mediaWidget) {
      try {
        mediaWidget.remove();
      } catch {}
      mediaWidget = null;
    }
    mediaState = null;
  }

  function resetMarking() {
    if (!mediaState) return;
    mediaState.startTime = null;
    mediaState.endTime = null;
    mediaState.capped = false;
    renderMediaWidget();
  }

  function markStart() {
    if (!mediaState) return;
    mediaState.startTime = mediaState.el.currentTime || 0;
    mediaState.endTime = null;
    mediaState.capped = false;
    renderMediaWidget();
  }

  function markEnd() {
    if (!mediaState || mediaState.startTime == null) return;
    const raw = mediaState.el.currentTime || 0;
    const maxEnd = mediaState.startTime + MAX_VIDEO_CLIP_SECONDS;
    mediaState.endTime = Math.min(raw, maxEnd);
    mediaState.capped = raw > maxEnd + 0.25;
    renderMediaWidget();
  }

  function buildVideoClip() {
    if (!mediaState || mediaState.startTime == null || mediaState.endTime == null) {
      return null;
    }
    const url = window.location.href;
    try {
      new URL(url);
    } catch {
      return null;
    }
    return {
      clipType: "video",
      videoStartSeconds: Math.floor(mediaState.startTime),
      videoEndSeconds: Math.ceil(mediaState.endTime),
      sourceUrl: url,
      sourceTitle: document.title?.trim().slice(0, 500) || window.location.hostname,
      sourceDomain: window.location.hostname,
      thumbnailUrl: captureThumbnail(mediaState.el)
    };
  }

  function saveVideoClip() {
    const clip = buildVideoClip();
    if (!clip) return;
    sendClip(clip, "Clip saved — opening ClipRoots…");
    removeMediaWidget();
  }

  function ensureMediaWidget() {
    if (mediaWidget) return;

    mediaWidget = document.createElement("div");
    mediaWidget.id = MEDIA_WIDGET_ID;
    document.documentElement.appendChild(mediaWidget);

    mediaTickHandle = setInterval(renderMediaWidget, 250);
  }

  function renderMediaWidget() {
    if (!mediaWidget || !mediaState) return;

    const { el, startTime, endTime, capped } = mediaState;
    const label = platformLabel() || (mediaState.kind === "audio" ? "Audio" : "Video");
    const current = el.currentTime || 0;

    let body;

    if (startTime == null) {
      body = `
        <div class="cliproots-media-badge">${label}</div>
        <div class="cliproots-media-time">${formatTime(current)}</div>
        <button type="button" class="cliproots-media-btn cliproots-media-btn-primary" data-action="mark-start">Mark start</button>
      `;
    } else if (endTime == null) {
      const elapsed = Math.max(0, current - startTime);
      const remaining = Math.max(0, MAX_VIDEO_CLIP_SECONDS - elapsed);
      const nearCap = remaining <= 10;
      body = `
        <div class="cliproots-media-badge">${label}</div>
        <div class="cliproots-media-time">${formatTime(startTime)} → ${formatTime(current)}</div>
        <div class="cliproots-media-cap-note${nearCap ? " is-near-cap" : ""}">${formatTime(remaining)} left of 90s max</div>
        <div class="cliproots-media-row">
          <button type="button" class="cliproots-media-btn" data-action="cancel">Cancel</button>
          <button type="button" class="cliproots-media-btn cliproots-media-btn-primary" data-action="mark-end">Mark end</button>
        </div>
      `;
      if (elapsed >= MAX_VIDEO_CLIP_SECONDS) {
        markEnd();
        return;
      }
    } else {
      body = `
        <div class="cliproots-media-badge">${label}</div>
        <div class="cliproots-media-time">${formatTime(startTime)} – ${formatTime(endTime)}</div>
        ${capped ? '<div class="cliproots-media-cap-note is-near-cap">Capped at 90s</div>' : ""}
        <div class="cliproots-media-row">
          <button type="button" class="cliproots-media-btn" data-action="discard">Discard</button>
          <button type="button" class="cliproots-media-btn cliproots-media-btn-primary" data-action="save">Save clip</button>
        </div>
      `;
    }

    mediaWidget.innerHTML = body;
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-action]");
    if (!target || !mediaWidget || !mediaWidget.contains(target)) return;

    event.preventDefault();
    event.stopPropagation();

    const action = target.getAttribute("data-action");
    if (action === "mark-start") markStart();
    else if (action === "mark-end") markEnd();
    else if (action === "cancel") resetMarking();
    else if (action === "discard") resetMarking();
    else if (action === "save") saveVideoClip();
  });

  function scanForMedia() {
    if (mediaState && mediaState.startTime != null) {
      // don't yank the widget away mid-mark, even if detection flickers
      return;
    }

    const found = findPrimaryMedia();

    if (!found) {
      removeMediaWidget();
      return;
    }

    if (!mediaState || mediaState.el !== found.el) {
      mediaState = { el: found.el, kind: found.kind, startTime: null, endTime: null, capped: false };
      ensureMediaWidget();
    }

    renderMediaWidget();
  }

  setInterval(scanForMedia, 1500);

  let previousUrl = location.href;

  setInterval(() => {
    if (location.href !== previousUrl) {
      previousUrl = location.href;
      removeButton();
      removeMediaWidget();
      lastSelectedText = "";
    }
  }, 1000);
})();