import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isValidNewsletterEmail,
  newsletterBroadcastSetComplete,
  newsletterMarkdownToHtml,
  normalizeNewsletterEmail,
  renderNewsletterEmail,
  splitNewsletterAudience
} from "../lib/newsletterFormat.mjs";

test("newsletter email normalization and validation stay bounded", () => {
  assert.equal(normalizeNewsletterEmail("  PERSON@Example.COM "), "person@example.com");
  assert.equal(isValidNewsletterEmail("person@example.com"), true);
  assert.equal(isValidNewsletterEmail("not-an-email"), false);
  assert.equal(isValidNewsletterEmail(`${"a".repeat(250)}@x.com`), false);
});

test("newsletter markdown escapes raw markup and rejects unsafe links", () => {
  const html = newsletterMarkdownToHtml([
    "<script>alert(1)</script>",
    "",
    "## Dates",
    "",
    "- **Tuesday:** [Calendar](https://ashleybands.com/calendar)",
    "- [Unsafe](javascript:alert(1))"
  ].join("\n"));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /href="https:\/\/ashleybands\.com\/calendar"/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(newsletterMarkdownToHtml("Play *Bernstein Tribute*."), /<em>Bernstein Tribute<\/em>/);
});

test("completed newsletter sends cannot restart while partial sends remain resumable", () => {
  assert.equal(newsletterBroadcastSetComplete([]), false);
  assert.equal(newsletterBroadcastSetComplete([{ status: "sent" }]), true);
  assert.equal(newsletterBroadcastSetComplete([{ status: "sent" }, { status: "failed" }]), false);
  assert.equal(newsletterBroadcastSetComplete([{ status: "sent" }, { status: "sent" }]), true);
});

test("active-program recipients win dedupe and newsletter opt-outs remain excluded", () => {
  const memberRecipients = [
    { email: "family@example.com", student_id: "student-1" },
    { email: "FAMILY@example.com", student_id: "student-2" },
    { email: "student@school.example", student_id: "student-1" },
    { email: "optout@example.com", student_id: "student-3" }
  ];
  const contacts = [
    { email: "family@example.com", community_opt_in: true, newsletter_opted_out: false },
    { email: "friend@example.com", community_opt_in: true, newsletter_opted_out: false },
    { email: "optout@example.com", community_opt_in: true, newsletter_opted_out: true },
    { email: "pending@example.com", community_opt_in: false, newsletter_opted_out: false }
  ];
  const split = splitNewsletterAudience({ memberRecipients, contacts });
  assert.deepEqual(split.member.map((row) => row.email), ["family@example.com", "student@school.example"]);
  assert.deepEqual(split.public.map((row) => row.email), ["friend@example.com"]);
});

test("rendered email contains the edition, public archive, and per-recipient preference link", () => {
  const rendered = renderNewsletterEmail({
    issue: {
      slug: "2026-08-30",
      title: "A strong first week",
      preview_text: "What happened and what is next.",
      public_subject: "Public subject",
      member_subject: "Member subject",
      public_markdown: "Public copy",
      member_markdown: "## Students\n\n- Check Canvas."
    },
    edition: "member",
    unsubscribeUrl: "https://ashleybands.com/newsletter/unsubscribe?token=abc"
  });
  assert.equal(rendered.subject, "Member subject");
  assert.match(rendered.html, /Ashley Bands students and families/);
  assert.match(rendered.html, /newsletter\/2026-08-30/);
  assert.match(rendered.html, /unsubscribe\?token=abc/);
  assert.match(rendered.text, /Urgent program messages are managed separately/);
  assert.match(rendered.text, /555 Halyburton Memorial Pkwy/);
});

test("the first issue is a reviewed draft, never an automatic send", async () => {
  const migration = await readFile(new URL("../supabase/migrations/0045_weekly_newsletter.sql", import.meta.url), "utf8");
  assert.match(migration, /'draft'/);
  assert.match(migration, /Before publishing:/);
  assert.doesNotMatch(migration, /status,\s*'published'/);
  const server = await readFile(new URL("../lib/newsletter.js", import.meta.url), "utf8");
  assert.doesNotMatch(server, /cron|schedule/i);
  assert.match(server, /Publish the newsletter archive before sending email/);
});
