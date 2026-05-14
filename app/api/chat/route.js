import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: { message: "API key not set. Add ANTHROPIC_API_KEY in Vercel Project Settings." } },
      { status: 500 }
    );
  }

  try {
    const { systemPrompt, question } = await request.json();
    if (!systemPrompt || !question) {
      return Response.json({ error: { message: "Missing systemPrompt or question." } }, { status: 400 });
    }

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
