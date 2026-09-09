"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { revokeStaffSession } from "@/lib/staffSession";
import styles from "./workspace.module.css";
const API = "/api/carnegie-2027/team";
const SIGN_IN = "/carnegie-2027/team/sign-in";
async function workspaceResponse(response, accessCheck = false) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      body.error ||
        "The workspace is temporarily unavailable. Please try again.",
    );
    error.status = response.status;
    error.accessCheck = accessCheck;
    throw error;
  }
  return body;
}
const labels = {
  coordination: "Coordination",
  program: "Program / external decisions",
  finance: "Financial facts",
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  requested: "Requested · not accepted",
  accepted: "Accepted commitment",
  waiting: "Waiting · still owned",
  completed: "Completed",
  declined: "Declined",
  current: "Current working version",
  received: "Received · not confirmed",
  needs_correction: "Needs correction",
  pending: "Pending review",
  rejected: "Rejected",
};
const label = (value) => labels[value] || value;
const formValues = (event) => {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
};
function Field({ name, children, ...props }) {
  return (
    <label className={styles.field}>
      {children}
      <input name={name} required {...props} />
    </label>
  );
}
function Source() {
  return (
    <Field name="source" maxLength={1000}>
      Evidence or reason (source and location)
    </Field>
  );
}
function Owner({ people, domain }) {
  return (
    <label className={styles.field}>
      Owner
      <select name="owner_id" required defaultValue="">
        <option value="" disabled>
          Choose an authorized person
        </option>
        {people
          .filter((p) => !domain || p.domains.includes(domain))
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
      </select>
    </label>
  );
}
function Workspace() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [errorStatus, setErrorStatus] = useState(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("attention"),
    [domain, setDomain] = useState("coordination"),
    [proposed, setProposed] = useState(null);
  const load = useCallback(async (signal) => {
    const response = await fetch(API, { signal, cache: "no-store" });
    const body = await workspaceResponse(response, true);
    setData(body);
    setErrorStatus(null);
  }, []);
  const handleFailure = useCallback((error) => {
    setError(
      error.message || "The workspace could not connect. Please try again.",
    );
    setErrorStatus(error.status || 0);
    if (error.status === 401 || (error.status === 403 && error.accessCheck))
      setData(null);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(
      () =>
        load(c.signal).catch((e) => {
          if (!c.signal.aborted) handleFailure(e);
        }),
      0,
    );
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [load, handleFailure]);
  async function run(operation, message) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      await load();
      setNotice(message);
    } catch (e) {
      handleFailure(e);
    } finally {
      setBusy(false);
    }
  }
  async function post(
    url,
    body,
    headers = { "Content-Type": "application/json" },
  ) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body:
        headers["Content-Type"] === "application/json"
          ? JSON.stringify(body)
          : body,
    });
    return workspaceResponse(res);
  }
  function mutate(command) {
    return run(
      () => post(API, { ...command, revision: data.revision }),
      "Saved. The shared view is up to date.",
    );
  }
  async function download(url) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) await workspaceResponse(res, true);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || "download";
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      handleFailure(e);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      if (!(await revokeStaffSession()))
        throw new Error("Sign-out could not connect. Please try again.");
      window.location.replace(SIGN_IN);
    } catch (error) {
      handleFailure(error);
      setBusy(false);
    }
  }
  if (!data) {
    const needsSignIn = errorStatus === 401;
    const denied = errorStatus === 403;
    return (
      <section className={styles.card}>
        <h1>
          {needsSignIn
            ? "Sign in to the Carnegie workspace"
            : denied
              ? "This account does not have workspace access"
              : error
                ? "Workspace temporarily unavailable"
                : "Checking workspace access…"}
        </h1>
        {needsSignIn || denied ? (
          <>
            <p role="alert">
              {needsSignIn
                ? "Your session is missing or has expired. Sign in with your existing staff email and PIN to continue."
                : "You are signed in, but this account has not been granted private coordination access. Campaign research access is separate."}
            </p>
            <Link className={styles.signInLink} href={SIGN_IN}>
              {needsSignIn ? "Sign in" : "Sign in with another account"}
            </Link>
            {denied && (
              <button disabled={busy} onClick={signOut}>
                Sign out
              </button>
            )}
          </>
        ) : error ? (
          <>
            <p role="alert">{error}</p>
            <button
              disabled={busy}
              onClick={() => run(() => Promise.resolve(), "Refreshed.")}
            >
              Try again
            </button>
            <p>
              This did not change your access. If you need to use a different
              account, <Link href={SIGN_IN}>sign in here</Link>.
            </p>
          </>
        ) : (
          <p role="status">Checking your existing server session.</p>
        )}
      </section>
    );
  }
  const { state, actor, people, history } = data;
  const person = (id) =>
    people.find((p) => p.id === id)?.display_name || "Former workspace member";
  const pending = state.proposals.filter((p) => p.status === "pending");
  const mine = state.commitments.filter(
    (c) =>
      c.owner_id === actor.id && !["completed", "declined"].includes(c.status),
  );
  const decisions = state.records.filter(
    (r) => r.owner_id === actor.id && r.status === "unconfirmed",
  );
  function changeForm(action, id, children) {
    return (
      <form
        className={styles.form}
        onSubmit={(e) => mutate({ ...formValues(e), action, id })}
      >
        {children}
        <Source />
        <button disabled={busy}>Save change</button>
      </form>
    );
  }
  function commitment(c) {
    return (
      <article className={styles.card} key={c.id}>
        <span className={styles.badge}>{label(c.status)}</span>
        <h3>{c.title}</h3>
        <p>
          <strong>{person(c.owner_id)}</strong> · requested by{" "}
          {person(c.requested_by)}
        </p>
        <p>
          {c.accepted_at
            ? `Accepted ${new Date(c.accepted_at).toLocaleString()}${c.accepted_due ? `; accepted date ${c.accepted_due}` : ""}`
            : `Suggested date: ${c.requested_due || "not set"}. No commitment yet.`}
        </p>
        {c.dependency && (
          <p>
            Waiting on: {c.dependency}. Ownership remains with{" "}
            {person(c.owner_id)}.
          </p>
        )}
        <p className={styles.muted}>Source: {c.source}</p>
        {c.owner_id === actor.id && c.status !== "declined" && (
          <details>
            <summary>Update my response</summary>
            {changeForm(
              "commitment.transition",
              c.id,
              <>
                <label className={styles.field}>
                  My response
                  <select name="status">
                    {(c.status === "requested"
                      ? ["accepted", "declined"]
                      : c.status === "completed"
                        ? ["accepted"]
                        : c.status === "waiting"
                          ? ["accepted", "completed"]
                          : ["waiting", "completed"]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                {!c.accepted_at && (
                  <Field name="due" type="date" required={false}>
                    Date I accept (optional)
                  </Field>
                )}
                <Field name="dependency" maxLength={500} required={false}>
                  Dependency (required when waiting)
                </Field>
              </>,
            )}
          </details>
        )}
      </article>
    );
  }
  return (
    <>
      <header className={styles.top}>
        <div>
          <span className={styles.eyebrow}>Private team workspace</span>
          <h1>Carnegie, together.</h1>
          <p>
            Current truth, working documents, and the work each person has
            accepted.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            disabled={busy}
            onClick={() => run(() => Promise.resolve(), "Refreshed.")}
          >
            Refresh
          </button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className={styles.status}>
        <span>
          {actor.display_name} · Revision {data.revision}
        </span>
        <button disabled={busy} onClick={() => download(`${API}/package`)}>
          Download working package
        </button>
      </div>
      <p className={styles.muted}>
        Use downloaded private material only with an approved local or AI tool.
        Uploads propose evidence; they never make a claim true.
      </p>
      {error && (
        <div className={styles.error} role="alert">
          {error} Your unsaved entries remain available. Refresh before retrying
          a stale change.
        </div>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">Working…</p>}
      <nav className={styles.tabs} aria-label="Workspace sections">
        {[
          ["attention", "My attention"],
          ["records", "Project truth"],
          ["documents", "Documents"],
          ["commitments", "Follow-through"],
          ["history", "History"],
        ].map(([key, title]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === "attention" && (
        <>
          <div className={styles.metrics}>
            <article>
              <strong>{mine.length}</strong>
              <span>My requests and commitments</span>
            </article>
            <article>
              <strong>
                {pending.filter(
                  (p) =>
                    state.records.find((r) => r.id === p.record_id)
                      ?.owner_id === actor.id,
                ).length + decisions.length}
              </strong>
              <span>My facts and decisions to review</span>
            </article>
            <article>
              <strong>
                {
                  state.documents.filter((d) => d.status === "needs_correction")
                    .length
                }
              </strong>
              <span>Documents needing correction</span>
            </article>
          </div>
          <section>
            <h2>What belongs with me</h2>
            <div className={styles.grid}>{mine.map(commitment)}</div>
            {!mine.length && (
              <p className={styles.empty}>
                You have no open requests or accepted commitments here.
              </p>
            )}
          </section>
          <section className={styles.card}>
            <h2>My review</h2>
            {decisions.map((r) => (
              <p key={r.id}>{r.title} · unconfirmed</p>
            ))}
            {pending
              .filter(
                (p) =>
                  state.records.find((r) => r.id === p.record_id)?.owner_id ===
                  actor.id,
              )
              .map((p) => (
                <p key={p.id}>
                  {state.records.find((r) => r.id === p.record_id)?.title} ·
                  proposed update
                </p>
              ))}
            <button onClick={() => setTab("records")}>
              Review project truth
            </button>
          </section>
          {!state.records.length && (
            <aside className={styles.empty}>
              <h2>A clean starting point</h2>
              <p>
                No project records or source files have been imported. Add a
                sourced record, a reviewed working file, or a request. Existing
                OneDrive masters remain where they are.
              </p>
              <p>
                Access is limited to the designated director and explicitly
                granted workspace members. Campaign research access does not
                grant access here. Financial confirmation becomes available when
                a financial owner is granted access.
              </p>
            </aside>
          )}
        </>
      )}
      {tab === "records" && (
        <>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Project truth</h2>
              <p>
                Each fact, milestone, or decision has an owner. Unconfirmed
                entries are visible, without being treated as settled.
              </p>
            </div>
          </div>
          <details className={styles.card}>
            <summary>Add a sourced record</summary>
            <form
              className={styles.form}
              onSubmit={(e) =>
                mutate({ ...formValues(e), action: "record.create" })
              }
            >
              <Field name="title" maxLength={160}>
                Title
              </Field>
              <label className={styles.field}>
                Type
                <select name="kind">
                  <option value="fact">Fact</option>
                  <option value="milestone">Milestone</option>
                  <option value="decision">Decision</option>
                </select>
              </label>
              <label className={styles.field}>
                Area
                <select
                  name="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                >
                  {["coordination", "program", "finance"].map((d) => (
                    <option key={d} value={d}>
                      {label(d)}
                    </option>
                  ))}
                </select>
              </label>
              <Owner key={domain} people={people} domain={domain} />
              <Field name="value" maxLength={2000}>
                Current claim or unresolved question
              </Field>
              <Source />
              <button disabled={busy}>Add as unconfirmed</button>
            </form>
          </details>
          <div className={styles.grid}>
            {state.records.map((r) => (
              <article className={styles.card} key={r.id}>
                <span className={styles.badge}>{label(r.status)}</span>
                <p className={styles.muted}>
                  {label(r.domain)} · {r.kind} · version {r.version}
                </p>
                <h3>{r.title}</h3>
                <p className={styles.value}>{r.value}</p>
                <p>
                  Owner: <strong>{person(r.owner_id)}</strong>
                </p>
                <p className={styles.muted}>Source: {r.source}</p>
                {r.source_document_id && (
                  <p className={styles.muted}>
                    Accepted from document version {r.source_document_id}
                  </p>
                )}
                {r.status === "unconfirmed" && r.owner_id === actor.id && (
                  <details>
                    <summary>Confirm from evidence</summary>
                    {changeForm(
                      "record.confirm",
                      r.id,
                      <p>
                        I have verified this claim within my authority.
                        Confirmation records my decision and source.
                      </p>,
                    )}
                  </details>
                )}
                <details>
                  <summary>Propose a change</summary>
                  <form
                    className={styles.form}
                    onSubmit={(e) =>
                      mutate({
                        ...formValues(e),
                        action: "proposal.create",
                        record_id: r.id,
                        base_version: r.version,
                      })
                    }
                  >
                    <Field name="value" maxLength={2000} defaultValue={r.value}>
                      Proposed replacement
                    </Field>
                    <label className={styles.field}>
                      Received document version (optional)
                      <select name="document_id">
                        <option value="">No document reference</option>
                        {state.documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.filename} ·{" "}
                            {new Date(d.received_at).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Source />
                    <button disabled={busy}>Submit proposal</button>
                  </form>
                </details>
              </article>
            ))}
          </div>
          <h2>Proposed updates</h2>
          <p>
            Changing a document does not update this view. Compare the evidence
            here; only the record owner can accept.
          </p>
          {pending.length === 0 && (
            <p className={styles.empty}>No pending proposals.</p>
          )}
          {pending.map((p) => {
            const r = state.records.find((r) => r.id === p.record_id);
            const conflict = r?.version !== p.base_version;
            return (
              <article className={styles.card} key={p.id}>
                <h3>{r?.title}</h3>
                <span className={styles.badge}>
                  {conflict
                    ? "Conflict · source record changed"
                    : "Pending owner review"}
                </span>
                <div className={styles.compare}>
                  <div>
                    <h4>Current {label(r?.status).toLowerCase()}</h4>
                    <p>{r?.value}</p>
                  </div>
                  <div>
                    <h4>Proposed</h4>
                    <p>{p.value}</p>
                  </div>
                </div>
                <p>
                  Proposed by {person(p.created_by)}. Source: {p.source}
                </p>
                {p.document_id && (
                  <button
                    disabled={busy}
                    onClick={() => download(`${API}/files?id=${p.document_id}`)}
                  >
                    Download source version
                  </button>
                )}
                {conflict && (
                  <p>
                    Based on version {p.base_version}: {p.base_value}. Create a
                    new proposal after reviewing the current record.
                  </p>
                )}
                {r?.owner_id === actor.id && (
                  <form
                    className={styles.form}
                    onSubmit={(e) => {
                      const v = formValues(e);
                      mutate({ ...v, action: v.disposition, id: p.id });
                    }}
                  >
                    <label className={styles.field}>
                      Review decision
                      <select name="disposition">
                        <option value="proposal.reject">Reject proposal</option>
                        {!conflict && (
                          <option value="proposal.accept">
                            Accept and confirm replacement
                          </option>
                        )}
                      </select>
                    </label>
                    <Source />
                    <button disabled={busy}>Record my review</button>
                  </form>
                )}
              </article>
            );
          })}
          <details className={styles.card}>
            <summary>Import proposals from my AI working package</summary>
            <p>
              Use the JSON template in the download. This creates pending
              proposals only; existing record versions must still match.
            </p>
            <label className={styles.field}>
              Proposal JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  setError("");
                  setProposed(null);
                  try {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 100000)
                      throw new Error("Proposal file is too large.");
                    const p = JSON.parse(await file.text());
                    if (
                      p.format !== "carnegie-proposals-v1" ||
                      !Array.isArray(p.proposals) ||
                      !p.proposals.length ||
                      p.proposals.length > 50 ||
                      !p.proposals.every(
                        (item) =>
                          item &&
                          typeof item.record_id === "string" &&
                          typeof item.value === "string" &&
                          typeof item.source === "string" &&
                          Number.isInteger(item.base_version),
                      )
                    )
                      throw new Error("Choose a filled proposal template.");
                    setProposed(p);
                  } catch (err) {
                    setError(err.message);
                  }
                }}
              />
            </label>
            {proposed && (
              <>
                <h3>Review import ({proposed.proposals.length} proposals)</h3>
                {proposed.proposals.map((p, i) => (
                  <p key={i}>
                    <strong>
                      {state.records.find((r) => r.id === p.record_id)?.title ||
                        "Unknown record"}
                    </strong>
                    : {String(p.value)} · {String(p.source)}
                  </p>
                ))}
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await post(`${API}/import`, {
                        ...proposed,
                        revision: data.revision,
                      });
                      setProposed(null);
                    }, "Proposals received for owner review.")
                  }
                >
                  Import as pending proposals
                </button>
              </>
            )}
          </details>
        </>
      )}
      {tab === "documents" && (
        <>
          <h2>Working documents</h2>
          <p>
            Latest received and current working versions are separate. Selecting
            a working version does not confirm its claims.
          </p>
          <details className={styles.card}>
            <summary>Upload a reviewed DOCX or XLSX</summary>
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const file = f.get("file");
                const params = new URLSearchParams({
                  name: file.name,
                  source: f.get("source"),
                  series: f.get("series"),
                  revision: String(data.revision),
                });
                run(
                  () =>
                    post(`${API}/files?${params}`, file, {
                      "Content-Type": "application/octet-stream",
                      "X-Reviewed-Content": "yes",
                    }),
                  "Immutable version received. Project facts have not changed.",
                );
              }}
            >
              <label className={styles.field}>
                Document
                <input name="file" type="file" accept=".docx,.xlsx" required />
              </label>
              <label className={styles.field}>
                Version of
                <select name="series">
                  <option value="">New document series (I own it)</option>
                  {state.documents
                    .filter((d) => !d.series_id && d.owner_id === actor.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.filename}
                      </option>
                    ))}
                </select>
              </label>
              <Source />
              <label className={styles.check}>
                <input type="checkbox" required />I reviewed the entire
                original, including hidden cells, comments and images. It
                contains no passwords, PINs, keys, bank instructions, or
                material outside this team’s approved access.
              </label>
              <p className={styles.muted}>
                3 MB maximum. Macros, embedded objects and external data links
                are rejected. A credential scan is an aid; it does not replace
                this review.
              </p>
              <button disabled={busy}>Receive new version</button>
            </form>
          </details>
          {!state.documents.length && (
            <p className={styles.empty}>
              No documents received. OneDrive originals have not been imported.
            </p>
          )}
          {state.documents
            .filter((d) => !d.series_id)
            .map((root) => {
              const versions = state.documents
                .filter((d) => (d.series_id || d.id) === root.id)
                .toReversed();
              return (
                <section className={styles.card} key={root.id}>
                  <h3>{root.filename}</h3>
                  <p>Working owner: {person(root.owner_id)}</p>
                  {versions.map((d, i) => (
                    <details key={d.id} className={styles.version}>
                      <summary>
                        {i === 0 ? "Latest received · " : ""}
                        {label(d.status)} · {d.filename} ·{" "}
                        {new Date(d.received_at).toLocaleString()}
                      </summary>
                      <p>Source: {d.source}</p>
                      <p className={styles.muted}>
                        SHA-256: <code>{d.sha256}</code>
                      </p>
                      <button
                        disabled={busy}
                        onClick={() => download(`${API}/files?id=${d.id}`)}
                      >
                        Download this original
                      </button>
                      <p className={styles.muted}>{d.preview.note}</p>
                      {d.preview.sections.map((s, i) => (
                        <details key={i}>
                          <summary>{s.title}</summary>
                          <pre className={styles.preview}>
                            {s.text || "(No readable cells or text)"}
                          </pre>
                        </details>
                      ))}
                      {d.owner_id === actor.id && (
                        <details>
                          <summary>Set version status</summary>
                          {changeForm(
                            "document.status",
                            d.id,
                            <label className={styles.field}>
                              Status
                              <select name="status" defaultValue={d.status}>
                                {[
                                  "received",
                                  "needs_correction",
                                  "current",
                                ].map((s) => (
                                  <option value={s} key={s}>
                                    {label(s)}
                                  </option>
                                ))}
                              </select>
                            </label>,
                          )}
                        </details>
                      )}
                    </details>
                  ))}
                </section>
              );
            })}
        </>
      )}
      {tab === "commitments" && (
        <>
          <h2>Shared follow-through</h2>
          <p>
            A request is not a commitment. Only the named person can accept,
            decline, mark waiting, or complete their work.
          </p>
          <details className={styles.card}>
            <summary>Make a request</summary>
            <form
              className={styles.form}
              onSubmit={(e) =>
                mutate({ ...formValues(e), action: "commitment.request" })
              }
            >
              <Field name="title" maxLength={240}>
                Requested outcome
              </Field>
              <Owner people={people} />
              <Field name="due" type="date" required={false}>
                Suggested date (not an accepted deadline)
              </Field>
              <Source />
              <button disabled={busy}>Record request</button>
            </form>
          </details>
          <div className={styles.grid}>{state.commitments.map(commitment)}</div>
          {!state.commitments.length && (
            <p className={styles.empty}>No requests or commitments recorded.</p>
          )}
        </>
      )}
      {tab === "history" && (
        <>
          <h2>Who changed what</h2>
          <p>
            Every saved revision has an immutable snapshot and actor record.
            Showing the latest 100 changes.
          </p>
          {history.map((h) => (
            <article key={h.revision} className={styles.history}>
              <strong>
                Revision {h.revision} · {h.action}
              </strong>
              <p>
                {person(h.actor_id)} · {new Date(h.created_at).toLocaleString()}
              </p>
              <p>{h.source}</p>
              <button
                disabled={busy}
                onClick={() => download(`${API}?revision=${h.revision}`)}
              >
                Download this revision snapshot
              </button>
            </article>
          ))}
          {!history.length && (
            <p className={styles.empty}>No changes recorded yet.</p>
          )}
        </>
      )}
    </>
  );
}
export default function TeamPage() {
  return (
    <main className={styles.main}>
      <Workspace />
    </main>
  );
}
