"use client";

import { useCallback, useState } from "react";

const SPEECH_SUPPORTED = typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const ENSEMBLE_TYPES = [
  "concert_band", "wind_ensemble", "marching_band", "jazz_band",
  "percussion_ensemble", "chamber", "solo", "method_book", "classroom_book", "other"
];

export default function MusicLibraryPage() {
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showAll, setShowAll] = useState(false);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

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
    if (!form.title?.trim()) { setError("Title is required"); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, raw_transcript: transcript };
      const res = await fetch("/api/music-library", {
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
      <main style={pageStyle}>
        <h1>✅ Piece Submitted!</h1>
        <p style={{ margin: "16px 0", color: "#555" }}>Your music library entry has been saved. Mr. Parker will review it.</p>
        <button onClick={() => { setDone(false); setForm({}); setTranscript(""); }}
          style={btnStyle}>Add Another Piece</button>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "0 0 4px" }}>🎵 Music Library</h1>
      <p style={{ margin: "0 0 20px", color: "#555", fontSize: 14 }}>
        Catalog a piece of music from the band library. Find the folder, look at the score, and tell us what's there.
      </p>

      {/* QR code for classroom display — scan with phone camera */}
      <div style={{ textAlign: "center", marginBottom: 24, padding: 16, background: "#f5f5f5", borderRadius: 8, border: "2px dashed #ccc" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 15 }}>📱 Scan to open on your phone</p>
        <img src="/qr/music-library.svg" alt="QR code for music library" style={{ width: 160, height: 160 }} />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#777" }}>ashleybands.com/music-library</p>
      </div>

      {SPEECH_SUPPORTED && (
        <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>🎤 Voice Input</p>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#555" }}>
            Tap and describe the piece — title, composer, what condition the folder is in, any missing parts.
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
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Piece Title *</label>
          <input value={form.title || ""} onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Xerxes, First Suite in Eb, Into the Storm" style={inputStyle} required />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Composer</label>
            <input value={form.composer || ""} onChange={(e) => update("composer", e.target.value)}
              placeholder="Last, First" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Arranger/Editor</label>
            <input value={form.arranger_editor || ""} onChange={(e) => update("arranger_editor", e.target.value)}
              placeholder="if applicable" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Publisher</label>
            <input value={form.publisher || ""} onChange={(e) => update("publisher", e.target.value)}
              placeholder="e.g. Hal Leonard, Boosey" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Grade Level</label>
            <input value={form.publisher_grade || ""} onChange={(e) => update("publisher_grade", e.target.value)}
              placeholder="e.g. 3, 4, Grade 5" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Ensemble Type</label>
          <select value={form.ensemble_type || ""} onChange={(e) => update("ensemble_type", e.target.value)} style={inputStyle}>
            <option value="">— select —</option>
            {ENSEMBLE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Physical Location</label>
          <input value={form.physical_location || ""} onChange={(e) => update("physical_location", e.target.value)}
            placeholder="e.g. Cabinet 3, drawer 2 / Box 14" style={inputStyle} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Score?</label>
            <select value={form.score_status || ""} onChange={(e) => update("score_status", e.target.value)} style={inputStyle}>
              <option value="">— select —</option>
              <option value="present">Present</option>
              <option value="missing">Missing</option>
              <option value="digital_only">Digital only</option>
              <option value="needs_check">Needs check</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Parts?</label>
            <select value={form.parts_status || ""} onChange={(e) => update("parts_status", e.target.value)} style={inputStyle}>
              <option value="">— select —</option>
              <option value="complete">Complete set</option>
              <option value="incomplete">Missing parts</option>
              <option value="needs_check">Needs check</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Ready to use?</label>
            <select value={form.ready_to_use || ""} onChange={(e) => update("ready_to_use", e.target.value)} style={inputStyle}>
              <option value="">— select —</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="not_sure">Not sure</option>
            </select>
          </div>
        </div>

        {showAll && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Missing Parts</label>
              <input value={form.missing_parts || ""} onChange={(e) => update("missing_parts", e.target.value)}
                placeholder="e.g. missing 2nd clarinet part" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Acquired But Not Filed</label>
              <input value={form.acquired_not_filed || ""} onChange={(e) => update("acquired_not_filed", e.target.value)}
                placeholder="Purchased but not printed/filed yet" style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Publisher Catalog #</label>
                <input value={form.catalog_number || ""} onChange={(e) => update("catalog_number", e.target.value)}
                  placeholder="SKU or item number" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Year / Duration</label>
                <input value={form.year || ""} onChange={(e) => update("year", e.target.value)}
                  placeholder="e.g. 2010 / 4:30" style={inputStyle} />
              </div>
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: "#999", margin: "0 0 10px" }}>
          <button type="button" onClick={() => setShowAll(!showAll)}
            style={{ background: "none", border: "none", color: "#3498db", cursor: "pointer", fontSize: 12, padding: 0 }}>
            {showAll ? "Hide extra fields" : "Show extra fields"}
          </button>
        </p>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Condition Notes</label>
          <textarea value={form.condition_notes || ""} onChange={(e) => update("condition_notes", e.target.value)}
            placeholder="Folder condition? Pages missing? Writing in parts? Any damage?"
            rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Your Name</label>
          <input value={form.submitted_by || ""} onChange={(e) => update("submitted_by", e.target.value)}
            placeholder="First and last name" style={inputStyle} required />
        </div>

        {error && <p style={{ color: "#e74c3c", fontSize: 13 }}>{error}</p>}

        <button type="submit" disabled={submitting}
          style={{ ...btnStyle, background: submitting ? "#999" : "#3498db", width: "100%" }}>
          {submitting ? "Saving..." : "Submit Piece"}
        </button>
      </form>
    </main>
  );
}

const pageStyle = { maxWidth: 600, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" };
const labelStyle = { display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 };
const inputStyle = { boxSizing: "border-box", width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const btnStyle = { padding: "10px 20px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" };