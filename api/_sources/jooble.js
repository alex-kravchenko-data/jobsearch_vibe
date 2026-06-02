// Jooble — official public API (https://jooble.org/api/about).
//
// Jooble is a meta-aggregator that pulls listings from hundreds of job boards,
// so it gives the widest coverage of any single source — and it's a sanctioned
// API, not scraping. It requires a free API key.
//
// Get a key at https://jooble.org/api/about and set JOOBLE_API_KEY.
// Without the key this source returns [] (non-fatal), like the other gated ones.

import { normalizeJob, detectRemote } from "../_lib/jobs.js";

export function joobleEnabled() {
  return Boolean(process.env.JOOBLE_API_KEY);
}

export async function fetchJooble({ query = "", location = "Україна", remote = "any" } = {}) {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return [];

  const body = {
    keywords: query,
    location: remote === "remote" ? "" : location, // empty = anywhere
    page: 1,
  };

  const resp = await fetch(`https://jooble.org/api/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Jooble API ${resp.status}`);

  const data = await resp.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs.map((j) =>
    normalizeJob({
      source: "jooble",
      title: j.title || "",
      company: j.company || "",
      location: j.location || "",
      url: j.link || "",
      description: stripHtml(j.snippet || ""),
      postedAt: j.updated ? new Date(j.updated).toISOString() : null,
      remote: detectRemote(`${j.title} ${j.location} ${j.snippet}`),
    })
  );
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
