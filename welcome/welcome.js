"use strict";

// First-run welcome tour. Lives entirely on its own - no shared state
// with the side panel, no message passing either direction - so it
// can't disturb anything already running there. Its only two actions
// are opening the side panel (a normal extension-page call, same as
// clicking the toolbar icon) and closing its own tab afterward.

document.getElementById("open-panel-btn").addEventListener("click", async () => {
  try {
    const win = await chrome.windows.getCurrent();
    if (typeof win?.id === "number") {
      await chrome.sidePanel.open({ windowId: win.id });
    }
  } catch (err) {
    console.warn("ClipRoots: couldn't open the side panel from the welcome page", err);
  }

  try {
    const tab = await chrome.tabs.getCurrent();
    if (typeof tab?.id === "number") {
      chrome.tabs.remove(tab.id);
    }
  } catch {
    // Not fatal either way - the side panel call above already happened.
  }
});
