// Shared CORS helper. The static frontend (GitHub Pages) lives on a different
// origin than this serverless API (Vercel), so every response needs CORS headers.
//
// Set ALLOWED_ORIGIN env var to your GitHub Pages URL in production
// (e.g. https://<user>.github.io). Defaults to "*" for easy local dev.

export function applyCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // handled — caller should return
  }
  return false;
}
