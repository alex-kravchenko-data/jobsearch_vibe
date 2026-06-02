// Small shared UI helpers.

export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" });
}

// ── Theme toggle (persisted in localStorage) ──
export function initTheme() {
  const btn = document.getElementById("theme-toggle");
  const saved = localStorage.getItem("theme") || "light";
  apply(saved);
  btn?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    apply(next);
    localStorage.setItem("theme", next);
  });
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  }
}

// ── Tabs ──
export function initTabs() {
  const tabs = [...document.querySelectorAll(".tab")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".panel-view").forEach((v) => {
        v.classList.toggle("active", v.id === `view-${name}`);
      });
    });
  });
}
