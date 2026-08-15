"use strict";

// ClipMarginal — lightweight error helpers shared across the extension:
// toUserMessage() separates what's safe to show a user from the raw
// error, and logAndSwallow() standardizes "log it, return null" for
// call sites that want to fail soft rather than throw.

(function (root) {
  class ClipMarginalError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "ClipMarginalError";
      this.code = code || "UNKNOWN";
    }
  }

  // Never leak raw Supabase/Postgres/network error internals to the UI —
  // map to short, human strings, and log the original for debugging.
  function toUserMessage(err, fallback) {
    if (!err) return fallback || "Something went wrong.";
    const message = typeof err === "string" ? err : err.message;
    if (!message) return fallback || "Something went wrong.";
    // Trim noisy Postgres/Supabase prefixes if present.
    return message.replace(/^\[?PGRST\d+\]?:?\s*/i, "").slice(0, 300);
  }

  function logAndSwallow(context, err) {
    // eslint-disable-next-line no-console
    console.warn(`[ClipMarginal] ${context}:`, err);
    return null;
  }

  const api = { ClipMarginalError, toUserMessage, logAndSwallow };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipMarginalErrors = api;
  }
})(typeof self !== "undefined" ? self : this);