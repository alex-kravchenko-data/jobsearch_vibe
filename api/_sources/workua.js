// work.ua — HTML scraping of the public search results page.
//
// URL pattern: https://www.work.ua/jobs-<remote->-<kw1>+<kw2>/
// Site markup changes over time, so selectors are defensive and the parser
// returns [] (rather than throwing) if it can't find cards — that way one
// broken source never kills the whole aggregated search.

import * as cheerio from "cheerio";
import { fetchText } from "../_lib/fetch.js";
import { normalizeJob } from "../_lib/jobs.js";

export async function fetchWorkUa({ query = "", remote = "any" } = {}) {
  const kw = query.trim().toLowerCase().replace(/\s+/g, "+");
  const remotePrefix = remote === "remote" ? "remote-" : "";
  const slug = kw ? `jobs-${remotePrefix}${kw}` : "jobs";
  const url = `https://www.work.ua/${slug}/`;

  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const jobs = [];

  // Each vacancy card. work.ua uses cards with an h2 > a linking to /jobs/<id>/
  $('div[id^="job-"], div.card.card-hover, .card.job-link').each((_, el) => {
    const card = $(el);
    const link = card.find('h2 a, a[href^="/jobs/"]').first();
    const href = link.attr("href");
    if (!href || !/\/jobs\/\d+/.test(href)) return;

    const title = link.text().trim() || link.attr("title") || "";
    const company =
      card.find('.add-top-xs .text-default-7, span.strong-600, .company-name')
        .first()
        .text()
        .trim() ||
      card.find('a[href^="/jobs-by-company/"]').first().text().trim();
    const location = card
      .find('.add-top-xs, .text-default-7')
      .first()
      .text()
      .trim();

    jobs.push(
      normalizeJob({
        source: "work.ua",
        title,
        company,
        location,
        url: "https://www.work.ua" + href.split("?")[0],
        description: card.find("p").first().text().trim(),
        remote: remote === "remote" ? true : null,
      })
    );
  });

  return jobs;
}
