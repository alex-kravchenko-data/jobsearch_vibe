// Thin client over the serverless /api/search endpoint.

import { apiUrl } from "./config.js";

export async function searchJobs({ query, remote, location, category, sources, smart }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (remote && remote !== "any") params.set("remote", remote);
  if (location) params.set("location", location);
  if (category) params.set("category", category);
  if (sources?.length) params.set("sources", sources.join(","));
  if (smart) params.set("smart", "1");

  const res = await fetch(apiUrl(`/api/search?${params.toString()}`));
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
