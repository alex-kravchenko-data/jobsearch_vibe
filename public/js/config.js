// ── Frontend configuration ──────────────────────────────────────────────
// Edit these values after you deploy.

export const CONFIG = {
  // URL of your deployed Vercel API (no trailing slash).
  // For local dev with `vercel dev` this is usually http://localhost:3000.
  // Leave "" to use a same-origin "/api" (works if frontend+API are co-hosted).
  API_BASE: "https://jobsearch-vibe.vercel.app",

  // ── Supabase Auth (optional) ──
  // Create a free project at https://supabase.com, then paste the project URL
  // and the public anon key here. Leave empty to run in guest mode (no login).
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // If true, users must sign in before searching. Ignored in guest mode.
  REQUIRE_AUTH: false,
};

export function apiUrl(path) {
  const base = CONFIG.API_BASE || "";
  return `${base}${path}`;
}
