// Client-side resume PDF generation (≤ 2 pages) via pdfmake.
// pdfmake is loaded from CDN on first use; a bundled Liberation Sans vfs
// (lazy-imported) provides Ukrainian/Cyrillic glyphs.

const PDFMAKE_SRC = "https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/pdfmake.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Не вдалося завантажити pdfmake"));
    document.head.appendChild(s);
  });
}

let ready;
async function ensurePdfMake() {
  if (ready) return ready;
  ready = (async () => {
    if (!window.pdfMake) await loadScript(PDFMAKE_SRC);
    const { vfs, fonts } = await import("./pdf-font.js");
    window.pdfMake.vfs = vfs;
    window.pdfMake.fonts = fonts;
    return window.pdfMake;
  })();
  return ready;
}

const ACCENT = "#c0653c";
const TEXT = "#2b2620";
const MUTED = "#7a7165";

function buildDocDefinition(r = {}) {
  const content = [];

  if (r.name) content.push({ text: r.name, fontSize: 22, bold: true, color: TEXT });
  if (r.headline) content.push({ text: r.headline, fontSize: 12, color: ACCENT, margin: [0, 1, 0, 2] });
  if (r.contacts) content.push({ text: r.contacts, fontSize: 9, color: MUTED, margin: [0, 0, 0, 6] });

  const section = (title) => ({
    text: title.toUpperCase(),
    fontSize: 11,
    bold: true,
    color: ACCENT,
    margin: [0, 10, 0, 4],
  });

  if (r.summary) {
    content.push(section("Профіль"));
    content.push({ text: r.summary, fontSize: 10, color: TEXT });
  }

  if (Array.isArray(r.experience) && r.experience.length) {
    content.push(section("Досвід"));
    for (const job of r.experience) {
      content.push({
        columns: [
          { text: [{ text: job.role || "", bold: true }, job.company ? { text: ` · ${job.company}`, color: MUTED } : {}], fontSize: 10.5 },
          { text: job.period || "", alignment: "right", color: MUTED, fontSize: 9 },
        ],
        margin: [0, 4, 0, 1],
      });
      if (Array.isArray(job.bullets) && job.bullets.length) {
        content.push({ ul: job.bullets, fontSize: 9.5, color: TEXT, margin: [0, 0, 0, 2] });
      }
    }
  }

  if (Array.isArray(r.skills) && r.skills.length) {
    content.push(section("Навички"));
    content.push({ text: r.skills.join("  ·  "), fontSize: 10, color: TEXT });
  }

  if (Array.isArray(r.education) && r.education.length) {
    content.push(section("Освіта"));
    for (const e of r.education) {
      content.push({
        columns: [
          { text: [{ text: e.title || "", bold: true }, e.place ? { text: ` · ${e.place}`, color: MUTED } : {}], fontSize: 10 },
          { text: e.period || "", alignment: "right", color: MUTED, fontSize: 9 },
        ],
        margin: [0, 2, 0, 0],
      });
    }
  }

  if (Array.isArray(r.languages) && r.languages.length) {
    content.push(section("Мови"));
    content.push({ text: r.languages.join("  ·  "), fontSize: 10, color: TEXT });
  }

  return {
    pageSize: "A4",
    pageMargins: [44, 40, 44, 40],
    defaultStyle: { font: "LibSans", fontSize: 10, lineHeight: 1.15, color: TEXT },
    content,
  };
}

export async function downloadResumePdf(resume, filename = "resume.pdf") {
  const pdfMake = await ensurePdfMake();
  pdfMake.createPdf(buildDocDefinition(resume)).download(filename);
}
