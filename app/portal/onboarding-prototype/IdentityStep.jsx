import { Field, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const syntheticOfficialRecord = [
  ["Legal name", "Jordan Ellis"],
  ["Current school", "Murray Middle School"],
  ["Grade", "8th Grade"],
  ["School email", "jordan.ellis@student.nhcs.net"]
];

export default function IdentityStep({ form, update, official }) {
  const officialRecord = official ? [
    ["Legal name", official.legalName],
    ["Current school", official.currentSchool],
    ["Grade", official.grade ? `${official.grade}${/grade/i.test(official.grade) ? "" : "th Grade"}` : "Not connected yet"],
    ["School email", official.schoolEmail],
  ] : syntheticOfficialRecord;
  return (
    <>
      <StepIntro eyebrow="Step 1 of 6" title="About you">
        Confirm the school record and add any name information you want.
      </StepIntro>
      <div className={styles.sourceNote}>
        <span>School-system record</span>
        <p>Official fields are read-only here.</p>
      </div>
      <div className={styles.officialGrid}>
        {officialRecord.map(([label, value]) => (
          <div key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      <div className={styles.formGrid}>
        <Field id="preferredFirst" label="What should we call you? (optional)">
          <input id="preferredFirst" value={form.preferredFirst} onChange={(event) => update("preferredFirst", event.target.value)} />
        </Field>
        <Field id="pronunciation" label="Name pronunciation (optional)" hint="Write it the way it sounds.">
          <input id="pronunciation" value={form.pronunciation} placeholder="Example: juh-DAN" onChange={(event) => update("pronunciation", event.target.value)} />
        </Field>
        <Field id="pronouns" label="Pronouns (optional)">
          <select id="pronouns" value={form.pronouns} onChange={(event) => update("pronouns", event.target.value)}>
            <option value="">Choose one</option>
            <option>she/her</option><option>he/him</option><option>they/them</option><option>Use my name</option>
          </select>
        </Field>
      </div>
    </>
  );
}
