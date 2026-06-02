// Shared Anthropic (Claude) client + a structured-analysis helper used by the
// resume and LinkedIn endpoints.
//
// Uses the official @anthropic-ai/sdk with:
//  - model claude-opus-4-8 (most capable)
//  - adaptive thinking (Claude decides how much to reason)
//  - structured outputs (output_config.format) so we get schema-valid JSON
//  - streaming (.finalMessage()) to stay under serverless HTTP timeouts
//  - prompt caching on the (stable) system prompt

import Anthropic from "@anthropic-ai/sdk";

export function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export async function analyzeStructured({ client, system, userContent, schema, maxTokens = 8000 }) {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", name: "analysis", schema },
    },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });

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
