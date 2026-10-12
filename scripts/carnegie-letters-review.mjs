// Director review of Carnegie student letters from the terminal (#106 queue, same rules as
// /api/admin/carnegie-letters/[id]): approve one exact version, or return to draft with a note.
// Run: node --env-file=.env.local scripts/carnegie-letters-review.mjs list
//      node --env-file=.env.local scripts/carnegie-letters-review.mjs approve <id> <version>
//      node --env-file=.env.local scripts/carnegie-letters-review.mjs return <id> <version> "note"
// Output holds student first names and private letter text: print it to the session, never to a file.

const DIRECTOR = { id: "dcc345b7-173b-4fd8-b2f6-2bffae7c1357", name: "Mr. Parker" };
const ROUTE = "scripts/carnegie-letters-review.mjs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Run with --env-file=.env.local");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers, ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

const [cmd, id, version, note] = process.argv.slice(2);

if (cmd === "list") {
  const rows = await rest("carnegie_student_letters?status=eq.needs_review&order=submitted_at.asc&select=id,version,recipient_type,recipient_name,meaning_text,help_text,submitted_at,portal_students(preferred_first,legal_first,display_name)");
  console.log(`${rows.length} letter(s) waiting for review\n`);
  for (const r of rows) {
    const s = r.portal_students || {};
    console.log(`— ${s.preferred_first || s.legal_first || s.display_name} → ${r.recipient_type === "general_supporter" ? "(general supporter)" : r.recipient_name}`);
    console.log(`  id ${r.id}  v${r.version}  sent for review ${r.submitted_at?.slice(0, 10)}`);
    console.log(`  What this means to me: ${r.meaning_text}`);
    console.log(`  How you can help: ${r.help_text}\n`);
  }
} else if (cmd === "approve" || cmd === "return") {
  if (!id || !Number.isInteger(Number(version))) throw new Error("Need <id> <version>");
  if (cmd === "return" && !note?.trim()) throw new Error("Add a short note so the family knows what to change.");
  const actor = { last_actor_type: "staff", last_actor_id: DIRECTOR.id };
  const patch = cmd === "approve"
    ? { ...actor, status: "approved", approved_version: Number(version), approved_at: new Date().toISOString(), approved_by_staff_id: DIRECTOR.id, review_note: "" }
    : { ...actor, status: "draft", review_note: note.slice(0, 1000) };
  // Optimistic: only the exact version Rob read, and only while it is still waiting.
  const [row] = await rest(`carnegie_student_letters?id=eq.${id}&version=eq.${Number(version)}&status=eq.needs_review&select=id,status,version`, { method: "PATCH", body: JSON.stringify(patch) });
  if (!row) throw new Error("Not updated: the letter changed or is no longer waiting. Run list again.");
  await rest("audit_log", { method: "POST", body: JSON.stringify({
    actor_type: "staff", actor_id: DIRECTOR.id, actor_name: DIRECTOR.name,
    action: `letter.${cmd === "approve" ? "approve" : "return_to_draft"}`, table_name: "carnegie_student_letters", record_id: id,
    changes: { from: { status: "needs_review", version: Number(version) }, to: { status: row.status, version: row.version } }, route: ROUTE
  }) });
  console.log(`${row.status}: ${id} v${row.version}`);
} else {
  console.log("Usage: list | approve <id> <version> | return <id> <version> \"note\"");
}
