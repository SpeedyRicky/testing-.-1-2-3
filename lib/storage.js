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

  const api = { get, set, remove, readFavorites, writeFavorites, toggleFavorite, isFavorited };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipMarginalStorage = api;
  }
})(typeof self !== "undefined" ? self : this);
