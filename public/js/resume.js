// Resume tab: upload a file (+ optional target vacancy), send to /api/resume,
// render Claude's analysis, and generate a 2-page PDF from the structured result.

import { analyzeResume, setAccessCode } from "./api.js";
import { downloadResumePdf } from "./pdf.js";
import { esc } from "./ui.js";

export function initResume() {
  const fileInput = document.getElementById("resume-file");
  const jdInput = document.getElementById("resume-jd");
  const btn = document.getElementById("resume-analyze");
  const status = document.getElementById("resume-status");
  const result = document.getElementById("resume-result");
  if (!fileInput || !btn) return;

  fileInput.addEventListener("change", () => {
    btn.disabled = !fileInput.files?.length;
  });

  btn.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      status.innerHTML = `<span class="err">Файл завеликий (макс. ~4 МБ).</span>`;
      return;
    }
    const jobDescription = (jdInput?.value || "").trim();

    btn.disabled = true;
    result.innerHTML = "";
    status.innerHTML = `<span class="loader"></span> Аналізую резюме${jobDescription ? " та підлаштовую під вакансію" : ""} (до хвилини)…`;

    try {
      const dataBase64 = await toBase64(file);
      const payload = { filename: file.name, mimeType: file.type, dataBase64, jobDescription };
      let data;
      try {
        data = await analyzeResume(payload);
      } catch (err) {
        if (err.status === 401) {
          const code = prompt("Введіть код доступу для аналізу:");
          if (!code) throw new Error("Потрібен код доступу.");
          setAccessCode(code.trim());
          data = await analyzeResume(payload);
        } else {
          throw err;
        }
      }
      status.innerHTML = "";
      renderResumeAnalysis(result, data, Boolean(jobDescription));
    } catch (err) {
      if (err.status === 401) setAccessCode("");
      status.innerHTML = `<span class="err">Помилка: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
    }
  });
}

function renderResumeAnalysis(root, d, hasJd) {
  const strengths = (d.strengths || []).map((s) => `<li>${esc(s)}</li>`).join("");
  const improvements = (d.improvements || [])
    .map((i) => `<li><b>${esc(i.area)}:</b> ${esc(i.advice)}</li>`)
    .join("");
  const keywords = (d.keywords || []).map((k) => `<span class="tag">${esc(k)}</span>`).join("");

  const t = d.tailoring || {};
  const tailoringBlock =
    hasJd && (t.summary || (t.missingKeywords || []).length || (t.gaps || []).length)
      ? `<div class="block">
          <h3>🎯 Відповідність вакансії <span class="score-badge">${esc(t.matchScore)}%</span></h3>
          ${t.summary ? `<p>${esc(t.summary)}</p>` : ""}
          ${(t.gaps || []).length ? `<p class="muted" style="margin:6px 0 2px">Прогалини:</p><ul>${(t.gaps || []).map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
          ${(t.missingKeywords || []).length ? `<p class="muted" style="margin:6px 0 2px">Бракує ключових слів:</p><div class="chips">${(t.missingKeywords || []).map((k) => `<span class="tag">${esc(k)}</span>`).join("")}</div>` : ""}
        </div>`
      : "";

  root.innerHTML = `
    <div class="block">
      <h3>Загальна оцінка <span class="score-badge">${esc(d.score)} / 10</span></h3>
      <p>${esc(d.overall)}</p>
    </div>
    ${tailoringBlock}
    ${strengths ? `<div class="block"><h3>✅ Сильні сторони</h3><ul>${strengths}</ul></div>` : ""}
    ${improvements ? `<div class="block"><h3>🔧 Що покращити</h3><ul>${improvements}</ul></div>` : ""}
    ${keywords ? `<div class="block"><h3>🔑 Ключові слова для ATS</h3><div class="chips">${keywords}</div></div>` : ""}
    <div class="block">
      <h3>📝 Покращена версія резюме</h3>
      <textarea class="rewrite" id="resume-rewrite"></textarea>
      <div class="rewrite-actions">
        <button type="button" class="btn btn-primary" id="resume-pdf">⬇ Завантажити PDF</button>
        <button type="button" class="btn btn-ghost" id="resume-copy">📋 Копіювати</button>
        <button type="button" class="btn btn-ghost" id="resume-download">⬇ .md</button>
      </div>
      <div class="status-bar" id="pdf-status"></div>
    </div>`;

  const ta = root.querySelector("#resume-rewrite");
  ta.value = d.improvedResume || "";
  root.querySelector("#resume-copy").onclick = () => navigator.clipboard.writeText(ta.value);
  root.querySelector("#resume-download").onclick = () => downloadText(ta.value, "improved-resume.md");

  const pdfBtn = root.querySelector("#resume-pdf");
  const pdfStatus = root.querySelector("#pdf-status");
  pdfBtn.onclick = async () => {
    pdfBtn.disabled = true;
    pdfStatus.innerHTML = `<span class="loader"></span> Генерую PDF…`;
    try {
      const name = (d.resume?.name || "resume").replace(/\s+/g, "_");
      await downloadResumePdf(d.resume || {}, `${name}.pdf`);
      pdfStatus.innerHTML = "";
    } catch (err) {
      pdfStatus.innerHTML = `<span class="err">PDF: ${esc(err.message)}</span>`;
    } finally {
      pdfBtn.disabled = false;
    }
  };
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
