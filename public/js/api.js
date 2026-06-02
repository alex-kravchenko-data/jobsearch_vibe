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

async function postJson(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

export function analyzeResume({ filename, mimeType, dataBase64 }) {
  return postJson("/api/resume", { filename, mimeType, dataBase64 });
}

export function analyzeLinkedIn(profileText) {
  return postJson("/api/linkedin", { profileText });
}
