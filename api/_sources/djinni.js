// Djinni — best-effort HTML scraping of the public jobs listing.
//
// NOTE: Djinni has no public API and sits behind anti-bot protection, so this
// source may return [] (blocked / markup changed). It is wrapped so failures
// are non-fatal to the overall search. Treat results as a bonus, not a
// guarantee. Respect Djinni's Terms of Service.

import * as cheerio from "cheerio";
import { fetchText } from "../_lib/fetch.js";
import { normalizeJob } from "../_lib/jobs.js";

export async function fetchDjinni({ query = "", remote = "any" } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("all-keywords", query);
  if (remote === "remote") params.set("employment", "remote");
  const url = `https://djinni.co/jobs/?${params.toString()}`;

  // Djinni sits behind Cloudflare and frequently returns 403 to datacenter
  // IPs (e.g. Vercel). A browser-like Referer helps marginally but is not a
  // guarantee — treat results as best-effort.
  const html = await fetchText(url, {
    timeout: 12000,
    headers: { Referer: "https://djinni.co/jobs/" },
  });
  const $ = cheerio.load(html);
  const jobs = [];

  $("li.list-jobs__item, .job-list-item, [data-analytics='job_item']").each(
    (_, el) => {
      const card = $(el);
      const link = card.find('a.job-item__title-link, a[href^="/jobs/"]').first();
      const href = link.attr("href");
      if (!href) return;

      jobs.push(
        normalizeJob({
          source: "djinni",
          title: link.text().trim(),
          company: card.find(".job-item__company-name, .text-body").first().text().trim(),
          location: card.find(".location-text, .job-item__location").first().text().trim(),
          url: href.startsWith("http") ? href : "https://djinni.co" + href.split("?")[0],
          description: card.find(".job-item__description, .js-truncated-text").first().text().trim(),
          remote: remote === "remote" ? true : null,
        })
      );
    }
  );

  return jobs;
}
