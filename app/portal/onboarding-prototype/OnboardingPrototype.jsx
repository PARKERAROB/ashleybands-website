"use client";

import Link from "next/link";
import { useState } from "react";
import ContactStep from "./ContactStep";
import FamilyStep from "./FamilyStep";
import IdentityStep from "./IdentityStep";
import MusicStep from "./MusicStep";
import ReviewStep from "./ReviewStep";
import SupportStep from "./SupportStep";
import styles from "./onboarding.module.css";

const steps = [
  ["01", "Student", "About the student"], ["02", "Contact", "How to reach you"],
  ["03", "Family", "Family connections"], ["04", "Music", "Your band background"],
  ["05", "Support", "What helps you participate"], ["06", "Review", "Review your information"]
];

const initialForm = {
  preferredFirst: "", pronunciation: "", pronouns: "", personalEmail: "", mobile: "",
  guardian1Name: "", guardian1Relationship: "Parent/guardian", guardian1Email: "", guardian1Phone: "",
  guardian2Name: "", guardian2Relationship: "", guardian2Email: "", guardian2Phone: "",
  guardian3Name: "", guardian3Relationship: "", guardian3Email: "", guardian3Phone: "",
  guardian4Name: "", guardian4Relationship: "", guardian4Email: "", guardian4Phone: "", guardianCount: 2,
  primaryInstrument: "", otherInstruments: [], yearsPlaying: "", interests: [],
  originSchool: "", priorSchoolName: "", priorSchoolCity: "", priorSchoolState: "",
  shirtSize: "", instrumentAccess: "not_sure", supportAreas: [], studentNote: "", accurate: false
};

export default function OnboardingPrototype() {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [finished, setFinished] = useState(false);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleList = (key, item) => setForm((current) => ({
    ...current,
    [key]: current[key].includes(item) ? current[key].filter((value) => value !== item) : [...current[key], item]
  }));
  const jumpTo = (index) => { setStepIndex(index); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const outsideCountyComplete = form.originSchool !== "outside_county" || Boolean(
    form.priorSchoolName.trim() && form.priorSchoolCity.trim() && form.priorSchoolState
  );
  const musicComplete = Boolean(form.primaryInstrument && form.originSchool && outsideCountyComplete);
  const requiredRecordComplete = Boolean(
    form.guardian1Name.trim() && form.guardian1Email.trim() && form.guardian1Phone.trim() && musicComplete
  );
  const canContinue = stepIndex === 0 ? true
    : stepIndex === 2 ? Boolean(form.guardian1Name.trim() && form.guardian1Email.trim() && form.guardian1Phone.trim())
      : stepIndex === 3 ? musicComplete
        : stepIndex === 5 ? form.accurate && requiredRecordComplete : true;

  function submitStep(event) {
    event.preventDefault();
    if (!canContinue) return;
    if (stepIndex === steps.length - 1) setFinished(true);
    else jumpTo(stepIndex + 1);
  }

  if (finished) {
    return (
      <main className={styles.page}>
        <section className={styles.finished}>
          <p className={styles.prototypeFlag}>Prototype only · Nothing was saved</p>
          <div className={styles.finishMark}>✓</div>
          <p className={styles.eyebrow}>Student onboarding</p>
          <h1>The student picture is ready.</h1>
          <p>Nothing was saved. A live submission would update the current student record and create requested follow-ups.</p>
          <div className={styles.finishActions}>
            <button type="button" onClick={() => { setForm(initialForm); setStepIndex(0); setFinished(false); }}>Run the prototype again</button>
            <Link href="/portal">Return to the Family Portal</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div><strong>Ashley Bands</strong><span>Student onboarding</span></div>
        <Link href="/portal">Exit prototype</Link>
      </header>
      <section className={styles.hero}>
        <p className={styles.prototypeFlag}>Interactive prototype · Nothing is saved or sent</p>
        <div>
          <div><p className={styles.eyebrow}>One student · One career record</p><h1>Welcome to Ashley Bands.</h1><p>One form for the information Ashley Bands needs throughout a student’s career.</p></div>
          <aside><span>Previewing as</span><strong>Jordan Ellis</strong><small>Synthetic student</small></aside>
        </div>
      </section>
      <div className={styles.progressTrack} aria-label={["Step ", stepIndex + 1, " of ", steps.length].join("")}>
        <span style={{ width: ((stepIndex + 1) / steps.length * 100) + "%" }} />
      </div>
      <div className={styles.workspace}>
        <nav className={styles.stepNav} aria-label="Onboarding steps">
          {steps.map(([number, short, title], index) => (
            <button key={number} type="button" onClick={() => jumpTo(index)} className={index === stepIndex ? styles.activeStep : index < stepIndex ? styles.completeStep : ""} aria-current={index === stepIndex ? "step" : undefined}>
              <span>{index < stepIndex ? "✓" : number}</span><div><small>{short}</small><strong>{title}</strong></div>
            </button>
          ))}
          <p><strong>Why one-time?</strong> Future forms ask only what changed.</p>
        </nav>
        <form className={styles.formCard} onSubmit={submitStep}>
          {stepIndex === 0 ? <IdentityStep form={form} update={update} /> : null}
          {stepIndex === 1 ? <ContactStep form={form} update={update} /> : null}
          {stepIndex === 2 ? <FamilyStep form={form} update={update} /> : null}
          {stepIndex === 3 ? <MusicStep form={form} update={update} toggleList={toggleList} /> : null}
          {stepIndex === 4 ? <SupportStep form={form} update={update} toggleList={toggleList} /> : null}
          {stepIndex === 5 ? <ReviewStep form={form} update={update} jumpTo={jumpTo} /> : null}
          <footer className={styles.formActions}>
            <button type="button" className={styles.backButton} onClick={() => jumpTo(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0}>Back</button>
            <div><small>{!canContinue ? "Complete the required fields to continue." : "You can return to any step."}</small><button type="submit" className={styles.nextButton} disabled={!canContinue}>{stepIndex === steps.length - 1 ? "Finish prototype" : "Save and continue"}</button></div>
          </footer>
        </form>
      </div>
    </main>
  );
}
