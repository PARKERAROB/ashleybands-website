import { CheckboxCard, Field, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const instrumentOptions = [
  "None", "Flute", "Oboe", "Bassoon", "Clarinet", "Bass Clarinet",
  "Alto Saxophone", "Tenor Saxophone", "Baritone Saxophone",
  "Trumpet", "French Horn", "Trombone", "Euphonium", "Tuba", "Percussion"
];
const otherInstrumentOptions = [...instrumentOptions.filter((item) => item !== "None"), "Guitar", "Bass Guitar", "Piano"];
const interestOptions = ["Concert Band", "Wind Ensemble", "Marching Band", "Color Guard", "Jazz", "Percussion", "Leadership", "Solo and Ensemble"];
const schoolOptions = [
  ["murray", "Charles P. Murray Middle"], ["myrtle_grove", "Myrtle Grove Middle"],
  ["holly_shelter", "Holly Shelter Middle"],
  ["noble", "MCS Noble Middle"], ["roland_grise", "Roland-Grise Middle"],
  ["trask", "Emma B. Trask Middle"], ["williston", "Williston Middle"]
];

function InstrumentSection({ form, update, toggleList }) {
  return (
    <>
      <div className={styles.formGrid}>
        <Field id="primaryInstrument" label="Primary instrument" required>
          <select id="primaryInstrument" value={form.primaryInstrument} onChange={(event) => update("primaryInstrument", event.target.value)}>
            <option value="">Choose one</option>{instrumentOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field id="yearsPlaying" label="How long have you played?">
          <select id="yearsPlaying" value={form.yearsPlaying} onChange={(event) => update("yearsPlaying", event.target.value)}>
            <option value="">Choose one</option><option>Brand new</option><option>Less than 1 year</option><option>1–2 years</option><option>3–4 years</option><option>5+ years</option>
          </select>
        </Field>
      </div>
      <fieldset className={styles.choiceGroup}>
        <legend>Other instruments</legend>
        <div className={styles.choiceGrid}>
          {otherInstrumentOptions.filter((item) => item !== form.primaryInstrument).map((item) => <CheckboxCard key={item} checked={form.otherInstruments.includes(item)} onChange={() => toggleList("otherInstruments", item)} title={item} />)}
        </div>
      </fieldset>
    </>
  );
}

function SchoolSection({ form, update }) {
  return (
    <fieldset className={styles.choiceGroup}>
      <legend>Previous school</legend>
      <Field id="originSchool" label="Where did you attend before Ashley?" required>
        <select id="originSchool" value={form.originSchool} onChange={(event) => update("originSchool", event.target.value)}>
          <option value="">Choose one</option>
          {schoolOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="outside_county">Outside New Hanover County</option>
          <option value="no_previous">No previous school music program</option>
        </select>
      </Field>
      {form.originSchool === "outside_county" ? (
        <div className={styles.formGridThree}>
          <Field id="priorSchoolName" label="School name" required><input id="priorSchoolName" value={form.priorSchoolName} onChange={(event) => update("priorSchoolName", event.target.value)} /></Field>
          <Field id="priorSchoolCity" label="City" required><input id="priorSchoolCity" value={form.priorSchoolCity} onChange={(event) => update("priorSchoolCity", event.target.value)} /></Field>
          <Field id="priorSchoolState" label="State" required><input id="priorSchoolState" value={form.priorSchoolState} maxLength="2" placeholder="NC" onChange={(event) => update("priorSchoolState", event.target.value.toUpperCase())} /></Field>
        </div>
      ) : null}
    </fieldset>
  );
}

export default function MusicStep({ form, update, toggleList }) {
  return (
    <>
      <StepIntro eyebrow="Step 4 of 6" title="Music background">
        Add your instrument and previous-school information.
      </StepIntro>
      <InstrumentSection form={form} update={update} toggleList={toggleList} />
      <SchoolSection form={form} update={update} />
      <fieldset className={styles.choiceGroup}>
        <legend>Interests</legend>
        <div className={styles.choiceGrid}>
          {interestOptions.map((item) => <CheckboxCard key={item} checked={form.interests.includes(item)} onChange={() => toggleList("interests", item)} title={item} />)}
        </div>
      </fieldset>
    </>
  );
}
