"use strict";

// ClipMarginal — extension runtime messaging. Message type strings live
// in constants.js (the single source of truth) rather than being
// re-declared here - this file used to define its own MESSAGE_TYPES
// with the old "CLIPNOTER_*" values, which is exactly the kind of
// second copy of the same fact that caused the extension's two halves
// to stop talking to each other before. Load constants.js before this
// file.

(function (root) {
  function getExtensionRuntime() {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        typeof chrome.runtime.sendMessage === "function"
      ) {
        return chrome.runtime;
      }
    } catch {
      // fall through
    }

    try {
      if (
        typeof browser !== "undefined" &&
        browser.runtime &&
        typeof browser.runtime.sendMessage === "function"
      ) {
        return browser.runtime;
      }
    } catch {
      // fall through
    }

    return null;
  }

  // Chrome invalidates chrome.runtime.id when the extension reloads or
  // updates while a page/panel is still holding a reference to it.
  // Sending a message at that point throws "Extension context
  // invalidated" - check first so callers can show a clear message
  // instead of an unhandled error.
  function isExtensionContextValid() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function sendRuntimeMessage(message) {
    const runtime = getExtensionRuntime();

    if (!runtime) {
      return Promise.resolve(null);
    }

    if (typeof chrome !== "undefined" && runtime === chrome.runtime) {
      if (!isExtensionContextValid()) {
        return Promise.resolve(null);
      }

      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(message, (response) => {
            try {
              void chrome.runtime.lastError;
            } catch {}
            resolve(response ?? null);
          });
        } catch {
          resolve(null);
        }
      });
    }

    try {
      const result = runtime.sendMessage(message);
      if (result && typeof result.then === "function") {
        return result.then((response) => response ?? null).catch(() => null);
      }
      return Promise.resolve(null);
    } catch {
      return Promise.resolve(null);
    }
  }

  const api = { getExtensionRuntime, isExtensionContextValid, sendRuntimeMessage };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipMarginalRuntime = api;
  }
})(typeof self !== "undefined" ? self : this);
