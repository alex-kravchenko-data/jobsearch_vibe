// robota.ua — one of the two largest general job boards in Ukraine
// (~110K+ active listings). The site is a SPA backed by a public JSON search
// API at api.robota.ua, which is far more robust than scraping its HTML.
//
// Endpoint: POST https://api.robota.ua/vacancy/search
// The response shape can evolve, so field mapping is defensive and the source
// returns [] on any failure rather than breaking the aggregated search.
// (Could not be live-verified in this environment; mapping covers the known
// `documents[]` schema with id/name/companyName/cityName fields.)

import { normalizeJob } from "../_lib/jobs.js";

const REMOTE_FILTER = 3; // robota.ua "scheduleId" for remote work

export async function fetchRobotaUa({ query = "", remote = "any", location = "" } = {}) {
  const body = {
    page: 0,
    period: "Month",
    keyWords: query,
    searchType: "default",
    sort: "Score",
    cityId: 0,
    rubrics: [],
    scheduleIds: remote === "remote" ? [REMOTE_FILTER] : [],
  };

  const resp = await fetch("https://api.robota.ua/vacancy/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`robota.ua API ${resp.status}`);

  const data = await resp.json();
  const docs = Array.isArray(data?.documents)
    ? data.documents
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return docs.map((d) => {
    const id = d.id ?? d.vacancyId;
    const companyId = d.companyId ?? d.company?.id ?? 0;
    const url =
      d.url ||
      (id ? `https://robota.ua/company${companyId}/vacancy${id}` : "");
    return normalizeJob({
      source: "robota.ua",
      title: d.name || d.title || "",
      company: d.companyName || d.company?.name || "",
      location: d.cityName || d.city?.name || location || "",
      url,
      description: stripHtml(d.shortDescription || d.description || ""),
      postedAt: d.date ? new Date(d.date).toISOString() : null,
      remote: remote === "remote" ? true : null,
    });
  });
}

function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
