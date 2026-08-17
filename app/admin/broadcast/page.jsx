"use client";

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

function authHeaders(session) {
  return {
    "Content-Type": "application/json",
    "x-staff-id": session.id,
    "x-staff-token": session.token
  };
}

const AXES = [
  { value: "guardians", label: "Guardians (personal email — durable)" },
  { value: "students", label: "Students (NHCS school email)" },
  { value: "both", label: "Both" }
];

const OPEN_HOUSE_SUBJECT = "Welcome to Ashley Bands - Complete Your Band Ready Challenge";
const OPEN_HOUSE_BODY = `Hello Ashley Bands families,

Welcome to band! We are excited to begin the new school year with you.

You can complete the band portion of Open House through our Band Ready Challenge:

https://ashleybands.com/open-house

The challenge will connect you to the Family Portal and walk you through the calendar, Day 1 necessities, county instrument agreement, clothing order, grading, attendance, and communication information. AshleyBands.com is our one-stop shop for band information and forms.

Once you finish the six quick stops, show the completed screen to a student helper during Open House and choose a sticker. We may also have individually wrapped candy while supplies last.

You are always welcome to stop by the band room, say hello, and tell me something you enjoyed this summer, what you liked about band camp, or what you are excited about in band this year. I want to be available for individual conversations even though I will not be able to meet with every family at length that evening.

Our Band Boosters will also be in the band room to share ways families can volunteer and support the program. One of our long-term goals is to raise $150,000 over the next ten years so every Ashley band student can have access to a quality instrument.

If you have a question, email me at robert.parker@nhcs.net. Email is the best way for families to reach me.

Welcome to Ashley Bands,

Robert A. Parker
Director of Bands
Ashley High School`;

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

  async function load() {
    if (!session) return;
    const res = await fetch("/api/admin/broadcast", { headers: authHeaders(session) });
    if (res.ok) {
      const data = await res.json();
      setFacets(data.facets || []);
      setLog(data.broadcasts || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/broadcast", { headers: authHeaders(session) });
      if (!active || !res.ok) {
        if (active) setLoading(false);
        return;
      }
      const data = await res.json();
      if (!active) return;
      setFacets(data.facets || []);
      setLog(data.broadcasts || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const audienceFilter = useMemo(() => {
    const predicates = Object.entries(selected)
      .map(([key, set]) => ({ key, op: "in", values: [...set] }))
      .filter((p) => p.values.length);
    return predicates.length ? { match, predicates } : {};
  }, [selected, match]);

  const isEveryone = !audienceFilter.predicates;

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
    try {
      const res = await fetch("/api/admin/broadcast/preview", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({ audienceFilter, recipientAxis: axis })
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
          confirm: true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Send failed.");
        return;
      }
      const tail = data.remaining
        ? ` ${data.remaining} still queued — click Resend on the log row to finish.`
        : "";
      setMsg(`Sent ${data.sent}/${data.recipientCount}. ${data.failed} failed.${tail}`);
      setSubject("");
      setBody("");
      setSelected({});
      setPreview(null);
      load();
    } finally {
      setSending(false);
    }
  }

  async function resume(broadcastId) {
    setMsg("");
    const res = await fetch("/api/admin/broadcast/send", {
      method: "POST",
      headers: authHeaders(session),
      body: JSON.stringify({ broadcastId })
    });
    const data = await res.json();
    setMsg(res.ok ? `Resumed: ${data.sent} sent, ${data.remaining} remaining.` : data.error);
    load();
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
        <button
          type="button"
          style={{ ...chip, marginBottom: 10 }}
          onClick={() => {
            setSubject(OPEN_HOUSE_SUBJECT);
            setBody(OPEN_HOUSE_BODY);
            setAxis("guardians");
            setSelected({ open_house_roster: new Set(["2026-08-17_current_classes"]) });
            setPreview(null);
            setMsg("Open House welcome staged for the confirmed August 17 roster. Preview before sending.");
          }}
        >
          Load Open House welcome
        </button>
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

        <div style={{ marginBottom: 12 }}>
          <label style={label}>Send to</label>
          <select style={input} value={axis} onChange={(e) => { setAxis(e.target.value); setPreview(null); }}>
            {AXES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {facets.length > 0 && (
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

        {facets.length === 0 ? (
          <p style={muted}>
            No attributes on records yet, so the only audience is <strong>everyone</strong>.
            As students get attributes (instrument, ensemble, leadership…), filters appear here.
          </p>
        ) : (
          facets.map((facet) => (
            <div key={facet.key} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{facet.key}</div>
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
                      {v.value} ({v.count})
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop: 12, padding: "8px 12px", background: "#fffaf0", borderRadius: 6, fontSize: 14 }}>
          {isEveryone
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ded4bf" }}>
                <th style={th}>When</th>
                <th style={th}>Subject</th>
                <th style={th}>To</th>
                <th style={th}>Count</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {log.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #f0e9da" }}>
                  <td style={td}>{new Date(b.sent_at || b.created_at).toLocaleString()}</td>
                  <td style={td}>{b.subject}</td>
                  <td style={td}>{b.recipient_axis}</td>
                  <td style={td}>{b.recipient_count}</td>
                  <td style={td}>{b.status}</td>
                  <td style={td}>
                    {b.status === "failed" && (
                      <button type="button" onClick={() => resume(b.id)} style={btnTiny}>Resend</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
const chip = { padding: "5px 10px", fontSize: 13, border: "1px solid #ccc", borderRadius: 16, background: "#fff", cursor: "pointer" };
const chipOn = { ...chip, background: "#7b1829", color: "#fff", borderColor: "#7b1829" };
const btnPrimary = { marginTop: 12, padding: "10px 18px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", background: "#7b1829", cursor: "pointer" };
const btnDisabled = { ...btnPrimary, background: "#c9bfa9", cursor: "not-allowed" };
const btnSecondary = { padding: "9px 16px", fontSize: 14, fontWeight: 600, border: "1px solid #7b1829", borderRadius: 6, color: "#7b1829", background: "#fff", cursor: "pointer" };
const btnTiny = { padding: "4px 10px", fontSize: 12, fontWeight: 600, border: "1px solid #7b1829", borderRadius: 4, color: "#7b1829", background: "#fff", cursor: "pointer" };
const th = { padding: "6px 8px", fontSize: 12, color: "#6f675a", fontWeight: 600 };
const td = { padding: "6px 8px" };
