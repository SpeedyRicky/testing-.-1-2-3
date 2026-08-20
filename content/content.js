"use strict";

// Thin bootstrap: attaches each capture mode to the page. The actual
// button/state-machine implementations live in text-capture.js (text
// selection) and video-capture.js (video), both loaded before this file
// per manifest.json - this file used to carry its own full duplicate of
// both (a second "Clip this" button, a second video-marking widget,
// talking over its own message protocol), which meant every page showed
// two competing capture UIs fighting over the same click. One of each
// mode, both wired through the shared lib/*.js pending-list plumbing.

(function (root) {
  root.ClipMarginalTextCapture?.attach();
  root.ClipMarginalVideoCapture?.attach();
})(self);
