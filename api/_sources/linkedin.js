// LinkedIn — DISABLED BY DEFAULT.
//
// ⚠️  Scraping LinkedIn violates its User Agreement, and LinkedIn aggressively
// blocks automated access (rate limits, CAPTCHAs, IP bans). This module uses
// the unofficial "jobs-guest" endpoint that powers LinkedIn's public,
// logged-out job widget. It is brittle and may stop working at any time.
//
// It only runs if the env var ENABLE_LINKEDIN === "true". Enable at your own
// risk and responsibility. The recommended path is to rely on DOU / work.ua /
// Djinni instead.

import * as cheerio from "cheerio";
import { fetchText } from "../_lib/fetch.js";
import { normalizeJob } from "../_lib/jobs.js";

export function linkedinEnabled() {
  return process.env.ENABLE_LINKEDIN === "true";
}

export async function fetchLinkedIn({ query = "", location = "Ukraine", remote = "any" } = {}) {
  if (!linkedinEnabled()) return [];

  const params = new URLSearchParams();
  if (query) params.set("keywords", query);
  if (location) params.set("location", location);
  if (remote === "remote") params.set("f_WT", "2"); // 2 = Remote
  params.set("start", "0");

  const url =
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" +
    params.toString();

  const html = await fetchText(url, { timeout: 12000 });
  const $ = cheerio.load(html);
  const jobs = [];

  $("li").each((_, el) => {
    const card = $(el);
    const title = card.find(".base-search-card__title").text().trim();
    const company = card.find(".base-search-card__subtitle").text().trim();
    const loc = card.find(".job-search-card__location").text().trim();
    const href = card.find("a.base-card__full-link").attr("href");
    if (!title || !href) return;

    jobs.push(
      normalizeJob({
        source: "linkedin",
        title,
        company,
        location: loc,
        url: href.split("?")[0],
        remote: remote === "remote" ? true : null,
      })
    );
  });

  return jobs;
}
