"use strict";

// ClipMarginal — input validation shared by content scripts, background,
// and the side panel. Centralizing this closes a real gap in the previous
// build: the background service worker validated clips on the way in, but
// nothing validated commentary length or stripped unsafe values before an
// insert was attempted.

(function (root) {
  const LIMITS =
    (typeof module !== "undefined" && module.exports
      ? require("./constants.js")
      : root.ClipMarginalConstants
    ).LIMITS;

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isValidUrl(value) {
    if (!isNonEmptyString(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Validates the shape produced by content/capture-controller.js before it
  // is ever written to chrome.storage or sent to the background worker.
  // Text clips and video clips share the sourceUrl check but diverge on
  // what "content" means - a video clip has no quotedText, it has a
  // start/end timestamp range instead.
  function validateClipPayload(payload) {
    const errors = [];
    if (!payload || typeof payload !== "object") {
      return { valid: false, errors: ["Clip payload missing."] };
    }
    if (!isValidUrl(payload.sourceUrl)) {
      errors.push("Source URL is missing or invalid.");
    }
    if (payload.type === "video") {
      const start = Number(payload.videoStartSeconds);
      const end = Number(payload.videoEndSeconds);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        errors.push("Video clip is missing a valid start/end time.");
      } else if (end - start > LIMITS.MAX_VIDEO_CLIP_SECONDS) {
        errors.push(`Video clips can't be longer than ${LIMITS.MAX_VIDEO_CLIP_SECONDS} seconds.`);
      }
    } else if (!isNonEmptyString(payload.quotedText)) {
      errors.push("Highlighted text is required.");
    } else if (payload.quotedText.length > LIMITS.MAX_QUOTE_CHARS) {
      errors.push("Highlighted text is too long.");
    }
    return { valid: errors.length === 0, errors };
  }

  function validateCommentary(text) {
    if (text == null) return { valid: true, value: "" };
    if (typeof text !== "string") return { valid: false, errors: ["Invalid commentary."] };
    if (text.length > LIMITS.MAX_COMMENTARY_CHARS) {
      return { valid: false, errors: [`Commentary must be under ${LIMITS.MAX_COMMENTARY_CHARS} characters.`] };
    }
    return { valid: true, value: text.trim() };
  }

  // video.currentTime is fractional (e.g. 12.325558), but
  // video_start_seconds/video_end_seconds are integer columns in
  // Postgres - round here, once, so every caller (capture, validation,
  // the eventual insert) works with the same whole-second values.
  function clampVideoRange(startSeconds, endSeconds) {
    const start = Math.max(0, Math.round(Number(startSeconds) || 0));
    let end = Math.max(start, Math.round(Number(endSeconds) || start));
    if (end - start > LIMITS.MAX_VIDEO_CLIP_SECONDS) {
      end = start + LIMITS.MAX_VIDEO_CLIP_SECONDS;
    }
    return { start, end };
  }

  const api = { isNonEmptyString, isValidUrl, validateClipPayload, validateCommentary, clampVideoRange };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipMarginalValidation = api;
  }
})(typeof self !== "undefined" ? self : this);
