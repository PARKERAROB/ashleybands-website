import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  BERNSTEIN_PIECE_KEY,
  normalizePracticeSubmission,
} from "@/lib/practiceLoop.mjs";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

export async function POST(request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_384) return json({ error: "That practice update is too large." }, 413);
    const submission = normalizePracticeSubmission(await request.json());
    const participantTokenHash = createHash("sha256")
      .update(submission.participantToken)
      .digest("hex");
    const [participantRate, networkRate] = await Promise.all([
      checkRateLimit({
        key: `practice-loop:participant:${participantTokenHash}`,
        limit: 180,
        windowMs: 10 * 60 * 1000,
        failOpen: false,
      }),
      checkRateLimit({
        key: `practice-loop:network:${clientIp(request)}`,
        limit: 10_000,
        windowMs: 10 * 60 * 1000,
        failOpen: false,
      }),
    ]);
    if (!participantRate.allowed || !networkRate.allowed) {
      return json({ error: "Too many saves. Wait a moment and try again." }, 429);
    }
    const updatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("practice_loop_prototype_submissions")
      .upsert({
        piece_key: BERNSTEIN_PIECE_KEY,
        participant_token_hash: participantTokenHash,
        display_name: submission.displayName,
        instrument: submission.instrument,
        marks: submission.marks,
        source: "student_practice_prototype",
        updated_at: updatedAt,
      }, { onConflict: "piece_key,participant_token_hash" });

    if (error) {
      console.error("[practice-loop] save failed:", error.message);
      return json({ error: "Your practice marks could not be saved. Try again." }, 503);
    }
    return json({ savedAt: updatedAt });
  } catch (error) {
    return json({ error: error?.message || "That practice update is not valid." }, 400);
  }
}
