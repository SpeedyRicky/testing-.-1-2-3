// ClipMarginal — shared constants.
// Loaded by background, content, and sidepanel scripts (classic <script>/
// importScripts, no bundler). This file MUST be loaded first everywhere,
// and is the single source of truth for message types and storage keys so
// the extension's parts never drift out of sync with each other again.
//
// (Previous bug fixed here: background.js used "CLIPNOTER_*" message names
// and a "clipnoter_pending_clip" storage key, while sidepanel.js used
// "CLIPPER_*" message names and a "clipper_pending_clip" storage key. The
// two halves of the extension were never actually talking to each other —
// every clip silently failed to reach the side panel. Everything now reads
// from this single file.)

(function (root) {
  const CONSTANTS = {
    APP_NAME: "ClipMarginal",

    // A capture (text or video) is added to a pending *list* rather than
    // replacing whatever was captured before it - NEW_CLIP appends,
    // REMOVE_PENDING_CLIP drops one item back out by id, and the side
    // panel publishes the whole list (one or many clips) together.
    MESSAGE: {
      NEW_CLIP: "CLIPMARGINAL_NEW_CLIP",
      GET_PENDING_LIST: "CLIPMARGINAL_GET_PENDING_LIST",
      REMOVE_PENDING_CLIP: "CLIPMARGINAL_REMOVE_PENDING_CLIP",
      CLEAR_PENDING_LIST: "CLIPMARGINAL_CLEAR_PENDING_LIST",
      PENDING_LIST_UPDATED: "CLIPMARGINAL_PENDING_LIST_UPDATED",
      OPEN_PANEL: "CLIPMARGINAL_OPEN_PANEL"
    },

    STORAGE_KEY: {
      PENDING_LIST: "clipmarginal_pending_list",
      FAVORITES_PREFIX: "clipmarginal_favorites_"
    },

    CONTEXT_MENU_ID: "clipmarginal-clip-selection",

    LIMITS: {
      MAX_QUOTE_CHARS: 20000,
      MAX_TITLE_CHARS: 500,
      MAX_COMMENTARY_CHARS: 5000,
      MAX_VIDEO_CLIP_SECONDS: 90,
      MAX_LIST_CLIPS: 20
    },

    CLAIM_TYPE: {
      COPYRIGHT_OWNERSHIP: "copyright_ownership",
      CONTENT_CONCERN: "content_concern"
    },

    PLAN: {
      FREE: "free",
      PRO: "pro"
    },

    PRO_PRICE: {
      MONTHLY_USD: 5,
      YEARLY_USD: 60
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CONSTANTS;
  } else {
    root.ClipMarginalConstants = CONSTANTS;
  }
})(typeof self !== "undefined" ? self : this);
