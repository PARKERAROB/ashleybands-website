"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StaffGate } from "@/components/StaffGate";

const EMPTY = {
  id: "",
  slug: "",
  issue_date: "",
  week_start: "",
  week_end: "",
  title: "",
  preview_text: "",
  public_subject: "",
  member_subject: "",
  public_markdown: "",
  member_markdown: "",
  review_notes: "",
  status: "draft"
};

function authHeaders(session) {
  return {
    "Content-Type": "application/json",
    "x-staff-id": session.id,
    "x-staff-token": session.token
  };
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatEvent(event) {
  const start = new Date(event.start);
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(start);
  const time = event.all_day
    ? ""
    : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(start);
  const location = event.location ? ` at ${event.location}` : "";
  return `- **${date}:** ${event.title}${time ? `, ${time}` : ""}${location}`;
}

async function nextIssueDraft() {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const issueDate = addDays(now, daysUntilSunday);
  const weekStart = addDays(issueDate, 1);
  const weekEnd = addDays(issueDate, 7);
  let events = [];
  try {
    const response = await fetch("/calendar-data.json");
    const calendar = response.ok ? await response.json() : [];
    events = calendar
      .filter((event) => {
        const date = String(event.start || "").slice(0, 10);
        return date >= isoDate(weekStart) && date <= isoDate(weekEnd);
      })
      .slice(0, 8);
  } catch {}
  const upcoming = events.length ? events.map(formatEvent).join("\n") : "- Add the confirmed dates families need this week.";
  const label = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(issueDate);
  const endLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(weekEnd);
  const publicMarkdown = `Write a short opening that connects last week to the week ahead.\n\n## This week at a glance\n\n${upcoming}\n\n## What students accomplished\n\n- Add two or three verified ensemble or program accomplishments.\n\n## Spotlight\n\nAdd one student, ensemble, volunteer, alumni, or community highlight.\n\n## Stay connected\n\n- [Subscribe to the Ashley Bands calendar](https://ashleybands.com/calendar)\n- [Support Ashley Bands](https://ashleybands.com/sponsors)`;
  const memberMarkdown = `${publicMarkdown}\n\n## Students\n\n- Add the few things students need to practice, bring, or complete.\n\n## Families\n\n- Add the few things families need to know or do.\n- [Review family information in the Family Portal](https://ashleybands.com/portal)`;
  return {
    ...EMPTY,
    slug: isoDate(issueDate),
    issue_date: isoDate(issueDate),
    week_start: isoDate(weekStart),
    week_end: isoDate(weekEnd),
    title: "The week behind us. The week ahead.",
    preview_text: "What Ashley Bands accomplished and what is coming this week.",
    public_subject: `AshleyBands Weekly | ${label}-${endLabel}`,
    member_subject: `AshleyBands Weekly | ${label}-${endLabel}`,
    public_markdown: publicMarkdown,
    member_markdown: memberMarkdown,
    review_notes: "Confirm every date, time, link, student name, photograph, and action before publishing."
  };
}

function NewsletterAdmin({ session }) {
  const [issues, setIssues] = useState([]);
  const [subscriberCounts, setSubscriberCounts] = useState({ confirmed: 0, optedOut: 0 });
  const [form, setForm] = useState(EMPTY);
  const [previewEdition, setPreviewEdition] = useState("member");
  const [audience, setAudience] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const locked = form.status !== "draft";
  const markdown = previewEdition === "member" ? form.member_markdown : form.public_markdown;

  async function load(preferredId) {
    const response = await fetch("/api/admin/newsletter", { headers: authHeaders(session) });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Newsletter data could not be loaded.");
      return;
    }
    setIssues(data.issues || []);
    setSubscriberCounts(data.subscriberCounts || { confirmed: 0, optedOut: 0 });
    const selected = (data.issues || []).find((issue) => issue.id === preferredId)
      || (data.issues || []).find((issue) => issue.status === "draft")
      || data.issues?.[0];
    if (selected) setForm(selected);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch("/api/admin/newsletter", { headers: authHeaders(session) });
      const data = await response.json();
      if (!active) return;
      if (!response.ok) {
        setMessage(data.error || "Newsletter data could not be loaded.");
        return;
      }
      setIssues(data.issues || []);
      setSubscriberCounts(data.subscriberCounts || { confirmed: 0, optedOut: 0 });
      const selected = (data.issues || []).find((issue) => issue.status === "draft") || data.issues?.[0];
      if (selected) setForm(selected);
    })();
    return () => { active = false; };
  }, [session]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setAudience(null);
  };

  async function startNew() {
    setForm(await nextIssueDraft());
    setAudience(null);
    setMessage("A new Sunday draft was assembled from the public calendar. Add the verified look-back and member-only details.");
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/newsletter", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "The draft could not be saved.");
        return;
      }
      setForm(data.issue);
      setMessage("Draft saved. Nothing was published or sent.");
      await load(data.issue.id);
    } finally {
      setBusy(false);
    }
  }

  async function previewAudience() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/newsletter/preview", {
        method: "POST",
        headers: authHeaders(session),
        body: "{}"
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "The audience could not be previewed.");
        return;
      }
      setAudience(data);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const review = form.review_notes.trim();
    if (review && !window.confirm(`Review notes are still present:\n\n${review}\n\nPublish the public archive anyway?`)) return;
    if (!window.confirm(`Publish "${form.title}" on the public AshleyBands Weekly archive?`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/newsletter/publish", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({ issueId: form.id, confirm: true })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "The issue could not be published.");
        return;
      }
      setMessage("Public archive published. No email was sent.");
      await load(data.issue.id);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!audience) {
      setMessage("Preview the live audience before sending.");
      return;
    }
    const first = `Send the member edition to ${audience.memberCount} current-program addresses and the public edition to ${audience.communityCount} confirmed community subscribers?`;
    if (!window.confirm(first)) return;
    if (!window.confirm(`Confirm again: ${audience.totalCount} real emails will be sent now and cannot be unsent.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({ issueId: form.id, confirm: true })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "The newsletter send did not complete.");
        return;
      }
      const member = data.result.member || { sent: 0, failed: 0, remaining: 0 };
      const community = data.result.public || { sent: 0, failed: 0, remaining: 0 };
      setMessage(`Member: ${member.sent} sent, ${member.failed} failed. Public: ${community.sent} sent, ${community.failed} failed.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="newsletter-admin">
      <header className="newsletter-admin-header">
        <div>
          <p className="newsletter-kicker">Review before send</p>
          <h1>AshleyBands Weekly</h1>
          <p>Draft both editions, publish the public archive, preview the current audience, then send.</p>
        </div>
        <button type="button" onClick={startNew}>Start next Sunday&apos;s draft</button>
      </header>

      {message && <div className="newsletter-admin-message" role="status">{message}</div>}

      <section className="newsletter-admin-summary">
        <div><strong>{subscriberCounts.confirmed}</strong><span>confirmed community subscribers</span></div>
        <div><strong>{subscriberCounts.optedOut}</strong><span>newsletter opt-outs</span></div>
        <div><strong>{issues.length}</strong><span>issues and drafts</span></div>
      </section>

      {issues.length > 0 && (
        <label className="newsletter-admin-issue-picker">
          Issue
          <select value={form.id} onChange={(event) => {
            const selected = issues.find((issue) => issue.id === event.target.value);
            if (selected) { setForm(selected); setAudience(null); setMessage(""); }
          }}>
            {!form.id && <option value="">Unsaved new issue</option>}
            {issues.map((issue) => (
              <option key={issue.id} value={issue.id}>{issue.issue_date} · {issue.title} · {issue.status}</option>
            ))}
          </select>
        </label>
      )}

      <div className="newsletter-admin-grid">
        <section className="newsletter-admin-editor">
          <div className="newsletter-admin-status-row">
            <span className={`newsletter-admin-status is-${form.status}`}>{form.status}</span>
            {locked && <span>Published issues are retained as immutable records.</span>}
          </div>

          <div className="newsletter-admin-dates">
            <Field label="Issue date" type="date" value={form.issue_date} disabled={locked} onChange={(value) => update("issue_date", value)} />
            <Field label="Week starts" type="date" value={form.week_start} disabled={locked} onChange={(value) => update("week_start", value)} />
            <Field label="Week ends" type="date" value={form.week_end} disabled={locked} onChange={(value) => update("week_end", value)} />
          </div>
          <Field label="Slug" value={form.slug} disabled={locked} onChange={(value) => update("slug", value)} />
          <Field label="Issue title" value={form.title} disabled={locked} onChange={(value) => update("title", value)} />
          <Field label="Inbox preview" value={form.preview_text} disabled={locked} onChange={(value) => update("preview_text", value)} />
          <Field label="Member subject" value={form.member_subject} disabled={locked} onChange={(value) => update("member_subject", value)} />
          <Field label="Public subject" value={form.public_subject} disabled={locked} onChange={(value) => update("public_subject", value)} />

          <label>
            Member edition
            <textarea value={form.member_markdown} disabled={locked} onChange={(event) => update("member_markdown", event.target.value)} rows={22} />
          </label>
          <label>
            Public edition
            <textarea value={form.public_markdown} disabled={locked} onChange={(event) => update("public_markdown", event.target.value)} rows={20} />
          </label>
          <label>
            Review notes, not included in the newsletter
            <textarea value={form.review_notes} disabled={locked} onChange={(event) => update("review_notes", event.target.value)} rows={5} />
          </label>

          <div className="newsletter-admin-actions">
            {!locked && <button type="button" className="is-primary" onClick={save} disabled={busy}>Save draft</button>}
            {!locked && form.id && <button type="button" onClick={publish} disabled={busy}>Publish archive</button>}
            <button type="button" onClick={previewAudience} disabled={busy}>Preview live audience</button>
            {locked && <button type="button" className="is-danger" onClick={send} disabled={busy || !audience}>Send both editions</button>}
            {form.status === "published" && <a href={`/newsletter/${form.slug}`} target="_blank" rel="noreferrer">Open public issue ↗</a>}
          </div>

          {audience && (
            <div className="newsletter-admin-audience">
              <strong>{audience.totalCount} unique newsletter recipients</strong>
              <span>{audience.memberCount} current-program addresses receive the member edition.</span>
              <span>{audience.communityCount} confirmed outside subscribers receive the public edition.</span>
            </div>
          )}
        </section>

        <aside className="newsletter-admin-preview">
          <div className="newsletter-admin-preview-switch">
            {[
              ["member", "Member"],
              ["public", "Public"]
            ].map(([value, label]) => (
              <button key={value} type="button" className={previewEdition === value ? "is-active" : ""} onClick={() => setPreviewEdition(value)}>{label}</button>
            ))}
          </div>
          <div className="newsletter-admin-preview-paper">
            <p className="newsletter-kicker">AshleyBands Weekly</p>
            <h2>{form.title || "Issue title"}</h2>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || "Preview appears here."}</ReactMarkdown>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }) {
  return (
    <label>
      {label}
      <input type={type} value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function NewsletterAdminPage() {
  return (
    <StaffGate>
      {(session) => <NewsletterAdmin session={session} />}
    </StaffGate>
  );
}
