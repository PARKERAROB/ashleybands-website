"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import styles from "./assets.module.css";

const ALL = "all";

const STATUS_OPTIONS = [
  [ALL, "All statuses"],
  ["assigned", "Assigned / in use"],
  ["available", "Available"],
  ["attention", "Needs attention"]
];

const SORT_OPTIONS = [
  ["name", "Asset name · A–Z"],
  ["tag", "Asset tag · A–Z"],
  ["type", "Type · A–Z"],
  ["status", "Status · A–Z"],
  ["holder", "Current holder · A–Z"],
  ["updated", "Source update · newest"]
];

const SOURCE_LABELS = {
  canonical_assets: "AshleyBands assets",
  instrument_inventory: "Instrument inventory",
  legacy_instrument_inventory: "Instrument inventory",
  music_library_inventory: "Music library intake",
  bandsofahs_resource_csv: "BandsofAHS resource assignments",
  portal_student_resources: "Student resource assignments",
  bandsofahs_instrument_inventory_csv: "BandsofAHS instrument inventory",
  bandsofahs_lockers_csv: "BandsofAHS locker inventory",
  bandsofahs_master_locks_csv: "BandsofAHS lock inventory",
  bandsofahs_tuners_csv: "BandsofAHS tuner inventory"
};

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceLabel(value) {
  return SOURCE_LABELS[value] || titleCase(value) || "Source not listed";
}

function dateLabel(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function categoryValue(category) {
  if (typeof category === "string") return category;
  return category?.id || category?.value || category?.category || category?.assetType || "";
}

function normalizeCategory(category) {
  const id = categoryValue(category);
  if (!id) return null;
  if (typeof category === "string") {
    return { id, label: titleCase(id), connected: true, count: null, dedicatedHref: "", source: "" };
  }
  const rawCount = category.count ?? category.recordCount ?? category.total;
  const count = rawCount === "" || rawCount == null || !Number.isFinite(Number(rawCount))
    ? null
    : Number(rawCount);
  const disconnected = category.connected === false
    || ["disconnected", "not_connected", "not-connected"].includes(String(category.state || category.status || "").toLowerCase());
  return {
    id,
    label: category.label || category.name || category.title || titleCase(id),
    connected: !disconnected,
    count,
    dedicatedHref: category.dedicatedHref || category.href || "",
    source: category.source || ""
  };
}

function normalizeStudent(student) {
  if (!student?.id) return null;
  return {
    id: student.id,
    name: student.name || student.displayName || student.display_name || "Student",
    status: String(student.status || "active").toLowerCase()
  };
}

function normalizeDetails(details) {
  if (!Array.isArray(details)) return [];
  return details.filter((item) => Array.isArray(item) && item.length >= 2 && item[0] && item[1] != null);
}

function normalizeRecord(record) {
  if (!record?.id) return null;
  const holder = record.holder?.id || record.holder?.name ? {
    id: record.holder.id || "",
    name: record.holder.name || "Current holder",
    status: record.holder.status || ""
  } : null;
  return {
    id: record.id,
    assetType: record.assetType || record.asset_type || "asset",
    tag: record.tag || "",
    name: record.name || record.displayName || record.tag || "Asset",
    type: record.type || titleCase(record.assetType || record.asset_type || "asset"),
    status: record.status || "Status not listed",
    state: String(record.state || "").toLowerCase(),
    condition: record.condition || "",
    location: record.location || "",
    holder,
    source: record.source || "",
    sourceUpdatedAt: record.sourceUpdatedAt || record.source_updated_at || null,
    sourceDateLabel: record.sourceDateLabel || "Imported",
    details: normalizeDetails(record.details),
    dedicatedHref: record.dedicatedHref || ""
  };
}

function normalizeFreshness(sourceFreshness) {
  if (Array.isArray(sourceFreshness)) {
    return sourceFreshness.map((item) => {
      if (typeof item === "string") return { source: item, label: sourceLabel(item), updatedAt: null, connected: true };
      const source = item?.source || item?.id || item?.name || "";
      return {
        source,
        label: item?.label || sourceLabel(source),
        updatedAt: item?.updatedAt || item?.sourceUpdatedAt || item?.asOf || null,
        connected: item?.connected !== false,
        dateLabel: item?.dateLabel || "Imported"
      };
    }).filter((item) => item.source || item.label);
  }
  if (sourceFreshness && typeof sourceFreshness === "object") {
    return Object.entries(sourceFreshness).map(([source, value]) => ({
      source,
      label: typeof value === "object" && value?.label ? value.label : sourceLabel(source),
      updatedAt: typeof value === "object" ? value?.updatedAt || value?.sourceUpdatedAt || value?.asOf : value,
      connected: typeof value !== "object" || value?.connected !== false,
      dateLabel: typeof value === "object" ? value?.dateLabel || "Imported" : "Imported"
    }));
  }
  return [];
}

function summaryValue(summary, keys) {
  for (const key of keys) {
    const value = summary?.[key];
    if (value != null && value !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function safeHref(value) {
  return typeof value === "string" && value.startsWith("/") ? value : "";
}

function compareRecords(left, right, sort) {
  if (sort === "updated") {
    const leftTime = left.sourceUpdatedAt ? new Date(left.sourceUpdatedAt).getTime() : 0;
    const rightTime = right.sourceUpdatedAt ? new Date(right.sourceUpdatedAt).getTime() : 0;
    return rightTime - leftTime || left.name.localeCompare(right.name, undefined, { numeric: true });
  }
  const values = {
    tag: [left.tag, right.tag],
    type: [left.type, right.type],
    status: [left.status, right.status],
    holder: [left.holder?.name || "", right.holder?.name || ""],
    name: [left.name, right.name]
  }[sort] || [left.name, right.name];
  return String(values[0] || "").localeCompare(String(values[1] || ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export default function AssetsWorkspace(props) {
  return (
    <StaffGate>
      {(session, signOut) => <AuthenticatedAssets {...props} session={session} signOut={signOut} />}
    </StaffGate>
  );
}

function AuthenticatedAssets({
  initialStudentId = "",
  initialCategory = ALL,
  initialStatus = ALL,
  initialAssetId = "",
  initialQuery = "",
  initialType = ALL,
  initialSort = "name",
  session,
  signOut
}) {
  const [studentId, setStudentId] = useState(initialStudentId);
  const [category, setCategory] = useState(initialCategory || ALL);
  const [status, setStatus] = useState(initialStatus || ALL);
  const [assetId, setAssetId] = useState(initialAssetId);
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType || ALL);
  const [sort, setSort] = useState(initialSort || "name");
  const [data, setData] = useState({ records: [], categories: [], students: [], summary: {}, sourceFreshness: [] });
  const [loadState, setLoadState] = useState({ loading: true, error: "" });
  const detailRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (studentId) params.set("student", studentId);
    if (category && category !== ALL) params.set("category", category);
    if (status && status !== ALL) params.set("status", status);
    if (assetId) params.set("asset", assetId);
    if (query.trim()) params.set("q", query.trim());
    if (type && type !== ALL) params.set("type", type);
    if (sort && sort !== "name") params.set("sort", sort);
    const serialized = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (serialized ? `?${serialized}` : ""));
  }, [assetId, category, query, sort, status, studentId, type]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (studentId) params.set("student", studentId);
      if (category && category !== ALL) params.set("category", category);
      if (status && status !== ALL) params.set("status", status);
      setLoadState({ loading: true, error: "" });
      fetch(`/api/admin/assets${params.size ? `?${params.toString()}` : ""}`, {
        headers: staffAuthHeaders(session),
        cache: "no-store",
        signal: controller.signal
      })
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || "Assets could not be loaded.");
          return body;
        })
        .then((body) => {
          const records = (body.records || []).map(normalizeRecord).filter(Boolean);
          const categories = (body.categories || []).map(normalizeCategory).filter(Boolean);
          const students = (body.students || []).map(normalizeStudent).filter(Boolean)
            .filter((student) => student.status === "active");
          setData({
            records,
            categories,
            students,
            summary: body.summary || {},
            sourceFreshness: normalizeFreshness(body.sourceFreshness)
          });
          setAssetId((current) => current && records.some((record) => record.id === current) ? current : "");
          setLoadState({ loading: false, error: "" });
        })
        .catch((error) => {
          if (error.name !== "AbortError") setLoadState({ loading: false, error: error.message });
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, session, status, studentId]);

  const selectedStudent = useMemo(() => data.students.find((student) => student.id === studentId)
    || data.records.find((record) => record.holder?.id === studentId)?.holder
    || null, [data.records, data.students, studentId]);

  const categoryOptions = useMemo(() => data.categories, [data.categories]);
  const selectedCategory = category === ALL ? null : categoryOptions.find((item) => item.id === category) || null;
  const typeOptions = useMemo(() => [...new Set(data.records.map((record) => record.type).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true })), [data.records]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.records.filter((record) => {
      if (type !== ALL && record.type !== type) return false;
      if (!term) return true;
      const details = record.details.flatMap(([label, value]) => [label, value]);
      return [
        record.name,
        record.tag,
        record.type,
        record.status,
        record.condition,
        record.location,
        record.holder?.name,
        sourceLabel(record.source),
        ...details
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
    }).sort((left, right) => compareRecords(left, right, sort));
  }, [data.records, query, sort, type]);

  const selected = data.records.find((record) => record.id === assetId) || null;

  useEffect(() => {
    if (!selected || !detailRef.current || typeof window.matchMedia !== "function"
      || !window.matchMedia("(max-width: 780px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  const total = summaryValue(data.summary, ["total", "records", "recordCount"]);
  const assigned = summaryValue(data.summary, ["assigned", "assignedCount", "inUse"]);
  const available = summaryValue(data.summary, ["available", "availableCount"]);
  const attention = summaryValue(data.summary, ["attention", "attentionCount", "needsAttention"]);

  function chooseCategory(nextCategory) {
    setCategory(nextCategory);
    setType(ALL);
    setAssetId("");
  }

  function chooseStatus(nextStatus) {
    setStatus(nextStatus);
    setAssetId("");
  }

  function chooseStudent(nextStudentId) {
    setStudentId(nextStudentId);
    setAssetId("");
  }

  function clearFilters() {
    setCategory(ALL);
    setStatus(ALL);
    setType(ALL);
    setQuery("");
    setAssetId("");
  }

  return (
    <main className={styles.page}>
      <header className={styles.appBar}>
        <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
        <nav>
          <Link href="/admin">Command center</Link>
          <Link href="/admin/students">Current students</Link>
          <button type="button" onClick={signOut}>Sign out</button>
        </nav>
      </header>

      <section className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Current operations</p>
          <h1>Assets &amp; inventory</h1>
          <p>Find current records and assignments across connected asset sources.</p>
        </div>
        <div className={styles.quickCounts} aria-label="Asset status shortcuts">
          <button type="button" className={status === ALL ? styles.activeCount : ""} onClick={() => chooseStatus(ALL)}>
            <strong>{loadState.loading || loadState.error ? "—" : total ?? data.records.length}</strong><span>Current results</span>
          </button>
          <button type="button" className={status === "assigned" ? styles.activeCount : ""} onClick={() => chooseStatus("assigned")}>
            <strong>{loadState.loading || loadState.error ? "—" : assigned ?? "—"}</strong><span>Assigned</span>
          </button>
          <button type="button" className={status === "available" ? styles.activeCount : ""} onClick={() => chooseStatus("available")}>
            <strong>{loadState.loading || loadState.error ? "—" : available ?? "—"}</strong><span>Available</span>
          </button>
          <button type="button" className={`${styles.attentionCount} ${status === "attention" ? styles.activeCount : ""}`} onClick={() => chooseStatus("attention")}>
            <strong>{loadState.loading || loadState.error ? "—" : attention ?? "—"}</strong><span>Need attention</span>
          </button>
        </div>
      </section>

      {!loadState.error ? <SourceFreshness sources={data.sourceFreshness} /> : null}

      {selectedStudent ? (
        <section className={styles.scopeBar}>
          <div><span>Student context</span><strong>{selectedStudent.name}</strong><p>Showing current assets connected to this student.</p></div>
          <div>
            <Link href={`/admin/students?student=${encodeURIComponent(studentId)}`}>Open full student</Link>
            <button type="button" onClick={() => chooseStudent("")}>Show full program</button>
          </div>
        </section>
      ) : null}

      {loadState.error ? <p className={styles.error} role="alert">{loadState.error}</p> : null}

      <div className={`${styles.workspace} ${selected ? styles.withDetail : ""}`}>
        <aside className={styles.filters} aria-label="Asset filters">
          <div className={styles.filterHeading}><strong>Find assets</strong><button type="button" onClick={clearFilters}>Clear</button></div>
          <label><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tag, item, student…" /></label>
          <label><span>Student</span><select value={studentId} onChange={(event) => chooseStudent(event.target.value)}><option value="">All current students</option>{data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>

          <div className={styles.categoryHeading}>Asset area</div>
          <div className={styles.categoryList}>
            <div className={styles.categoryRow}>
              <button type="button" className={category === ALL ? styles.activeCategory : ""} onClick={() => chooseCategory(ALL)}><span>All connected</span><strong>{total ?? data.records.length}</strong></button>
            </div>
            {categoryOptions.map((item) => (
              <div className={`${styles.categoryRow} ${!item.connected ? styles.disconnectedCategory : ""}`} key={item.id}>
                <button type="button" disabled={!item.connected} className={category === item.id ? styles.activeCategory : ""} onClick={() => chooseCategory(item.id)}>
                  <span>{item.label}</span>
                  <strong>{item.connected ? item.count ?? "Connected" : "Not connected yet"}</strong>
                </button>
                {item.connected && safeHref(item.dedicatedHref) ? <Link href={item.dedicatedHref} aria-label={`Open dedicated ${item.label} tool`}>Open</Link> : null}
              </div>
            ))}
          </div>

          <label><span>Status</span><select value={status} onChange={(event) => chooseStatus(event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Type</span><select value={type} onChange={(event) => { setType(event.target.value); setAssetId(""); }}><option value={ALL}>All types</option>{typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <p className={styles.filterNote}>Current records only. Each asset area keeps its own source and workflow.</p>
        </aside>

        <section className={styles.inventoryPanel} aria-label="Asset results">
          <header className={styles.inventoryToolbar}>
            <div>
              <strong>{selectedStudent ? `${selectedStudent.name} · current assets` : selectedCategory?.label || "All connected assets"}</strong>
              <span>{loadState.loading ? "Loading current records…" : `${visible.length} result${visible.length === 1 ? "" : "s"}`}</span>
            </div>
            <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}>{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </header>

          {loadState.error ? (
            <div className={styles.empty}><strong>Asset records are unavailable right now.</strong></div>
          ) : selectedCategory && !selectedCategory.connected ? (
            <DisconnectedState category={selectedCategory} />
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Asset</th><th>Type</th><th>Status</th><th>Current holder</th><th>Location</th><th>Source</th></tr></thead>
                <tbody>{visible.map((record) => (
                  <tr key={record.id} className={selected?.id === record.id ? styles.focusedRow : ""}>
                    <td data-label="Asset"><button type="button" className={styles.assetButton} onClick={() => setAssetId(record.id)}><strong>{record.name}</strong><span>{record.tag || "No asset tag"}</span></button></td>
                    <td data-label="Type">{record.type}</td>
                    <td data-label="Status"><Status state={record.state}>{record.status}</Status></td>
                    <td data-label="Current holder">{record.holder?.id ? <Link className={styles.holderLink} href={`/admin/students?student=${encodeURIComponent(record.holder.id)}`}>{record.holder.name}</Link> : record.holder?.name || "Unassigned"}</td>
                    <td data-label="Location">{record.location || "Not listed"}</td>
                    <td data-label="Source"><span className={styles.sourceTag}>{sourceLabel(record.source)}</span></td>
                  </tr>
                ))}</tbody>
              </table>
              {!loadState.loading && !visible.length ? <div className={styles.empty}><strong>No current assets match.</strong><button type="button" onClick={clearFilters}>Clear filters</button></div> : null}
            </div>
          )}
        </section>

        {selected ? <AssetDetail record={selected} detailRef={detailRef} onClose={() => setAssetId("")} /> : null}
      </div>
    </main>
  );
}

function SourceFreshness({ sources }) {
  const connected = sources.filter((source) => source.connected);
  if (!connected.length) return null;
  return (
    <section className={styles.sourceBar} aria-label="Connected asset sources">
      <strong>Connected sources</strong>
      <div>{connected.map((source) => <span key={source.source || source.label}><b>{source.label}</b>{source.updatedAt ? ` · ${source.dateLabel || "Imported"} ${dateLabel(source.updatedAt)}` : ""}</span>)}</div>
    </section>
  );
}

function DisconnectedState({ category }) {
  return (
    <div className={styles.disconnectedState}>
      <span>Not connected yet</span>
      <strong>{category.label}</strong>
      <p>This area will use its own inventory source when that source is ready.</p>
    </div>
  );
}

function AssetDetail({ record, detailRef, onClose }) {
  const dedicatedHref = safeHref(record.dedicatedHref);
  return (
    <aside ref={detailRef} tabIndex={-1} className={styles.detail} aria-label={`${record.name} details`}>
      <header><div><span>{record.tag || titleCase(record.assetType)}</span><h2>{record.name}</h2><p>{record.type}</p></div><button type="button" onClick={onClose} aria-label="Close asset details">×</button></header>

      <section className={styles.detailSection}>
        <h3>Current record</h3>
        <DetailLine label="Status" value={record.status} />
        {record.condition ? <DetailLine label="Condition" value={record.condition} /> : null}
        {record.location ? <DetailLine label="Location" value={record.location} /> : null}
        {record.details.map(([label, value]) => <DetailLine key={`${label}-${value}`} label={label} value={String(value)} />)}
      </section>

      <section className={styles.detailSection}>
        <h3>Current assignment</h3>
        {record.holder ? (
          <>
            <DetailLine label="Holder" value={record.holder.name} />
            {record.holder.status ? <DetailLine label="Holder status" value={titleCase(record.holder.status)} /> : null}
            {record.holder.id ? <Link className={styles.detailLink} href={`/admin/students?student=${encodeURIComponent(record.holder.id)}`}>Open {record.holder.name} →</Link> : null}
          </>
        ) : <p className={styles.unassigned}>No current assignment</p>}
      </section>

      <section className={styles.detailSection}>
        <h3>Source</h3>
        <DetailLine label="Record owner" value={sourceLabel(record.source)} />
        <DetailLine label={record.sourceDateLabel || "Imported"} value={dateLabel(record.sourceUpdatedAt)} />
        {dedicatedHref ? <Link className={styles.dedicatedLink} href={dedicatedHref}>Open dedicated tool →</Link> : <p className={styles.unassigned}>No separate workflow is connected for this record.</p>}
      </section>
    </aside>
  );
}

function DetailLine({ label, value }) {
  return <div className={styles.detailLine}><span>{label}</span><strong>{value}</strong></div>;
}

function Status({ state, children }) {
  const tone = ["assigned", "available", "attention"].includes(state) ? state : "plain";
  return <span className={`${styles.status} ${styles[tone]}`}>{children}</span>;
}
