"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STUDENTS } from "../current-students-prototype/CurrentStudentsPrototype";
import styles from "./assets-inventory-prototype.module.css";

const ACTIVE = STUDENTS.filter((student) => student.status === "active");

const ASSETS = [
  {
    id: "instrument-trumpet-118", tag: "TP-118", name: "School trumpet 118", category: "instruments", type: "Trumpet",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "avery-north",
    details: [["Maker", "Yamaha"], ["Model", "YTR-2330"], ["Serial", "C40218"]],
    assignment: { since: "Aug 5, 2026", agreement: "Signed", due: "End of school year" },
    history: [["Aug 5, 2026", "Assigned to Avery North"], ["Jul 31, 2026", "Condition checked: Good"], ["Jun 6, 2026", "Returned from prior assignment"]]
  },
  {
    id: "instrument-trumpet-204", tag: "TP-204", name: "School trumpet 204", category: "instruments", type: "Trumpet",
    status: "Available", state: "available", condition: "Good", location: "Instrument room · Shelf B", studentId: "",
    details: [["Maker", "Bach"], ["Model", "TR300H2"], ["Serial", "A92041"]],
    history: [["Aug 21, 2026", "Returned and checked in"], ["Aug 21, 2026", "Condition checked: Good"], ["May 29, 2026", "Assigned to prior student"]]
  },
  {
    id: "instrument-trumpet-206", tag: "TP-206", name: "School trumpet 206", category: "instruments", type: "Trumpet",
    status: "In repair", state: "attention", condition: "Valve repair", location: "Coastal Music Repair", studentId: "",
    details: [["Maker", "Yamaha"], ["Model", "YTR-2330"], ["Serial", "C40612"]],
    history: [["Aug 26, 2026", "Sent for valve repair"], ["Aug 25, 2026", "Repair need recorded"], ["Jun 4, 2026", "Returned from prior assignment"]]
  },
  {
    id: "instrument-horn-031", tag: "HN-031", name: "School horn 31", category: "instruments", type: "French Horn",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "imani-stone",
    details: [["Maker", "Conn"], ["Model", "6D"], ["Serial", "H61823"]],
    assignment: { since: "Aug 6, 2026", agreement: "Signed", due: "End of school year" },
    history: [["Aug 6, 2026", "Assigned to Imani Stone"], ["Aug 1, 2026", "Condition checked: Good"]]
  },
  {
    id: "instrument-tuba-024", tag: "TU-024", name: "School tuba 24", category: "instruments", type: "Tuba",
    status: "Checked out", state: "assigned", condition: "Fair", location: "Band room", studentId: "noah-quill",
    details: [["Maker", "King"], ["Model", "2341"], ["Serial", "T77204"]],
    assignment: { since: "Aug 7, 2026", agreement: "Signed", due: "End of school year" },
    history: [["Aug 7, 2026", "Assigned to Noah Quill"], ["Aug 7, 2026", "Condition checked: Fair"]]
  },
  {
    id: "instrument-bass-clarinet-016", tag: "BC-016", name: "School bass clarinet 16", category: "instruments", type: "Bass Clarinet",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "kai-mercer",
    details: [["Maker", "Selmer"], ["Model", "1430LP"], ["Serial", "B16048"]],
    assignment: { since: "Aug 6, 2026", agreement: "Signed", due: "End of school year" },
    history: [["Aug 6, 2026", "Assigned to Kai Mercer"], ["Aug 1, 2026", "Condition checked: Good"]]
  },
  {
    id: "instrument-euphonium-027", tag: "EU-027", name: "School euphonium 27", category: "instruments", type: "Euphonium",
    status: "Available", state: "available", condition: "Good", location: "Instrument room · Rack C", studentId: "",
    details: [["Maker", "Jupiter"], ["Model", "JEP700"], ["Serial", "E27122"]],
    history: [["Aug 10, 2026", "Condition checked: Good"], ["Jun 4, 2026", "Returned from prior assignment"]]
  },
  {
    id: "tuner-033", tag: "TN-033", name: "Tuner 33", category: "tuners", type: "Tuner",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "avery-north",
    details: [["Brand", "Korg"], ["Model", "TM-60"], ["Clip", "Included"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of marching season" },
    history: [["Aug 5, 2026", "Assigned to Avery North"], ["Aug 2, 2026", "Battery replaced"]]
  },
  {
    id: "tuner-008", tag: "TN-008", name: "Tuner 08", category: "tuners", type: "Tuner",
    status: "Clip missing", state: "attention", condition: "Needs accessory", location: "With student", studentId: "rowan-fields",
    details: [["Brand", "Korg"], ["Model", "TM-60"], ["Clip", "Missing"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of marching season" },
    history: [["Aug 28, 2026", "Tuner clip reported missing"], ["Aug 5, 2026", "Assigned to Rowan Fields"]]
  },
  {
    id: "tuner-019", tag: "TN-019", name: "Tuner 19", category: "tuners", type: "Tuner",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "theo-marin",
    details: [["Brand", "Korg"], ["Model", "TM-60"], ["Clip", "Included"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of marching season" },
    history: [["Aug 5, 2026", "Assigned to Theo Marin"], ["Aug 2, 2026", "Condition checked: Good"]]
  },
  {
    id: "tuner-042", tag: "TN-042", name: "Tuner 42", category: "tuners", type: "Tuner",
    status: "Available", state: "available", condition: "Good", location: "Front cabinet · Bin 2", studentId: "",
    details: [["Brand", "Korg"], ["Model", "TM-60"], ["Clip", "Included"]],
    history: [["Aug 20, 2026", "Returned and checked in"], ["Aug 20, 2026", "Condition checked: Good"]]
  },
  {
    id: "tuner-021", tag: "TN-021", name: "Tuner 21", category: "tuners", type: "Tuner",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "kai-mercer",
    details: [["Brand", "Korg"], ["Model", "TM-60"], ["Clip", "Included"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of marching season" },
    history: [["Aug 5, 2026", "Assigned to Kai Mercer"], ["Aug 2, 2026", "Condition checked: Good"]]
  },
  {
    id: "tuner-004", tag: "TN-004", name: "Tuner 04", category: "tuners", type: "Tuner",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "nia-grove",
    details: [["Brand", "Korg"], ["Model", "TM-60"], ["Clip", "Included"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of marching season" },
    history: [["Aug 5, 2026", "Assigned to Nia Grove"], ["Aug 2, 2026", "Condition checked: Good"]]
  },
  {
    id: "locker-114", tag: "LK-114", name: "Locker 114", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Instrument storage · Row 1", studentId: "avery-north", relatedAssetId: "lock-114",
    details: [["Size", "Medium"], ["Lock", "Master lock 114"], ["Contents", "Trumpet case"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 5, 2026", "Assigned to Avery North"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "lock-114", tag: "ML-114", name: "Master lock 114", category: "lockers", type: "Lock",
    status: "In use", state: "assigned", condition: "Good", location: "Locker 114", studentId: "avery-north", relatedAssetId: "locker-114",
    details: [["Serial", "ML9482"], ["Assigned locker", "Locker 114"], ["Combination", "Protected"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 5, 2026", "Connected to Locker 114 and Avery North"], ["Aug 1, 2026", "Serial and combination verified"]]
  },
  {
    id: "locker-087", tag: "LK-087", name: "Locker 087", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Instrument storage · Row 1", studentId: "milo-harbor",
    details: [["Size", "Large"], ["Lock", "Student-provided"], ["Contents", "Trombone case"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 5, 2026", "Assigned to Milo Harbor"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "locker-guard-012", tag: "GL-012", name: "Guard locker 12", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Guard storage", studentId: "sage-linden",
    details: [["Size", "Guard"], ["Lock", "Built in"], ["Contents", "Guard equipment"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of marching season" },
    history: [["Aug 5, 2026", "Assigned to Sage Linden"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "locker-132", tag: "LK-132", name: "Locker 132", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Instrument storage · Row 2", studentId: "theo-marin",
    details: [["Size", "Medium"], ["Lock", "Student-provided"], ["Contents", "Alto saxophone case"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 5, 2026", "Assigned to Theo Marin"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "locker-105", tag: "LK-105", name: "Locker 105", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Instrument storage · Row 1", studentId: "imani-stone",
    details: [["Size", "Medium"], ["Lock", "Student-provided"], ["Contents", "Horn case"]],
    assignment: { since: "Aug 6, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 6, 2026", "Assigned to Imani Stone"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "locker-141", tag: "LK-141", name: "Locker 141", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Large instrument storage", studentId: "noah-quill",
    details: [["Size", "Large"], ["Lock", "Student-provided"], ["Contents", "Tuba accessories"]],
    assignment: { since: "Aug 7, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 7, 2026", "Assigned to Noah Quill"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "locker-063", tag: "LK-063", name: "Locker 063", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Instrument storage · Row 1", studentId: "kai-mercer",
    details: [["Size", "Large"], ["Lock", "Student-provided"], ["Contents", "Bass clarinet case"]],
    assignment: { since: "Aug 6, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 6, 2026", "Assigned to Kai Mercer"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "locker-044", tag: "LK-044", name: "Locker 044", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Instrument storage · Row 1", studentId: "lena-vale",
    details: [["Size", "Small"], ["Lock", "Student-provided"], ["Contents", "Flute case"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 5, 2026", "Assigned to Lena Vale"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "locker-038", tag: "LK-038", name: "Locker 038", category: "lockers", type: "Locker",
    status: "In use", state: "assigned", condition: "Good", location: "Instrument storage · Row 1", studentId: "nia-grove",
    details: [["Size", "Small"], ["Lock", "Student-provided"], ["Contents", "Oboe case"]],
    assignment: { since: "Aug 5, 2026", agreement: "Not required", due: "End of school year" },
    history: [["Aug 5, 2026", "Assigned to Nia Grove"], ["Aug 1, 2026", "Locker cleared and checked"]]
  },
  {
    id: "lock-spare-017", tag: "ML-017", name: "Master lock 017", category: "lockers", type: "Lock",
    status: "Available", state: "available", condition: "Good", location: "Director cabinet · Lock bin", studentId: "",
    details: [["Serial", "ML3027"], ["Assigned locker", "None"], ["Combination", "Protected"]],
    history: [["Aug 1, 2026", "Serial and combination verified"], ["Jun 5, 2026", "Returned and stored"]]
  },
  {
    id: "uniform-jacket-042", tag: "UJ-042", name: "Marching jacket 42", category: "uniforms", type: "Jacket",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "avery-north",
    details: [["Uniform group", "Band"], ["Size", "M"], ["Garment", "Jacket"]],
    assignment: { since: "Aug 8, 2026", agreement: "Issued", due: "End of marching season" },
    history: [["Aug 8, 2026", "Issued to Avery North"], ["Aug 3, 2026", "Cleaned and inspected"]]
  },
  {
    id: "uniform-bibber-058", tag: "UB-058", name: "Marching bibber 58", category: "uniforms", type: "Bibber",
    status: "Cleaning", state: "attention", condition: "Stain treatment", location: "Uniform room · Cleaning rack", studentId: "",
    details: [["Uniform group", "Band"], ["Size", "L"], ["Garment", "Bibber"]],
    history: [["Aug 27, 2026", "Moved to cleaning rack"], ["Aug 26, 2026", "Stain noted at return"]]
  },
  {
    id: "uniform-guard-top-014", tag: "GU-014", name: "Guard top 14", category: "uniforms", type: "Guard uniform",
    status: "Checked out", state: "assigned", condition: "Good", location: "With student", studentId: "sage-linden",
    details: [["Uniform group", "Guard"], ["Size", "M"], ["Garment", "Top"]],
    assignment: { since: "Aug 8, 2026", agreement: "Issued", due: "End of marching season" },
    history: [["Aug 8, 2026", "Issued to Sage Linden"], ["Aug 3, 2026", "Cleaned and inspected"]]
  },
  {
    id: "music-blue-shades", tag: "MU-0012", name: "Blue Shades · Set 12", category: "music", type: "Music set",
    status: "Shelved", state: "available", condition: "Complete", location: "Music library · Cabinet A", studentId: "", holder: "Music library",
    details: [["Composer", "Frank Ticheli"], ["Parts", "Complete"], ["Format", "Print set"]],
    history: [["Aug 22, 2026", "Returned by Wind Ensemble"], ["Aug 22, 2026", "Parts counted: Complete"]]
  },
  {
    id: "music-incantation", tag: "MU-0048", name: "Incantation and Dance · Set 48", category: "music", type: "Music set",
    status: "Missing part", state: "attention", condition: "Clarinet 3 missing", location: "Music library · Review cart", studentId: "", holder: "Music library",
    details: [["Composer", "John Barnes Chance"], ["Parts", "Clarinet 3 missing"], ["Format", "Print set"]],
    history: [["Aug 24, 2026", "Clarinet 3 part marked missing"], ["Aug 23, 2026", "Returned by Concert Band"]]
  },
  {
    id: "music-english-folk", tag: "MU-0061", name: "English Folk Song Suite · Set 61", category: "music", type: "Music set",
    status: "In use", state: "assigned", condition: "Complete", location: "Wind Ensemble folders", studentId: "", holder: "Wind Ensemble",
    details: [["Composer", "Ralph Vaughan Williams"], ["Parts", "Complete"], ["Format", "Print set"]],
    assignment: { since: "Aug 18, 2026", agreement: "Not required", due: "Oct 8 concert" },
    history: [["Aug 18, 2026", "Issued to Wind Ensemble"], ["Aug 17, 2026", "Parts counted: Complete"]]
  }
];

const CATEGORIES = [
  ["all", "All records"],
  ["instruments", "Instruments"],
  ["tuners", "Tuners"],
  ["lockers", "Lockers & locks"],
  ["uniforms", "Uniforms"],
  ["music", "Music"]
];

const STATUS_OPTIONS = [
  ["all", "All statuses"],
  ["assigned", "Assigned / in use"],
  ["available", "Available"],
  ["attention", "Needs attention"]
];

const SORT_OPTIONS = [
  ["name", "Asset name · A-Z"],
  ["tag", "Asset tag · A-Z"],
  ["type", "Type · A-Z"],
  ["status", "Status · A-Z"],
  ["holder", "Current holder · A-Z"]
];

function studentFor(asset) {
  return ACTIVE.find((student) => student.id === asset.studentId) || null;
}

function holderFor(asset) {
  return studentFor(asset)?.displayName || asset.holder || (asset.state === "available" ? "Unassigned" : "Program");
}

function compareAssets(a, b, sortBy) {
  const values = {
    name: [a.name, b.name],
    tag: [a.tag, b.tag],
    type: [a.type, b.type],
    status: [a.status, b.status],
    holder: [holderFor(a), holderFor(b)]
  }[sortBy] || [a.name, b.name];
  return values[0].localeCompare(values[1], undefined, { numeric: true });
}

export default function AssetsInventoryPrototype({ initialStudentId = "", initialCategory = "all", initialStatus = "all", initialAssetId = "" }) {
  const safeStudent = ACTIVE.some((student) => student.id === initialStudentId) ? initialStudentId : "";
  const safeCategory = CATEGORIES.some(([value]) => value === initialCategory) ? initialCategory : "all";
  const safeStatus = STATUS_OPTIONS.some(([value]) => value === initialStatus) ? initialStatus : "all";
  const initialPool = ASSETS.filter((asset) => !safeStudent || asset.studentId === safeStudent);
  const [studentId, setStudentId] = useState(safeStudent);
  const [category, setCategory] = useState(safeCategory);
  const [status, setStatus] = useState(safeStatus);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [assetId, setAssetId] = useState(ASSETS.some((asset) => asset.id === initialAssetId) ? initialAssetId : (initialPool[0]?.id || ""));
  const [action, setAction] = useState("");

  const student = ACTIVE.find((item) => item.id === studentId) || null;
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ASSETS.filter((asset) => {
      if (studentId && asset.studentId !== studentId) return false;
      if (category !== "all" && asset.category !== category) return false;
      if (status !== "all" && asset.state !== status) return false;
      const haystack = [asset.name, asset.tag, asset.type, asset.status, asset.location, holderFor(asset)].join(" ").toLowerCase();
      return !term || haystack.includes(term);
    }).sort((a, b) => compareAssets(a, b, sortBy));
  }, [category, search, sortBy, status, studentId]);

  const selected = ASSETS.find((asset) => asset.id === assetId) || null;
  const attentionCount = ASSETS.filter((asset) => asset.state === "attention").length;
  const assignedCount = ASSETS.filter((asset) => asset.state === "assigned").length;
  const availableCount = ASSETS.filter((asset) => asset.state === "available").length;

  function writeLocation(next = {}) {
    const values = { student: studentId, category, status, asset: assetId, ...next };
    const params = new URLSearchParams();
    if (values.student) params.set("student", values.student);
    if (values.category && values.category !== "all") params.set("category", values.category);
    if (values.status && values.status !== "all") params.set("status", values.status);
    if (values.asset) params.set("asset", values.asset);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
  }

  function chooseCategory(nextCategory) {
    setCategory(nextCategory); setAssetId(""); setAction("");
    writeLocation({ category: nextCategory, asset: "" });
  }

  function chooseStatus(nextStatus) {
    setStatus(nextStatus); setAssetId(""); setAction("");
    writeLocation({ status: nextStatus, asset: "" });
  }

  function chooseAsset(nextAssetId) {
    setAssetId(nextAssetId); setAction("");
    writeLocation({ asset: nextAssetId });
  }

  function scopeStudent(nextStudentId) {
    setStudentId(nextStudentId); setAssetId(""); setAction("");
    writeLocation({ student: nextStudentId, asset: "" });
  }

  function clearStudent() {
    setStudentId(""); setAssetId(""); setAction("");
    writeLocation({ student: "", asset: "" });
  }

  function clearFilters() {
    setSearch(""); setCategory("all"); setStatus("all"); setAssetId(""); setAction("");
    writeLocation({ category: "all", status: "all", asset: "" });
  }

  return (
    <main className={styles.page}>
      <header className={styles.appBar}>
        <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
        <nav><Link href="/admin/operations-prototype">Command center</Link><Link href="/admin/current-students-prototype">Current students</Link><span className={styles.prototypeBadge}>Prototype · Synthetic data</span></nav>
      </header>

      <section className={styles.heading}>
        <div><p className={styles.eyebrow}>Current operations</p><h1>Assets & Inventory</h1><p>{ASSETS.length} synthetic records across five inventory areas</p></div>
        <div className={styles.quickCounts}>
          <button onClick={() => chooseStatus("assigned")}><strong>{assignedCount}</strong><span>Assigned</span></button>
          <button onClick={() => chooseStatus("available")}><strong>{availableCount}</strong><span>Available</span></button>
          <button className={styles.attentionCount} onClick={() => chooseStatus("attention")}><strong>{attentionCount}</strong><span>Need attention</span></button>
        </div>
      </section>

      {student ? <section className={styles.scopeBar}>
        <div><span>Student context</span><strong>{student.displayName}</strong><p>{ASSETS.filter((asset) => asset.studentId === student.id).length} current assignments</p></div>
        <div><Link href={`/admin/current-students-prototype?student=${encodeURIComponent(student.id)}`}>Open full student</Link><button onClick={clearStudent}>Show full program</button></div>
      </section> : null}

      <div className={[styles.workspace, selected ? styles.withDetail : ""].filter(Boolean).join(" ")}>
        <aside className={styles.filters}>
          <div className={styles.filterHeading}><strong>Find assets</strong><button onClick={clearFilters}>Clear</button></div>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tag, item, student..." /></label>
          <div className={styles.categoryList} aria-label="Inventory category">
            {CATEGORIES.map(([value, label]) => <button key={value} className={category === value ? styles.activeCategory : ""} onClick={() => chooseCategory(value)}><span>{label}</span><strong>{value === "all" ? ASSETS.length : ASSETS.filter((asset) => asset.category === value).length}</strong></button>)}
          </div>
          <label><span>Status</span><select value={status} onChange={(event) => chooseStatus(event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <p className={styles.filterNote}>Current status only. History appears inside each asset.</p>
        </aside>

        <section className={styles.inventoryPanel}>
          <header className={styles.inventoryToolbar}>
            <div><strong>{student ? `${student.displayName} · assigned assets` : CATEGORIES.find(([value]) => value === category)?.[1]}</strong><span>{visible.length} result{visible.length === 1 ? "" : "s"}</span></div>
            <label><span>Sort</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </header>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Asset</th><th>Type</th><th>Status</th><th>Current holder</th><th>Location</th></tr></thead>
              <tbody>{visible.map((asset) => {
                const owner = studentFor(asset);
                return <tr key={asset.id} className={selected?.id === asset.id ? styles.focusedRow : ""}>
                  <td><button className={styles.assetButton} onClick={() => chooseAsset(asset.id)}><strong>{asset.name}</strong><span>{asset.tag}</span></button></td>
                  <td>{asset.type}</td>
                  <td><Status state={asset.state}>{asset.status}</Status></td>
                  <td>{owner && !student ? <button className={styles.holderButton} onClick={() => scopeStudent(owner.id)}>{owner.displayName}</button> : holderFor(asset)}</td>
                  <td>{asset.location}</td>
                </tr>;
              })}</tbody>
            </table>
            {!visible.length ? <div className={styles.empty}><strong>No assets match.</strong><button onClick={clearFilters}>Clear filters</button></div> : null}
          </div>
        </section>

        {selected ? <AssetDetail asset={selected} action={action} onAction={setAction} onClose={() => { setAssetId(""); setAction(""); writeLocation({ asset: "" }); }} onChooseAsset={chooseAsset} /> : null}
      </div>
    </main>
  );
}

function AssetDetail({ asset, action, onAction, onClose, onChooseAsset }) {
  const owner = studentFor(asset);
  const relatedAsset = ASSETS.find((item) => item.id === asset.relatedAssetId);
  const actions = asset.state === "available" ? ["Assign", "Send to repair", "Mark missing"] : asset.state === "attention" ? ["Resolve", "Assign", "Mark missing"] : ["Transfer", "Return", "Send to repair", "Mark missing"];
  return (
    <aside className={styles.detail} aria-label={`${asset.name} details`}>
      <header><div><span>{asset.tag}</span><h2>{asset.name}</h2><p>{asset.type}</p></div><button onClick={onClose} aria-label="Close asset details">×</button></header>

      <DetailSection title="Current record">
        <DetailLine label="Status" value={asset.status} />
        <DetailLine label="Condition" value={asset.condition} />
        <DetailLine label="Location" value={asset.location} />
        {asset.details.map(([label, value]) => <DetailLine key={label} label={label} value={value} />)}
        {relatedAsset ? <button className={styles.relatedAsset} onClick={() => onChooseAsset(relatedAsset.id)}>Open {relatedAsset.name} →</button> : null}
      </DetailSection>

      <DetailSection title="Current assignment">
        {owner || asset.holder ? <>
          <DetailLine label="Holder" value={owner?.displayName || asset.holder} />
          {asset.assignment ? <><DetailLine label="Assigned" value={asset.assignment.since} /><DetailLine label="Agreement" value={asset.assignment.agreement} /><DetailLine label="Due" value={asset.assignment.due} /></> : null}
          {owner ? <Link className={styles.studentLink} href={`/admin/current-students-prototype?student=${encodeURIComponent(owner.id)}`}>Open {owner.displayName} →</Link> : null}
        </> : <p className={styles.unassigned}>No current assignment</p>}
      </DetailSection>

      <DetailSection title="Actions">
        <div className={styles.actionGrid}>{actions.map((item) => <button key={item} className={action === item ? styles.activeAction : ""} onClick={() => onAction(item)}>{item}</button>)}</div>
        {action ? <div className={styles.actionPreview}><span>Workflow preview</span><strong>{action} · {asset.tag}</strong><p>Nothing will be saved from this prototype.</p><button disabled>Continue</button></div> : <p className={styles.actionNote}>Choose an action to preview its next step.</p>}
      </DetailSection>

      <DetailSection title="History">
        <ol className={styles.history}>{asset.history.map(([date, event]) => <li key={date + event}><span>{date}</span><strong>{event}</strong></li>)}</ol>
      </DetailSection>
    </aside>
  );
}

function DetailSection({ title, children }) {
  return <section className={styles.detailSection}><h3>{title}</h3>{children}</section>;
}

function DetailLine({ label, value }) {
  return <div className={styles.detailLine}><span>{label}</span><strong>{value}</strong></div>;
}

function Status({ state, children }) {
  return <span className={[styles.status, styles[state]].join(" ")}>{children}</span>;
}
