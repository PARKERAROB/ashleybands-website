import { Field, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

function GuardianCard({ number, form, update }) {
  const key = "guardian" + number;
  return (
    <fieldset className={styles.personCard}>
      <legend>Guardian {number}{number === 1 ? <small>Primary + emergency</small> : null}</legend>
      <div className={styles.formGrid}>
        <Field id={key + "Name"} label="Full name" required={number === 1}>
          <input id={key + "Name"} required={number === 1} value={form[key + "Name"]} onChange={(event) => update(key + "Name", event.target.value)} />
        </Field>
        <Field id={key + "Relationship"} label="Relationship to student" required={number === 1}>
          <input id={key + "Relationship"} required={number === 1} value={form[key + "Relationship"]} placeholder="Parent, grandparent, guardian…" onChange={(event) => update(key + "Relationship", event.target.value)} />
        </Field>
        <Field id={key + "Email"} label="Email" required={number === 1}>
          <input id={key + "Email"} type="email" required={number === 1} value={form[key + "Email"]} onChange={(event) => update(key + "Email", event.target.value)} />
        </Field>
        <Field id={key + "Phone"} label="Phone" required={number === 1}>
          <input id={key + "Phone"} type="tel" required={number === 1} value={form[key + "Phone"]} onChange={(event) => update(key + "Phone", event.target.value)} />
        </Field>
      </div>
    </fieldset>
  );
}

export default function FamilyStep({ form, update }) {
  return (
    <>
      <StepIntro eyebrow="Step 3 of 6" title="Guardians">
        Guardian 1 is the primary and emergency contact. Add up to four guardians.
      </StepIntro>
      {Array.from({ length: form.guardianCount }, (_, index) => (
        <GuardianCard key={index + 1} number={index + 1} form={form} update={update} />
      ))}
      {form.guardianCount < 4 ? <button className={styles.addGuardianButton} type="button" onClick={() => update("guardianCount", form.guardianCount + 1)}>+ Add another guardian</button> : null}
    </>
  );
}
