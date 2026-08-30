"use client";

import { useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";

export default function AdminStudentsPage() {
  return <StaffGate>{(session) => <StudentsAdmin session={session} />}</StaffGate>;
}

function StudentsAdmin({ session }) {
  const [q, setQ] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const search = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/students?q=${encodeURIComponent(q)}`, { headers: staffAuthHeaders(session) });
    const data = await res.json().catch(() => ({}));
    setStudents(data.students || []);
    setLoading(false);
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Students &amp; Guardians</h1>
        <a href="/admin" style={link}>← Staff home</a>
      </div>
      <p style={{ color: "#6f675a", fontSize: 14 }}>Add a new student, edit details, or link a guardian.</p>

      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
        <input
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={{ ...input, width: 280 }}
        />
        <button onClick={search} style={btn}>Search</button>
        <button onClick={() => setShowNew((v) => !v)} style={{ ...btn, background: "#446349" }}>
          {showNew ? "Close new student" : "+ New student"}
        </button>
      </div>

      {showNew && <NewStudent session={session} onCreated={() => { setShowNew(false); search(); }} />}

      <UnmatchedSignups session={session} />

      {loading ? <p>Loading…</p> : null}
      {students.map((s) => (
        <StudentEditor key={s.id} student={s} session={session} onChanged={search} />
      ))}
      {!loading && students.length === 0 && <p style={{ color: "#999" }}>No students loaded. Search or add one.</p>}
    </div>
  );
}

function UnmatchedSignups({ session }) {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");

  const reload = () => {
    fetch("/api/admin/students/unmatched-signups", { headers: staffAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setItems(d.unmatched || []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    fetch("/api/admin/students/unmatched-signups", { headers: staffAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setItems(d.unmatched || []))
      .catch(() => setItems([]));
  }, [session]);

  const create = async (signupId) => {
    setBusyId(signupId);
    setMsg("");
    const res = await fetch("/api/admin/students/unmatched-signups", {
      method: "POST",
      headers: staffAuthHeaders(session),
      body: JSON.stringify({ signupId })
    });
    const data = await res.json().catch(() => ({}));
    setBusyId("");
    if (!res.ok) { setMsg(data.error || "Failed."); return; }
    setMsg("Created student + guardian + $500 charge.");
    reload();
  };

  if (!items || items.length === 0) return null;

  return (
    <div style={{ ...panel, borderColor: "#b3541e", background: "#fff5ec" }}>
      <strong>⚠️ Marching-band signups with no student record ({items.length})</strong>
      <p style={{ fontSize: 12.5, color: "#6f675a", margin: "4px 0 8px" }}>
        One click creates the student, links the guardian, and adds the $500 season fee.
      </p>
      {msg && <p style={{ fontSize: 13, color: "#446349" }}>{msg}</p>}
      {items.map((u) => (
        <div key={u.signupId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #eaddc9", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13 }}>
            <strong>{u.student.firstName} {u.student.lastName}</strong>{" "}
            <span style={{ color: "#6f675a" }}>
              {u.student.gradeFall ? `· ${u.student.gradeFall}` : ""} {u.student.email ? `· ${u.student.email}` : ""}
              {u.guardian.name ? ` · guardian: ${u.guardian.name}${u.guardian.email ? ` (${u.guardian.email})` : ""}` : " · no guardian on signup"}
              {u.fundingPath ? ` · ${u.fundingPath}` : ""}
            </span>
          </span>
          <button onClick={() => create(u.signupId)} disabled={busyId === u.signupId} style={{ ...btn, background: "#b3541e" }}>
            {busyId === u.signupId ? "Creating…" : "Create + $500"}
          </button>
        </div>
      ))}
    </div>
  );
}

function NewStudent({ session, onCreated }) {
  const [form, setForm] = useState({ legalFirst: "", legalLast: "", preferredFirst: "", gradeFall26: "", schoolEmail: "", cellPhone: "" });
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    const res = await fetch("/api/admin/students", { method: "POST", headers: staffAuthHeaders(session), body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error || "Failed."); return; }
    onCreated();
  };

  return (
    <div style={panel}>
      <strong>New student</strong>
      <div style={formGrid}>
        <input placeholder="Legal first *" value={form.legalFirst} onChange={(e) => setForm({ ...form, legalFirst: e.target.value })} style={input} />
        <input placeholder="Legal last *" value={form.legalLast} onChange={(e) => setForm({ ...form, legalLast: e.target.value })} style={input} />
        <input placeholder="Preferred/nickname" value={form.preferredFirst} onChange={(e) => setForm({ ...form, preferredFirst: e.target.value })} style={input} />
        <input placeholder="Grade (e.g. Rising 11th)" value={form.gradeFall26} onChange={(e) => setForm({ ...form, gradeFall26: e.target.value })} style={input} />
        <input placeholder="School email" value={form.schoolEmail} onChange={(e) => setForm({ ...form, schoolEmail: e.target.value })} style={input} />
        <input placeholder="Cell phone" value={form.cellPhone} onChange={(e) => setForm({ ...form, cellPhone: e.target.value })} style={input} />
      </div>
      <button onClick={submit} style={{ ...btn, marginTop: 8, background: "#446349" }}>Create student</button>
      {msg && <p style={{ fontSize: 13, color: "#7b1829" }}>{msg}</p>}
    </div>
  );
}

function StudentEditor({ student, session, onChanged }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    legalFirst: student.legal_first || "",
    legalLast: student.legal_last || "",
    preferredFirst: student.preferred_first || "",
    gradeFall26: student.grade_fall26 || "",
    schoolEmail: student.school_email || "",
    cellPhone: student.cell_phone || "",
    status: student.status || "active"
  });
  const [msg, setMsg] = useState("");

  const save = async () => {
    setMsg("");
    const res = await fetch("/api/admin/students", { method: "PATCH", headers: staffAuthHeaders(session), body: JSON.stringify({ id: student.id, ...form }) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Saved." : data.error || "Failed.");
    if (res.ok) onChanged();
  };

  const displayLast = [student.legal_last, student.preferred_first || student.legal_first].filter(Boolean).join(", ");

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <strong>{displayLast || student.display_name}</strong>
          <span
            title={student.lastTouchAt ? `Last family activity ${new Date(student.lastTouchAt).toLocaleDateString()}` : "No login, update, or self-supplied contact on record"}
            style={student.touchedByFamily ? touchedBadge : untouchedBadge}
          >
            {student.touchedByFamily ? "touched" : "never touched"}
          </span>
        </span>
        <span style={{ fontSize: 12, color: "#6f675a" }}>
          {student.grade_fall26} {student.source === "manual" ? "· manual" : ""} ·{" "}
          <button onClick={() => setOpen((v) => !v)} style={link}>{open ? "close" : "manage"}</button> ·{" "}
          <a href={`/admin/measurements?studentId=${student.id}&name=${encodeURIComponent(student.display_name || "")}`} style={link}>Measurements →</a>
        </span>
      </div>
      {student.guardians?.length ? (
        <p style={{ fontSize: 12.5, color: "#6f675a", margin: "4px 0 0" }}>
          Guardians: {student.guardians.map((g) => `${g.name}${g.emails[0] ? ` (${g.emails[0]})` : ""}`).join(" · ")}
        </p>
      ) : (
        <p style={{ fontSize: 12.5, color: "#b3541e", margin: "4px 0 0" }}>No guardian linked</p>
      )}

      {open && (
        <div style={{ marginTop: 10, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <span style={subhead}>Edit details</span>
            <div style={formGrid}>
              <input placeholder="Legal first" value={form.legalFirst} onChange={(e) => setForm({ ...form, legalFirst: e.target.value })} style={input} />
              <input placeholder="Legal last" value={form.legalLast} onChange={(e) => setForm({ ...form, legalLast: e.target.value })} style={input} />
              <input placeholder="Preferred" value={form.preferredFirst} onChange={(e) => setForm({ ...form, preferredFirst: e.target.value })} style={input} />
              <input placeholder="Grade" value={form.gradeFall26} onChange={(e) => setForm({ ...form, gradeFall26: e.target.value })} style={input} />
              <input placeholder="School email" value={form.schoolEmail} onChange={(e) => setForm({ ...form, schoolEmail: e.target.value })} style={input} />
              <input placeholder="Cell phone" value={form.cellPhone} onChange={(e) => setForm({ ...form, cellPhone: e.target.value })} style={input} />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="inactive-graduated">inactive-graduated</option>
              </select>
            </div>
            <button onClick={save} style={{ ...btn, marginTop: 8 }}>Save</button>
            {msg && <span style={{ fontSize: 12, marginLeft: 8 }}>{msg}</span>}
          </div>
          <AddGuardian studentId={student.id} session={session} onAdded={onChanged} />
        </div>
      )}
    </div>
  );
}

function AddGuardian({ studentId, session, onAdded }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "Parent", primary: true });
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    const res = await fetch("/api/admin/students/guardians", { method: "POST", headers: staffAuthHeaders(session), body: JSON.stringify({ studentId, ...form }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error || "Failed."); return; }
    setMsg("Guardian linked.");
    setForm({ name: "", email: "", phone: "", role: "Parent", primary: true });
    onAdded();
  };

  return (
    <div>
      <span style={subhead}>Add guardian</span>
      <div style={formGrid}>
        <input placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} />
        <input placeholder="Role (Parent, etc.)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={input} />
      </div>
      <label style={{ fontSize: 12.5, display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={form.primary} onChange={(e) => setForm({ ...form, primary: e.target.checked })} /> Primary contact
      </label>
      <button onClick={submit} style={{ ...btn, marginTop: 8, background: "#446349" }}>Link guardian</button>
      {msg && <p style={{ fontSize: 12, color: "#7b1829" }}>{msg}</p>}
    </div>
  );
}

const page = { maxWidth: 980, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#191716" };
const panel = { border: "1px solid #ded4bf", borderRadius: 10, background: "#fffaf0", padding: 14, margin: "10px 0" };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginTop: 8 };
const input = { boxSizing: "border-box", width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const btn = { padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", background: "#7b1829", cursor: "pointer" };
const link = { color: "#7b1829", fontSize: 13, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 };
const subhead = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6f675a" };
const badgeBase = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", borderRadius: 999, padding: "2px 8px" };
const touchedBadge = { ...badgeBase, color: "#215732", background: "#e3efe4" };
const untouchedBadge = { ...badgeBase, color: "#6f675a", background: "#eee7d8" };
