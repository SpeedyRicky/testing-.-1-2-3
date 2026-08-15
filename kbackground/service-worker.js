// Entry point for the extension's service worker. Owns the
// extension's lifecycle (toolbar icon clicks, install-time setup,
// side panel behavior) and wires up the message router — all the
// actual message handling lives in message-router.js.

import { registerMessageRouter } from "./message-router.js";

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({
      openPanelOnActionClick: true
    })
    .catch(() => {});
});