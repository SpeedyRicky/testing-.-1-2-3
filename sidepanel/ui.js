// Stateless view/tab switching, shared by sidepanel.js (the
// navigation owner) and the module init functions that need to
// switch views as a side effect of an action (e.g. login -> compose).

import { $ } from "./state.js";

export function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("view-" + name).classList.remove("hidden");
}

export function setActiveTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
}

let toastTimer = null;

// #toast exists in sidepanel.html, fully styled (.toast in
// sidepanel.css), and was never actually shown by any code - this is
// its first real use.
export function showToast(message, durationMs = 2800) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, durationMs);
}
