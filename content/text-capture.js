"use strict";

// Text selection capture: the floating "Clip this" button, its
// positioning, and the capture -> validate -> send flow. Split out of
// content.js so a future video-capture.js can sit alongside it as a
// second capture mode, with content.js staying a thin bootstrap that
// picks which one(s) to attach.

(function (root) {
  const BUTTON_ID = "clipper-clip-btn";
  const TOAST_ID = "clipper-toast";

  const { MESSAGE, STORAGE_KEY } = root.ClipMarginalConstants;
  const { sendRuntimeMessage, isExtensionContextValid } = root.ClipMarginalRuntime;
  const { set: storageSet } = root.ClipMarginalStorage;
  const { createTextClip, validateClip } = root.ClipMarginalClipModel;

  let clipButton = null;
  let lastSelectedText = "";
  let toastTimer = null;
  let attached = false;

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

  function buildClip() {
    const text = lastSelectedText.trim();

    if (!text) {
      return null;
    }

    const clip = createTextClip({
      sourceUrl: window.location.href,
      sourceTitle: document.title?.trim().slice(0, 500) || window.location.hostname,
      sourceDomain: window.location.hostname,
      quotedText: text.slice(0, 20000)
    });

    return validateClip(clip) ? clip : null;
  }

  function saveFallback(clip) {
    void storageSet({
      [STORAGE_KEY.PENDING_CLIP]: clip
    });
  }

  async function clipSelection() {
    if (!isExtensionContextValid()) {
      showToast("ClipMarginal was updated. Please reload this page.");
      removeButton();
      return;
    }

    const clip = buildClip();

    if (!clip) {
      showToast("Select some text first.");
      return;
    }

    saveFallback(clip);

    const response = await sendRuntimeMessage({
      type: MESSAGE.NEW_CLIP,
      payload: clip
    });

    showToast(
      response?.ok
        ? "Clip saved — opening ClipMarginal…"
        : "Clip saved. Open ClipMarginal from the toolbar."
    );

    void sendRuntimeMessage({
      type: MESSAGE.OPEN_PANEL
    });

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

    let left = rect.left + rect.width / 2 - buttonWidth / 2;
    let top = rect.top - buttonHeight - 10;

    left = Math.max(padding, Math.min(left, window.innerWidth - buttonWidth - padding));

    if (top < padding) {
      top = rect.bottom + 10;
    }

    top = Math.max(padding, Math.min(top, window.innerHeight - buttonHeight - padding));

    clipButton.style.left = `${left}px`;
    clipButton.style.top = `${top}px`;
  }

  function createButton(rect) {
    removeButton();

    clipButton = document.createElement("button");

    clipButton.id = BUTTON_ID;
    clipButton.type = "button";

    clipButton.setAttribute("aria-label", "Clip selected text with ClipMarginal");

    clipButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16 3a3 3 0 0 1 3 3v5h-2V6a1 1 0 0 0-1-1h-3V3h3ZM8 21a3 3 0 0 1-3-3v-5h2v5a1 1 0 0 0 1 1h3v2H8Zm8-15H8a2 2 0 0 0-2 2v8h2V8h8v8h2V8a2 2 0 0 0-2-2Z" />
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

    clipButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      void clipSelection();
    });

    document.documentElement.appendChild(clipButton);

    positionButton(rect);
  }

  function handleSelection() {
    setTimeout(() => {
      const text = getSelectionText();

      if (!text || text.length < 2) {
        removeButton();
        return;
      }

      lastSelectedText = text;

      try {
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
          removeButton();
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (!rect || (!rect.width && !rect.height)) {
          removeButton();
          return;
        }

        createButton(rect);
      } catch {
        removeButton();
      }
    }, 20);
  }

  function attach() {
    if (attached) {
      return;
    }
    attached = true;

    document.addEventListener(
      "mouseup",
      (event) => {
        if (clipButton && (event.target === clipButton || clipButton.contains(event.target))) {
          return;
        }
        handleSelection();
      },
      false
    );

    document.addEventListener(
      "mousedown",
      (event) => {
        if (clipButton && (event.target === clipButton || clipButton.contains(event.target))) {
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

    window.addEventListener("scroll", removeButton, { passive: true });
    window.addEventListener("resize", removeButton, { passive: true });

    let previousUrl = location.href;

    setInterval(() => {
      if (location.href !== previousUrl) {
        previousUrl = location.href;
        removeButton();
        lastSelectedText = "";
      }
    }, 1000);
  }

  root.ClipMarginalTextCapture = Object.freeze({
    attach
  });
})(self);
