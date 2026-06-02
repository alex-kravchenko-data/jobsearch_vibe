// OLX.ua — best-effort search via the public offers API.
//
// NOTE: passing a specific Jobs category_id returned HTTP 400 (the id appears
// invalid / non-leaf), so we query by keyword only and let the downstream
// keyword filter drop non-job results. OLX remains best-effort: it may
// rate-limit or change its API, so failures are non-fatal.

import { normalizeJob } from "../_lib/jobs.js";

export async function fetchOlx({ query = "", location = "" } = {}) {
  const params = new URLSearchParams({ offset: "0", limit: "40" });
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
