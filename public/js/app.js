// Main app controller: wires the form, auth, search, rendering and export.

import { CONFIG } from "./config.js";
import { initAuth, getUser, isConfigured } from "./auth.js";
import { searchJobs } from "./api.js";
import { exportCsv, exportJson } from "./export.js";

const els = {
  form: document.getElementById("search-form"),
  q: document.getElementById("q"),
  remote: document.getElementById("remote"),
  location: document.getElementById("location"),
  category: document.getElementById("category"),
  smartBtn: document.getElementById("smart-btn"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  exportCsv: document.getElementById("export-csv"),
  exportJson: document.getElementById("export-json"),
};

let lastResults = [];

function readForm(smart) {
  const sources = [...document.querySelectorAll(".src:checked")].map((c) => c.value);
  return {
    query: els.q.value.trim(),
    remote: els.remote.value,
    location: els.location.value.trim(),
    category: els.category.value,
    sources,
    smart,
  };
}

async function runSearch(smart) {
  if (CONFIG.REQUIRE_AUTH && isConfigured() && !getUser()) {
    setStatus(`<span class="err">Увійдіть, щоб шукати вакансії.</span>`);
    return;
  }
  const opts = readForm(smart);
  if (!opts.query) {
    setStatus(`<span class="err">Введіть запит для пошуку.</span>`);
    return;
  }

  setStatus(`<span class="loader"></span> ${smart ? "Розумний пошук" : "Шукаю"}…`);
  setExportEnabled(false);
  els.results.innerHTML = "";

  try {
    const data = await searchJobs(opts);
    lastResults = data.jobs || [];
    renderResults(lastResults);

    const errNote = Object.keys(data.errors || {}).length
      ? ` · <span class="err">помилки джерел: ${Object.keys(data.errors).join(", ")}</span>`
      : "";
    const smartNote = smart ? " (відсортовано за релевантністю)" : "";
    setStatus(
      `Знайдено <b>${data.count}</b> із ${data.total}${smartNote}. Джерела: ${data.sources.join(", ")}${errNote}`
    );
    setExportEnabled(lastResults.length > 0);
  } catch (err) {
    setStatus(`<span class="err">Помилка: ${err.message}. Перевірте API_BASE у config.js.</span>`);
  }
}

function renderResults(jobs) {
  if (!jobs.length) {
    els.results.innerHTML = `<div class="empty">Нічого не знайдено. Спробуйте інший запит або джерела.</div>`;
    return;
  }
  els.results.innerHTML = jobs.map(card).join("");
}

function card(j) {
  const remoteTag = j.remote === true ? `<span class="tag remote">Remote</span>` : "";
  const scoreTag = j._score ? `<span class="tag score">★ ${j._score}</span>` : "";
  const loc = j.location ? `<span class="tag">${esc(j.location)}</span>` : "";
  const desc = j.description ? `<p>${esc(j.description.slice(0, 220))}</p>` : "";
  return `
    <article class="card">
      <h3><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title) || "Без назви"}</a></h3>
      ${j.company ? `<div class="company">${esc(j.company)}</div>` : ""}
      <div class="meta">
        <span class="tag src">${esc(j.source)}</span>
        ${remoteTag}${loc}${scoreTag}
      </div>
      ${desc}
    </article>`;
}

function setStatus(html) { els.status.innerHTML = html; }
function setExportEnabled(on) {
  els.exportCsv.disabled = !on;
  els.exportJson.disabled = !on;
}
function esc(s = "") {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ── Wire up events ──
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(false);
});
els.smartBtn.addEventListener("click", () => runSearch(true));
els.exportCsv.addEventListener("click", () => exportCsv(lastResults));
els.exportJson.addEventListener("click", () => exportJson(lastResults));

initAuth(() => {}).catch((e) => console.error("Auth init failed:", e));
