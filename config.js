(() => {
  "use strict";

  /*
   * ClipMarginal runtime configuration
   *
   * IMPORTANT:
   * - Never put private API keys, service-role keys, Google AI keys,
   *   Anthropic keys, database passwords, or other secrets here.
   * - The Supabase anon key is intentionally public and must be
   *   protected by Supabase Row Level Security (RLS).
   * - AI requests should go through your server-side proxy.
   */

  // Single source of truth for the version is manifest.json - read it
  // at runtime instead of duplicating the number here, which is
  // exactly the kind of two-places-for-one-fact drift that broke
  // clip-to-compose earlier (this literally already drifted once:
  // this file said 1.1.0 after manifest.json had moved to 1.2.0).
  function getAppVersion() {
    try {
      return chrome.runtime.getManifest().version;
    } catch {
      return "0.0.0-unknown";
    }
  }

  const CONFIG = Object.freeze({
    // ------------------------------------------------------------------
    // Supabase
    // ------------------------------------------------------------------

    SUPABASE_URL: "https://lgdbyynrarikfnyjunaw.supabase.co",

    SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZGJ5eW5yYXJpa2ZueWp1bmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTE1MDksImV4cCI6MjEwMTQyNzUwOX0.C_RziaBzdBXPROEtBtzWlq6rSED8-8mjdRid0dANadQ",

    // ------------------------------------------------------------------
    // Public web application
    // ------------------------------------------------------------------

    WEBAPP_URL: "https://clipnoter.netlify.app",

    // ------------------------------------------------------------------
    // AI
    // ------------------------------------------------------------------
    //
    // Deployed on Render (server/, see .env.example for what it needs).
    // Never put an AI provider's private API key in this file - it
    // stays server-side, read from process.env on Render.
    //

    AI_PROXY_URL: "https://clipmarginaltestbetter.onrender.com",

    // ------------------------------------------------------------------
    // Feature flags
    // ------------------------------------------------------------------

    FEATURES: Object.freeze({
      AI_SUMMARIZATION: true,
      AI_REVIEW: true,
      FAVORITES: true,
      FOLLOWING_FEED: true,
      PUBLIC_FEED: true,
      CLIP_PUBLISHING: true,
      DELETE_CLIPS: true
    }),

    // ------------------------------------------------------------------
    // Product limits
    // ------------------------------------------------------------------

    LIMITS: Object.freeze({
      MAX_COMMENTARY_LENGTH: 5000,
      MAX_QUOTED_TEXT_LENGTH: 10000,
      MAX_SEARCH_LENGTH: 200,
      MAX_FEED_RESULTS: 30,
      MAX_PROFILE_CLIPS: 50,
      MAX_RECENT_REVIEW_CLIPS: 5,

      // Prevent accidental huge AI requests.
      MAX_AI_INPUT_LENGTH: 12000
    }),

    // ------------------------------------------------------------------
    // Network settings
    // ------------------------------------------------------------------

    NETWORK: Object.freeze({
      REQUEST_TIMEOUT_MS: 15000,
      AI_TIMEOUT_MS: 30000,

      // Number of times a transient request may be retried.
      MAX_RETRIES: 2
    }),

    // ------------------------------------------------------------------
    // Application metadata
    //
    // Message types and storage keys used to be duplicated here too -
    // removed. lib/constants.js (ClipMarginalConstants) is the single
    // source of truth for those now; this file has no business keeping
    // its own copy of facts it doesn't own.
    // ------------------------------------------------------------------

    APP: Object.freeze({
      NAME: "ClipMarginal",
      VERSION: getAppVersion()
    })
  });

  // --------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------

  function validateUrl(value, name, { required = true } = {}) {
    if (!value) {
      if (required) {
        throw new Error(`${name} is not configured.`);
      }

      return;
    }

    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} is not a valid URL.`);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`${name} must use HTTP or HTTPS.`);
    }
  }

  function validateConfig(config) {
    validateUrl(config.SUPABASE_URL, "SUPABASE_URL");
    validateUrl(config.WEBAPP_URL, "WEBAPP_URL");

    // AI proxy is optional.
    if (config.AI_PROXY_URL) {
      validateUrl(config.AI_PROXY_URL, "AI_PROXY_URL", {
        required: false
      });
    }

    if (
      !config.SUPABASE_ANON_KEY ||
      typeof config.SUPABASE_ANON_KEY !== "string"
    ) {
      throw new Error("SUPABASE_ANON_KEY is missing.");
    }

    if (!config.SUPABASE_ANON_KEY.startsWith("eyJ")) {
      console.warn(
        "ClipMarginal: SUPABASE_ANON_KEY does not look like a Supabase JWT."
      );
    }

    if (
      !config.LIMITS ||
      typeof config.LIMITS.MAX_COMMENTARY_LENGTH !== "number"
    ) {
      throw new Error("ClipMarginal limits are not configured correctly.");
    }
  }

  // --------------------------------------------------------------------
  // Helpers exposed to the rest of the extension
  // --------------------------------------------------------------------

  function trimTrailingSlashes(value) {
    return typeof value === "string" ? value.replace(/\/+$/, "") : value;
  }

  function getWebAppUrl(path = "") {
    const base = trimTrailingSlashes(CONFIG.WEBAPP_URL);

    if (!path) {
      return base;
    }

    return `${base}/${String(path).replace(/^\/+/, "")}`;
  }

  function getAiProxyUrl(path = "") {
    if (!CONFIG.AI_PROXY_URL) {
      return null;
    }

    const base = trimTrailingSlashes(CONFIG.AI_PROXY_URL);

    if (!path) {
      return base;
    }

    return `${base}/${String(path).replace(/^\/+/, "")}`;
  }

  function isFeatureEnabled(name) {
    return CONFIG.FEATURES[name] === true;
  }

  validateConfig(CONFIG);

  window.CLIPMARGINAL_CONFIG = CONFIG;

  window.CLIPMARGINAL_CONFIG_UTILS = Object.freeze({
    getWebAppUrl,
    getAiProxyUrl,
    isFeatureEnabled
  });

  console.info(`ClipMarginal ${CONFIG.APP.VERSION} configuration loaded.`);
})();
