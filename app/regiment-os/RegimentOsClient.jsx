"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./regiment-os.module.css";

function headingId(children) {
  return String(children)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function headings(markdown) {
  return String(markdown || "")
    .split("\n")
    .map((line) => line.match(/^(##|###)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      level: match[1].length,
      text: match[2].replace(/[`*_]/g, ""),
      id: headingId(match[2].replace(/[`*_]/g, ""))
    }));
}

export default function RegimentOsClient() {
  const [access, setAccess] = useState("checking");
  const [documents, setDocuments] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("start-here");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/regiment-os", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setAccess("locked");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Regiment OS could not be loaded.");
      setDocuments(data.documents || []);
      const requested = window.location.hash.replace(/^#\/?/, "");
      if ((data.documents || []).some((document) => document.slug === requested)) {
        setSelectedSlug(requested);
      }
      setAccess("open");
    } catch (loadError) {
      setError(loadError.message);
      setAccess("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = documents.find((document) => document.slug === selectedSlug) || documents[0];
  const pageHeadings = useMemo(() => headings(selected?.markdown), [selected]);
  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((document) =>
      [document.title, document.summary, document.markdown]
        .some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [documents, query]);

  const selectDocument = useCallback((slug) => {
    setSelectedSlug(slug);
    window.history.replaceState(null, "", `#/${slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (access === "checking") {
    return <main className={styles.loading}>Opening Regiment OS…</main>;
  }
  if (access === "locked") {
    return <RegimentOsGate onOpen={load} />;
  }
  if (access === "error") {
    return <main className={styles.loading}><p>{error}</p><button onClick={load}>Try again</button></main>;
  }

  const markdownComponents = {
    h1: ({ children }) => <h1 id={headingId(children)}>{children}</h1>,
    h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>,
    h3: ({ children }) => <h3 id={headingId(children)}>{children}</h3>,
    a: ({ href = "", children }) => {
      const targetFile = href.split("#")[0].split("/").pop();
      const target = documents.find((document) => document.sourceFile === targetFile);
      if (target) {
        return <a href={`#/${target.slug}`} onClick={(event) => {
          event.preventDefault();
          selectDocument(target.slug);
        }}>{children}</a>;
      }
      const external = /^https?:\/\//.test(href);
      return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{children}</a>;
    }
  };

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <span>Ashley Bands</span>
          <strong>Regiment OS</strong>
        </div>
        <button type="button" onClick={async () => {
          await fetch("/api/regiment-os/access", { method: "DELETE" });
          setAccess("locked");
        }}>Lock</button>
      </header>

      <section className={styles.reviewBrief}>
        <div>
          <p>Working source for systems review</p>
          <h1>Read the intent. Watch the practice. Write what does not line up.</h1>
        </div>
        <div className={styles.briefRules}>
          <span><strong>Everything is visible.</strong> Unfinished ideas are included.</span>
          <span><strong>Nothing is frozen.</strong> Any part may be questioned.</span>
          <span><strong>Observation is not block authority.</strong> The assigned instructor still leads.</span>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <label className={styles.search}>
            <span>Find in the system</span>
            <input
              type="search"
              placeholder="Search topics or language"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className={styles.mobileDocumentSelect}>
            <span>Open a document</span>
            <select value={selected?.slug || ""} onChange={(event) => selectDocument(event.target.value)}>
              {documents.map((document) => (
                <option key={document.slug} value={document.slug}>{document.title}</option>
              ))}
            </select>
          </label>
          <nav className={query.trim() ? styles.mobileSearchResults : ""} aria-label="Regiment OS documents">
            {visibleDocuments.map((document) => (
              <button
                key={document.slug}
                type="button"
                className={document.slug === selected?.slug ? styles.currentDocument : ""}
                aria-current={document.slug === selected?.slug ? "page" : undefined}
                onClick={() => selectDocument(document.slug)}
              >
                <strong>{document.title}</strong>
                <span>{document.summary}</span>
              </button>
            ))}
            {!visibleDocuments.length && <p className={styles.noResults}>No document contains that phrase.</p>}
          </nav>
        </aside>

        <article className={styles.document}>
          <header className={styles.documentHeader}>
            <p>{selected?.summary}</p>
            <span>Working file: {selected?.sourceFile}</span>
          </header>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {selected?.markdown || ""}
          </ReactMarkdown>
        </article>

        <aside className={styles.contents} aria-label="On this page">
          <strong>On this page</strong>
          <nav>
            {pageHeadings.map((heading, index) => (
              <a
                key={`${heading.id}-${index}`}
                className={heading.level === 3 ? styles.subheading : ""}
                href={`#${heading.id}`}
              >{heading.text}</a>
            ))}
          </nav>
        </aside>
      </div>
    </main>
  );
}

function RegimentOsGate({ onOpen }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/regiment-os/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "PIN not recognized.");
      onOpen();
    } catch (accessError) {
      setError(accessError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.gateShell}>
      <form className={styles.gate} onSubmit={submit}>
        <p>Ashley Bands · Private working material</p>
        <h1>Regiment OS</h1>
        <span>Enter the established program PIN to open the complete working system.</span>
        <label htmlFor="regiment-os-pin">Program PIN</label>
        <input
          id="regiment-os-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
        {error && <strong className={styles.gateError} role="alert">{error}</strong>}
        <button type="submit" disabled={busy}>{busy ? "Opening…" : "Open Regiment OS"}</button>
        <small>This material includes unfinished planning. Lock the page when you are finished.</small>
      </form>
    </main>
  );
}
