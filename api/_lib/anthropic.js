// Shared Anthropic (Claude) client + a structured-analysis helper used by the
// resume endpoint, plus a lightweight access-code gate for the (paid) endpoints.
//
// Model is configurable via ANALYSIS_MODEL (default: claude-haiku-4-5 — cheap,
// to stretch a small spend cap). For Opus models we additionally enable
// adaptive thinking + effort; Haiku doesn't support those params, so we send a
// plain structured-output request there.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANALYSIS_MODEL || "claude-haiku-4-5";

export function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// Access-code gate. If ANALYSIS_ACCESS_CODE is set, the request must carry a
// matching `x-access-code` header. If it's unset, the gate is open (no code).
export function checkAccessCode(req) {
  const expected = process.env.ANALYSIS_ACCESS_CODE;
  if (!expected) return true;
  const got = req.headers["x-access-code"] || req.headers["X-Access-Code"];
  return got === expected;
}

export async function analyzeStructured({ client, system, userContent, schema, maxTokens = 8000 }) {
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  };

  // Opus supports adaptive thinking + effort; Haiku/others do not.
  if (MODEL.startsWith("claude-opus")) {
    params.thinking = { type: "adaptive" };
    params.output_config.effort = "medium";
  }

  const stream = client.messages.stream(params);
  const message = await stream.finalMessage();
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Empty response from Claude");
  return JSON.parse(textBlock.text);
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
