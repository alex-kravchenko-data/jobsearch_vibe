// Supabase-based authentication with graceful guest-mode fallback.
//
// If SUPABASE_URL / SUPABASE_ANON_KEY are not set in config.js, the app runs
// in "guest mode": no login required, everything still works. As soon as you
// fill those in, email magic-link auth is enabled automatically.

import { CONFIG } from "./config.js";

let supabase = null;
let currentUser = null;

export function isConfigured() {
  return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
}

export function getUser() {
  return currentUser;
}

export async function initAuth(onChange) {
  const el = document.getElementById("auth");

  if (!isConfigured()) {
    el.innerHTML = `<span class="auth-status">Гостьовий режим</span>`;
    onChange(null);
    return;
  }

  // Dynamically import the Supabase client only when configured.
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  render(el, onChange);

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    render(el, onChange);
  });

  onChange(currentUser);
}

function render(el, onChange) {
  if (currentUser) {
    el.innerHTML = `
      <span class="auth-status">${currentUser.email || "Увійшли"}</span>
      <button class="btn btn-ghost" id="logout-btn">Вийти</button>`;
    el.querySelector("#logout-btn").onclick = async () => {
      await supabase.auth.signOut();
      onChange(null);
    };
  } else {
    el.innerHTML = `<button class="btn btn-primary" id="login-btn">Увійти</button>`;
    el.querySelector("#login-btn").onclick = signIn;
  }
}

async function signIn() {
  const email = prompt("Введіть email — надішлемо магічне посилання для входу:");
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  alert(
    error
      ? "Помилка: " + error.message
      : "Перевірте пошту — ми надіслали посилання для входу."
  );
}
