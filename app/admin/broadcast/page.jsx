"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StaffLogin } from "@/components/StaffGate";

const STORAGE_KEY = "bdos_staff_session_v1";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function authHeaders() {
  return { "Content-Type": "application/json" };
}

const AXES = [
  { value: "guardians", label: "Guardians (personal email — durable)" },
  { value: "students", label: "Students (NHCS school email)" },
  { value: "both", label: "Both" }
];

export default function BroadcastPage() {
  const [session, setSession] = useState(() => readSession());
  const [facets, setFacets] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [axis, setAxis] = useState("guardians");
  const [match, setMatch] = useState("all");
  const [selected, setSelected] = useState({}); // key -> Set(values)

  const [preview, setPreview] = useState(null); // { count, studentCount, sample }
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [directStudent, setDirectStudent] = useState("");
  const [directStudentName, setDirectStudentName] = useState("");

  useEffect(() => {
    const studentId = new URLSearchParams(window.location.search).get("student") || "";
    const studentName = new URLSearchParams(window.location.search).get("name") || "";
    if (!studentId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      setDirectStudent(studentId);
      setDirectStudentName(studentName);
      setAxis("both");
      setSelected({ student_id: new Set([studentId]) });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function load() {
    if (!session) return;
    const res = await fetch("/api/admin/broadcast", { headers: authHeaders(session) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Broadcast history could not be loaded.");
    setFacets(data.facets || []);
    setLog(data.broadcasts || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/broadcast", { headers: authHeaders(session) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Broadcast history could not be loaded.");
      if (!active) return;
      setFacets(data.facets || []);
      setLog(data.broadcasts || []);
      setLoading(false);
    })().catch((loadError) => {
      if (!active) return;
      setMsg(loadError.message);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session]);

  const audienceFilter = useMemo(() => {
    if (directStudent) {
      return { match: "all", predicates: [{ key: "student_id", op: "in", values: [directStudent] }] };
    }
    const predicates = Object.entries(selected)
      .map(([key, set]) => ({ key, op: "in", values: [...set] }))
      .filter((p) => p.values.length);
    return predicates.length ? { match, predicates } : {};
  }, [selected, match, directStudent]);

  const isEveryone = !audienceFilter.predicates;

  function clearDirectStudent() {
    setDirectStudent("");
    setDirectStudentName("");
    setSelected({});
    setAxis("guardians");
    setPreview(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("student");
    url.searchParams.delete("name");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function toggleValue(key, value) {
    setPreview(null);
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[key] || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      if (set.size) next[key] = set;
      else delete next[key];
      return next;
    });
  }

  async function runPreview() {
    setPreviewing(true);
    setMsg("");
    setPreview(null);
    try {
      const res = await fetch("/api/admin/broadcast/preview", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({ audienceFilter, recipientAxis: axis, directStudentId: directStudent })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Preview failed.");
        return;
      }
      setPreview(data);
    } finally {
      setPreviewing(false);
    }
  }

  async function send() {
    if (!preview || !preview.count) return;
    const confirmText =
      `Send "${subject}" to ${preview.count} recipient${preview.count === 1 ? "" : "s"}` +
      `${isEveryone ? " (ALL FAMILIES)" : ""}? This emails real people and cannot be unsent.`;
    if (!window.confirm(confirmText)) return;
    // Second hard stop for large/all-family sends.
    if (isEveryone || preview.count >= 50) {
      if (!window.confirm(`Confirm again: ${preview.count} real emails will go out now.`)) return;
    }

    setSending(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/broadcast/send", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({
          subject,
          body,
          audienceFilter,
          recipientAxis: axis,
          directStudentId: directStudent,
          confirmationToken: preview.confirmationToken,
          confirm: true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setPreview(null);
        setMsg(data.error || "Send failed.");
        return;
      }
      const tail = data.remaining
        ? ` ${data.remaining} still queued — click Retry unsent on the log row to finish.`
        : "";
      setMsg(`Sent ${data.sent}/${data.recipientCount}. ${data.failed} failed.${tail}`);
      setSubject("");
      setBody("");
      if (directStudent) clearDirectStudent();
      else {
        setSelected({});
        setPreview(null);
      }
      try {
        await load();
      } catch (loadError) {
        setMsg((current) => `${current} Broadcast history did not refresh: ${loadError.message}`);
      }
    } finally {
      setSending(false);
    }
  }

  async function resume(broadcastId) {
    setMsg("");
    try {
      const res = await fetch("/api/admin/broadcast/send", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({ broadcastId })
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? `Retry complete: ${data.sent} sent, ${data.remaining} remaining.` : data.error || "The retry could not be completed.");
      if (res.ok) await load();
    } catch (resumeError) {
      setMsg(resumeError.message || "The retry could not be completed.");
    }
  }

  if (!session) {
    return <StaffLogin onAuthed={(s) => setSession(s)} />;
  }

  const canSend = preview && preview.count > 0 && subject.trim() && body.trim() && !sending;

  return (
    <main style={wrap}>
      <h1 style={{ marginBottom: 4 }}>Broadcast</h1>
      <p style={muted}>
        Email families through the band&apos;s own sender (Resend) — independent of NHCS mail.
        You compose and send. Nothing goes out automatically.
      </p>

      {msg && <div style={banner}>{msg}</div>}

      <section style={card}>
        <h2 style={h2}>Message</h2>
        <input
          style={input}
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          style={{ ...input, minHeight: 160, fontFamily: "inherit" }}
          placeholder="Write your message. Blank lines start new paragraphs."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </section>

      <section style={card}>
        <h2 style={h2}>Audience</h2>

        {directStudent ? <div style={banner}>
          <strong>{directStudentName || "Selected student"} + connected guardians</strong>
          <p style={{ margin: "4px 0 8px" }}>This audience cannot be broadened. Preview the exact recipients before sending.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={clearDirectStudent} style={btnSecondary}>Clear student scope</button>
            <Link href={`/admin/students?student=${encodeURIComponent(directStudent)}`} style={{ ...btnSecondary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Back to student</Link>
          </div>
        </div> : null}

        <div style={{ marginBottom: 12 }}>
          <label style={label}>Send to</label>
          <select style={input} value={axis} disabled={Boolean(directStudent)} onChange={(e) => { setAxis(e.target.value); setPreview(null); }}>
            {AXES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {!directStudent && facets.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Match</label>
            <div style={{ display: "flex", gap: 16 }}>
              {["all", "any"].map((m) => (
                <label key={m} style={{ fontSize: 14 }}>
                  <input
                    type="radio"
                    checked={match === m}
                    onChange={() => { setMatch(m); setPreview(null); }}
                  />{" "}
                  {m === "all" ? "Match ALL selected (and)" : "Match ANY selected (or)"}
                </label>
              ))}
            </div>
          </div>
        )}

        {directStudent ? null : facets.length === 0 ? (
          <p style={muted}>
            No attributes on records yet, so the only audience is <strong>everyone</strong>.
            As students get attributes (instrument, ensemble, leadership…), filters appear here.
          </p>
        ) : (
          facets.map((facet) => (
            <div key={facet.key} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{facet.label || facet.key}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {facet.values.map((v) => {
                  const on = (selected[facet.key] || new Set()).has(v.value);
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => toggleValue(facet.key, v.value)}
                      style={on ? chipOn : chip}
                    >
                      {v.label || v.value} ({v.count})
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop: 12, padding: "8px 12px", background: "#fffaf0", borderRadius: 6, fontSize: 14 }}>
          {directStudent
            ? `Audience: ${directStudentName || "selected student"} and connected guardians.`
            : isEveryone
            ? "Audience: everyone (all families)."
            : `Audience: ${match === "all" ? "students matching ALL" : "students matching ANY"} of the selected filters.`}
        </div>
      </section>

      <section style={card}>
        <button type="button" onClick={runPreview} disabled={previewing} style={btnSecondary}>
          {previewing ? "Counting…" : "Preview recipients"}
        </button>

        {preview && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>
              {preview.count} recipient{preview.count === 1 ? "" : "s"}{" "}
              <span style={muted}>
                ({preview.coveredStudentCount} of {preview.studentCount} students reached)
              </span>
            </p>
            {preview.sample?.length > 0 && (
              <p style={{ ...muted, wordBreak: "break-all" }}>
                e.g. {preview.sample.join(", ")}
                {preview.count > preview.sample.length ? " …" : ""}
              </p>
            )}
            <button type="button" onClick={send} disabled={!canSend} style={canSend ? btnPrimary : btnDisabled}>
              {sending ? "Sending…" : `Send to ${preview.count}`}
            </button>
          </div>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>Sent log</h2>
        {loading ? (
          <p style={muted}>Loading…</p>
        ) : log.length === 0 ? (
          <p style={muted}>No broadcasts yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {log.map((broadcast) => <article key={broadcast.id} style={logCard}>
              <div><strong>{broadcast.subject}</strong><small>{new Date(broadcast.sent_at || broadcast.created_at).toLocaleString()}</small></div>
              <div><span>{broadcast.recipient_axis}</span><span>{broadcast.recipient_count} recipients</span><span>{broadcast.status}</span></div>
              {broadcast.status === "failed" ? <button type="button" onClick={() => resume(broadcast.id)} style={btnTiny}>Retry unsent</button> : null}
            </article>)}
          </div>
        )}
      </section>
    </main>
  );
}

const wrap = { maxWidth: 760, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif", color: "#2b2620" };
const muted = { color: "#6f675a", fontSize: 13 };
const card = { border: "1px solid #ded4bf", borderRadius: 8, padding: 16, marginTop: 16, background: "#fff" };
const h2 = { marginTop: 0, fontSize: 16 };
const label = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 };
const input = { boxSizing: "border-box", width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6, marginBottom: 10 };
const banner = { marginTop: 12, padding: "10px 12px", background: "#eef7ee", border: "1px solid #bcdcbc", borderRadius: 6, fontSize: 14 };
const chip = { minHeight: 44, padding: "8px 12px", fontSize: 13, border: "1px solid #ccc", borderRadius: 22, background: "#fff", cursor: "pointer" };
const chipOn = { ...chip, background: "#7b1829", color: "#fff", borderColor: "#7b1829" };
const btnPrimary = { marginTop: 12, padding: "10px 18px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", background: "#7b1829", cursor: "pointer" };
const btnDisabled = { ...btnPrimary, background: "#c9bfa9", cursor: "not-allowed" };
const btnSecondary = { minHeight: 44, padding: "9px 16px", fontSize: 14, fontWeight: 600, border: "1px solid #7b1829", borderRadius: 6, color: "#7b1829", background: "#fff", cursor: "pointer" };
const btnTiny = { minHeight: 44, padding: "8px 12px", fontSize: 12, fontWeight: 600, border: "1px solid #7b1829", borderRadius: 4, color: "#7b1829", background: "#fff", cursor: "pointer" };
const logCard = { border: "1px solid #e3dac9", borderRadius: 7, padding: 12, display: "grid", gap: 8, overflowWrap: "anywhere" };
