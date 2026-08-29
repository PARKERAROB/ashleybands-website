import { CheckboxCard, Field, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

function GuardianCard({ number, optional = false, form, update }) {
  const key = "guardian" + number;
  return (
    <fieldset className={styles.personCard}>
      <legend>Guardian {number}{optional ? <small>Optional</small> : null}</legend>
      <div className={styles.formGrid}>
        <Field id={key + "Name"} label="Full name" required={!optional}>
          <input id={key + "Name"} value={form[key + "Name"]} onChange={(event) => update(key + "Name", event.target.value)} />
        </Field>
        <Field id={key + "Relationship"} label="Relationship to student" required={!optional}>
          <input id={key + "Relationship"} value={form[key + "Relationship"]} placeholder="Parent, grandparent, guardian…" onChange={(event) => update(key + "Relationship", event.target.value)} />
        </Field>
        <Field id={key + "Email"} label="Email" required={!optional}>
          <input id={key + "Email"} type="email" value={form[key + "Email"]} onChange={(event) => update(key + "Email", event.target.value)} />
        </Field>
        <Field id={key + "Phone"} label="Phone" required={!optional}>
          <input id={key + "Phone"} type="tel" value={form[key + "Phone"]} onChange={(event) => update(key + "Phone", event.target.value)} />
        </Field>
      </div>
    </fieldset>
  );
}

export default function FamilyStep({ form, update }) {
  return (
    <>
      <StepIntro eyebrow="Step 3 of 6" title="Connect the people who support you.">
        Each person becomes their own connected record. That lets one guardian support more than one student without duplicating or losing contact information.
      </StepIntro>
      <GuardianCard number="1" form={form} update={update} />
      <GuardianCard number="2" optional form={form} update={update} />
      <CheckboxCard checked={form.emergencySame} onChange={(event) => update("emergencySame", event.target.checked)} title="One of these guardians is also my emergency contact">
        The finished system would let the family select the specific guardian during verification.
      </CheckboxCard>
      {!form.emergencySame ? (
        <fieldset className={styles.personCard}>
          <legend>Emergency contact</legend>
          <div className={styles.formGridThree}>
            <Field id="emergencyName" label="Full name" required><input id="emergencyName" value={form.emergencyName} onChange={(event) => update("emergencyName", event.target.value)} /></Field>
            <Field id="emergencyRelationship" label="Relationship" required><input id="emergencyRelationship" value={form.emergencyRelationship} onChange={(event) => update("emergencyRelationship", event.target.value)} /></Field>
            <Field id="emergencyPhone" label="Phone" required><input id="emergencyPhone" type="tel" value={form.emergencyPhone} onChange={(event) => update("emergencyPhone", event.target.value)} /></Field>
          </div>
        </fieldset>
      ) : null}
      <p className={styles.prototypeAside}><strong>Production handoff:</strong> guardians would receive a private verification request. A student submission would not silently overwrite a guardian-owned email or phone number.</p>
    </>
  );
}
