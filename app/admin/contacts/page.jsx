"use client";

import { useEffect, useMemo, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";

export default function AdminContactsPage() {
  return <StaffGate>{(session) => <ContactsAdmin session={session} />}</StaffGate>;
}

function ContactsAdmin({ session }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/contacts", { headers: staffAuthHeaders(session) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Failed to load.");
        setPeople([]);
        return;
      }
      setPeople(data.people || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((p) => {
      if (p.displayName?.toLowerCase().includes(needle)) return true;
      if (p.students.some((s) => s.name?.toLowerCase().includes(needle))) return true;
      if (p.contacts.some((c) => c.valueDisplay?.toLowerCase().includes(needle))) return true;
      return false;
    });
  }, [people, q]);

  const exportUrl = "/api/admin/contacts?export=csv";

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Contacts &amp; Guardians</h1>
        <a href="/admin" style={link}>← Staff home</a>
      </div>
      <p style={{ color: "#6f675a", fontSize: 14 }}>
        Every guardian and contact-adjacent person, with each contact value's origin visible at a glance.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search by person, student, or contact value…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ ...input, width: 320 }}
        />
        <ExportButton session={session} exportUrl={exportUrl} />
        <span style={{ fontSize: 12.5, color: "#6f675a" }}>
          {loading ? "Loading…" : `${filtered.length} of ${people.length}`}
        </span>
      </div>

      {err && <p style={{ color: "#7b1829", fontSize: 13 }}>{err}</p>}
      {!loading && filtered.length === 0 && <p style={{ color: "#999" }}>No matches.</p>}

      {filtered.map((p) => (
        <PersonRow key={p.id} person={p} session={session} onChanged={load} />
      ))}
    </div>
  );
}

function ExportButton({ session, exportUrl }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(exportUrl, { headers: staffAuthHeaders(session) });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ashley-bands-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={download} disabled={busy} style={{ ...btn, background: "#446349" }}>
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}

function ProvenanceChip({ contact }) {
  const label = contact.source || "unknown";
  return (
    <span style={chip} title={contact.verificationSource ? `verification: ${contact.verificationSource}` : undefined}>
      {label}
      {contact.verificationSource ? ` · ${contact.verificationSource}` : ""}
    </span>
  );
}

function PersonRow({ person, session, onChanged }) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <span>
          <strong>{person.displayName}</strong>{" "}
          <span style={{ fontSize: 12, color: "#6f675a" }}>
            {person.personType}
            {person.students.length ? ` · ${person.students.map((s) => s.name).join(", ")}` : ""}
          </span>
        </span>
        <span style={{ fontSize: 12 }}>
          <button onClick={() => setOpen((v) => !v)} style={link}>
            {open ? "close" : `${person.contacts.length} contact${person.contacts.length === 1 ? "" : "s"} →`}
          </button>
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {person.contacts.length === 0 && <p style={{ fontSize: 12.5, color: "#b3541e" }}>No contact methods on file.</p>}
          {person.contacts.map((c) => (
            <ContactMethodRow key={c.id} contact={c} personId={person.id} session={session} onChanged={onChanged} />
          ))}

          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowHistory((v) => !v)} style={link}>
              {showHistory ? "hide history" : "History →"}
            </button>
            {showHistory && <HistoryPanel personId={person.id} session={session} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactMethodRow({ contact, personId, session, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(contact.valueDisplay || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "PATCH",
        headers: staffAuthHeaders(session),
        body: JSON.stringify({ personId, contactMethodId: contact.id, value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || "Failed.");
        return;
      }
      setMsg("Saved.");
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #eaddc9", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "#6f675a", width: 56, textTransform: "uppercase" }}>{contact.contactType}</span>
      {editing ? (
        <input value={value} onChange={(e) => setValue(e.target.value)} style={{ ...input, width: 220 }} />
      ) : (
        <span style={{ fontSize: 13 }}>{contact.valueDisplay}</span>
      )}
      {editing && <ProvenanceChip contact={contact} />}
      {editing && contact.verificationStatus && (
        <span style={{ fontSize: 11, color: "#6f675a" }}>{contact.verificationStatus}</span>
      )}
      {editing ? (
        <>
          <button onClick={save} disabled={busy} style={{ ...btn, padding: "4px 10px", fontSize: 12 }}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setValue(contact.valueDisplay || "");
              setMsg("");
            }}
            style={link}
          >
            cancel
          </button>
        </>
      ) : (
        <button onClick={() => setEditing(true)} style={link}>edit</button>
      )}
      {msg && <span style={{ fontSize: 11.5, color: msg === "Saved." ? "#446349" : "#7b1829" }}>{msg}</span>}
    </div>
  );
}

function HistoryPanel({ personId, session }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/contacts?personId=${encodeURIComponent(personId)}`, { headers: staffAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setErr(d.error);
        setRows(d.history || []);
      })
      .catch(() => !cancelled && setErr("Failed to load history."));
    return () => {
      cancelled = true;
    };
  }, [personId, session]);

  if (err) return <p style={{ fontSize: 12, color: "#7b1829" }}>{err}</p>;
  if (rows === null) return <p style={{ fontSize: 12, color: "#6f675a" }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ fontSize: 12, color: "#6f675a" }}>No history on record.</p>;

  return (
    <div style={{ marginTop: 6 }}>
      {rows.map((row) => (
        <div key={row.id} style={{ fontSize: 12, padding: "4px 0", borderTop: "1px solid #eaddc9" }}>
          <span style={{ color: "#6f675a" }}>{new Date(row.occurred_at).toLocaleString()}</span>{" "}
          <strong>{row.actor_name || row.actor_type}</strong> · {row.action} on {row.table_name}
          {row.changes && (
            <div style={{ color: "#6f675a", marginTop: 2 }}>
              {Object.entries(row.changes)
                .filter(([k]) => k !== "contact_method_id")
                .map(([field, diff]) => (
                  <div key={field}>
                    {field}: {diff && typeof diff === "object" && "old" in diff ? `${diff.old ?? "(empty)"} -> ${diff.new ?? "(empty)"}` : JSON.stringify(diff)}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const page = { maxWidth: 980, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#191716" };
const panel = { border: "1px solid #ded4bf", borderRadius: 10, background: "#fffaf0", padding: 14, margin: "10px 0" };
const input = { boxSizing: "border-box", width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const btn = { padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", background: "#7b1829", cursor: "pointer" };
const link = { color: "#7b1829", fontSize: 13, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 };
const chip = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", borderRadius: 999, padding: "2px 8px", background: "#eeeaf0", color: "#4a3f63" };
