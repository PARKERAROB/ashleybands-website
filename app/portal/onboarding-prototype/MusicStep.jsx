import { CheckboxCard, Field, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const instrumentOptions = ["Flute", "Oboe", "Bassoon", "Clarinet", "Saxophone", "Trumpet", "French Horn", "Trombone", "Euphonium", "Tuba", "Percussion", "Color Guard", "Other"];
const interestOptions = ["Concert Band", "Wind Ensemble", "Marching Band", "Color Guard", "Jazz", "Percussion", "Leadership", "Solo and Ensemble"];

export default function MusicStep({ form, update, toggleList }) {
  return (
    <>
      <StepIntro eyebrow="Step 4 of 6" title="Tell us about your music life.">
        This is a starting point, not an audition. It helps staff place students, prepare instruments, and understand the experience they bring with them.
      </StepIntro>
      <div className={styles.formGrid}>
        <Field id="primaryInstrument" label="Primary instrument or role" required>
          <select id="primaryInstrument" value={form.primaryInstrument} onChange={(event) => update("primaryInstrument", event.target.value)}>
            <option value="">Choose one</option>
            {instrumentOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field id="yearsPlaying" label="How long have you played?">
          <select id="yearsPlaying" value={form.yearsPlaying} onChange={(event) => update("yearsPlaying", event.target.value)}>
            <option value="">Choose one</option><option>Brand new</option><option>Less than 1 year</option><option>1–2 years</option><option>3–4 years</option><option>5+ years</option>
          </select>
        </Field>
        <Field id="otherInstruments" label="Other instruments or roles" hint="Optional. Separate more than one with commas.">
          <input id="otherInstruments" value={form.otherInstruments} placeholder="Piano, guitar, dance…" onChange={(event) => update("otherInstruments", event.target.value)} />
        </Field>
        <Field id="priorProgram" label="Previous school or music program" hint="Optional. This gives staff helpful context.">
          <input id="priorProgram" value={form.priorProgram} onChange={(event) => update("priorProgram", event.target.value)} />
        </Field>
        <Field id="privateTeacher" label="Private teacher" hint="Optional. Name only; contact details are not needed here.">
          <input id="privateTeacher" value={form.privateTeacher} onChange={(event) => update("privateTeacher", event.target.value)} />
        </Field>
      </div>
      <fieldset className={styles.choiceGroup}>
        <legend>What are you interested in?</legend>
        <p>Choose any that sound interesting. This does not enroll you or lock in a commitment.</p>
        <div className={styles.choiceGrid}>
          {interestOptions.map((item) => <CheckboxCard key={item} checked={form.interests.includes(item)} onChange={() => toggleList("interests", item)} title={item} />)}
        </div>
      </fieldset>
    </>
  );
}
