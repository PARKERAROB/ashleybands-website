// Spelling, grammar and punctuation corrections to Carnegie student letters (#108).
//
// The student's original words are never changed. A correction is a separate proposed text for
// one exact letter version, from Atlas or a staff reviewer. Only staff accept one, and only when
// approving that version. These rules keep a correction to surface fixes, never meaning.

export const CORRECTION_SOURCES = Object.freeze(["atlas", "staff"]);
export const CORRECTION_LIMITS = Object.freeze({
  // Share of original words that may be changed, added or removed (per answer).
  maxWordChangeRatio: 0.2,
  // Absolute floor so a short answer can still fix a couple of words.
  minAllowedWordChanges: 3,
  // Word count may move this much (a split or joined word, an added article).
  maxWordCountDelta: 0.15
});

const words = (text) => String(text || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}'\s-]/gu, " ").split(/\s+/).filter(Boolean);

// Levenshtein distance over words.
function wordDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = temp;
    }
  }
  return prev[b.length];
}

// Letter-level closeness of two words, for telling a spelling fix from a new word.
function charDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = temp;
    }
  }
  return prev[b.length];
}

// Small function words a grammar fix may add, drop or swap.
const GRAMMAR_WORDS = new Set("a an the is are was were be been am to too two of for in on at with and or but that which who whom it its it's i me my we us our you your you're they them their there they're he him his she her has have had do does did not".split(" "));

// Compare one answer. Returns { ok, reasons, changedWords, originalWords }.
export function checkCorrection(original, corrected) {
  const reasons = [];
  const a = words(original);
  const b = words(corrected);
  const changed = wordDistance(a, b);
  const allowed = Math.max(CORRECTION_LIMITS.minAllowedWordChanges, Math.ceil(a.length * CORRECTION_LIMITS.maxWordChangeRatio));
  if (!String(corrected || "").trim() && String(original || "").trim()) reasons.push("A correction cannot remove the answer.");
  if (changed > allowed) reasons.push(`Changes ${changed} words; a spelling and grammar pass may change at most ${allowed} here.`);
  if (a.length && Math.abs(b.length - a.length) / a.length > CORRECTION_LIMITS.maxWordCountDelta && Math.abs(b.length - a.length) > 2) {
    reasons.push("Adds or removes too many words for a spelling and grammar pass.");
  }
  // Every new word must be a respelling of an original word or a small grammar word.
  const originalSet = new Set(a);
  for (const word of new Set(b)) {
    if (originalSet.has(word) || GRAMMAR_WORDS.has(word)) continue;
    const near = a.some((w) => charDistance(w, word) <= Math.max(2, Math.floor(w.length / 3)));
    if (!near) reasons.push(`"${word}" is a new word, not a respelling.`);
  }
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)].slice(0, 5), changedWords: changed, originalWords: a.length };
}

export function validateCorrection(letter, input = {}) {
  const meaning = typeof input.meaning_text === "string" ? input.meaning_text : null;
  const help = typeof input.help_text === "string" ? input.help_text : null;
  if (meaning == null || help == null) throw new Error("Send both corrected answers, even if one is unchanged.");
  if (meaning.length > 1500 || help.length > 1000) throw new Error("The correction is too long.");
  if (meaning === letter.meaning_text && help === letter.help_text) throw new Error("That correction does not change anything.");
  const version = Number(input.letter_version);
  if (!Number.isInteger(version) || version !== letter.version) throw new Error("The letter changed since this correction was written. Propose it again against the current version.");
  if (letter.status !== "needs_review") throw new Error("Corrections are for letters waiting for review.");
  const checks = { meaning: checkCorrection(letter.meaning_text, meaning), help: checkCorrection(letter.help_text, help) };
  const reasons = [...checks.meaning.reasons.map((r) => `First answer: ${r}`), ...checks.help.reasons.map((r) => `Second answer: ${r}`)];
  if (reasons.length) throw new Error(`Corrections are limited to spelling, grammar and punctuation. ${reasons.join(" ")}`);
  const note = String(input.note || "").trim().slice(0, 500);
  return { meaning_text: meaning, help_text: help, note, letter_version: version };
}

// Word-level diff for the side-by-side view: [{ text, kind: "same" | "removed" | "added" }].
export function wordDiff(original, corrected) {
  const a = String(original || "").split(/(\s+)/);
  const b = String(corrected || "").split(/(\s+)/);
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) {
    table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const out = [];
  let i = 0;
  let j = 0;
  const push = (text, kind) => { const last = out[out.length - 1]; if (last && last.kind === kind) last.text += text; else out.push({ text, kind }); };
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push(a[i], "same"); i += 1; j += 1; } else if (table[i + 1][j] >= table[i][j + 1]) { push(a[i], "removed"); i += 1; } else { push(b[j], "added"); j += 1; }
  }
  while (i < a.length) push(a[i++], "removed");
  while (j < b.length) push(b[j++], "added");
  return out;
}

// The words that print: the accepted correction for this approval, or the original.
export function printedWords(letter, correction) {
  if (correction && letter?.approved_correction_id === correction.id && correction.status === "accepted" && correction.letter_version === letter.version) {
    return { meaning_text: correction.meaning_text, help_text: correction.help_text, corrected: true };
  }
  return { meaning_text: letter?.meaning_text || "", help_text: letter?.help_text || "", corrected: false };
}
