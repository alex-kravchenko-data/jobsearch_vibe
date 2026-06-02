// GET /api/search
//
// Query params:
//   q        - search query (e.g. "senior motion designer")
//   remote   - "remote" | "office" | "any"  (default "any")
//   location - free-text city filter (e.g. "Київ")
//   tools    - comma-separated tool phrases to require in the vacancy text
//   sources  - comma list to restrict sources (dou,work.ua,robota.ua)
//   smart    - "1" to enable "smart search" relevance ranking
//   limit    - max results (default 100)
//
// Aggregates all enabled sources in parallel, normalizes, dedupes, filters,
// and (optionally) ranks. A single failing source never breaks the response.
//
// Only reliable, datacenter-accessible sources are wired up. Djinni/LinkedIn
// were dropped because they return 403 to serverless (Cloudflare / anti-bot).

import { applyCors } from "./_lib/cors.js";
import { dedupe, applyFilters } from "./_lib/jobs.js";
import { smartRank } from "./_lib/rank.js";
import { fetchDou } from "./_sources/dou.js";
import { fetchWorkUa } from "./_sources/workua.js";
import { fetchRobotaUa } from "./_sources/robotaua.js";

const ALL_SOURCES = {
  dou: (opts) => fetchDou({ query: opts.query, category: opts.category }),
  "work.ua": (opts) => fetchWorkUa({ query: opts.query, remote: opts.remote }),
  "robota.ua": (opts) => fetchRobotaUa({ query: opts.query, remote: opts.remote, location: opts.location }),
};

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.searchParams;
  const query = (p.get("q") || "").trim();
  const remote = p.get("remote") || "any";
  const location = (p.get("location") || "").trim();
  const category = (p.get("category") || "").trim();
  const tools = (p.get("tools") || "").trim();
  const smart = p.get("smart") === "1";
  const limit = Math.min(parseInt(p.get("limit") || "100", 10) || 100, 300);

  let requested = (p.get("sources") || "dou,work.ua,robota.ua")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ALL_SOURCES[s]);
  if (requested.length === 0) requested = Object.keys(ALL_SOURCES);

  const opts = { query, remote, location, category };

  const settled = await Promise.allSettled(
    requested.map((name) => ALL_SOURCES[name](opts))
  );

  const errors = {};
  let jobs = [];
  settled.forEach((r, i) => {
    const name = requested[i];
    if (r.status === "fulfilled") jobs = jobs.concat(r.value);
    else errors[name] = r.reason?.message || "failed";
  });

  jobs = dedupe(jobs);
  jobs = applyFilters(jobs, { query, remote, location, tools });

  let ranked;
  if (smart && query) {
    ranked = await smartRank(jobs, query, { limit });
  } else {
    ranked = jobs.slice(0, limit);
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
  res.status(200).json({
    query,
    count: ranked.length,
    total: jobs.length,
    smart,
    sources: requested,
    errors,
    jobs: ranked,
  });
}
