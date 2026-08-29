import { CheckboxCard, Field, RadioCard, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const supportOptions = ["Instrument or equipment", "Transportation", "Schedule", "Accessibility", "Financial support", "Something else"];

export default function SupportStep({ form, update, toggleList }) {
  return (
    <>
      <StepIntro eyebrow="Step 5 of 6" title="What helps you participate fully?">
        Ashley Bands should know what support to arrange without asking you to put private medical or family details into a general form.
      </StepIntro>
      <div className={styles.formGrid}>
        <Field id="shirtSize" label="Unisex shirt size" hint="Used for the standard Ashley Bands shirt; detailed uniform measurements belong in inventory assignments.">
          <select id="shirtSize" value={form.shirtSize} onChange={(event) => update("shirtSize", event.target.value)}>
            <option value="">Choose later</option><option>Adult XS</option><option>Adult S</option><option>Adult M</option><option>Adult L</option><option>Adult XL</option><option>Adult 2XL</option><option>Adult 3XL+</option>
          </select>
        </Field>
      </div>
      <fieldset className={styles.choiceGroup}>
        <legend>Instrument access</legend>
        <div className={styles.choiceGrid}>
          <RadioCard name="instrumentAccess" value="personal" checked={form.instrumentAccess === "personal"} onChange={(event) => update("instrumentAccess", event.target.value)} title="I have an instrument">Staff can confirm that it is appropriate for the program.</RadioCard>
          <RadioCard name="instrumentAccess" value="school" checked={form.instrumentAccess === "school"} onChange={(event) => update("instrumentAccess", event.target.value)} title="I need a school instrument">This would create an equipment follow-up, not an assignment yet.</RadioCard>
          <RadioCard name="instrumentAccess" value="not_sure" checked={form.instrumentAccess === "not_sure"} onChange={(event) => update("instrumentAccess", event.target.value)} title="I am not sure yet">Staff can help choose the right path.</RadioCard>
        </div>
      </fieldset>
      <fieldset className={styles.choiceGroup}>
        <legend>Areas where help may be useful</legend>
        <p>Optional. Choose broad areas only; the right person can follow up privately.</p>
        <div className={styles.choiceGrid}>
          {supportOptions.map((item) => <CheckboxCard key={item} checked={form.supportAreas.includes(item)} onChange={() => toggleList("supportAreas", item)} title={item} />)}
        </div>
      </fieldset>
      <fieldset className={styles.choiceGroup}>
        <legend>Private follow-up</legend>
        <div className={styles.choiceGrid}>
          <RadioCard name="privateFollowup" value="no" checked={form.privateFollowup === "no"} onChange={(event) => update("privateFollowup", event.target.value)} title="No follow-up needed" />
          <RadioCard name="privateFollowup" value="yes" checked={form.privateFollowup === "yes"} onChange={(event) => update("privateFollowup", event.target.value)} title="Please contact my family privately">No diagnosis or sensitive explanation is needed here.</RadioCard>
        </div>
      </fieldset>
      <Field id="studentNote" label="Anything else you want Mr. Parker to know?" hint="Optional. Do not enter medical diagnoses, custody details, or other highly sensitive information here.">
        <textarea id="studentNote" value={form.studentNote} rows="4" maxLength="500" onChange={(event) => update("studentNote", event.target.value)} />
      </Field>
    </>
  );
}
