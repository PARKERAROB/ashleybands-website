"use client";

import { useEffect, useState } from "react";

export default function PortalReviewClient() {
  const [state, setState] = useState({ status: "loading", message: "Opening secure profile..." });
  const [profile, setProfile] = useState(null);
  const [update, setUpdate] = useState({
    field: "student_preferred_first",
    studentId: "",
    value: ""
  });
  const [updateState, setUpdateState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    let cancelled = false;
    async function openProfile() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        const sessionRes = await fetch("/api/portal/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        if (!sessionRes.ok) {
          const data = await sessionRes.json().catch(() => ({}));
          if (!cancelled) setState({ status: "error", message: data.error || "This profile link could not be opened." });
          return;
        }
        window.history.replaceState({}, "", "/portal/review");
      }

      const res = await fetch("/api/portal/me");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!cancelled) setState({ status: "error", message: data.error || "Profile access expired. Request a new link." });
        return;
      }
      if (!cancelled) {
        setProfile(data);
        setUpdate((current) => ({ ...current, studentId: data.students[0]?.id || "" }));
        setState({ status: "ready", message: "" });
      }
    }
    openProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitUpdate(event) {
    event.preventDefault();
    setUpdateState({ status: "sending", message: "" });
    const res = await fetch("/api/portal/update-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUpdateState({ status: "error", message: data.error || "Could not submit the update." });
      return;
    }
    setUpdate((current) => ({ ...current, value: "" }));
    setUpdateState({ status: "sent", message: "Submitted for review. Mr. Parker has been notified." });
  }

  return (
    <main className="portal-shell">
      <section className="portal-panel portal-panel-wide">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Profile Review</h1>
        {state.status !== "ready" ? <p className={`portal-message ${state.status === "error" ? "error" : ""}`}>{state.message}</p> : null}
        {profile ? (
          <div className="portal-profile">
            <div>
              <p className="portal-label">Signed in as</p>
              <h2>{profile.person?.display_name || profile.email}</h2>
              <p className="portal-copy">{profile.email}</p>
            </div>
            <div>
              <p className="portal-label">Students connected to this email</p>
              {profile.students.length ? (
                <div className="portal-student-list">
                  {profile.students.map((student) => (
                    <article className="portal-student" key={student.id}>
                      <h3>{student.displayName}</h3>
                      <p>{student.grade || "Grade not listed"}</p>
                      <p>{student.status || "Status not listed"}</p>
                      {student.preferredFirst ? <p>Preferred name: {student.preferredFirst}</p> : null}
                      {student.cellPhone ? <p>Cell: {student.cellPhone}</p> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="portal-copy">No trusted student connections are ready to show yet.</p>
              )}
            </div>
            {profile.students.length ? (
              <form className="portal-update-form" onSubmit={submitUpdate}>
                <div>
                  <p className="portal-label">Submit a correction</p>
                  <p className="portal-copy">Updates are sent to Mr. Parker for review before they change the official records.</p>
                </div>
                {profile.students.length > 1 ? (
                  <label>
                    <span>Student</span>
                    <select value={update.studentId} onChange={(event) => setUpdate({ ...update, studentId: event.target.value })}>
                      {profile.students.map((student) => (
                        <option key={student.id} value={student.id}>{student.displayName}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  <span>What changed?</span>
                  <select value={update.field} onChange={(event) => setUpdate({ ...update, field: event.target.value })}>
                    <option value="student_preferred_first">Student preferred name</option>
                    <option value="student_cell_phone">Student cell phone</option>
                    <option value="person_display_name">My name</option>
                    <option value="guardian_phone">My phone</option>
                    <option value="student_note">Other student note</option>
                  </select>
                </label>
                <label className="portal-request-wide">
                  <span>Updated information</span>
                  <textarea
                    rows={4}
                    value={update.value}
                    onChange={(event) => setUpdate({ ...update, value: event.target.value })}
                    required
                  />
                </label>
                <button type="submit" disabled={updateState.status === "sending"}>
                  {updateState.status === "sending" ? "Submitting..." : "Submit for review"}
                </button>
                {updateState.message ? <p className={`portal-message ${updateState.status === "error" ? "error" : ""}`}>{updateState.message}</p> : null}
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
