// Common job schema + helpers shared across all sources.
//
// Normalized job shape:
// {
//   id, source, title, company, location, remote (bool|null),
//   url, description, postedAt (ISO string|null), tags: string[]
// }

const REMOTE_HINTS = [
  "remote", "віддалено", "удаленно", "дистанційно", "anywhere", "worldwide",
];

export function detectRemote(text = "") {
  const t = text.toLowerCase();
  if (REMOTE_HINTS.some((h) => t.includes(h))) return true;
  return null; // unknown
}

// Matches salary mentions like "$2000", "1 500 – 3 000 $", "30000 грн", "від $1500".
const SALARY_RE =
  /(\$\s?\d[\d\s.,]*(?:\s?[–—-]\s?\$?\d[\d\s.,]*)?\s?(?:\$|usd|к|k)?|(?:від|from|до)\s?\$?\d[\d\s.,]+|\d[\d\s.,]{2,}\s?(?:грн|₴|uah|\$|usd|eur|€))/i;

export function extractSalary(...texts) {
  for (const t of texts) {
    const m = (t || "").match(SALARY_RE);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return "";
}

export function normalizeJob(raw) {
  const title = (raw.title || "").trim();
  const url = (raw.url || "").trim();
  let company = (raw.company || "").trim();

  // Salary sometimes ends up glued into the company field (esp. work.ua/robota.ua).
  // Prefer an explicit salary, otherwise sniff it out of title/company and strip it.
  let salary = (raw.salary || "").trim();
  if (!salary) salary = extractSalary(title, company);
  if (salary && company.includes(salary)) {
    company = company.replace(salary, "").replace(/^[\s•|,;·\-–—]+|[\s•|,;·\-–—]+$/g, "").trim();
  }

  return {
    id: raw.id || hashId(`${raw.source}:${url || title}`),
    source: raw.source || "unknown",
    title,
    company,
    salary,
    location: (raw.location || "").trim(),
    remote: raw.remote ?? detectRemote(`${title} ${raw.location || ""} ${raw.description || ""}`),
    url,
    description: (raw.description || "").trim(),
    postedAt: raw.postedAt || null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
  };
}

export function dedupe(jobs) {
  const seen = new Set();
  const out = [];
  for (const job of jobs) {
    const key = (job.url || `${job.title}|${job.company}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

// Apply user filters server-side.
// filters: { query, remote ("remote"|"office"|"any"), location }
export function applyFilters(jobs, { query, remote, location } = {}) {
  let out = jobs;

  if (remote === "remote") out = out.filter((j) => j.remote === true);
  else if (remote === "office") out = out.filter((j) => j.remote !== true);

  if (location) {
    const loc = location.toLowerCase();
    out = out.filter((j) => j.location.toLowerCase().includes(loc));
  }

  // Keyword pre-filter is loose here; precise ranking happens in rank.js.
  if (query) {
    const terms = tokenize(query);
    out = out.filter((j) => {
      const hay = `${j.title} ${j.company} ${j.tags.join(" ")} ${j.description}`.toLowerCase();
      return terms.some((t) => hay.includes(t));
    });
  }
  return out;
}

export function tokenize(str = "") {
  return str
    .toLowerCase()
    .split(/[^a-zа-яіїєґ0-9+#]+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return "j" + (h >>> 0).toString(36);
}
