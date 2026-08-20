"use strict";

// ClipMarginal — chrome.storage.local wrapper (promise-based) shared by
// background/service-worker.js and sidepanel/sidepanel.js, plus a small
// localStorage-backed favorites helper used only in the side panel.

(function (root) {
  function get(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([key], (result) => {
          void chrome.runtime.lastError; // acknowledge, never throw
          resolve(result ? result[key] ?? null : null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function set(values) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(values, () => {
          void chrome.runtime.lastError;
          resolve(true);
        });
      } catch {
        resolve(false);
      }
    });
  }

  function remove(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove(key, () => {
          void chrome.runtime.lastError;
          resolve(true);
        });
      } catch {
        resolve(false);
      }
    });
  }

  // ---- Favorites (side panel only; keyed per signed-in user id) ----
  const constants =
    (typeof module !== "undefined" && module.exports
      ? require("./constants.js")
      : root.ClipMarginalConstants);

  // ---- Pending list (shared by content scripts + background) ----
  // A capture never overwrites the last one - it's appended to a list
  // that the side panel reviews and publishes as a batch. Content
  // scripts and the background service worker both read/write this
  // through the same read-modify-write helpers so there's exactly one
  // implementation of "what a pending list looks like".
  const PENDING_LIST_KEY = constants.STORAGE_KEY.PENDING_LIST;
  const MAX_LIST_CLIPS = constants.LIMITS.MAX_LIST_CLIPS;

  async function getPendingList() {
    const list = await get(PENDING_LIST_KEY);
    return Array.isArray(list) ? list : [];
  }

  async function appendPendingClip(clip) {
    const list = await getPendingList();
    list.push(clip);
    const trimmed = list.slice(-MAX_LIST_CLIPS);
    await set({ [PENDING_LIST_KEY]: trimmed });
    return trimmed;
  }

  async function removePendingClip(clipId) {
    const list = await getPendingList();
    const trimmed = list.filter((clip) => clip.id !== clipId);
    await set({ [PENDING_LIST_KEY]: trimmed });
    return trimmed;
  }

  async function clearPendingList() {
    await remove(PENDING_LIST_KEY);
    return [];
  }

  function favoritesKey(userId) {
    return `${constants.STORAGE_KEY.FAVORITES_PREFIX}${userId || "anon"}`;
  }

  function readFavorites(userId) {
    try {
      const raw = window.localStorage.getItem(favoritesKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeFavorites(userId, favorites) {
    try {
      window.localStorage.setItem(favoritesKey(userId), JSON.stringify(favorites));
      return true;
    } catch {
      return false;
    }
  }

  function toggleFavorite(userId, clip) {
    const favorites = readFavorites(userId);
    const exists = favorites.some((item) => item.id === clip.id);
    const updated = exists
      ? favorites.filter((item) => item.id !== clip.id)
      : [...favorites.filter((item) => item.id !== clip.id), clip];
    writeFavorites(userId, updated);
    return !exists;
  }

  function isFavorited(userId, clipId) {
    return readFavorites(userId).some((item) => item.id === clipId);
  }

  const api = {
    get, set, remove,
    readFavorites, writeFavorites, toggleFavorite, isFavorited,
    getPendingList, appendPendingClip, removePendingClip, clearPendingList
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipMarginalStorage = api;
  }
})(typeof self !== "undefined" ? self : this);
