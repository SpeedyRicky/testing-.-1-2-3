"use strict";

(function (root) {
  // Every captured clip needs a stable id so it can be individually
  // removed from the pending list before publishing - crypto.randomUUID
  // is available in every context this file runs in (content scripts,
  // service worker), so no fallback implementation is needed.
  function generateClipId() {
    return crypto.randomUUID();
  }

  function createTextClip(data) {
    return {
      id: data.id || generateClipId(),
      type: "text",
      sourceUrl: data.sourceUrl,
      sourceTitle: data.sourceTitle || "",
      sourceDomain: data.sourceDomain || "",
      quotedText: data.quotedText || ""
    };
  }

  // Video clips never carry any video/audio bytes - only a source URL
  // and a start/end timestamp range. Playback happens through the
  // original site's own player (e.g. a YouTube embed), never a
  // downloaded/re-hosted copy - see video-capture.js.
  function createVideoClip(data) {
    return {
      id: data.id || generateClipId(),
      type: "video",
      sourceUrl: data.sourceUrl,
      sourceTitle: data.sourceTitle || "",
      sourceDomain: data.sourceDomain || "",
      quotedText: data.quotedText || "",
      videoStartSeconds: data.videoStartSeconds,
      videoEndSeconds: data.videoEndSeconds,
      thumbnailUrl: data.thumbnailUrl || null
    };
  }

  function validateClip(clip) {
    // Delegates to validation.js's validateClipPayload() rather than
    // re-checking quotedText/sourceUrl here too - that function is a
    // strict superset (also enforces LIMITS.MAX_QUOTE_CHARS), and having
    // two implementations of "what makes a clip valid" is exactly the
    // kind of drift this rewrite exists to eliminate.
    if (!clip || typeof clip !== "object") {
      return false;
    }
    return root.ClipMarginalValidation.validateClipPayload(clip).valid;
  }

  const api = { createTextClip, createVideoClip, validateClip };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipMarginalClipModel = api;
  }
})(typeof self !== "undefined" ? self : this);
