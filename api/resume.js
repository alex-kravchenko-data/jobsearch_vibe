// POST /api/resume
//
// Body (JSON): { filename, mimeType, dataBase64 }
// Accepts PDF, images (PNG/JPG/WebP), DOCX, and plain text / markdown.
// Returns Claude's structured assessment + an improved rewrite.
//
// Requires ANTHROPIC_API_KEY on the backend.

import { applyCors } from "./_lib/cors.js";
import { getClient, analyzeStructured, readJsonBody, checkAccessCode } from "./_lib/anthropic.js";

const SYSTEM = `Ти — досвідчений кар'єрний консультант і рекрутер в IT та креативних індустріях (зокрема motion/graphic design).
Аналізуй резюме кандидата уважно й конструктивно. Відповідай українською.
Давай конкретні, дієві поради (а не загальні фрази), орієнтуйся на проходження ATS-систем і на сучасні вимоги ринку.
У полі improvedResume надай повністю переписану, покращену версію резюме у форматі Markdown, готову до використання.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall: { type: "string", description: "Коротка загальна оцінка резюме (2-4 речення)." },
    score: { type: "integer", description: "Оцінка резюме від 1 до 10." },
    strengths: { type: "array", items: { type: "string" }, description: "Сильні сторони резюме." },
    improvements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string", description: "Що саме покращити (розділ/аспект)." },
          advice: { type: "string", description: "Конкретна порада." },
        },
        required: ["area", "advice"],
      },
    },
    keywords: { type: "array", items: { type: "string" }, description: "Ключові слова/навички, яких бракує для ATS." },
    improvedResume: { type: "string", description: "Покращена версія резюме у форматі Markdown." },
  },
  required: ["overall", "score", "strengths", "improvements", "keywords", "improvedResume"],
};

const INSTRUCTION = {
  type: "text",
  text: "Ось резюме кандидата. Проаналізуй його та запропонуй покращення згідно зі схемою відповіді.",
};

async function buildContent({ filename = "", mimeType = "", dataBase64 = "" }) {
  const mt = mimeType.toLowerCase();
  const name = filename.toLowerCase();

  if (mt.includes("pdf") || name.endsWith(".pdf")) {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: dataBase64 } },
      INSTRUCTION,
    ];
  }

  if (mt.startsWith("image/")) {
    return [
      { type: "image", source: { type: "base64", media_type: mt, data: dataBase64 } },
      INSTRUCTION,
    ];
  }

  if (mt.includes("word") || name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(dataBase64, "base64") });
    return [{ type: "text", text: `РЕЗЮМЕ (з DOCX):\n\n${value}` }, INSTRUCTION];
  }

  // Plain text / markdown / unknown — decode as UTF-8 text.
  const text = Buffer.from(dataBase64, "base64").toString("utf8");
  return [{ type: "text", text: `РЕЗЮМЕ:\n\n${text}` }, INSTRUCTION];
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  if (!checkAccessCode(req)) {
    res.status(401).json({ error: "Невірний або відсутній код доступу." });
    return;
  }

  const client = getClient();
  if (!client) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY не налаштовано на бекенді." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body.dataBase64) {
      res.status(400).json({ error: "Файл не надано." });
      return;
    }

    const userContent = await buildContent(body);
    const result = await analyzeStructured({ client, system: SYSTEM, userContent, schema: SCHEMA });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json(result);
  } catch (err) {
    console.error("resume analysis failed:", err);
    res.status(500).json({ error: err.message || "Помилка аналізу резюме." });
  }
}
