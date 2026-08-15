// Everything to do with talking to the rest of the extension:
// receiving a captured clip from content.js, holding it in
// chrome.storage until the side panel asks for it, and telling
// the side panel to open. No lifecycle/install concerns live here
// — that's service-worker.js.

const PENDING_CLIP_KEY = "cliproots_pending_clip";

const MAX_VIDEO_CLIP_SECONDS = 90;

function storageGet(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([key], (result) => {
        void chrome.runtime.lastError;
        resolve(result?.[key] ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(values, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

function storageRemove(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(key, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve(response ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function validateClip(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (
    typeof payload.sourceUrl !== "string" ||
    !payload.sourceUrl.trim()
  ) {
    return false;
  }

  try {
    new URL(payload.sourceUrl);
  } catch {
    return false;
  }

  if (payload.clipType === "video") {
    const start = payload.videoStartSeconds;
    const end = payload.videoEndSeconds;

    if (typeof start !== "number" || typeof end !== "number") {
      return false;
    }

    if (!(start >= 0) || !(end > start)) {
      return false;
    }

    if (end - start > MAX_VIDEO_CLIP_SECONDS + 0.5) {
      return false;
    }

    return true;
  }

  if (
    typeof payload.quotedText !== "string" ||
    !payload.quotedText.trim()
  ) {
    return false;
  }

  return true;
}

export function registerMessageRouter() {
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (!message || typeof message.type !== "string") {
        return false;
      }

      if (message.type === "CLIPROOTS_NEW_CLIP") {
        const payload = message.payload;

        if (!validateClip(payload)) {
          sendResponse({
            ok: false,
            error: "Invalid clip."
          });

          return false;
        }

        void storageSet({
          [PENDING_CLIP_KEY]: payload
        }).then(() => {
          void sendRuntimeMessage({
            type: "CLIPROOTS_PENDING_CLIP_UPDATED",
            payload
          });
        });

        sendResponse({
          ok: true
        });

        return false;
      }

      if (message.type === "CLIPROOTS_GET_PENDING_CLIP") {
        storageGet(PENDING_CLIP_KEY).then((payload) => {
          sendResponse({
            ok: true,
            payload
          });
        });

        return true;
      }

      if (message.type === "CLIPROOTS_CLEAR_PENDING_CLIP") {
        storageRemove(PENDING_CLIP_KEY).then(() => {
          sendResponse({
            ok: true
          });
        });

        return true;
      }

      if (message.type === "CLIPROOTS_OPEN_PANEL") {
        const windowId = sender?.tab?.windowId;

        if (typeof windowId !== "number") {
          sendResponse({
            ok: false,
            error: "No browser window found."
          });

          return false;
        }

        chrome.sidePanel
          .open({
            windowId
          })
          .then(() => {
            sendResponse({
              ok: true
            });
          })
          .catch(() => {
            sendResponse({
              ok: false,
              error: "Unable to open the side panel."
            });
          });

        return true;
      }

      return false;
    }
  );
}