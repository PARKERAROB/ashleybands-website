import { CheckboxCard, Field, RadioCard, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const supportOptions = ["Instrument or equipment", "Transportation", "Class schedule", "Accessibility", "Cost", "Something else"];

export default function SupportStep({ form, update, toggleList }) {
  return (
    <>
      <StepIntro eyebrow="Step 5 of 6" title="Current needs">
        Add current equipment or support needs.
      </StepIntro>
      <div className={styles.formGrid}>
        <Field id="shirtSize" label="Shirt size">
          <select id="shirtSize" value={form.shirtSize} onChange={(event) => update("shirtSize", event.target.value)}>
            <option value="">Choose one</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>2XL</option><option>3XL</option><option>4XL</option>
          </select>
        </Field>
      </div>
      <fieldset className={styles.choiceGroup}>
        <legend>Instrument access</legend>
        <div className={styles.choiceGrid}>
          <RadioCard name="instrumentAccess" value="personal" checked={form.instrumentAccess === "personal"} onChange={(event) => update("instrumentAccess", event.target.value)} title="I have an instrument" />
          <RadioCard name="instrumentAccess" value="school" checked={form.instrumentAccess === "school"} onChange={(event) => update("instrumentAccess", event.target.value)} title="I need a school instrument" />
          <RadioCard name="instrumentAccess" value="percussion" checked={form.instrumentAccess === "percussion"} onChange={(event) => update("instrumentAccess", event.target.value)} title="I am a percussionist" />
          <RadioCard name="instrumentAccess" value="not_sure" checked={form.instrumentAccess === "not_sure"} onChange={(event) => update("instrumentAccess", event.target.value)} title="I am not sure yet" />
          {form.colorGuardOnly ? <RadioCard name="instrumentAccess" value="color_guard" checked={form.instrumentAccess === "color_guard"} onChange={(event) => update("instrumentAccess", event.target.value)} title="Not applicable — Color Guard" /> : null}
        </div>
      </fieldset>
      <fieldset className={styles.choiceGroup}>
        <legend>Do you need help with anything before band starts?</legend>
        <p>Selecting one requests staff follow-up.</p>
        <div className={styles.choiceGrid}>
          {supportOptions.map((item) => <CheckboxCard key={item} checked={form.supportAreas.includes(item)} onChange={() => toggleList("supportAreas", item)} title={item} />)}
        </div>
      </fieldset>
      <Field id="studentNote" label="Anything else Mr. Parker should know? (optional)" hint="No medical or custody details.">
        <textarea id="studentNote" value={form.studentNote} rows="4" maxLength="500" onChange={(event) => update("studentNote", event.target.value)} />
      </Field>
    </>
  );
}
