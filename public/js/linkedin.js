// LinkedIn tab: paste profile text, send to /api/linkedin, render suggestions.

import { analyzeLinkedIn } from "./api.js";
import { esc } from "./ui.js";

export function initLinkedIn() {
  const textarea = document.getElementById("linkedin-text");
  const btn = document.getElementById("linkedin-analyze");
  const status = document.getElementById("linkedin-status");
  const result = document.getElementById("linkedin-result");
  if (!textarea || !btn) return;

  btn.addEventListener("click", async () => {
    const profileText = textarea.value.trim();
    if (profileText.length < 30) {
      status.innerHTML = `<span class="err">Вставте більше тексту вашого профілю.</span>`;
      return;
    }

    btn.disabled = true;
    result.innerHTML = "";
    status.innerHTML = `<span class="loader"></span> Аналізую профіль (це може зайняти до хвилини)…`;

    try {
      const data = await analyzeLinkedIn(profileText);
      status.innerHTML = "";
      renderLinkedInAnalysis(result, data);
    } catch (err) {
      status.innerHTML = `<span class="err">Помилка: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
    }
  });
}

function renderLinkedInAnalysis(root, d) {
  const headlines = (d.headlines || []).map((h) => `<li>${esc(h)}</li>`).join("");
  const tips = (d.experienceTips || [])
    .map((t) => `<li><b>${esc(t.section)}:</b> ${esc(t.advice)}</li>`)
    .join("");
  const skills = (d.skills || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("");

  root.innerHTML = `
    <div class="block">
      <h3>Загальна оцінка <span class="score-badge">${esc(d.score)} / 10</span></h3>
      <p>${esc(d.overall)}</p>
    </div>
    ${headlines ? `<div class="block"><h3>🏷️ Варіанти Headline</h3><ul>${headlines}</ul></div>` : ""}
    ${tips ? `<div class="block"><h3>🔧 Поради по секціях</h3><ul>${tips}</ul></div>` : ""}
    ${skills ? `<div class="block"><h3>🔑 Навички / ключові слова</h3><div class="chips">${skills}</div></div>` : ""}
    <div class="block">
      <h3>📝 Переписана секція About</h3>
      <textarea class="rewrite" id="linkedin-rewrite"></textarea>
      <div class="rewrite-actions">
        <button type="button" class="btn btn-ghost" id="linkedin-copy">📋 Копіювати</button>
      </div>
    </div>`;

  const ta = root.querySelector("#linkedin-rewrite");
  ta.value = d.aboutRewrite || "";
  root.querySelector("#linkedin-copy").onclick = () => navigator.clipboard.writeText(ta.value);
}
