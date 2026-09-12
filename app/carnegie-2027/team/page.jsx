"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { revokeStaffSession } from "@/lib/staffSession";
import styles from "./workspace.module.css";
import CoordinationPanel, { TeamView } from "./CoordinationPanel";
import AgentAccess from "./AgentAccess";
import WorkspaceOverview from "./WorkspaceOverview";
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
  program: "Program",
  finance: "Finance",
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  requested: "Requested",
  accepted: "Accepted",
  waiting: "Waiting",
  completed: "Completed",
  declined: "Declined",
  current: "Working version",
  received: "Received",
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
      Source / reason
    </Field>
  );
}
function Owner({ people, domain }) {
  return (
    <label className={styles.field}>
      Owner
      <select name="owner_id" required defaultValue="">
        <option value="" disabled>
          Choose owner
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
    [tab, setTab] = useState("overview"),
    [composer, setComposer] = useState(false),
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
      return true;
    } catch (e) {
      handleFailure(e);
      return false;
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
  function navigate(nextTab) { setTab(nextTab); setNotice(""); }
  function changeComposer(open) { setComposer(open); if (open) setNotice(""); }
  function mutate(command) {
    return run(
      () => post(API, { ...command, revision: data.revision }),
      "Saved.",
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
  if (actor.access === "viewer") return <div className={styles.viewer}><header className={styles.top}><div><Link href="/">Ashley Bands</Link><h1>Team view</h1></div><div className={styles.actions}><button disabled={busy} onClick={() => run(() => Promise.resolve(), "Refreshed.")}>Refresh</button><button onClick={signOut}>Sign out</button></div></header><p className={styles.muted}>Carnegie 2027 · Read only</p>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<TeamView rows={data.team} /></div>;
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
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}><span className={styles.mark}>A</span><span>Ashley Bands<small>Carnegie 2027</small></span></Link>
        <nav className={styles.tabs} aria-label="Workspace sections">
          {[
            ["overview", "Overview", "◫"],
            ["coordination", "Updates", "≡"],
            ["commitments", "Next actions", "✓"],
            ["records", "Reference", "▤"],
            ["documents", "Documents", "▱"],
            ["history", "History", "↶"],
            ["team", "Team view", "◎"],
            ["agent", "Connect agent", "↗"],
          ].map(([key, title, icon]) => <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => navigate(key)}><span aria-hidden="true">{icon}</span>{title}</button>)}
        </nav>
        <div className={styles.profile}><span className={styles.avatar}>{actor.display_name.split(" ").map(n => n[0]).slice(0,2).join("")}</span><span>{actor.display_name}</span></div>
        <button className={styles.signOut} disabled={busy} onClick={signOut}>Sign out</button>
      </aside>
      <div className={styles.workspaceBody}>
        <div className={styles.topbar}><span>Carnegie 2027 <span className={styles.privateBadge}>Private</span></span><button disabled={busy} onClick={() => run(() => Promise.resolve(), "Refreshed.")}>Refresh</button></div>
        <div className={styles.content}>
          <header className={styles.top}>
            <h1>{{overview: "Overview", coordination: "Updates", commitments: "Next actions", records: "Reference", documents: "Documents", history: "History", team: "Team view", agent: "Connect agent", attention: "Needs you"}[tab]}</h1>
            {actor.domains.includes("coordination") && (!composer || tab !== "coordination") && <button disabled={busy} className={styles.primary} onClick={() => { navigate("coordination"); changeComposer(true); }}>{composer ? "Resume update" : "+ Add an update"}</button>}
          </header>
          {error && <div className={styles.error} role="alert">{error}</div>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {busy && <p role="status">Working…</p>}
          {tab === "overview" && <WorkspaceOverview state={state} actor={actor} people={people} navigate={navigate} />}
          <div hidden={tab !== "coordination"}>
            <CoordinationPanel records={state.records} people={people} actor={actor} mutate={mutate} busy={busy} composer={composer} setComposer={changeComposer} />
          </div>
      {tab === "team" && <TeamView rows={state.records.filter(r => r.team_visible === true)} />}
      {tab === "agent" && <AgentAccess />}
      {tab === "attention" && (
        <>
          <section>
            <h2>My actions</h2>
            <div className={styles.grid}>{mine.map(commitment)}</div>
            {!mine.length && (
              <p className={styles.empty}>
                No open actions.
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
            <button onClick={() => navigate("records")}>
              Review reference
            </button>
          </section>

        </>
      )}
      {tab === "records" && (
        <>
          <div className={styles.sectionHeading}>
            <div>

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
            {state.records.filter(r => ["fact", "milestone", "decision"].includes(r.kind)).map((r) => (
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
                {(actor.is_primary || r.owner_id === actor.id) && <details>
                  <summary>Team visibility: {r.team_visible ? "shared" : "writers only"}</summary>
                  <p>Review the title, value and status for the whole team before sharing. Source notes and history stay private to writers.</p>
                  <button disabled={busy} onClick={() => mutate({ action: "record.share", id: r.id, base_version: r.version, team_visible: !r.team_visible, source: "Writer reviewed this current entry for team visibility" })}>{r.team_visible ? "Remove from team view" : "Share reviewed entry with team"}</button>
                </details>}
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

          <button disabled={busy} onClick={() => download(`${API}/package`)}>Download working package</button>

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
          <p className={styles.muted}>Latest 100 changes</p>
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
        </div>
      </div>
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
