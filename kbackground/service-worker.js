// Entry point for the extension's service worker. Owns the
// extension's lifecycle (toolbar icon clicks, install-time setup,
// side panel behavior) and wires up the message router — all the
// actual message handling lives in message-router.js.

import { registerMessageRouter } from "./message-router.js";
import "../lib/constants.js";

const { MESSAGE, CONTEXT_MENU_ID, CONTEXT_MENU_VIDEO_ID, COMMAND_ID } = self.ClipMarginalConstants;

registerMessageRouter();

chrome.action.onClicked.addListener((tab) => {
  const windowId = tab?.windowId;

  if (typeof windowId !== "number") {
    return;
  }

  chrome.sidePanel
    .open({
      windowId
    })
    .catch(() => {});
});

chrome.runtime.onInstalled.addListener((details) => {
  chrome.sidePanel
    .setPanelBehavior({
      openPanelOnActionClick: true
    })
    .catch(() => {});

  // Right-click fast paths for both capture modes - these just relay a
  // message to whatever content script is already on the page; the
  // actual capture logic stays in text-capture.js/video-capture.js, so
  // this never becomes a second implementation of either.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Clip this with ClipRoots",
      // "page" (not just "selection") so right-clicking a bare word -
      // no drag-select first - still shows this item. The content
      // script (text-capture.js) falls back to the word under the
      // cursor when nothing's actually selected.
      contexts: ["page", "selection"]
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_VIDEO_ID,
      title: "Clip this video with ClipRoots",
      contexts: ["video"]
    });
  });

  // First install only - re-showing this on every update would just be
  // noise for someone who already knows how the extension works.
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") }).catch(() => {});
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof tab?.id !== "number") {
    return;
  }
  if (info.menuItemId === CONTEXT_MENU_ID) {
    chrome.tabs.sendMessage(tab.id, { type: MESSAGE.TRIGGER_CLIP_SELECTION }).catch(() => {});
  } else if (info.menuItemId === CONTEXT_MENU_VIDEO_ID) {
    chrome.tabs.sendMessage(tab.id, { type: MESSAGE.TRIGGER_CLIP_VIDEO }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND_ID) {
    return;
  }
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof activeTab?.id !== "number") {
    return;
  }
  chrome.tabs.sendMessage(activeTab.id, { type: MESSAGE.TRIGGER_CLIP_SELECTION }).catch(() => {});
});