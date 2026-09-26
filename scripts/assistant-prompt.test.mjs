import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildAssistantPrompt, cleanQuestion, MAX_QUESTION_LENGTH } from "../lib/assistantPrompt.mjs";

test("prompt includes the knowledge text and upcoming calendar", () => {
  const prompt = buildAssistantPrompt({
    knowledge: "Rehearsals are Tuesdays.",
    events: [{ id: "evt-1", title: "Fall Concert", start: "2026-10-01T19:00:00-04:00", end: "2026-10-01T20:30:00-04:00" }],
    now: Date.parse("2026-09-26T12:00:00-04:00")
  });
  assert.match(prompt, /Rehearsals are Tuesdays\./);
  assert.match(prompt, /Fall Concert/);
  assert.match(prompt, /Saturday, September 26, 2026/);
});

test("prompt falls back when sources fail to load", () => {
  const prompt = buildAssistantPrompt({ knowledge: "", events: null });
  assert.match(prompt, /contact Mr\. Parker directly/);
  assert.match(prompt, /ashleybands\.com\/this-week/);
});

test("questions are trimmed and length-capped", () => {
  assert.equal(cleanQuestion("  When is the concert?  "), "When is the concert?");
  assert.equal(cleanQuestion(""), "");
  assert.equal(cleanQuestion(42), "");
  assert.equal(cleanQuestion("a".repeat(MAX_QUESTION_LENGTH + 1)), "");
});

test("the chat route ignores a browser-supplied system prompt", async () => {
  const route = await readFile(new URL("../app/api/chat/route.js", import.meta.url), "utf8");
  assert.doesNotMatch(route, /body\?*\.systemPrompt|\{\s*systemPrompt\s*,/);
  const client = await readFile(new URL("../components/ChatAssistant.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(client, /systemPrompt/);
});
