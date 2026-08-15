// Login, signup, logout, and session refresh.

import { supabaseClient, setCurrentUser, setCurrentProfile, $ } from "./state.js";

export async function refreshSession() {
  const { data } = await supabaseClient.auth.getUser();
  setCurrentUser(data?.user || null);
  if (data?.user) {
    const { data: profile } = await supabaseClient
      .from("profiles").select("*").eq("id", data.user.id).single();
    setCurrentProfile(profile);
  }
}

// goTo is passed in rather than imported to avoid a circular import:
// sidepanel.js's goTo() calls into compose.js/feed.js, and auth.js
// needs to call goTo() after login/logout - injecting it keeps the
// dependency graph one-directional (state/ui <- auth <- sidepanel).
export function initAuth(goTo) {
  let isSignupMode = false;

  $("btn-signup").addEventListener("click", () => {
    isSignupMode = !isSignupMode;
    $("signup-username-field").classList.toggle("hidden", !isSignupMode);
    $("btn-login").textContent = isSignupMode ? "Create account" : "Log in";
    $("btn-signup").textContent = isSignupMode ? "Back to log in" : "Sign up instead";
  });

  // Listening on the form's submit event (not the button's click)
  // catches both "click Log in" and "press Enter in a field" in one
  // place - and critically, preventDefault() here stops the browser's
  // native form submission. #btn-login is type="submit" with no
  // preventDefault anywhere, inside a <form> with no action/method:
  // without this, clicking it fires our handler AND a real form
  // submit at the same time, which reloads sidepanel.html mid-request
  // and aborts the in-flight Supabase call before it can finish. That
  // reload is silent - no error shown, the panel just resets - which
  // is exactly what "login doesn't work" looks like from the outside.
  $("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    $("auth-error").classList.add("hidden");

    try {
      if (isSignupMode) {
        const username = $("auth-username").value.trim();
        if (!username) throw new Error("Pick a username.");
        const { error } = await supabaseClient.auth.signUp({
          email, password, options: { data: { username } }
        });
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await refreshSession();
      goTo("compose");
    } catch (e) {
      $("auth-error").textContent = e.message || "Something went wrong.";
      $("auth-error").classList.remove("hidden");
    }
  });

  $("btn-logout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    setCurrentUser(null);
    setCurrentProfile(null);
    goTo("feed");
  });
}
