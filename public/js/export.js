// Client-side export of results to CSV or JSON files.

export function exportJson(jobs) {
  download(
    JSON.stringify(jobs, null, 2),
    "application/json",
    `jobs-${stamp()}.json`
  );
}

export function exportCsv(jobs) {
  const cols = ["title", "company", "location", "remote", "source", "url", "postedAt"];
  const header = cols.join(",");
  const rows = jobs.map((j) => cols.map((c) => csvCell(j[c])).join(","));
  download([header, ...rows].join("\n"), "text/csv", `jobs-${stamp()}.csv`);
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function download(content, type, filename) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}
