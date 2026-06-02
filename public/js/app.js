// Main app controller: wires the form, auth, search, rendering and export.

import { CONFIG } from "./config.js";
import { initAuth, getUser, isConfigured } from "./auth.js";
import { searchJobs } from "./api.js";
import { exportCsv, exportJson } from "./export.js";
import { esc, formatDate, initTheme, initTabs } from "./ui.js";
import { initResume } from "./resume.js";

const els = {
  form: document.getElementById("search-form"),
  q: document.getElementById("q"),
  remote: document.getElementById("remote"),
  location: document.getElementById("location"),
  tools: document.getElementById("tools"),
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
    tools: els.tools.value.trim(),
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
  renderSkeleton();

  try {
    const data = await searchJobs(opts);
    lastResults = data.jobs || [];
    renderResults(lastResults);

    const errEntries = Object.entries(data.errors || {});
    const errNote = errEntries.length
      ? ` · <span class="err" title="${esc(errEntries.map(([k, v]) => `${k}: ${v}`).join(" | "))}">помилки джерел: ${errEntries.map(([k, v]) => `${esc(k)} (${esc(String(v))})`).join(", ")}</span>`
      : "";
    const smartNote = smart ? " (відсортовано за релевантністю)" : "";
    setStatus(
      `Знайдено <b>${data.count}</b> із ${data.total}${smartNote}. Джерела: ${data.sources.join(", ")}${errNote}`
    );
    setExportEnabled(lastResults.length > 0);
  } catch (err) {
    els.results.innerHTML = "";
    setStatus(`<span class="err">Помилка: ${err.message}. Перевірте API_BASE у config.js.</span>`);
  }
}

function renderSkeleton(n = 6) {
  els.results.classList.remove("list-view");
  els.results.innerHTML = Array.from({ length: n })
    .map(
      () => `<article class="card skel-card">
        <div class="skel skel-line lg"></div>
        <div class="skel skel-line sm"></div>
        <div class="skel skel-line md"></div>
        <div class="skel-tags"><span class="skel skel-pill"></span><span class="skel skel-pill"></span></div>
      </article>`
    )
    .join("");
}

function emptyState(text) {
  return `<div class="empty-state">
      <img src="./logo.svg" alt="" width="88" height="88" />
      <p>${text}</p>
    </div>`;
}

function renderResults(jobs) {
  if (!jobs.length) {
    els.results.innerHTML = emptyState("Нічого не знайдено. Спробуйте інший запит, прибрати фільтри або змінити джерела.");
    return;
  }
  els.results.innerHTML = jobs.map(card).join("");
}

function card(j) {
  const remoteTag = j.remote === true ? `<span class="tag remote">Remote</span>` : "";
  const scoreTag = j._score ? `<span class="tag score">★ ${j._score}</span>` : "";
  const loc = j.location ? `<span class="tag">${esc(j.location)}</span>` : "";
  const dateStr = formatDate(j.postedAt);
  const dateTag = dateStr ? `<span class="tag date">📅 ${esc(dateStr)}</span>` : "";
  const salary = j.salary ? `<div class="salary">💰 ${esc(j.salary)}</div>` : "";
  const desc = j.description ? `<p>${esc(j.description.slice(0, 220))}</p>` : "";
  return `
    <article class="card">
      <h3><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title) || "Без назви"}</a></h3>
      ${j.company ? `<div class="company">${esc(j.company)}</div>` : ""}
      ${salary}
      <div class="meta">
        <span class="tag src">${esc(j.source)}</span>
        ${remoteTag}${loc}${dateTag}${scoreTag}
      </div>
      ${desc}
    </article>`;
}

function setStatus(html) { els.status.innerHTML = html; }
function setExportEnabled(on) {
  els.exportCsv.disabled = !on;
  els.exportJson.disabled = !on;
}

// ── Wire up events ──
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(false);
});
els.smartBtn.addEventListener("click", () => runSearch(true));
els.exportCsv.addEventListener("click", () => exportCsv(lastResults));
els.exportJson.addEventListener("click", () => exportJson(lastResults));

// View toggle (grid / list)
document.querySelectorAll(".vbtn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".vbtn").forEach((x) => x.classList.toggle("active", x === b));
    els.results.classList.toggle("list-view", b.dataset.view === "list");
  });
});

// Init shared UI + the other tabs
initTheme();
initTabs();
initResume();
initAuth(() => {}).catch((e) => console.error("Auth init failed:", e));

// Friendly initial state
els.results.innerHTML = emptyState("Почніть пошук — напр. «senior motion designer».");
