// Everything to do with talking to the rest of the extension:
// receiving clips captured by content.js into a pending *list* held in
// chrome.storage until the side panel asks for it, and telling the side
// panel to open. No lifecycle/install concerns live here — that's
// service-worker.js.
//
// Message names, the storage key, and clip validation all come from
// lib/*.js (side-effect imported below) instead of being redeclared
// here - a second copy of those facts is exactly what let this file and
// the side panel drift onto two different message vocabularies before
// (see the history note in lib/constants.js).

import "../lib/constants.js";
import "../lib/storage.js";
import "../lib/validation.js";

const { MESSAGE } = self.ClipMarginalConstants;
const { getPendingList, removePendingClip, clearPendingList } = self.ClipMarginalStorage;
const { validateClipPayload } = self.ClipMarginalValidation;

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

async function broadcastPendingList() {
  const list = await getPendingList();
  void sendRuntimeMessage({
    type: MESSAGE.PENDING_LIST_UPDATED,
    payload: list
  });
  return list;
}

export function registerMessageRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      return false;
    }

    if (message.type === MESSAGE.NEW_CLIP) {
      // The content script already appended this clip to the pending
      // list (see appendPendingClip() in text-capture.js/video-capture.js)
      // before sending this message - re-validate the shape here since
      // the background is the trust boundary for what came from a page,
      // then just broadcast so any open panel refreshes.
      if (!validateClipPayload(message.payload).valid) {
        sendResponse({ ok: false, error: "Invalid clip." });
        return false;
      }

      void broadcastPendingList();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MESSAGE.GET_PENDING_LIST) {
      getPendingList().then((payload) => {
        sendResponse({ ok: true, payload });
      });
      return true;
    }

    if (message.type === MESSAGE.REMOVE_PENDING_CLIP) {
      removePendingClip(message.payload?.id).then((payload) => {
        void sendRuntimeMessage({ type: MESSAGE.PENDING_LIST_UPDATED, payload });
        sendResponse({ ok: true, payload });
      });
      return true;
    }

    if (message.type === MESSAGE.CLEAR_PENDING_LIST) {
      clearPendingList().then((payload) => {
        void sendRuntimeMessage({ type: MESSAGE.PENDING_LIST_UPDATED, payload });
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === MESSAGE.OPEN_PANEL) {
      const windowId = sender?.tab?.windowId;

      if (typeof windowId !== "number") {
        sendResponse({ ok: false, error: "No browser window found." });
        return false;
      }

      chrome.sidePanel
        .open({ windowId })
        .then(() => {
          sendResponse({ ok: true });
        })
        .catch(() => {
          sendResponse({ ok: false, error: "Unable to open the side panel." });
        });

      return true;
    }

    return false;
  });
}
