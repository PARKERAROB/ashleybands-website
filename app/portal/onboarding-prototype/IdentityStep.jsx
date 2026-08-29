import { Field, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const officialRecord = [
  ["Legal name", "Jordan Ellis"],
  ["Current school", "Murray Middle School"],
  ["Grade", "8th Grade"],
  ["School email", "jordan.ellis@student.nhcs.net"]
];

export default function IdentityStep({ form, update }) {
  return (
    <>
      <StepIntro eyebrow="Step 1 of 6" title="Let’s start with you.">
        Your official school information is already connected. Confirm it here, then tell us how you want to be known in the band room.
      </StepIntro>
      <div className={styles.sourceNote}>
        <span>School-system record</span>
        <p>These fields come from the official roster. The finished form would route a correction instead of silently changing them.</p>
      </div>
      <div className={styles.officialGrid}>
        {officialRecord.map(([label, value]) => (
          <div key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      <div className={styles.formGrid}>
        <Field id="preferredFirst" label="What should we call you?" required hint="This can be different from your legal first name.">
          <input id="preferredFirst" value={form.preferredFirst} onChange={(event) => update("preferredFirst", event.target.value)} />
        </Field>
        <Field id="pronunciation" label="How do we pronounce your name?" hint="Optional — write it the way it sounds.">
          <input id="pronunciation" value={form.pronunciation} placeholder="Example: juh-DAN" onChange={(event) => update("pronunciation", event.target.value)} />
        </Field>
        <Field id="pronouns" label="Pronouns" hint="Optional. Used by staff in everyday communication.">
          <select id="pronouns" value={form.pronouns} onChange={(event) => update("pronouns", event.target.value)}>
            <option value="">Choose if you would like</option>
            <option>she/her</option><option>he/him</option><option>they/them</option><option>Use my name</option>
          </select>
        </Field>
      </div>
      <p className={styles.prototypeAside}><strong>Prototype choice:</strong> date of birth, legal sex, and other protected details are not collected here unless a specific band operation truly needs them.</p>
    </>
  );
}
