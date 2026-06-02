// OLX.ua — Ukraine's biggest classifieds platform; its "Робота" (Jobs) section
// has very wide reach, especially for non-IT and regional roles.
//
// OLX's web app is powered by a public JSON API (api/v1/offers). We query the
// Jobs category. This is best-effort: OLX may rate-limit, change the API, or
// require region params, so failures are non-fatal and mapping is defensive.
// (Could not be live-verified here; category id 4 = "Робота / Бізнес".)

import { normalizeJob } from "../_lib/jobs.js";

const JOBS_CATEGORY_ID = 4; // OLX.ua top-level "Робота" category

export async function fetchOlx({ query = "", location = "" } = {}) {
  const params = new URLSearchParams({
    offset: "0",
    limit: "40",
    category_id: String(JOBS_CATEGORY_ID),
  });
  if (query) params.set("query", query);

  const resp = await fetch(`https://www.olx.ua/api/v1/offers/?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!resp.ok) throw new Error(`OLX API ${resp.status}`);

  const data = await resp.json();
  const offers = Array.isArray(data?.data) ? data.data : [];

  return offers.map((o) =>
    normalizeJob({
      source: "olx",
      title: o.title || "",
      company: getParam(o, "company") || "",
      location: o.location?.city?.name || location || "",
      url: o.url || "",
      description: (o.description || "").replace(/\s+/g, " ").trim(),
      postedAt: o.created_time || o.last_refresh_time || null,
      remote: getParam(o, "type")?.toLowerCase().includes("remote") || null,
    })
  );
}

// OLX stores structured attributes in a params[] array.
function getParam(offer, key) {
  const p = (offer.params || []).find((x) => x.key === key);
  return p?.value?.label || p?.value?.key || "";
}
