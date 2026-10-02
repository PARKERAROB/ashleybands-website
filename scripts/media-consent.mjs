#!/usr/bin/env node
// Media interview permission helper (#162). Run from the repository root:
//   node --env-file=.env.local scripts/media-consent.mjs <command>
//
//   dry-run [--axis both|guardians|students]
//       Resolves the real audience and renders every personalized email in memory.
//       Prints counts only. Inserts nothing, sends nothing.
//   preview --to a@x.com,b@y.com --subject "..." --body-file body.txt [--send]
//       Renders the guardian version with a sample student and non-recording
//       preview links. Without --send it prints the text version. With --send it
//       emails ONLY the --to addresses, subject prefixed "[Preview]".
//   results [--csv]
//       Latest answer per active student: first name + last initial, ensemble,
//       answer (yes/no/none), answered at. Reads only.
//
// The real send stays in /admin/broadcast (authenticated staff send): put
// {{media_consent}} on its own line in the body where the Yes/No links belong.
import { readFileSync } from "node:fs";
import { resolveAudience, allStudentIds } from "../lib/audience.js";
import { bodyToHtml, loadMediaConsentContext, personalizeForRecipient } from "../lib/broadcast.js";
import { htmlToText, sendBroadcastEmail } from "../lib/portalEmail.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { SITE_ORIGIN } from "../lib/routes.js";
import {
  PREVIEW_TOKEN,
  hasMediaConsentPlaceholder,
  latestAnswers,
  personalizeMediaConsent,
  studentFirstName,
} from "../lib/mediaConsent.mjs";

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i === -1 ? null : rest[i + 1];
};

async function dryRun() {
  const axis = flag("--axis") || "both";
  const audience = await resolveAudience({}, axis);
  const context = await loadMediaConsentContext();
  const sample = bodyToHtml("Hello.\n\n{{media_consent}}\n\nThanks.");
  let guardians = 0;
  let studentsAxis = 0;
  let guardiansWithSeveral = 0;
  let guardiansWithNone = 0;
  const covered = new Set();
  for (const row of audience.recipients) {
    const out = personalizeForRecipient(sample, row, context);
    if (out.kind === "guardian") {
      guardians += 1;
      if (out.students.length > 1) guardiansWithSeveral += 1;
      if (!out.students.length) guardiansWithNone += 1;
      const links = (out.html.match(/media-consent\?t=/g) || []).length;
      if (links !== out.students.length * 2) throw new Error("Rendered link count does not match student count.");
      for (const id of context.byEmail.get(row.email.trim().toLowerCase()) || []) covered.add(id);
    } else {
      studentsAxis += 1;
      if (out.html.includes("media-consent?t=")) throw new Error("A student recipient received consent links.");
    }
  }
  const active = await allStudentIds();
  console.log(JSON.stringify({
    axis,
    recipients: audience.count,
    guardian_recipients: guardians,
    student_recipients: studentsAxis,
    guardians_with_2_or_more_students: guardiansWithSeveral,
    guardians_with_no_student_links: guardiansWithNone,
    active_students: active.length,
    students_covered_by_guardian_links: covered.size,
    active_students_with_no_guardian_email: active.filter((id) => !covered.has(id)).length,
    inserted: 0,
    sent: 0,
  }, null, 2));
}

async function preview() {
  const to = String(flag("--to") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const subject = flag("--subject");
  const bodyFile = flag("--body-file");
  if (!to.length || !subject || !bodyFile) throw new Error("preview needs --to, --subject and --body-file.");
  const bodyHtml = bodyToHtml(readFileSync(bodyFile, "utf8"));
  if (!hasMediaConsentPlaceholder(bodyHtml)) throw new Error("The body has no {{media_consent}} line.");
  const { html, text } = personalizeMediaConsent(
    bodyHtml,
    { kind: "guardian", students: [{ firstName: "Sample", token: PREVIEW_TOKEN }], baseUrl: SITE_ORIGIN },
    htmlToText,
  );
  const banner = "<p><strong>PREVIEW.</strong> The real email shows one Yes/No pair for each of the family's students. These sample links record nothing.</p>";
  if (!rest.includes("--send")) {
    console.log(`To: ${to.join(", ")}\nSubject: [Preview] ${subject}\n\n${text}\n\n(Not sent. Add --send to email only these addresses.)`);
    return;
  }
  for (const address of to) {
    const id = await sendBroadcastEmail({ to: address, subject: `[Preview] ${subject}`, html: banner + html, text: `PREVIEW. Sample links record nothing.\n\n${text}` });
    console.log(`sent preview to ${address} (${id})`);
  }
}

async function results() {
  const { data: students, error } = await supabaseAdmin
    .from("portal_students")
    .select("id, preferred_first, legal_first, legal_last, display_name")
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("media_consent_responses")
    .select("student_id, answer, created_at");
  if (rowsError) throw new Error(rowsError.message);
  const { data: memberships } = await supabaseAdmin
    .from("program_memberships")
    .select("student_id, program_groups!inner(code, name, status)")
    .is("ends_on", null)
    .eq("program_groups.status", "active");
  const ensembles = new Map();
  for (const m of memberships || []) {
    if (/marching|guard/i.test(m.program_groups.code)) continue;
    ensembles.set(m.student_id, [...(ensembles.get(m.student_id) || []), m.program_groups.name]);
  }
  const latest = latestAnswers(rows);
  const out = students.map((s) => {
    const last = String(s.legal_last || "").trim();
    const hit = latest.get(s.id);
    return {
      student: `${studentFirstName(s)}${last ? ` ${last[0]}.` : ""}`,
      ensemble: (ensembles.get(s.id) || []).sort().join(" + ") || "-",
      answer: hit?.answer || "none",
      answered_at: hit ? new Date(hit.at).toLocaleString("en-US", { timeZone: "America/New_York" }) : "",
    };
  }).sort((a, b) => a.ensemble.localeCompare(b.ensemble) || a.student.localeCompare(b.student));
  if (rest.includes("--csv")) {
    console.log("student,ensemble,answer,answered_at");
    for (const r of out) console.log([r.student, r.ensemble, r.answer, r.answered_at].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
  } else {
    console.table(out);
  }
  const count = (answer) => out.filter((r) => r.answer === answer).length;
  console.log(`yes ${count("yes")} | no ${count("no")} | none ${count("none")} | active ${out.length}`);
}

const commands = { "dry-run": dryRun, preview, results };
if (!commands[command]) {
  console.error("Usage: node --env-file=.env.local scripts/media-consent.mjs dry-run|preview|results");
  process.exit(2);
}
await commands[command]();
