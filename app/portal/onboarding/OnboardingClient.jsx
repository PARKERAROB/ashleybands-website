"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ContactStep from "../onboarding-prototype/ContactStep";
import FamilyStep from "../onboarding-prototype/FamilyStep";
import IdentityStep from "../onboarding-prototype/IdentityStep";
import MusicStep from "../onboarding-prototype/MusicStep";
import ReviewStep from "../onboarding-prototype/ReviewStep";
import SupportStep from "../onboarding-prototype/SupportStep";
import styles from "../onboarding-prototype/onboarding.module.css";

const steps = [
  ["01", "Student", "About the student"], ["02", "Contact", "How to reach you"],
  ["03", "Family", "Family connections"], ["04", "Music", "Your band background"],
  ["05", "Support", "What helps you participate"], ["06", "Review", "Review your information"],
];

function requestedStudentId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("studentId") || "";
}

function guardianPayload(form) {
  return Array.from({ length: form.guardianCount }, (_, index) => {
    const number = index + 1;
    const key = `guardian${number}`;
    return {
      personId: form[`${key}PersonId`] || "",
      name: form[`${key}Name`] || "",
      relationship: form[`${key}Relationship`] || "",
      email: form[`${key}Email`] || "",
      phone: form[`${key}Phone`] || "",
    };
  });
}

function payloadForStep(step, form) {
  if (step === 1) return { preferredFirst: form.preferredFirst, pronunciation: form.pronunciation, pronouns: form.pronouns };
  if (step === 2) return { personalEmail: form.personalEmail, mobile: form.mobile };
  if (step === 3) return { guardians: guardianPayload(form) };
  if (step === 4) return {
    primaryInstrument: form.primaryInstrument,
    otherInstruments: form.otherInstruments,
    yearsPlaying: form.yearsPlaying,
    interests: form.interests,
    originSchool: form.originSchool,
    priorSchoolName: form.priorSchoolName,
    priorSchoolCity: form.priorSchoolCity,
    priorSchoolState: form.priorSchoolState,
  };
  if (step === 5) return {
    shirtSize: form.shirtSize,
    instrumentAccess: form.instrumentAccess,
    supportAreas: form.supportAreas,
    studentNote: form.studentNote,
  };
  return { accurate: form.accurate };
}

export default function OnboardingClient() {
  const [state, setState] = useState({ status: "loading", message: "Opening student onboarding…" });
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [saveState, setSaveState] = useState({ status: "idle", message: "" });
  const [finished, setFinished] = useState(false);

  async function loadOnboarding(nextStudentId) {
    setState({ status: "loading", message: "Opening student onboarding…" });
    const response = await fetch(`/api/portal/onboarding?studentId=${encodeURIComponent(nextStudentId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState({ status: data.code === "STRONG_RELATIONSHIP_REQUIRED" ? "verify" : "error", message: data.error || "Student onboarding could not be opened." });
      return;
    }
    const onboarding = data.onboarding;
    setRecord(onboarding);
    setForm(onboarding.form);
    setStepIndex(onboarding.progress.status === "complete" ? 0 : Math.min(onboarding.progress.lastCompletedStep, 5));
    setFinished(false);
    setSaveState({ status: "idle", message: "" });
    setState({ status: "ready", message: "" });
  }

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const response = await fetch("/api/portal/me", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) {
        setState({ status: "signin", message: data.error || "Sign in to open student onboarding." });
        return;
      }
      const currentStudents = (data.students || []).filter((student) => String(student.status || "").toLowerCase() === "active");
      if (!currentStudents.length) {
        setState({ status: "error", message: "No current student is connected to this account." });
        return;
      }
      setStudents(currentStudents);
      const requested = requestedStudentId();
      const selected = currentStudents.some((student) => student.id === requested) ? requested : currentStudents[0].id;
      setStudentId(selected);
      await loadOnboarding(selected);
    }
    start().catch(() => {
      if (!cancelled) setState({ status: "error", message: "Student onboarding could not be opened." });
    });
    return () => { cancelled = true; };
  }, []);

  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId), [students, studentId]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleList = (key, item) => setForm((current) => ({
    ...current,
    [key]: current[key].includes(item) ? current[key].filter((value) => value !== item) : [...current[key], item],
  }));
  const jumpTo = (index) => {
    setStepIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const outsideCountyComplete = form?.originSchool !== "outside_county" || Boolean(
    form?.priorSchoolName.trim() && form?.priorSchoolCity.trim() && form?.priorSchoolState,
  );
  const musicComplete = Boolean(form?.primaryInstrument && form?.originSchool && outsideCountyComplete);
  const requiredRecordComplete = Boolean(
    form?.guardian1Name.trim() && form?.guardian1Relationship.trim()
      && form?.guardian1Email.trim() && form?.guardian1Phone.trim() && musicComplete,
  );
  const canContinue = stepIndex === 0 ? true
    : stepIndex === 2 ? Boolean(form?.guardian1Name.trim() && form?.guardian1Relationship.trim()
      && form?.guardian1Email.trim() && form?.guardian1Phone.trim())
      : stepIndex === 3 ? musicComplete
        : stepIndex === 5 ? Boolean(form?.accurate && requiredRecordComplete) : true;

  async function submitStep(event) {
    event.preventDefault();
    if (!canContinue || !form || !record) return;
    const step = stepIndex + 1;
    setSaveState({ status: "saving", message: "Saving…" });
    try {
      const response = await fetch("/api/portal/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          step,
          idempotencyKey: crypto.randomUUID(),
          payload: payloadForStep(step, form),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveState({ status: "error", message: data.error || "This step could not be saved." });
        return;
      }
      if (data.onboarding) setRecord(data.onboarding);
      setSaveState({ status: "saved", message: "Saved" });
      if (step === 6) {
        setFinished(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        jumpTo(stepIndex + 1);
      }
    } catch {
      setSaveState({ status: "error", message: "This step could not be saved. Check your connection and try again." });
    }
  }

  async function chooseStudent(nextStudentId) {
    setStudentId(nextStudentId);
    window.history.replaceState({}, "", `/portal/onboarding?studentId=${encodeURIComponent(nextStudentId)}`);
    await loadOnboarding(nextStudentId);
  }

  if (state.status !== "ready") {
    return (
      <main className={styles.page}>
        <section className={styles.finished}>
          <p className={styles.eyebrow}>Student onboarding</p>
          <h1>{state.status === "loading" ? "Opening the student record." : "Onboarding is not available yet."}</h1>
          <p>{state.message}</p>
          <div className={styles.finishActions}>
            {state.status === "signin" ? <Link href={`/portal?next=${encodeURIComponent("/portal/onboarding")}`}>Sign in</Link> : null}
            {state.status === "verify" ? <Link href={`/portal/request?next=${encodeURIComponent(`/portal/onboarding?studentId=${studentId}`)}`}>Verify the family connection</Link> : null}
            <Link href="/portal/review">Return to the Family Portal</Link>
          </div>
        </section>
      </main>
    );
  }

  if (finished) {
    return (
      <main className={styles.page}>
        <section className={styles.finished}>
          <div className={styles.finishMark}>✓</div>
          <p className={styles.eyebrow}>Student onboarding</p>
          <h1>The student picture is saved.</h1>
          <p>Current information is connected to the student record. Future updates can change only what needs changing.</p>
          <div className={styles.finishActions}>
            <button type="button" onClick={() => { setFinished(false); jumpTo(0); }}>Review again</button>
            <Link href={`/portal/review?studentId=${encodeURIComponent(studentId)}`}>Return to the Family Portal</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div><strong>Ashley Bands</strong><span>Student onboarding</span></div>
        <Link href={`/portal/review?studentId=${encodeURIComponent(studentId)}`}>Save and exit</Link>
      </header>
      <section className={styles.hero}>
        <p className={styles.prototypeFlag}>{record.completion ? "Onboarding complete · Update information" : "Saved student record"}</p>
        <div>
          <div><p className={styles.eyebrow}>One student · One career record</p><h1>Welcome to Ashley Bands.</h1><p>Review the information Ashley Bands needs throughout the student’s career.</p></div>
          <aside>
            <span>Student</span><strong>{selectedStudent?.displayName || record.official.legalName}</strong>
            {students.length > 1 ? (
              <select aria-label="Choose student" value={studentId} onChange={(event) => chooseStudent(event.target.value)}>
                {students.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
              </select>
            ) : <small>{record.official.currentSchool}</small>}
          </aside>
        </div>
      </section>
      <div className={styles.progressTrack} aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
        <span style={{ width: `${(stepIndex + 1) / steps.length * 100}%` }} />
      </div>
      <div className={styles.workspace}>
        <nav className={styles.stepNav} aria-label="Onboarding steps">
          {steps.map(([number, short, title], index) => (
            <button key={number} type="button" onClick={() => jumpTo(index)} className={index === stepIndex ? styles.activeStep : index < stepIndex ? styles.completeStep : ""} aria-current={index === stepIndex ? "step" : undefined}>
              <span>{index < stepIndex ? "✓" : number}</span><div><small>{short}</small><strong>{title}</strong></div>
            </button>
          ))}
          <p><strong>One-time setup</strong> Later, update only what changed.</p>
        </nav>
        <form className={styles.formCard} onSubmit={submitStep}>
          {stepIndex === 0 ? <IdentityStep form={form} update={update} official={record.official} /> : null}
          {stepIndex === 1 ? <ContactStep form={form} update={update} official={record.official} /> : null}
          {stepIndex === 2 ? <FamilyStep form={form} update={update} /> : null}
          {stepIndex === 3 ? <MusicStep form={form} update={update} toggleList={toggleList} /> : null}
          {stepIndex === 4 ? <SupportStep form={form} update={update} toggleList={toggleList} /> : null}
          {stepIndex === 5 ? <ReviewStep form={form} update={update} jumpTo={jumpTo} official={record.official} /> : null}
          <footer className={styles.formActions}>
            <button type="button" className={styles.backButton} onClick={() => jumpTo(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0 || saveState.status === "saving"}>Back</button>
            <div>
              <small aria-live="polite">{saveState.status === "error" ? saveState.message : !canContinue ? "Complete the required fields." : saveState.message || "You can return to any step."}</small>
              <button type="submit" className={styles.nextButton} disabled={!canContinue || saveState.status === "saving"}>{saveState.status === "saving" ? "Saving…" : stepIndex === steps.length - 1 ? "Finish onboarding" : "Save and continue"}</button>
            </div>
          </footer>
        </form>
      </div>
    </main>
  );
}
