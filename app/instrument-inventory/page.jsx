"use client";

import { useCallback, useEffect, useState } from "react";

const SPEECH_SUPPORTED = typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const STORAGE_KEY = "bdos_staff_session_v1";

const FIELDS = [
  { key: "instrument_type", label: "Instrument Type", placeholder: "e.g. trumpet, clarinet, flute, trombone" },
  { key: "brand", label: "Brand", placeholder: "e.g. Yamaha, Bach, Jupiter, Conn" },
  { key: "model_markings", label: "Model / Markings", placeholder: "What does it say on the instrument?" },
  { key: "serial_number", label: "Serial Number", placeholder: "Number stamped on the instrument" },
  { key: "serial_location", label: "Where's the serial?", placeholder: "e.g. bell, back of valve, slide receiver" },
  { key: "finish", label: "Finish", placeholder: "lacquer, silver, nickel, raw brass, other" },
  { key: "key_or_pitch", label: "Key / Pitch", placeholder: "e.g. Bb, Eb, F, C" },
  { key: "level", label: "Level", placeholder: "student, intermediate, professional, not sure" },
];

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch { return null; }
}

export default function InstrumentInventoryPage() {
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    const s = readSession();
    setSession(s);
    if (s) setForm((f) => ({ ...f, submitted_by: s.display_name || "" }));
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Voice: dictate everything at once
  const startListening = useCallback(() => {
    if (!SPEECH_SUPPORTED) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Recognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript;
      setTranscript((prev) => (prev ? prev + " " + text : text));
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Submission failed"); setSubmitting(false); return; }
      setDone(true);
      setSubmitting(false);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
        <h1>✅ Submitted!</h1>
        <p style={{ margin: "16px 0", color: "#555" }}>Your instrument observation has been saved. Mr. Parker will review it.</p>
        <button onClick={() => { setDone(false); setForm({ submitted_by: session?.display_name || "" }); setTranscript(""); }}
          style={btnStyle}>Add Another Instrument</button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: "0 0 4px" }}>🎺 Instrument Inventory</h1>
      <p style={{ margin: "0 0 20px", color: "#555", fontSize: 14 }}>
        Pick up an instrument, look at it, and tell us what you see. You can type or use the voice button.
      </p>

      {/* QR code for classroom display — scan with phone camera */}
      <div style={{ textAlign: "center", marginBottom: 24, padding: 16, background: "#f5f5f5", borderRadius: 8, border: "2px dashed #ccc" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 15 }}>📱 Scan to open on your phone</p>
        <img src="/qr/instruments.svg" alt="QR code for instrument inventory" style={{ width: 160, height: 160 }} />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#777" }}>ashleybands.com/instrument-inventory</p>
      </div>

      {SPEECH_SUPPORTED && (
        <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>🎤 Voice Input</p>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#555" }}>
            Tap the mic and describe the instrument in your own words. Say what it is, the brand, condition, markings, serial number, anything you see.
          </p>
          <button onClick={startListening} disabled={listening}
            style={{ ...btnStyle, background: listening ? "#e74c3c" : "#2ecc71" }}>
            {listening ? "🔴 Listening..." : "🎤 Start Speaking"}
          </button>
          {transcript && (
            <div style={{ marginTop: 8, padding: 8, background: "#fff", borderRadius: 4, fontSize: 13, border: "1px solid #ddd" }}>
              <strong>Transcript:</strong> {transcript}
              <button onClick={() => setTranscript("")} style={{ marginLeft: 8, background: "none", border: "none", color: "#999", cursor: "pointer" }}>✕</button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              {f.label}
            </label>
            <input
              value={form[f.key] || ""}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={inputStyle}
            />
          </div>
        ))}

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Condition Notes — what does it look like?
          </label>
          <textarea
            value={form.condition_notes || ""}
            onChange={(e) => update("condition_notes", e.target.value)}
            placeholder="Dents? Scratches? Stuck slides? Pad condition? Rust? Anything unusual?"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Visible Damage
          </label>
          <input
            value={form.visible_damage || ""}
            onChange={(e) => update("visible_damage", e.target.value)}
            placeholder="e.g. large dent on bell, stuck 2nd valve"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Missing Parts
          </label>
          <input
            value={form.missing_parts || ""}
            onChange={(e) => update("missing_parts", e.target.value)}
            placeholder="e.g. no mouthpiece, missing thumbscrew"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Plays?</label>
            <select value={form.plays || ""} onChange={(e) => update("plays", e.target.value)} style={inputStyle}>
              <option value="">— select —</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not_sure">Not sure</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Case?</label>
            <select value={form.case_present || ""} onChange={(e) => update("case_present", e.target.value)} style={inputStyle}>
              <option value="">— select —</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not_sure">Not sure</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Mouthpiece?</label>
            <select value={form.mouthpiece_present || ""} onChange={(e) => update("mouthpiece_present", e.target.value)} style={inputStyle}>
              <option value="">— select —</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not_sure">Not sure</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Your Name</label>
          <input
            value={form.submitted_by || ""}
            onChange={(e) => update("submitted_by", e.target.value)}
            placeholder="First and last name"
            style={inputStyle}
            required
          />
        </div>

        {error && <p style={{ color: "#e74c3c", fontSize: 13 }}>{error}</p>}

        <button type="submit" disabled={submitting}
          style={{ ...btnStyle, background: submitting ? "#999" : "#3498db", width: "100%" }}>
          {submitting ? "Saving..." : "Submit Observation"}
        </button>
      </form>
    </main>
  );
}

const inputStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  border: "1px solid #ccc",
  borderRadius: 6,
  fontFamily: "system-ui, sans-serif",
};

const btnStyle = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  borderRadius: 6,
  color: "#fff",
  cursor: "pointer",
};