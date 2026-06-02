// DOU.ua — uses the official public RSS feeds (jobs.dou.ua/vacancies/feeds/).
// This is the most reliable + legal source: DOU publishes these feeds for
// public consumption. Supports category and free-text search params.
//
// Categories useful here: "Design" (covers motion/graphic), plus we pass the
// raw query as ?search= so IT roles come through too.

import { XMLParser } from "fast-xml-parser";
import { fetchText } from "../_lib/fetch.js";
import { normalizeJob } from "../_lib/jobs.js";

// processEntities:false avoids fast-xml-parser's entity-expansion safety limit
// (DOU feeds contain >1000 HTML entities). We decode the entities we care about
// ourselves in decode() below, then strip the HTML.
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });

export async function fetchDou({ query = "", category = "" } = {}) {
  // The DOU RSS feed endpoint supports `category`/`city` only — not free-text
  // search. The query is applied later in applyFilters(), so we just fetch the
  // relevant category feed (or the latest-vacancies feed when no category).
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const qs = params.toString();
  const url = `https://jobs.dou.ua/vacancies/feeds/${qs ? `?${qs}` : ""}`;

  const xml = await fetchText(url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });
  const data = parser.parse(xml);
  const items = toArray(data?.rss?.channel?.item);

  return items.map((item) => {
    // DOU titles look like: "Senior Motion Designer at SomeCompany"
    const rawTitle = decode(item.title || "");
    const [title, company] = splitTitleCompany(rawTitle);
    const description = stripHtml(decode(item.description || ""));
    return normalizeJob({
      source: "dou",
      title,
      company,
      location: extractCity(description),
      url: item.link || "",
      description,
      postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      tags: category ? [category] : [],
    });
  });
}

function splitTitleCompany(s) {
  const idx = s.lastIndexOf(" at ");
  if (idx === -1) return [s, ""];
  return [s.slice(0, idx).trim(), s.slice(idx + 4).trim()];
}

function extractCity(desc) {
  // DOU descriptions often mention city/remote near the start.
  const m = desc.match(/(Київ|Львів|Харків|Одеса|Дніпро|Remote|Віддалено)/i);
  return m ? m[1] : "";
}

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // last, so we don't double-decode
}

function safeChar(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}
