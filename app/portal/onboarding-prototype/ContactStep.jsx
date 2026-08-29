import { CheckboxCard, Field, RadioCard, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

export default function ContactStep({ form, update }) {
  return (
    <>
      <StepIntro eyebrow="Step 2 of 6" title="How can the band reach you?">
        Your school email stays the official student address. Add only the other contact information you actually want Ashley Bands to use.
      </StepIntro>
      <div className={styles.officialSingle}>
        <span>Official school email</span><strong>jordan.ellis@student.nhcs.net</strong><small>Already connected from the school roster</small>
      </div>
      <div className={styles.formGrid}>
        <Field id="personalEmail" label="Personal email" hint="Optional. Useful after school account changes or graduation.">
          <input id="personalEmail" type="email" value={form.personalEmail} placeholder="you@example.com" onChange={(event) => update("personalEmail", event.target.value)} />
        </Field>
        <Field id="mobile" label="Student mobile number" hint="Optional. Enter a number only if you want staff to use it.">
          <input id="mobile" type="tel" value={form.mobile} placeholder="(910) 555-0123" onChange={(event) => update("mobile", event.target.value)} />
        </Field>
      </div>
      <fieldset className={styles.choiceGroup}>
        <legend>Best way to contact you</legend>
        <div className={styles.choiceGrid}>
          <RadioCard name="preferredContact" value="school_email" checked={form.preferredContact === "school_email"} onChange={(event) => update("preferredContact", event.target.value)} title="School email">Use the address already on your record.</RadioCard>
          <RadioCard name="preferredContact" value="personal_email" checked={form.preferredContact === "personal_email"} onChange={(event) => update("preferredContact", event.target.value)} title="Personal email">Use the optional personal address above.</RadioCard>
          <RadioCard name="preferredContact" value="mobile" checked={form.preferredContact === "mobile"} onChange={(event) => update("preferredContact", event.target.value)} title="Mobile">Use the optional student number above.</RadioCard>
        </div>
      </fieldset>
      <CheckboxCard checked={form.textOkay} onChange={(event) => update("textOkay", event.target.checked)} title="Ashley Bands may text this student number">
        Standard message rates may apply. Uncheck this at any time.
      </CheckboxCard>
    </>
  );
}
