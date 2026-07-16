"use client";

import { useEffect, useState, useMemo } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";

export default function AdminSizesPage() {
  return <StaffGate>{(session) => <SizesTable session={session} />}</StaffGate>;
}

function SizesTable({ session }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(null);
  const [lane, setLane] = useState("all");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/sizes", { headers: staffAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setRows(d.rows || []);
        setErr("");
      })
      .catch((e) => setErr(e.message || "Could not load sizes."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSize = async (row, size) => {
    setSaving(row.studentId);
    const res = await fetch("/api/admin/sizes", {
      method: "PUT",
      headers: staffAuthHeaders(session),
      body: JSON.stringify({ studentId: row.studentId, size })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) {
      setErr(data.error || "Could not save that size.");
      return;
    }
    setErr("");
    load();
  };

  const shown = useMemo(() => (lane === "all" ? rows : rows.filter((r) => r.lane === lane)), [rows, lane]);
  const counts = useMemo(
    () => ({
      all: rows.length,
      guard: rows.filter((r) => r.lane === "guard").length,
      band: rows.filter((r) => r.lane === "band").length
    }),
    [rows]
  );
  const needsAttention = shown.filter((r) => r.wideSpread || r.partial || r.unparsedHeight || r.drifted).length;

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Uniform Sizes</h1>
        <span>
          <a href="/admin/measurements" style={link}>← Measurements</a>
          <span style={{ color: "#ded4bf", margin: "0 8px" }}>|</span>
          <a href="/admin" style={link}>Staff home</a>
        </span>
      </div>
      <p style={{ color: "#6f675a", fontSize: 13.5, margin: "6px 0 0" }}>
        Sizes are calculated from chest, waist and hip using the Synced Up chart for each student&apos;s lane, then
        averaged. Neck, arm and inseam are hemming numbers, not size inputs. Change any size and it stays changed.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}>
        {[
          ["all", `All (${counts.all})`],
          ["band", `Band (${counts.band})`],
          ["guard", `Guard (${counts.guard})`]
        ].map(([k, label]) => (
          <button key={k} onClick={() => setLane(k)} style={k === lane ? tabOn : tabOff}>
            {label}
          </button>
        ))}
        {needsAttention > 0 && (
          <span style={{ ...chip, background: "#fdf1d6", borderColor: "#e6c877", color: "#6b4f13", alignSelf: "center" }}>
            {needsAttention} need{needsAttention === 1 ? "s" : ""} a look
          </span>
        )}
      </div>

      {err && <p style={{ color: "#7b1829", fontSize: 13 }}>{err}</p>}
      {loading && <p>Loading…</p>}

      {!loading && rows.length === 0 && (
        <div style={panel}>
          <strong>No students measured yet.</strong>
          <p style={{ color: "#6f675a", fontSize: 13.5, margin: "6px 0 0" }}>
            This table fills in as measurements are entered. Nothing can be sized until then.
          </p>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Student</th>
                <th style={th}>Lane</th>
                <th style={th}>Chest / Waist / Hip</th>
                <th style={th}>Each says</th>
                <th style={th}>Calculated</th>
                <th style={th}>Final size</th>
                <th style={th}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.studentId} style={{ borderTop: "1px solid #ece3d2" }}>
                  <td style={td}>
                    <strong>{r.name}</strong>
                    <div style={sub}>{r.grade}</div>
                  </td>
                  <td style={td}>
                    <span style={{ ...chip, ...(r.lane === "guard" ? chipGuard : chipBand) }}>
                      {r.lane === "guard" ? "Guard" : "Band"}
                    </span>
                    <div style={sub}>{r.role || "—"}</div>
                  </td>
                  <td style={td}>
                    {fmt(r.measurements.chest)} / {fmt(r.measurements.waist)} / {fmt(r.measurements.hips)}
                    {r.lane === "band" && (
                      <div style={sub}>
                        ht {r.measurements.height || "—"}
                        {r.lengthClass ? ` → ${r.lengthClass}` : ""}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={sub}>
                      {r.per.chest || "—"} / {r.per.waist || "—"} / {r.per.hip || "—"}
                    </span>
                  </td>
                  <td style={td}>
                    <strong>{r.computedSize || "—"}</strong>
                    {r.lane === "band" && r.lengthClass && <div style={sub}>{r.lengthClass}</div>}
                  </td>
                  <td style={td}>
                    <select
                      value={r.finalSize || ""}
                      disabled={saving === r.studentId || !r.sizeOptions?.length}
                      onChange={(e) => setSize(r, e.target.value)}
                      style={select}
                    >
                      <option value="">—</option>
                      {(r.sizeOptions || []).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {r.override && (
                      <div style={{ ...sub, color: "#7b1829" }}>
                        changed from {r.computedAtOverride || "—"}
                        {r.overrideBy ? ` by ${r.overrideBy}` : ""}
                        {r.overrideAt ? ` on ${new Date(r.overrideAt).toLocaleDateString()}` : ""}
                        <br />
                        <button onClick={() => setSize(r, "")} style={{ ...link, fontSize: 11 }}>
                          reset to calculated
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {r.wideSpread && (
                      <div style={{ ...chip, ...chipWarn }} title={`Measurements span ${r.spread} sizes`}>
                        spans {r.spread} sizes — check with Synced Up
                      </div>
                    )}
                    {r.partial && (
                      <div style={{ ...chip, ...chipInfo }}>partial ({r.measuredCount} of 3)</div>
                    )}
                    {r.unparsedHeight && <div style={{ ...chip, ...chipInfo }}>height unreadable</div>}
                    {r.drifted && (
                      <div style={{ ...chip, ...chipWarn }}>
                        re-measured — now calculates {r.computedSize}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmt(v) {
  return v === null || v === undefined || v === "" ? "—" : v;
}

const page = { maxWidth: 1180, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#191716" };
const panel = { border: "1px solid #ded4bf", borderRadius: 10, background: "#fffaf0", padding: 14, margin: "10px 0" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th = { textAlign: "left", padding: "8px 10px", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3, color: "#6f675a", borderBottom: "2px solid #ded4bf", whiteSpace: "nowrap" };
const td = { padding: "10px", verticalAlign: "top" };
const sub = { fontSize: 11.5, color: "#6f675a", marginTop: 2 };
const link = { color: "#7b1829", fontSize: 13, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 };
const select = { padding: "5px 8px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6, background: "#fff", fontFamily: "system-ui, sans-serif" };
const chip = { display: "inline-block", fontSize: 11, padding: "2px 7px", borderRadius: 999, border: "1px solid", marginBottom: 3, lineHeight: 1.5 };
const chipBand = { background: "#eef3ef", borderColor: "#c6d6c9", color: "#2f4a35" };
const chipGuard = { background: "#f6eef3", borderColor: "#d9c0cd", color: "#6b2748" };
const chipWarn = { background: "#fdf1d6", borderColor: "#e6c877", color: "#6b4f13" };
const chipInfo = { background: "#eef1f6", borderColor: "#c3cddc", color: "#33435c" };
const tabOn = { padding: "6px 14px", fontSize: 13, fontWeight: 600, border: "1px solid #7b1829", borderRadius: 999, background: "#7b1829", color: "#fff", cursor: "pointer" };
const tabOff = { padding: "6px 14px", fontSize: 13, fontWeight: 600, border: "1px solid #ded4bf", borderRadius: 999, background: "#fff", color: "#191716", cursor: "pointer" };
