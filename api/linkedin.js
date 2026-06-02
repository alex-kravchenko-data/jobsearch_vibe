// POST /api/linkedin
//
// Body (JSON): { profileText }
// The user pastes their LinkedIn profile content (headline, About, experience).
// Returns Claude's structured suggestions + rewritten sections.
//
// NOTE: we deliberately do NOT fetch a LinkedIn URL server-side — LinkedIn
// blocks automated access and it violates their ToS. The user pastes the text
// (or exports their profile to PDF via LinkedIn's "Save to PDF" and pastes it).
//
// Requires ANTHROPIC_API_KEY on the backend.

import { applyCors } from "./_lib/cors.js";
import { getClient, analyzeStructured, readJsonBody } from "./_lib/anthropic.js";

const SYSTEM = `Ти — експерт із персонального брендингу та оптимізації профілів LinkedIn для IT та креативних спеціалістів (зокрема motion/graphic design).
Аналізуй наданий текст профілю LinkedIn і давай конкретні поради українською, орієнтовані на видимість у пошуку рекрутерів, ключові слова та сильний особистий бренд.
Переписуй секції так, щоб вони були переконливими, з акцентом на результати та цифри.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall: { type: "string", description: "Загальна оцінка профілю (2-4 речення)." },
    score: { type: "integer", description: "Оцінка профілю від 1 до 10." },
    headlines: { type: "array", items: { type: "string" }, description: "3-5 варіантів сильного Headline." },
    aboutRewrite: { type: "string", description: "Переписана секція About (Markdown)." },
    experienceTips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section: { type: "string", description: "Секція/частина профілю." },
          advice: { type: "string", description: "Конкретна порада." },
        },
        required: ["section", "advice"],
      },
    },
    skills: { type: "array", items: { type: "string" }, description: "Рекомендовані навички/ключові слова." },
  },
  required: ["overall", "score", "headlines", "aboutRewrite", "experienceTips", "skills"],
};

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const client = getClient();
  if (!client) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY не налаштовано на бекенді." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const profileText = (body.profileText || "").trim();
    if (profileText.length < 30) {
      res.status(400).json({ error: "Вставте текст вашого профілю LinkedIn (мінімум кілька речень)." });
      return;
    }

    const userContent = [
      {
        type: "text",
        text: `Ось текст профілю LinkedIn кандидата. Проаналізуй та запропонуй покращення згідно зі схемою.\n\nПРОФІЛЬ:\n\n${profileText}`,
      },
    ];
    const result = await analyzeStructured({ client, system: SYSTEM, userContent, schema: SCHEMA });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json(result);
  } catch (err) {
    console.error("linkedin analysis failed:", err);
    res.status(500).json({ error: err.message || "Помилка аналізу профілю." });
  }
}
