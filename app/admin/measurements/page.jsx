"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";

// Grouped by what the hands are doing, so a fitting stops tool-switching: wrap the
// tape for every field in one group, run it along for the next, put it down for the
// last. Girth + weight removed 2026-07-16 (Rob) -- neither Band Shoppe guide asks
// for them. Their columns stay in the table (empty, nullable), so restoring either
// is a UI line, not a migration.
const FIELD_GROUPS = [
  {
    title: "Student",
    fields: [
      { key: "gender", label: "Gender", type: "text", hint: "" },
      { key: "height", label: "Height", type: "text", hint: "e.g. 5-9" }
    ]
  },
  {
    title: "Around (wrap the tape)",
    fields: [
      { key: "neckIn", label: "Neck", type: "number", hint: "Around the base of the neck" },
      { key: "chestIn", label: "Chest", type: "number", hint: "Arms at sides, around the fullest part of the chest, tape parallel to the floor" },
      { key: "waistIn", label: "Waist", type: "number", hint: "Around the narrowest part of the natural waist, at the navel" },
      { key: "hipsIn", label: "Hips", type: "number", hint: "Heels together, around the fullest part of the hips" }
    ]
  },
  {
    title: "Length (run the tape)",
    fields: [
      { key: "armLengthIn", label: "Arm Length", type: "number", hint: "Shoulder to wrist" },
      { key: "backLengthIn", label: "Back Length", type: "number", hint: "Base of the neck to the natural waistline" },
      { key: "inseamIn", label: "Inseam", type: "number", hint: "Inside of the leg, crotch to the bottom of the ankle bone" }
    ]
  },
  {
    title: "Sizes (no tape)",
    fields: [
      { key: "shoeSize", label: "Shoe Size", type: "text", hint: "Include the scale, e.g. 10.5 M or 8 W" },
      { key: "gloveSize", label: "Glove Size", type: "text", hint: "S / M / L / XL" },
      { key: "shirtSize", label: "T-Shirt Size", type: "text", hint: "S / M / L / XL / 2XL" }
    ]
  }
];

const FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

const BLANK_FORM = FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: "" }), { notes: "" });

// Band Shoppe's own size guides, linked (not mirrored) on purpose: these are the
// charts the vendor fills the order against, so a local copy could silently go
// stale against a sizing revision and we'd measure to an outdated chart. A dead
// link fails loudly; a stale chart fails quietly. Band guide is ~10MB, so the
// size is called out for anyone opening it on cell data in the band room.
const SIZE_GUIDES = [
  {
    label: "Band — Classic Top / Full Length",
    note: "PDF, 10 MB",
    href: "https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Classic_Top_Full_Length.pdf?v=1722619657"
  },
  {
    label: "Guard — Unitard",
    note: "PDF, 1.6 MB",
    href: "https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Unitard_Unisex.pdf?v=1722619651"
  }
];

function SizeGuideLinks() {
  return (
    <div style={guideBar}>
      <strong style={{ fontSize: 12.5 }}>Size guides:</strong>
      {SIZE_GUIDES.map((g) => (
        <a key={g.href} href={g.href} target="_blank" rel="noopener noreferrer" style={link}>
          {g.label} <span style={{ color: "#6f675a", textDecoration: "none" }}>({g.note})</span>
        </a>
      ))}
    </div>
  );
}

export default function AdminMeasurementsPage() {
  return (
    <StaffGate>
      {(session) => (
        <Suspense fallback={<div style={page}><p>Loading…</p></div>}>
          <MeasurementsAdmin session={session} />
        </Suspense>
      )}
    </StaffGate>
  );
}

function MeasurementsAdmin({ session }) {
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [measuredCount, setMeasuredCount] = useState(null);

  const loadProgress = () => {
    fetch("/api/admin/measurements", { headers: staffAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setMeasuredCount(d.measuredCount ?? null))
      .catch(() => {});
  };

  useEffect(() => {
    loadProgress();
    // Deep-link support: /admin/measurements?studentId=<id>&name=<display_name>
    const studentId = searchParams.get("studentId");
    if (studentId) {
      setSelected({ id: studentId, display_name: searchParams.get("name") || "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/students?q=${encodeURIComponent(q)}`, { headers: staffAuthHeaders(session) });
    const data = await res.json().catch(() => ({}));
    setStudents(data.students || []);
    setLoading(false);
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Uniform Measurements</h1>
        <a href="/admin" style={link}>← Staff home</a>
      </div>
      <p style={{ color: "#6f675a", fontSize: 14 }}>
        {measuredCount != null ? `${measuredCount} students measured` : "Loading progress…"}
      </p>

      <SizeGuideLinks />

      {selected && (
        <div style={{ ...panel, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong>{selected.display_name || "Selected student"}</strong>
            <button onClick={() => setSelected(null)} style={link}>change student</button>
          </div>
        </div>
      )}

      {!selected && (
        <>
          <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
            <input
              placeholder="Search by name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              style={{ ...input, width: 280 }}
            />
            <button onClick={search} style={btn}>Search</button>
          </div>

          {loading ? <p>Loading…</p> : null}
          {students.map((s) => (
            <div key={s.id} style={{ ...panel, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                <strong>{s.display_name}</strong>{" "}
                <span style={{ color: "#6f675a", fontSize: 13 }}>{s.grade_fall26}</span>
              </span>
              <button onClick={() => setSelected(s)} style={btn}>Select</button>
            </div>
          ))}
          {!loading && students.length === 0 && <p style={{ color: "#999" }}>Search for a student to begin.</p>}
        </>
      )}

      {selected && (
        <MeasurementForm
          student={selected}
          session={session}
          onSaved={loadProgress}
        />
      )}
    </div>
  );
}

function MeasurementForm({ student, session, onSaved }) {
  const [form, setForm] = useState(BLANK_FORM);
  const [measuredBy, setMeasuredBy] = useState("");
  const [measuredAt, setMeasuredAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setMsg("");
    setErr("");
    fetch(`/api/admin/measurements?studentId=${encodeURIComponent(student.id)}`, { headers: staffAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        const m = d.measurement;
        if (m) {
          setForm({
            gender: m.gender || "",
            height: m.height || "",
            chestIn: m.chest_in ?? "",
            waistIn: m.waist_in ?? "",
            hipsIn: m.hips_in ?? "",
            inseamIn: m.inseam_in ?? "",
            backLengthIn: m.back_length_in ?? "",
            neckIn: m.neck_in ?? "",
            armLengthIn: m.arm_length_in ?? "",
            shoeSize: m.shoe_size || "",
            gloveSize: m.glove_size || "",
            shirtSize: m.shirt_size || "",
            notes: m.notes || ""
          });
          setMeasuredBy(m.measured_by || "");
          setMeasuredAt(m.measured_at || "");
        } else {
          setForm(BLANK_FORM);
          setMeasuredBy("");
          setMeasuredAt("");
        }
      })
      .catch(() => setErr("Failed to load existing measurement."))
      .finally(() => setLoading(false));
  }, [student.id, session]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    const res = await fetch("/api/admin/measurements", {
      method: "PUT",
      headers: staffAuthHeaders(session),
      body: JSON.stringify({ studentId: student.id, ...form })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setErr(data.error || "Failed to save.");
      return;
    }
    setMsg("Saved.");
    setMeasuredBy(session?.display_name || measuredBy);
    setMeasuredAt(new Date().toISOString());
    onSaved();
  };

  if (loading) return <p>Loading measurements…</p>;

  return (
    <div style={panel}>
      {measuredBy && (
        <p style={{ fontSize: 12.5, color: "#6f675a", margin: "0 0 10px" }}>
          Measured by {measuredBy}{measuredAt ? ` on ${new Date(measuredAt).toLocaleDateString()}` : ""}
        </p>
      )}
      <SizeGuideLinks />
      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} style={groupBox}>
          <legend style={groupLegend}>{group.title}</legend>
          <div style={formGrid}>
            {group.fields.map((f) => (
              <div key={f.key}>
                <label style={fieldLabel}>{f.label}</label>
                <input
                  type={f.type}
                  step={f.type === "number" ? "0.5" : undefined}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={input}
                />
                {f.hint && <p style={hintText}>{f.hint}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <div style={{ marginTop: 10 }}>
        <label style={fieldLabel}>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={{ ...input, minHeight: 70, resize: "vertical" }}
        />
      </div>
      <button onClick={save} disabled={saving} style={{ ...btn, marginTop: 12 }}>
        {saving ? "Saving…" : "Save measurements"}
      </button>
      {msg && <span style={{ fontSize: 13, marginLeft: 8, color: "#446349" }}>{msg}</span>}
      {err && <span style={{ fontSize: 13, marginLeft: 8, color: "#7b1829" }}>{err}</span>}
    </div>
  );
}

const page = { maxWidth: 980, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#191716" };
const panel = { border: "1px solid #ded4bf", borderRadius: 10, background: "#fffaf0", padding: 14, margin: "10px 0" };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 8 };
const input = { boxSizing: "border-box", width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const btn = { padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", background: "#7b1829", cursor: "pointer" };
const link = { color: "#7b1829", fontSize: 13, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 };
const fieldLabel = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 3 };
const guideBar = { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", border: "1px solid #ded4bf", borderRadius: 8, background: "#fffaf0", margin: "0 0 12px" };
const groupBox = { border: "1px solid #e6dcc8", borderRadius: 8, padding: "4px 12px 12px", margin: "0 0 14px", minInlineSize: 0 };
const groupLegend = { fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "#7b1829", padding: "0 6px" };
const hintText = { fontSize: 11, color: "#6f675a", margin: "3px 0 0" };
