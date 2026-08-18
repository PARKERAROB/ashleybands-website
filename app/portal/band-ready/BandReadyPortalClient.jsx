"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./band-ready.module.css";

const steps = [
  { id: "portal", number: "01", title: "Connect your family", body: "Your family is signed in and connected to this student." },
  { id: "calendar", number: "02", title: "Subscribe to the calendar", body: "Keep Ashley Bands dates and updates on your family calendar." },
  { id: "day-one", number: "03", title: "Be ready for Day One", body: "Check the instrument, black one-inch binder, and dedicated band pencil." },
  { id: "forms", number: "04", title: "Complete applicable forms", body: "If a county instrument is needed, submit the responsibility agreement." },
  { id: "how-band-works", number: "05", title: "Know how band works", body: "Review assessments, practice, performances, absences, and communication." },
  { id: "clothing", number: "06", title: "Confirm the red band shirt", body: "Every band student needs the official red shirt. Review it first, then any optional clothing." },
  { id: "boosters", number: "07", title: "Check in with the Band Boosters", body: "Review Level 2 volunteering and tell us where you are in the process." },
  { id: "say-hey", number: "08", title: "Say hey to Mr. Parker", body: "Stop by for a quick hello, give a wave, or let us know you completed Band Ready online." }
];

const stepTotal = steps.length;

const nextStep = {
  calendar: "day-one",
  "day-one": "forms",
  forms: "how-band-works",
  "how-band-works": "clothing",
  clothing: "boosters",
  boosters: "say-hey",
  "say-hey": "review"
};

const bandReadyCache = new Map();
const allowedStepIds = new Set(["calendar", "day-one", "forms", "how-band-works", "clothing", "boosters", "say-hey", "review"]);

function rememberBandReady(body) {
  if (body?.student?.id) bandReadyCache.set(body.student.id, body);
  return body;
}

function queryHref(path, studentId) {
  return `${path}?studentId=${encodeURIComponent(studentId)}`;
}

function stepPath(stepId) {
  return stepId === "home" ? "/portal/band-ready" : `/portal/band-ready/${stepId}`;
}

function stepFromPathname(pathname) {
  const requested = pathname.match(/^\/portal\/band-ready\/([^/]+)/)?.[1] || "home";
  return allowedStepIds.has(requested) ? requested : "home";
}

function BandReadyLink({ destination, navigate, onClick, ...props }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(destination);
      }}
    />
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function instrumentLabel(value) {
  if (value === "personal") return "Personal instrument";
  if (value === "county") return "County instrument";
  if (value === "help") return "I need help choosing the instrument path";
  return "Not answered";
}

function stillNeededItems(data) {
  const dayOne = data?.progress?.["day-one"] || {};
  return [
    !data?.readiness?.complete?.calendar ? "Review or subscribe to the Ashley Bands calendar." : null,
    !dayOne.instrumentStatus ? "Choose the student’s instrument path." : null,
    !dayOne.binderStatus ? "Confirm whether the black one-inch band binder is ready." : null,
    dayOne.binderStatus === "need" ? "Get a black one-inch band binder." : null,
    !dayOne.pencilStatus ? "Confirm whether the dedicated band pencil is ready." : null,
    dayOne.pencilStatus === "need" ? "Get a dedicated band pencil and give it a name." : null,
    dayOne.instrumentStatus === "county" && !data?.external?.instrumentRequest ? "Submit the county instrument responsibility agreement." : null,
    dayOne.instrumentStatus === "help" ? "Talk with Mr. Parker about the student’s instrument." : null,
    !data?.readiness?.complete?.["how-band-works"] ? "Review how band works and confirm the family understands." : null,
    !data?.readiness?.complete?.clothing ? "Review the Open House clothing collection." : null,
    data?.progress?.clothing?.status === "return_later" ? "Return to the clothing collection by Friday, August 28." : null,
    !data?.readiness?.complete?.boosters ? "Review the Band Booster and Level 2 volunteer information." : null,
    data?.progress?.boosters?.status === "plan_later" ? "Complete the annual NHCS volunteer training and Level 2 background check." : null,
    data?.progress?.boosters?.status === "need_help" ? "Check in with the Band Boosters for help with Level 2 volunteering." : null,
    !data?.readiness?.complete?.["say-hey"] ? "Say hey to Mr. Parker or mark that you completed Band Ready online." : null
  ].filter(Boolean);
}

async function fetchBandReady(studentId = "") {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
  const response = await fetch(`/api/portal/band-ready${query}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Band Ready could not be loaded.");
    error.status = response.status;
    throw error;
  }
  return rememberBandReady(body);
}

export default function BandReadyPortalClient({ step }) {
  const [activeStep, setActiveStep] = useState(step);
  const [profile, setProfile] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const requestedStudentId = params.get("studentId") || "";
    const cached = params.get("refresh") === "1" ? null : bandReadyCache.get(requestedStudentId);
    const show = (body) => {
      if (cancelled) return;
      setProfile({ students: body.students || [] });
      setStudentId(body.student?.id || "");
      setData(body);
      setStatus("ready");
      setMessage("");
    };
    if (cached) Promise.resolve().then(() => show(cached));
    fetchBandReady(requestedStudentId)
      .then(show)
      .catch((error) => {
        if (!cancelled) {
          if (cached) return;
          setMessage(error.message);
          setStatus(error.status === 401 ? "signed-out" : error.status === 404 ? "empty" : "error");
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleBackOrForward = () => setActiveStep(stepFromPathname(window.location.pathname));
    window.addEventListener("popstate", handleBackOrForward);
    return () => window.removeEventListener("popstate", handleBackOrForward);
  }, []);

  const selectedStudent = profile?.students?.find((student) => student.id === studentId) || null;
  const href = (destination) => queryHref(destination, studentId);

  function navigate(destination, { replace = false } = {}) {
    const nextHref = queryHref(stepPath(destination), studentId);
    window.history[replace ? "replaceState" : "pushState"]({ bandReadyStep: destination }, "", nextHref);
    setActiveStep(destination);
    window.scrollTo(0, 0);
  }

  async function save(stepId, stepData, destination = nextStep[stepId] || "review") {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/portal/band-ready", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, step: stepId, data: stepData })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "This step could not be saved.");
      const updated = rememberBandReady({ ...data, progress: body.progress, readiness: body.readiness, completion: null });
      setData(updated);
      setStatus("ready");
      navigate(destination);
    } catch (error) {
      setMessage(error.message);
      setStatus("ready");
    }
  }

  async function switchStudent(event) {
    const nextId = event.target.value;
    setStudentId(nextId);
    const cached = bandReadyCache.get(nextId) || null;
    setData(cached);
    setStatus(cached ? "ready" : "loading");
    window.history.replaceState({ bandReadyStep: activeStep }, "", queryHref(stepPath(activeStep), nextId));
    try {
      const body = await fetchBandReady(nextId);
      setProfile({ students: body.students || [] });
      setStudentId(body.student?.id || nextId);
      setData(body);
      setStatus("ready");
      setMessage("");
    } catch (error) {
      if (!cached) {
        setMessage(error.message);
        setStatus("error");
      }
    }
  }

  function updateData(updater) {
    setData((current) => rememberBandReady(typeof updater === "function" ? updater(current) : updater));
  }

  if (status === "signed-out") {
    return (
      <main className={styles.page}>
        <section className={styles.notice}>
          <p className={styles.eyebrow}>Ashley Bands Open House</p>
          <h1>Connect your family first.</h1>
          <p>{message}</p>
          <Link className={styles.primaryButton} href="/portal?next=/portal/band-ready">Sign in to the Family Portal</Link>
          <Link className={styles.textLink} href="/portal/request?next=/portal/band-ready">New email? Request access</Link>
        </section>
      </main>
    );
  }

  if (status === "empty") {
    return (
      <main className={styles.page}>
        <section className={styles.notice}>
          <p className={styles.eyebrow}>Ashley Bands Open House</p>
          <h1>Connect a student.</h1>
          <p>Your portal sign-in works, but no student is connected to this family profile yet.</p>
          <Link className={styles.primaryButton} href="/portal/request?next=/portal/band-ready">Request student access</Link>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className={styles.page}>
        <section className={styles.notice}>
          <p className={styles.eyebrow}>Ashley Bands Open House</p>
          <h1>Band Ready did not load.</h1>
          <p>{message}</p>
          <button className={styles.primaryButton} type="button" onClick={() => window.location.reload()}>Try again</button>
        </section>
      </main>
    );
  }

  if (!profile || !data || !selectedStudent) {
    return <main className={styles.page}><section className={styles.notice}><p>Opening Band Ready…</p></section></main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <BandReadyLink className={styles.brand} href={href("/portal/band-ready")} destination="home" navigate={navigate}>Ashley Bands · Band Ready</BandReadyLink>
          <p>Open House checklist</p>
        </div>
        <nav aria-label="Portal navigation">
          <BandReadyLink href={href("/portal/band-ready")} destination="home" navigate={navigate}>Band Ready home</BandReadyLink>
          <Link href={`/portal/review?studentId=${encodeURIComponent(studentId)}`}>Family Portal</Link>
        </nav>
      </header>

      <section className={styles.studentBar}>
        <div><span>Completing for</span><strong>{selectedStudent.displayName}</strong></div>
        {profile.students.length > 1 ? (
          <label>Student<select value={studentId} onChange={switchStudent}>{profile.students.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}</select></label>
        ) : null}
      </section>

      {message ? <p className={styles.error} role="alert">{message}</p> : null}

      {activeStep === "home" ? <Dashboard data={data} href={href} navigate={navigate} /> : null}
      {activeStep === "calendar" ? <CalendarStep data={data} save={save} busy={status === "saving"} href={href} navigate={navigate} /> : null}
      {activeStep === "day-one" ? <DayOneStep key={`${studentId}-${data.completion?.updatedAt || "new"}`} data={data} save={save} busy={status === "saving"} href={href} navigate={navigate} /> : null}
      {activeStep === "forms" ? <FormsStep data={data} href={href} navigate={navigate} /> : null}
      {activeStep === "how-band-works" ? <HowBandWorksStep data={data} save={save} busy={status === "saving"} href={href} navigate={navigate} /> : null}
      {activeStep === "clothing" ? <ClothingStep key={`${studentId}-${data.completion?.updatedAt || "new"}`} data={data} save={save} busy={status === "saving"} href={href} navigate={navigate} studentId={studentId} /> : null}
      {activeStep === "boosters" ? <BoostersStep key={`${studentId}-${data.completion?.updatedAt || "new"}`} data={data} save={save} busy={status === "saving"} href={href} navigate={navigate} /> : null}
      {activeStep === "say-hey" ? <SayHeyStep key={`${studentId}-${data.completion?.updatedAt || "new"}`} data={data} save={save} busy={status === "saving"} href={href} navigate={navigate} /> : null}
      {activeStep === "review" ? <ReviewStep data={data} setData={updateData} studentId={studentId} href={href} navigate={navigate} /> : null}
    </main>
  );
}

function Dashboard({ data, href, navigate }) {
  const { count, complete } = data.readiness;
  return (
    <>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Get Band Ready</p>
        <h1>One clear path to the first day.</h1>
        <p>Complete one small task at a time. Your answers are saved to this student&apos;s Family Portal.</p>
        <div className={styles.progress} aria-label={`${count} of ${stepTotal} steps complete`}><span style={{ width: `${(count / stepTotal) * 100}%` }} /></div>
        <strong>{count} of {stepTotal} complete</strong>
      </section>
      <section className={styles.stepGrid} aria-label="Band Ready steps">
        {steps.map((item) => {
          const done = Boolean(complete[item.id]);
          const destination = item.id === "portal" ? "/portal/review" : `/portal/band-ready/${item.id}`;
          const card = (
            <>
              <span className={styles.stepNumber}>{done ? "✓" : item.number}</span>
              <div><p>{done ? "Complete" : `Step ${item.number}`}</p><h2>{item.title}</h2><span>{item.body}</span></div>
              <b aria-hidden="true">→</b>
            </>
          );
          return item.id === "portal" ? (
            <Link className={`${styles.stepCard} ${done ? styles.done : ""}`} href={href(destination)} key={item.id}>{card}</Link>
          ) : (
            <BandReadyLink className={`${styles.stepCard} ${done ? styles.done : ""}`} href={href(destination)} destination={item.id} navigate={navigate} key={item.id}>{card}</BandReadyLink>
          );
        })}
      </section>
      <div className={styles.reviewCallout}>
        <div><strong>{data.readiness.finished ? `All ${stepTotal} stops are ready.` : "Your progress is saved."}</strong><p>Review the family checklist and send the personalized summary when every stop is complete.</p></div>
        <BandReadyLink className={styles.primaryButton} href={href("/portal/band-ready/review")} destination="review" navigate={navigate}>Review Band Ready</BandReadyLink>
      </div>
    </>
  );
}

function StepShell({ eyebrow, title, intro, children, backHref, navigate }) {
  return (
    <section className={styles.stepPage}>
      <BandReadyLink className={styles.backLink} href={backHref} destination="home" navigate={navigate}>← Back to Band Ready</BandReadyLink>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p className={styles.intro}>{intro}</p>
      {children}
    </section>
  );
}

function CalendarStep({ data, save, busy, href, navigate }) {
  const confirmed = data.progress?.calendar?.confirmed;
  return (
    <StepShell eyebrow="Step 02" title="Put the band calendar where your family will see it." intro="The Ashley Bands calendar is the official place for dates and times. A subscription updates when the band calendar changes." backHref={href("/portal/band-ready")} navigate={navigate}>
      <div className={styles.actionPanel}>
        <h2>Choose the option that works for you</h2>
        <div className={styles.actionLinks}>
          <a className={styles.primaryButton} href="webcal://ashleybands.com/calendar.ics">Subscribe to the band calendar</a>
          <a className={styles.secondaryButton} href="/calendar.ics">Download calendar file</a>
          <Link className={styles.secondaryButton} href="/calendar" target="_blank">View the full calendar</Link>
        </div>
        <p>You can return here after the calendar opens. We only ask you to confirm that you reviewed or subscribed.</p>
      </div>
      <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => save("calendar", { confirmed: true })}>{busy ? "Saving…" : confirmed ? "Confirmed · Continue" : "I reviewed or subscribed · Continue"}</button>
    </StepShell>
  );
}

function DayOneStep({ data, save, busy, href, navigate }) {
  const existing = data.progress?.["day-one"] || {};
  const [form, setForm] = useState({ instrumentStatus: existing.instrumentStatus || "", binderStatus: existing.binderStatus || "", pencilStatus: existing.pencilStatus || "", pencilName: existing.pencilName || "" });
  const valid = form.instrumentStatus && form.binderStatus && form.pencilStatus && (form.pencilStatus !== "have" || form.pencilName.trim());
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <StepShell eyebrow="Step 03" title="Be ready for Day One." intro="Band starts smoothly when each student has these three things ready and knows exactly where they belong." backHref={href("/portal/band-ready")} navigate={navigate}>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); save("day-one", form); }}>
        <fieldset><legend>1. Instrument</legend><p>Will the student bring a personal instrument, or do they need a county instrument?</p>
          <Choice name="instrument" checked={form.instrumentStatus === "personal"} onChange={() => update("instrumentStatus", "personal")} title="Personal instrument" detail="The student will bring their own instrument." />
          <Choice name="instrument" checked={form.instrumentStatus === "county"} onChange={() => update("instrumentStatus", "county")} title="County instrument" detail="The family will complete the county responsibility agreement in the next step." />
          <Choice name="instrument" checked={form.instrumentStatus === "help"} onChange={() => update("instrumentStatus", "help")} title="We need help" detail="Mr. Parker should follow up about the best instrument path." />
        </fieldset>
        <fieldset><legend>2. Black one-inch band binder</legend><p>This binder holds the student&apos;s music and band handouts.</p>
          <Choice name="binder" checked={form.binderStatus === "have"} onChange={() => update("binderStatus", "have")} title="We have it" />
          <Choice name="binder" checked={form.binderStatus === "need"} onChange={() => update("binderStatus", "need")} title="We still need it" />
        </fieldset>
        <fieldset><legend>3. Dedicated band pencil</legend><p>This pencil lives in the band binder. It is not the student&apos;s math or science pencil. Students name it so the whole class knows it belongs to band.</p>
          <Choice name="pencil" checked={form.pencilStatus === "have"} onChange={() => update("pencilStatus", "have")} title="We have a band pencil" detail="Give it a name below." />
          <Choice name="pencil" checked={form.pencilStatus === "need"} onChange={() => update("pencilStatus", "need")} title="We still need a band pencil" />
          {form.pencilStatus === "have" ? <label className={styles.textField}><span>What is the pencil&apos;s name?</span><input value={form.pencilName} onChange={(event) => update("pencilName", event.target.value)} maxLength={80} placeholder="Bob" required /></label> : null}
        </fieldset>
        <button className={styles.primaryButton} type="submit" disabled={busy || !valid}>{busy ? "Saving…" : "Save and continue"}</button>
      </form>
    </StepShell>
  );
}

function Choice({ name, checked, onChange, title, detail }) {
  return <label className={`${styles.choice} ${checked ? styles.choiceSelected : ""}`}><input type="radio" name={name} checked={checked} onChange={onChange} /><span><strong>{title}</strong>{detail ? <small>{detail}</small> : null}</span></label>;
}

function FormsStep({ data, href, navigate }) {
  const dayOne = data.progress?.["day-one"] || {};
  const request = data.external?.instrumentRequest;
  const county = dayOne.instrumentStatus === "county";
  const answered = Boolean(dayOne.instrumentStatus);
  return (
    <StepShell eyebrow="Step 04" title="Complete the forms that apply to this student." intro="The portal already knows the student and family, so it only asks for information that is new." backHref={href("/portal/band-ready")} navigate={navigate}>
      <div className={`${styles.statusPanel} ${data.readiness.complete.forms ? styles.statusGood : styles.statusNeeds}`}>
        <span>{data.readiness.complete.forms ? "✓" : "!"}</span>
        <div>
          <h2>{data.readiness.complete.forms ? "This step is covered." : "One form is still needed."}</h2>
          <p>Day One instrument choice: <strong>{instrumentLabel(dayOne.instrumentStatus)}</strong></p>
          {!answered ? <p>Return to the Day One step and choose the student&apos;s instrument path first.</p> : null}
          {county && request ? <p>The county instrument responsibility agreement was submitted{request.submitted_at ? ` on ${formatDate(request.submitted_at)}` : ""}. Mr. Parker will add the assigned instrument information after processing it.</p> : null}
          {county && !request ? <p>Complete the county instrument responsibility agreement. It will go into the band instrument system for Mr. Parker to process.</p> : null}
          {dayOne.instrumentStatus === "personal" ? <p>No county instrument agreement is needed.</p> : null}
          {dayOne.instrumentStatus === "help" ? <p>No form is required right now. Your final summary will remind the family to follow up with Mr. Parker.</p> : null}
        </div>
      </div>
      <div className={styles.actionLinks}>
        {!answered ? <BandReadyLink className={styles.primaryButton} href={href("/portal/band-ready/day-one")} destination="day-one" navigate={navigate}>Return to Day One</BandReadyLink> : null}
        {county && !request ? <Link className={styles.primaryButton} href={`/portal/review?studentId=${encodeURIComponent(data.student.id)}#instrument-request-heading`}>Complete instrument agreement</Link> : null}
        {answered && data.readiness.complete.forms ? <BandReadyLink className={styles.primaryButton} href={href("/portal/band-ready/how-band-works")} destination="how-band-works" navigate={navigate}>Continue to how band works</BandReadyLink> : null}
      </div>
    </StepShell>
  );
}

function HowBandWorksStep({ data, save, busy, href, navigate }) {
  const [acknowledged, setAcknowledged] = useState(Boolean(data.progress?.["how-band-works"]?.acknowledged));
  return (
    <StepShell eyebrow="Step 05" title="Know how band works." intro="Students who stay engaged, work on the music presented in class, and prepare for individual and ensemble goals should have no problem earning an A in band." backHref={href("/portal/band-ready")} navigate={navigate}>
      <div className={styles.infoGrid}>
        <article><span>60 / 40</span><h2>Assessment balance</h2><p>County grading is based on a 60% performance and 40% practice split.</p></article>
        <article><span>Weekly</span><h2>Consistent assessment</h2><p>Mr. Parker&apos;s goal is to assess the ensemble at least once each week in an integrated way. That may be an in-class performance, individual performance, written test, or another assessment connected to the music.</p></article>
        <article><span>Regularly</span><h2>Practice and preparation</h2><p>Students should practice consistently, prepare for assessments, and contribute to the ensemble&apos;s larger performance goals, including concerts.</p></article>
        <article><span>As soon as known</span><h2>Absences and conflicts</h2><p>Communicate an absence or conflict as soon as it is understood, whether that is months ahead or the morning of an illness. Communication is especially important for performances because every student affects the ensemble.</p></article>
      </div>
      <div className={styles.detailPanel}>
        <h2>If a performance is missed</h2>
        <p>An illness or unavoidable circumstance that is communicated does not usually require a major performance make-up. An avoidable conflict may require an individual project, written reflection, concert-program project, or performance of key music. Mr. Parker will choose what fits the situation.</p>
        <h2>How to reach Mr. Parker</h2>
        <p>Families should email Mr. Parker. Students currently use Google Chat. If the transition to Microsoft changes the student communication method, families and students will be told.</p>
        <a className={styles.textLink} href="mailto:robert.parker@nhcs.net?subject=Ashley%20Bands%20Question">Email Mr. Parker</a>
      </div>
      <label className={`${styles.confirmBox} ${acknowledged ? styles.choiceSelected : ""}`}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span><strong>We reviewed how band works.</strong><small>We understand the assessment balance, regular preparation, performance expectations, and the importance of early communication.</small></span></label>
      <button className={styles.primaryButton} type="button" disabled={busy || !acknowledged} onClick={() => save("how-band-works", { acknowledged: true })}>{busy ? "Saving…" : "Save and continue"}</button>
    </StepShell>
  );
}

function ClothingStep({ data, save, busy, href, navigate, studentId }) {
  const paid = data.external?.clothingOrder?.payment_status === "paid";
  const [status, setStatus] = useState(paid ? "ordered" : data.progress?.clothing?.status || "");
  return (
    <StepShell eyebrow="Step 06" title="Confirm the required red band shirt." intro="Every band student needs the official red band shirt. Start there, then review any optional clothing your student or family would like." backHref={href("/portal/band-ready")} navigate={navigate}>
      <div className={`${styles.statusPanel} ${styles.statusNeeds}`}><span>!</span><div><h2>Required for every band student</h2><p>The official red band shirt is worn for pep rallies, community performances, parades, and informal band events.</p></div></div>
      <div className={styles.deadline}><span>Order deadline</span><strong>Friday, August 28</strong><p>Payment is completed in the Family Portal.</p></div>
      {paid ? <div className={`${styles.statusPanel} ${styles.statusGood}`}><span>✓</span><div><h2>Paid and ordered</h2><p>The order is already connected to this student. Items will be distributed through the band after the bulk order arrives.</p></div></div> : (
        <>
          <div className={styles.actionLinks}><Link className={styles.primaryButton} href={`/portal/clothing?studentId=${encodeURIComponent(studentId)}`}>Open the clothing order</Link></div>
          <div className={styles.form}>
            <Choice name="clothing" checked={status === "ordered"} onChange={() => setStatus("ordered")} title="We placed our order" detail="The order and payment are complete." />
            <Choice name="clothing" checked={status === "not_ordering"} onChange={() => setStatus("not_ordering")} title="We are not ordering" detail="The student already has the required shirt, or the family does not need any optional items." />
            <Choice name="clothing" checked={status === "return_later"} onChange={() => setStatus("return_later")} title="We will return later" detail="Add the deadline to our final reminder." />
          </div>
        </>
      )}
      <button className={styles.primaryButton} type="button" disabled={busy || (!paid && !status)} onClick={() => save("clothing", { status: paid ? "ordered" : status })}>{busy ? "Saving…" : "Save and continue to the Boosters"}</button>
    </StepShell>
  );
}

function BoostersStep({ data, save, busy, href, navigate }) {
  const [status, setStatus] = useState(data.progress?.boosters?.status || "");
  return (
    <StepShell eyebrow="Step 07" title="Check in with the Band Boosters." intro="Ashley Bands recommends that every band parent and guardian complete the NHCS Level 2 volunteer process. A large pool of approved adults gives the band the support it needs for travel, chaperoning, performances, and events." backHref={href("/portal/band-ready")} navigate={navigate}>
      <div className={`${styles.statusPanel} ${styles.statusNeeds}`}>
        <span>!</span>
        <div>
          <h2>Our recommendation: every parent completes Level 2</h2>
          <p>NHCS specifically requires Level 2 clearance when a volunteer may work with students without continual staff supervision or serves on a field trip. The band recommends it for every parent so families are ready when opportunities arise.</p>
        </div>
      </div>
      <div className={styles.actionPanel}>
        <h2>Complete the NHCS process</h2>
        <ol className={styles.processList}>
          <li><div><strong>Review the NHCS volunteer orientation</strong><span>Every volunteer completes training each school year.</span></div><a className={styles.secondaryButton} href="https://new.express.adobe.com/webpage/CEj1D2XoaFiIZ" target="_blank" rel="noreferrer">Open orientation</a></li>
          <li><div><strong>Complete the annual assessment</strong><span>NHCS requires a score of 80% or higher.</span></div><a className={styles.secondaryButton} href="https://docs.google.com/forms/d/e/1FAIpQLScVWKaIoXTNFKd1ofLKnSmK0P9Y73Xivcdb156cuEM0AGbnyg/viewform?usp=sf_link" target="_blank" rel="noreferrer">Open assessment</a></li>
          <li><div><strong>Submit the Level 2 background check</strong><span>The $22.50 background check is valid for three years.</span></div><a className={styles.primaryButton} href="https://securevolunteer.com/NHC/home" target="_blank" rel="noreferrer">Start Level 2</a></li>
        </ol>
        <p>These NHCS pages open in a new tab so you can return here and save your progress.</p>
      </div>
      <div className={styles.detailPanel}>
        <h2>Say hello to the Band Boosters</h2>
        <p>If you are completing Band Ready at Open House, check in with the Boosters in the band room. They can help with the Level 2 process and share ways to support students throughout the year.</p>
      </div>
      <div className={styles.form}>
        <Choice name="boosters" checked={status === "approved"} onChange={() => setStatus("approved")} title="My Level 2 approval is current" detail="I will also complete the NHCS volunteer training required this school year." />
        <Choice name="boosters" checked={status === "started"} onChange={() => setStatus("started")} title="I started or completed the Level 2 process" detail="I reviewed the steps and submitted what I could today." />
        <Choice name="boosters" checked={status === "plan_later"} onChange={() => setStatus("plan_later")} title="I plan to complete Level 2" detail="Add it to our Band Ready follow-up list." />
        <Choice name="boosters" checked={status === "need_help"} onChange={() => setStatus("need_help")} title="I need help or have a question" detail="I will check in with the Boosters before I leave or follow up afterward." />
      </div>
      <button className={styles.primaryButton} type="button" disabled={busy || !status} onClick={() => save("boosters", { status })}>{busy ? "Saving…" : "Save and continue to Mr. Parker"}</button>
    </StepShell>
  );
}

function SayHeyStep({ data, save, busy, href, navigate }) {
  const [status, setStatus] = useState(data.progress?.["say-hey"]?.status || "");
  return (
    <StepShell eyebrow="Step 08" title="Say hey to Mr. Parker." intro="Mr. Parker wants to greet every band family, even though Open House does not leave enough time for a long conversation with everyone. A quick hello or wave is perfect." backHref={href("/portal/band-ready")} navigate={navigate}>
      <div className={styles.detailPanel}>
        <h2>A quick connection is all this stop needs</h2>
        <p>If you have a moment, tell Mr. Parker something you enjoyed this summer, something you liked about band camp, or something you are excited about in band this year. If he is helping another family, a wave absolutely counts.</p>
      </div>
      <div className={styles.form}>
        <Choice name="say-hey" checked={status === "in_person"} onChange={() => setStatus("in_person")} title="We said hey to Mr. Parker" detail="We stopped by for a quick greeting." />
        <Choice name="say-hey" checked={status === "waved"} onChange={() => setStatus("waved")} title="We waved while Mr. Parker was helping someone" detail="We made the connection without waiting for a longer conversation." />
        <Choice name="say-hey" checked={status === "online"} onChange={() => setStatus("online")} title="We completed Band Ready away from Open House" detail="We could not say hello in person, but we completed the family checklist." />
      </div>
      <button className={styles.primaryButton} type="button" disabled={busy || !status} onClick={() => save("say-hey", { status })}>{busy ? "Saving…" : "Save and review Band Ready"}</button>
    </StepShell>
  );
}

function ReviewStep({ data, setData, studentId, href, navigate }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const needed = useMemo(() => stillNeededItems(data), [data]);
  const alreadySent = Boolean(data.completion?.emailSentAt);
  const progressHeading = data.readiness.count === 1 ? `1 of ${stepTotal} stops is complete.` : `${data.readiness.count} of ${stepTotal} stops are complete.`;

  async function finish() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/portal/band-ready", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Band Ready could not be finished.");
      setResult(body);
      setData((current) => ({ ...current, completion: { completedAt: body.completedAt || current.completion?.completedAt, emailSentAt: body.emailSent ? new Date().toISOString() : current.completion?.emailSentAt, emailRecipients: body.recipients || current.completion?.emailRecipients, emailError: body.emailError || null } }));
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  const completionShown = data.readiness.finished && (alreadySent || result?.emailSent || result?.alreadySent);
  return (
    <StepShell eyebrow="Band Ready review" title={`${data.student.display_name}’s family checklist`} intro={`This is the complete Open House picture for this student. Finish when all ${stepTotal} stops are complete, and the band will email this summary to the connected student and family addresses.`} backHref={href("/portal/band-ready")} navigate={navigate}>
      <ol className={styles.reviewList}>{steps.map((item) => <li key={item.id} className={data.readiness.complete[item.id] ? styles.reviewDone : styles.reviewOpen}><span>{data.readiness.complete[item.id] ? "✓" : "•"}</span><div><strong>{item.title}</strong><small>{data.readiness.complete[item.id] ? "Complete" : "Still needs attention"}</small></div>{!data.readiness.complete[item.id] && item.id !== "portal" ? <BandReadyLink href={href(`/portal/band-ready/${item.id}`)} destination={item.id} navigate={navigate}>Open</BandReadyLink> : null}</li>)}</ol>
      <div className={styles.summaryGrid}>
        <article><h2>Day One</h2><p><strong>Instrument:</strong> {instrumentLabel(data.progress?.["day-one"]?.instrumentStatus)}</p><p><strong>Binder:</strong> {data.progress?.["day-one"]?.binderStatus === "have" ? "Ready" : "Still needed"}</p><p><strong>Band pencil:</strong> {data.progress?.["day-one"]?.pencilStatus === "have" ? `Ready${data.progress?.["day-one"]?.pencilName ? ` · ${data.progress["day-one"].pencilName}` : ""}` : "Still needed"}</p></article>
        <article><h2>Still needed</h2>{needed.length ? <ul>{needed.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Nothing. This student reported having the Day One supplies they need.</p>}</article>
      </div>
      {completionShown ? <div className={styles.prize}><p className={styles.eyebrow}>Challenge complete</p><h2>{data.student.display_name} is Band Ready!</h2><p>The personalized summary was sent to {result?.recipients?.length || data.completion?.emailRecipients?.length || "the connected"} student and family email address{(result?.recipients?.length || data.completion?.emailRecipients?.length) === 1 ? "" : "es"}.</p><strong>Show this screen to a student helper for a sticker or candy prize.</strong></div> : (
        <div className={styles.finishPanel}><div><h2>{data.readiness.finished ? "Everything is ready to finish." : progressHeading}</h2><p>{data.readiness.finished ? "Finishing sends the personalized checklist email and unlocks the prize screen." : "Open each unfinished stop above. Your work is already saved."}</p></div><button className={styles.primaryButton} type="button" disabled={busy || !data.readiness.finished} onClick={finish}>{busy ? "Sending summary…" : "Finish Band Ready and email summary"}</button></div>
      )}
      {result?.emailError || data.completion?.emailError ? <p className={styles.error}>The checklist is saved, but the email could not be sent. Try finishing again.</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </StepShell>
  );
}
