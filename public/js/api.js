// Thin client over the serverless API.

import { apiUrl } from "./config.js";

const ACCESS_CODE_KEY = "jsv_access_code";

export function getAccessCode() {
  return localStorage.getItem(ACCESS_CODE_KEY) || "";
}
export function setAccessCode(code) {
  if (code) localStorage.setItem(ACCESS_CODE_KEY, code);
  else localStorage.removeItem(ACCESS_CODE_KEY);
}

export async function searchJobs({ query, remote, location, tools, category, sources, smart }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (remote && remote !== "any") params.set("remote", remote);
  if (location) params.set("location", location);
  if (tools) params.set("tools", tools);
  if (category) params.set("category", category);
  if (sources?.length) params.set("sources", sources.join(","));
  if (smart) params.set("smart", "1");

  const res = await fetch(apiUrl(`/api/search?${params.toString()}`));
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function postJson(path, body) {
  const headers = { "Content-Type": "application/json" };
  const code = getAccessCode();
  if (code) headers["x-access-code"] = code;

  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function analyzeResume({ filename, mimeType, dataBase64, jobDescription }) {
  return postJson("/api/resume", { filename, mimeType, dataBase64, jobDescription });
}
