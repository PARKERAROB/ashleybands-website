import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";
import { buildAssistantPrompt, cleanQuestion, MAX_QUESTION_LENGTH } from "@/lib/assistantPrompt.mjs";

// Public files are read over HTTP because Vercel functions do not bundle /public.
const SOURCE_TTL_MS = 5 * 60 * 1000;
let cachedSources = null;

async function loadSources(requestUrl) {
  if (cachedSources && Date.now() - cachedSources.at < SOURCE_TTL_MS) return cachedSources;
  const [knowledge, events] = await Promise.all([
    fetch(new URL("/chatbot-knowledge.txt", requestUrl)).then((res) => (res.ok ? res.text() : "")).catch(() => ""),
    fetch(new URL("/calendar-data.json", requestUrl)).then((res) => (res.ok ? res.json() : null)).catch(() => null)
  ]);
  cachedSources = { at: Date.now(), knowledge, events };
  return cachedSources;
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: { message: "API key not set. Add ANTHROPIC_API_KEY in Vercel Project Settings." } },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const question = cleanQuestion(body?.question);
    if (!question) {
      return Response.json(
        { error: { message: `Please ask a question under ${MAX_QUESTION_LENGTH} characters.` } },
        { status: 400 }
      );
    }
    const { knowledge, events } = await loadSources(request.url);
    const systemPrompt = buildAssistantPrompt({ knowledge, events });

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: question }]
      })
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      const detail = data?.error?.message || `Anthropic error ${anthropicRes.status}`;
      return Response.json({ error: { message: detail } }, { status: anthropicRes.status });
    }

    const raw = (data.content || []).map((block) => block.text || "").join("");
    let flagged = false;
    try {
      const cleaned = raw.trim().replace(/```json|```/g, "").trim();
      if (cleaned.startsWith("{")) {
        const parsed = JSON.parse(cleaned);
        flagged = Boolean(parsed.flagged);
      }
    } catch {
      flagged = false;
    }

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();
    if (supabaseUrl && supabaseKey) {
      fetch(`${supabaseUrl}/rest/v1/band_questions`, {
        method: "POST",
        headers: supabaseHeaders(supabaseKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify({ question, flagged })
      }).catch(() => {});
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: { message: error.message } }, { status: 500 });
  }
}

export function GET() {
  return Response.json({ error: { message: "Method Not Allowed" } }, { status: 405 });
}
