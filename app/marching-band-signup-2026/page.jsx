"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const INITIAL_FORM = {
  student_first_name: "",
  student_last_name: "",
  grade_fall: "",
  instrument: "",
  student_email: "",
  student_phone: "",
  guardian_name: "",
  guardian_email: "",
  guardian_phone: "",
  guardian_relationship: "",
  known_conflicts: "",
  funding_path: "",
  volunteer_areas: [],
  questions: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  medical_notes: "",
  calendar_acknowledgment: false,
  financial_acknowledgment: false,
  volunteer_acknowledgment: false,
  student_acknowledgment: false,
  parent_acknowledgment: false,
  travel_permission: false,
  emergency_care_permission: false,
  student_signature: "",
  parent_signature: ""
};

const VOLUNTEER_OPTIONS = [
  "Football game chaperone",
  "Competition chaperone",
  "Truck/trailer support",
  "Props/building",
  "Uniform help",
  "Meals/water/logistics",
  "Fundraising/sponsorship help"
];

function Field({ label, children, required = false }) {
  return (
    <label className="signup-field">
      <span>{label}{required ? " *" : ""}</span>
      {children}
    </label>
  );
}

function CheckField({ children, checked, onChange }) {
  return (
    <label className="signup-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

function MarchingBandSignupInner() {
  const params = useSearchParams();
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    source_student_id: params.get("s") || "",
    student_first_name: params.get("first") || "",
    student_last_name: params.get("last") || "",
    student_email: params.get("email") || ""
  }));
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => status !== "saving" && status !== "success", [status]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleVolunteer(option) {
    setForm((current) => {
      const selected = new Set(current.volunteer_areas);
      if (selected.has(option)) {
        selected.delete(option);
      } else {
        selected.add(option);
      }
      return { ...current, volunteer_areas: Array.from(selected) };
    });
  }

  async function submit(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/marching-band-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "The form did not submit.");
      }
      setStatus("success");
      setMessage("Your marching band sign-up has been recorded. Mr. Parker will follow up if anything needs to be clarified.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "The form did not submit.");
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-intro">
        <p className="eyebrow">Ashley Bands</p>
        <h1>2026 Marching Band Sign-Up</h1>
        <p>
          This form is not meant to scare anyone away. It is meant to give an honest picture of what
          marching band requires so that no one feels blindsided or confused once the season begins.
        </p>
        <div className="signup-deadline">Complete by June 1</div>
      </section>

      <form className="signup-form" onSubmit={submit}>
        <section className="signup-section">
          <h2>Student Information</h2>
          <div className="signup-grid">
            <Field label="Student first name" required>
              <input value={form.student_first_name} onChange={(event) => update("student_first_name", event.target.value)} />
            </Field>
            <Field label="Student last name" required>
              <input value={form.student_last_name} onChange={(event) => update("student_last_name", event.target.value)} />
            </Field>
            <Field label="Grade for fall 2026" required>
              <select value={form.grade_fall} onChange={(event) => update("grade_fall", event.target.value)}>
                <option value="">Select one</option>
                <option>Rising 8th</option>
                <option>Rising 9th</option>
                <option>Rising 10th</option>
                <option>Rising 11th</option>
                <option>Rising 12th</option>
              </select>
            </Field>
            <Field label="Instrument / section" required>
              <input value={form.instrument} onChange={(event) => update("instrument", event.target.value)} placeholder="Trumpet, percussion, colorguard, etc." />
            </Field>
            <Field label="Student email">
              <input type="email" value={form.student_email} onChange={(event) => update("student_email", event.target.value)} />
            </Field>
            <Field label="Student phone">
              <input value={form.student_phone} onChange={(event) => update("student_phone", event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="signup-section">
          <h2>Parent / Guardian Information</h2>
          <div className="signup-grid">
            <Field label="Parent/guardian name" required>
              <input value={form.guardian_name} onChange={(event) => update("guardian_name", event.target.value)} />
            </Field>
            <Field label="Parent/guardian email" required>
              <input type="email" value={form.guardian_email} onChange={(event) => update("guardian_email", event.target.value)} />
            </Field>
            <Field label="Parent/guardian phone" required>
              <input value={form.guardian_phone} onChange={(event) => update("guardian_phone", event.target.value)} />
            </Field>
            <Field label="Relationship to student">
              <input value={form.guardian_relationship} onChange={(event) => update("guardian_relationship", event.target.value)} placeholder="Parent, guardian, grandparent, etc." />
            </Field>
          </div>
        </section>

        <section className="signup-section">
          <h2>Calendar and Conflicts</h2>
          <p>
            Band Camp is August 4-15. The season includes Tuesday/Thursday rehearsals after school,
            Friday night football games, Saturday competitions, and currently runs through October 31.
          </p>
          <CheckField checked={form.calendar_acknowledgment} onChange={(event) => update("calendar_acknowledgment", event.target.checked)}>
            We have reviewed the marching band calendar and understand the attendance commitment.
          </CheckField>
          <Field label="Known conflicts">
            <textarea value={form.known_conflicts} onChange={(event) => update("known_conflicts", event.target.value)} placeholder="List dates, reasons, and whether the student would miss all or part of the event. Write none if there are no known conflicts." />
          </Field>
        </section>

        <section className="signup-section">
          <h2>Season Funding</h2>
          <p>
            Marching band costs roughly $40,000 to operate for the season. We do not want money to
            keep students away, but the season only works when families understand the real cost and
            help meet it through payments, sponsorships, fundraising, and volunteer support.
          </p>
          <CheckField checked={form.financial_acknowledgment} onChange={(event) => update("financial_acknowledgment", event.target.checked)}>
            We understand the season funding goal and that every family is expected to help meet the cost in some way.
          </CheckField>
          <Field label="Funding path" required>
            <select value={form.funding_path} onChange={(event) => update("funding_path", event.target.value)}>
              <option value="">Select one</option>
              <option value="500_up_front">$500 up front</option>
              <option value="250_now_250_camp">$250 now and $250 by band camp</option>
              <option value="sponsorship_fundraising">Commit to raising $500 through sponsorships/fundraising</option>
              <option value="talk_with_parker">I need to talk with Mr. Parker</option>
            </select>
          </Field>
        </section>

        <section className="signup-section">
          <h2>Volunteer Support</h2>
          <p>
            Marching band takes a large team of adults. Volunteer needs will be communicated as the
            season develops, including chaperoning, props, trucks/trailers, uniforms, meals, water,
            logistics, and fundraising support.
          </p>
          <CheckField checked={form.volunteer_acknowledgment} onChange={(event) => update("volunteer_acknowledgment", event.target.checked)}>
            We understand that parent/guardian support is needed and will make a good-faith effort to help when opportunities are shared.
          </CheckField>
          <div className="signup-options" aria-label="Volunteer areas">
            {VOLUNTEER_OPTIONS.map((option) => (
              <CheckField key={option} checked={form.volunteer_areas.includes(option)} onChange={() => toggleVolunteer(option)}>
                {option}
              </CheckField>
            ))}
          </div>
        </section>

        <section className="signup-section">
          <h2>Medical, Emergency, and Travel</h2>
          <div className="signup-grid">
            <Field label="Emergency contact name">
              <input value={form.emergency_contact_name} onChange={(event) => update("emergency_contact_name", event.target.value)} />
            </Field>
            <Field label="Emergency contact phone">
              <input value={form.emergency_contact_phone} onChange={(event) => update("emergency_contact_phone", event.target.value)} />
            </Field>
          </div>
          <Field label="Medical notes">
            <textarea value={form.medical_notes} onChange={(event) => update("medical_notes", event.target.value)} placeholder="Allergies, medications, medical concerns, or write none." />
          </Field>
          <CheckField checked={form.travel_permission} onChange={(event) => update("travel_permission", event.target.checked)}>
            I give permission for my student to travel with Ashley Bands for marching band events.
          </CheckField>
          <CheckField checked={form.emergency_care_permission} onChange={(event) => update("emergency_care_permission", event.target.checked)}>
            I authorize band staff/chaperones to seek emergency care if needed and a parent/guardian cannot be reached immediately.
          </CheckField>
        </section>

        <section className="signup-section">
          <h2>Questions</h2>
          <Field label="Questions or concerns for Mr. Parker">
            <textarea value={form.questions} onChange={(event) => update("questions", event.target.value)} placeholder="Use this space for anything you want to ask or explain before the commitment is finalized." />
          </Field>
        </section>

        <section className="signup-section">
          <h2>Final Acknowledgment</h2>
          <CheckField checked={form.student_acknowledgment} onChange={(event) => update("student_acknowledgment", event.target.checked)}>
            Student: I understand that marching band is a team commitment and that my attendance, preparation, and communication affect the full group.
          </CheckField>
          <CheckField checked={form.parent_acknowledgment} onChange={(event) => update("parent_acknowledgment", event.target.checked)}>
            Parent/guardian: I understand the schedule, funding model, volunteer needs, and communication expectations for the season.
          </CheckField>
          <div className="signup-grid">
            <Field label="Student signature" required>
              <input value={form.student_signature} onChange={(event) => update("student_signature", event.target.value)} />
            </Field>
            <Field label="Parent/guardian signature" required>
              <input value={form.parent_signature} onChange={(event) => update("parent_signature", event.target.value)} />
            </Field>
          </div>
        </section>

        <div className="signup-submit">
          <button type="submit" disabled={!canSubmit}>{status === "saving" ? "Submitting..." : status === "success" ? "Submitted" : "Submit sign-up"}</button>
          {message && <p className={status === "error" ? "signup-error" : "signup-success"}>{message}</p>}
          {status === "success" && (
            <div className="signup-next">
              <p>
                {form.funding_path === "sponsorship_fundraising"
                  ? "You chose to raise $500 through sponsorships. Here is your next step."
                  : "Want a head start on funding? One $2,000 sponsor can cover your student and several others."}
              </p>
              <a href="/sponsors/campaign" className="sponsors-btn sponsors-btn-primary">Open Family Sponsorship Tools</a>
            </div>
          )}
        </div>
      </form>
    </main>
  );
}

export default function MarchingBandSignupPage() {
  return (
    <Suspense fallback={<main className="signup-page"><p>Loading...</p></main>}>
      <MarchingBandSignupInner />
    </Suspense>
  );
}
