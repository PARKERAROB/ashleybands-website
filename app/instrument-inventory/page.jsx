"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const SPEECH_SUPPORTED = typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const STORAGE_KEY = "bdos_staff_session_v1";

const SELECT_FIELDS = [
  { key: "plays", label: "Plays?", options: [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]] },
  { key: "case_present", label: "Case?", options: [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]] },
  { key: "mouthpiece_present", label: "Mouthpiece?", options: [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]] },
];

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch { return null; }
}

function valueText(value) {
  return String(value || "").trim();
}

function displayInstrument(instrument) {
  return [
    instrument.asset_id,
    instrument.instrument_type,
    [instrument.brand, instrument.model || instrument.model_markings].filter(Boolean).join(" "),
  ].filter(Boolean).join(" · ");
}

export default function InstrumentInventoryPage() {
  const [session, setSession] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loadWarning, setLoadWarning] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [repairFilter, setRepairFilter] = useState("");
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const s = readSession();
      setSession(s);
      if (s) setForm((f) => ({ ...f, submitted_by: s.display_name || "" }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetch("/api/instrument-inventory")
      .then((res) => res.json())
      .then((data) => {
        setInstruments(data.instruments || []);
        setGeneratedAt(data.generatedAt || null);
        setLoadWarning(data.warning || "");
        setLoading(false);
      })
      .catch((err) => {
        setLoadWarning(err.message || "Could not load instrument list.");
        setLoading(false);
      });
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const types = useMemo(() => Array.from(new Set(instruments.map((i) => i.instrument_type).filter(Boolean))).sort(), [instruments]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return instruments.filter((instrument) => {
      if (typeFilter && instrument.instrument_type !== typeFilter) return false;
      if (repairFilter === "needs_repair" && !valueText(instrument.repair_needed)) return false;
      if (repairFilter === "no_repair" && valueText(instrument.repair_needed)) return false;
      if (!needle) return true;
      return [
        instrument.asset_id,
        instrument.instrument_type,
        instrument.brand,
        instrument.model,
        instrument.model_markings,
        instrument.serial_number,
        instrument.location,
        instrument.locker,
        instrument.play_status,
        instrument.repair_needed,
        instrument.visible_issues,
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [instruments, query, repairFilter, typeFilter]);

  const selectInstrument = (instrument) => {
    setForm((f) => ({
      ...f,
      asset_id: instrument.asset_id || "",
      instrument_type: instrument.instrument_type || "",
      brand: instrument.brand || "",
      model_markings: instrument.model_markings || instrument.model || "",
      serial_number: instrument.serial_number || "",
      finish: instrument.finish || "",
      key_or_pitch: instrument.key_pitch || "",
      level: instrument.level || "",
      locker: instrument.locker || "",
      location: instrument.location || "",
      repair_needed: instrument.repair_needed || "",
      repair_priority: instrument.repair_priority || "",
      condition_notes: instrument.condition || instrument.visible_issues || "",
    }));
    setDone(false);
    setError("");
    document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startListening = useCallback(() => {
    if (!SPEECH_SUPPORTED) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Recognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript;
      setTranscript((prev) => (prev ? `${prev} ${text}` : text));
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...form, raw_transcript: transcript };
      const res = await fetch("/api/instrument-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed");
        setSubmitting(false);
        return;
      }
      setDone(true);
      setSubmitting(false);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const clearForAnother = () => {
    setDone(false);
    setForm({ submitted_by: session?.display_name || "" });
    setTranscript("");
  };

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "0 0 4px" }}>🎺 Instrument Dashboard</h1>
      <p style={{ margin: "0 0 20px", color: "#555", fontSize: 14 }}>
        Browse school instruments and send Mr. Parker a repair/location update.
      </p>

      <div style={{ textAlign: "center", marginBottom: 24, padding: 16, background: "#f5f5f5", borderRadius: 8, border: "2px dashed #ccc" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 15 }}>📱 Scan to open on your phone</p>
        <img src="/qr/instruments.svg" alt="QR code for instrument inventory" style={{ width: 150, height: 150 }} />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#777" }}>ashleybands.com/instrument-inventory</p>
      </div>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Find an instrument</h2>
        {generatedAt && <p style={metaStyle}>Inventory snapshot: {new Date(generatedAt).toLocaleString()}</p>}
        {loadWarning && <p style={{ ...metaStyle, color: "#b45309" }}>{loadWarning}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 170px 150px", gap: 8 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search asset ID, type, brand, serial, location..." style={inputStyle} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
            <option value="">All types</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={repairFilter} onChange={(e) => setRepairFilter(e.target.value)} style={inputStyle}>
            <option value="">All repair status</option>
            <option value="needs_repair">Needs repair</option>
            <option value="no_repair">No repair listed</option>
          </select>
        </div>
        <p style={metaStyle}>{loading ? "Loading..." : `${filtered.length} of ${instruments.length} instruments shown`}</p>
        <div style={{ display: "grid", gap: 10, maxHeight: 520, overflow: "auto", paddingRight: 4 }}>
          {filtered.slice(0, 150).map((instrument) => (
            <button key={instrument.asset_id || instrument.serial_number} type="button" onClick={() => selectInstrument(instrument)} style={cardButtonStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <strong>{instrument.asset_id || "No asset ID"} · {instrument.instrument_type || "Instrument"}</strong>
                  <div style={metaStyle}>{[instrument.brand, instrument.model || instrument.model_markings].filter(Boolean).join(" ") || "Unknown brand/model"}</div>
                </div>
                <span style={{ ...pillStyle, background: instrument.repair_needed ? "#fee2e2" : "#dcfce7", color: instrument.repair_needed ? "#991b1b" : "#166534" }}>
                  {instrument.repair_needed || "No repair listed"}
                </span>
              </div>
              <div style={gridInfoStyle}>
                <span>Serial: {instrument.serial_number || "—"}</span>
                <span>Location: {instrument.location || "—"}</span>
                <span>Locker: {instrument.locker || "—"}</span>
                <span>Play status: {instrument.play_status || "—"}</span>
              </div>
              {instrument.visible_issues && <div style={{ ...metaStyle, marginTop: 6 }}>Issues: {instrument.visible_issues}</div>}
            </button>
          ))}
        </div>
      </section>

      <section id="report" style={sectionStyle}>
        <h2 style={h2Style}>Send an update</h2>
        <p style={metaStyle}>{form.asset_id ? `Selected: ${displayInstrument(form)}` : "Choose an instrument above, or type details below."}</p>

        {SPEECH_SUPPORTED && (
          <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <button type="button" onClick={startListening} disabled={listening} style={{ ...btnStyle, background: listening ? "#e74c3c" : "#2ecc71" }}>
              {listening ? "🔴 Listening..." : "🎤 Add voice note"}
            </button>
            {transcript && <p style={metaStyle}><strong>Transcript:</strong> {transcript}</p>}
          </div>
        )}

        {done ? (
          <div style={{ padding: 16, background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 8 }}>
            <strong>✅ Submitted!</strong>
            <p style={metaStyle}>Your instrument update has been saved for review.</p>
            <button type="button" onClick={clearForAnother} style={{ ...btnStyle, background: "#3498db" }}>Add another update</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={twoColStyle}>
              <Field label="Asset ID" value={form.asset_id} onChange={(v) => update("asset_id", v)} placeholder="INST-0001" />
              <Field label="Instrument Type" value={form.instrument_type} onChange={(v) => update("instrument_type", v)} placeholder="trumpet, clarinet, flute" required />
              <Field label="Brand" value={form.brand} onChange={(v) => update("brand", v)} placeholder="Yamaha, Bach, Jupiter" />
              <Field label="Model / Markings" value={form.model_markings} onChange={(v) => update("model_markings", v)} placeholder="What does it say?" />
              <Field label="Serial Number" value={form.serial_number} onChange={(v) => update("serial_number", v)} placeholder="Stamped serial" />
              <Field label="Locker" value={form.locker} onChange={(v) => update("locker", v)} placeholder="Current locker" />
              <Field label="Location" value={form.location} onChange={(v) => update("location", v)} placeholder="Band room, repair shelf, etc." />
              <Field label="Repair Needed" value={form.repair_needed} onChange={(v) => update("repair_needed", v)} placeholder="What should be fixed?" />
              <Field label="Repair Priority" value={form.repair_priority} onChange={(v) => update("repair_priority", v)} placeholder="routine, urgent, estimate first" />
              <Field label="Your Name" value={form.submitted_by} onChange={(v) => update("submitted_by", v)} placeholder="First and last name" required />
            </div>
            <TextField label="Condition Notes" value={form.condition_notes} onChange={(v) => update("condition_notes", v)} placeholder="Dents, stuck slides, pad condition, scratches, anything unusual" required />
            <Field label="Visible Damage" value={form.visible_damage} onChange={(v) => update("visible_damage", v)} placeholder="large dent on bell, stuck 2nd valve" />
            <Field label="Missing Parts" value={form.missing_parts} onChange={(v) => update("missing_parts", v)} placeholder="no mouthpiece, missing thumbscrew" />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {SELECT_FIELDS.map((field) => (
                <div key={field.key} style={{ flex: 1 }}>
                  <label style={labelStyle}>{field.label}</label>
                  <select value={form[field.key] || ""} onChange={(e) => update(field.key, e.target.value)} style={inputStyle}>
                    <option value="">— select —</option>
                    {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {error && <p style={{ color: "#e74c3c", fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={submitting} style={{ ...btnStyle, background: submitting ? "#999" : "#3498db", width: "100%" }}>
              {submitting ? "Saving..." : "Submit Update for Review"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle}>{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} required={required} />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, required }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle}>{label}</label>
      <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...inputStyle, resize: "vertical" }} required={required} />
    </div>
  );
}

const pageStyle = { maxWidth: 980, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" };
const sectionStyle = { marginBottom: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" };
const h2Style = { margin: "0 0 10px", fontSize: 20 };
const inputStyle = { boxSizing: "border-box", width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const labelStyle = { display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 };
const btnStyle = { padding: "10px 16px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" };
const metaStyle = { margin: "4px 0", color: "#555", fontSize: 13 };
const cardButtonStyle = { textAlign: "left", background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" };
const pillStyle = { borderRadius: 999, padding: "3px 8px", fontSize: 12, whiteSpace: "nowrap" };
const gridInfoStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 4, marginTop: 8, color: "#333", fontSize: 13 };
const twoColStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 10px" };
