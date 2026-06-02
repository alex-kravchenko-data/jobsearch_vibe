// POST /api/resume
//
// Body (JSON): { filename, mimeType, dataBase64, jobDescription? }
// Accepts PDF, images (PNG/JPG/WebP), DOCX, and plain text / markdown.
// Returns Claude's structured assessment, an improved rewrite (markdown), a
// structured resume (for client-side PDF), and — if a job description is
// provided — a tailoring/gap analysis against it.
//
// Requires ANTHROPIC_API_KEY on the backend.

import { applyCors } from "./_lib/cors.js";
import { getClient, analyzeStructured, readJsonBody, checkAccessCode } from "./_lib/anthropic.js";

const SYSTEM = `Ти — досвідчений кар'єрний консультант і рекрутер в IT та креативних індустріях (зокрема motion/graphic design).
Аналізуй резюме кандидата уважно й конструктивно. Відповідай українською.
Давай конкретні, дієві поради (а не загальні фрази), орієнтуйся на проходження ATS-систем і на сучасні вимоги ринку.

Заповни ВСІ поля схеми:
- improvedResume: повністю переписана покращена версія у форматі Markdown.
- resume: те саме резюме, але структуровано по секціях (для генерації PDF).
  ВАЖЛИВО: резюме має бути лаконічним і вміщатися на 2 сторінки A4 — summary до 3 речень;
  до 4 місць досвіду; до 4 пунктів-досягнень у кожному (з цифрами, де можливо); до 14 навичок.
- tailoring: якщо надано опис цільової вакансії — оціни відповідність (matchScore 0-100),
  перелічи відсутні ключові слова/вимоги (missingKeywords), прогалини (gaps) і як їх закрити.
  Якщо вакансію НЕ надано — постав matchScore 0, порожні масиви і summary "".`;

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
          area: { type: "string" },
          advice: { type: "string" },
        },
        required: ["area", "advice"],
      },
    },
    keywords: { type: "array", items: { type: "string" }, description: "Ключові слова/навички, яких бракує для ATS." },
    improvedResume: { type: "string", description: "Покращена версія резюме у форматі Markdown." },
    resume: {
      type: "object",
      additionalProperties: false,
      description: "Структуроване резюме для PDF (≤ 2 сторінки A4).",
      properties: {
        name: { type: "string", description: "Ім'я кандидата (або порожньо, якщо невідомо)." },
        headline: { type: "string", description: "Цільова посада / роль." },
        contacts: { type: "string", description: "Контакти одним рядком (email · телефон · посилання)." },
        summary: { type: "string", description: "Короткий профіль, до 3 речень." },
        experience: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              role: { type: "string" },
              company: { type: "string" },
              period: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
            required: ["role", "company", "period", "bullets"],
          },
        },
        skills: { type: "array", items: { type: "string" } },
        education: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              place: { type: "string" },
              period: { type: "string" },
            },
            required: ["title", "place", "period"],
          },
        },
        languages: { type: "array", items: { type: "string" } },
      },
      required: ["name", "headline", "contacts", "summary", "experience", "skills", "education", "languages"],
    },
    tailoring: {
      type: "object",
      additionalProperties: false,
      description: "Аналіз відповідності цільовій вакансії (якщо надано).",
      properties: {
        matchScore: { type: "integer", description: "Відповідність вакансії 0-100 (0, якщо вакансію не надано)." },
        summary: { type: "string" },
        missingKeywords: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
      },
      required: ["matchScore", "summary", "missingKeywords", "gaps"],
    },
  },
  required: ["overall", "score", "strengths", "improvements", "keywords", "improvedResume", "resume", "tailoring"],
};

function instruction(jobDescription) {
  if (jobDescription) {
    return {
      type: "text",
      text:
        "Ось резюме кандидата. Проаналізуй і ПІДЛАШТУЙ його під цільову вакансію нижче " +
        "(переписане резюме та структуроване resume мають бути заточені під неї; заповни tailoring).\n\n" +
        "ОПИС ЦІЛЬОВОЇ ВАКАНСІЇ:\n" + jobDescription,
    };
  }
  return {
    type: "text",
    text: "Ось резюме кандидата. Проаналізуй його та запропонуй покращення згідно зі схемою відповіді.",
  };
}

async function buildContent({ filename = "", mimeType = "", dataBase64 = "", jobDescription = "" }) {
  const mt = mimeType.toLowerCase();
  const name = filename.toLowerCase();
  const instr = instruction(jobDescription.trim());

  if (mt.includes("pdf") || name.endsWith(".pdf")) {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: dataBase64 } },
      instr,
    ];
  }

  if (mt.startsWith("image/")) {
    return [
      { type: "image", source: { type: "base64", media_type: mt, data: dataBase64 } },
      instr,
    ];
  }

  if (mt.includes("word") || name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(dataBase64, "base64") });
    return [{ type: "text", text: `РЕЗЮМЕ (з DOCX):\n\n${value}` }, instr];
  }

  const text = Buffer.from(dataBase64, "base64").toString("utf8");
  return [{ type: "text", text: `РЕЗЮМЕ:\n\n${text}` }, instr];
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
    // Larger schema (structured resume) → allow more output tokens.
    const result = await analyzeStructured({ client, system: SYSTEM, userContent, schema: SCHEMA, maxTokens: 12000 });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json(result);
  } catch (err) {
    console.error("resume analysis failed:", err);
    res.status(500).json({ error: err.message || "Помилка аналізу резюме." });
  }
}
