// "Smart search" ranking.
//
// Two modes:
//  1. Heuristic (default, no API key needed): scores each job by how well its
//     title/tags/company match the query terms, with title matches weighted
//     highest. Filters out low-relevance noise.
//  2. LLM rerank (optional): if ANTHROPIC_API_KEY is set, asks Claude to pick
//     and order the most relevant jobs. Falls back to heuristic on any error.

import { tokenize } from "./jobs.js";

export function heuristicScore(job, query) {
  const terms = tokenize(query);
  if (terms.length === 0) return 1;

  const title = job.title.toLowerCase();
  const tags = job.tags.join(" ").toLowerCase();
  const body = `${job.company} ${job.description}`.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 5;
    if (tags.includes(term)) score += 3;
    if (body.includes(term)) score += 1;
  }
  // Bonus for exact phrase in title (e.g. "motion designer").
  if (terms.length > 1 && title.includes(terms.join(" "))) score += 4;
  // Slight freshness bonus.
  if (job.postedAt) {
    const ageDays = (Date.now() - new Date(job.postedAt).getTime()) / 86400000;
    if (ageDays >= 0 && ageDays < 7) score += 1;
  }
  return score;
}

export function heuristicRank(jobs, query, { limit = 50 } = {}) {
  const scored = jobs
    .map((j) => ({ job: j, score: heuristicScore(j, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => ({ ...x.job, _score: x.score }));
}

export async function smartRank(jobs, query, opts = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  // Pre-rank heuristically so we only send a manageable shortlist to the LLM.
  const shortlist = heuristicRank(jobs, query, { limit: 40 });

  if (!key || shortlist.length === 0) {
    return heuristicRank(jobs, query, opts);
  }

  try {
    const ordered = await claudeRerank(shortlist, query, key, opts.limit || 25);
    return ordered.length ? ordered : shortlist.slice(0, opts.limit || 25);
  } catch (err) {
    console.error("Claude rerank failed, using heuristic:", err.message);
    return shortlist.slice(0, opts.limit || 25);
  }
}

async function claudeRerank(jobs, query, apiKey, limit) {
  const items = jobs.map((j, i) => ({
    i,
    title: j.title,
    company: j.company,
    location: j.location,
    tags: j.tags.slice(0, 8),
  }));

  const prompt =
    `User is searching for: "${query}".\n` +
    `Here are candidate job postings as JSON:\n${JSON.stringify(items)}\n\n` +
    `Return ONLY a JSON array of the indices (the "i" field) of the jobs that ` +
    `are genuinely relevant to the search, ordered from most to least relevant. ` +
    `Drop irrelevant/noise postings. Max ${limit} indices. Example: [3,0,7]`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`);
  const data = await resp.json();
  const text = data?.content?.[0]?.text || "[]";
  const match = text.match(/\[[\d,\s]*\]/);
  const indices = match ? JSON.parse(match[0]) : [];

  return indices
    .filter((i) => Number.isInteger(i) && jobs[i])
    .slice(0, limit)
    .map((i) => jobs[i]);
}
