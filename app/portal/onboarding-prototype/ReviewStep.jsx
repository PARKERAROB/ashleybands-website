import { CheckboxCard, ReviewGroup, ReviewLine, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const accessLabels = { personal: "Has an instrument", school: "Needs a school instrument", percussion: "Percussionist", not_sure: "Not sure yet" };
const schoolLabels = {
  murray: "Charles P. Murray Middle", myrtle_grove: "Myrtle Grove Middle", holly_shelter: "Holly Shelter Middle",
  noble: "MCS Noble Middle", roland_grise: "Roland-Grise Middle",
  trask: "Emma B. Trask Middle", williston: "Williston Middle", no_previous: "No previous school music program"
};

export default function ReviewStep({ form, update, jumpTo }) {
  return (
    <>
      <StepIntro eyebrow="Step 6 of 6" title="Review the student picture.">
        Check everything before finishing.
      </StepIntro>
      <div className={styles.reviewStack}>
        <ReviewGroup title="Student" onEdit={() => jumpTo(0)}>
          <ReviewLine label="Official record" value="Jordan Ellis · Murray Middle · 8th Grade" />
          <ReviewLine label="Goes by" value={form.preferredFirst} />
          <ReviewLine label="Pronunciation" value={form.pronunciation} />
          <ReviewLine label="Pronouns" value={form.pronouns} />
        </ReviewGroup>
        <ReviewGroup title="Contact" onEdit={() => jumpTo(1)}>
          <ReviewLine label="School email" value="jordan.ellis@student.nhcs.net" />
          <ReviewLine label="Personal email" value={form.personalEmail} />
          <ReviewLine label="Student mobile" value={form.mobile} />
        </ReviewGroup>
        <ReviewGroup title="Family" onEdit={() => jumpTo(2)}>
          {Array.from({ length: form.guardianCount }, (_, index) => {
            const number = index + 1;
            const key = "guardian" + number;
            return <ReviewLine key={key} label={number === 1 ? "Guardian 1 · Primary + emergency" : "Guardian " + number} value={[form[key + "Name"], form[key + "Relationship"], form[key + "Email"], form[key + "Phone"]].filter(Boolean).join(" · ")} />;
          })}
        </ReviewGroup>
        <ReviewGroup title="Music and participation" onEdit={() => jumpTo(3)}>
          <ReviewLine label="Primary instrument" value={form.primaryInstrument} />
          <ReviewLine label="Experience" value={form.yearsPlaying} />
          <ReviewLine label="Other instruments" value={form.otherInstruments.join(", ")} />
          <ReviewLine label="Previous school" value={form.originSchool === "outside_county" ? [form.priorSchoolName, form.priorSchoolCity, form.priorSchoolState].filter(Boolean).join(" · ") : schoolLabels[form.originSchool]} />
          <ReviewLine label="Interests" value={form.interests.join(", ")} />
        </ReviewGroup>
        <ReviewGroup title="Support" onEdit={() => jumpTo(4)}>
          <ReviewLine label="Shirt size" value={form.shirtSize} />
          <ReviewLine label="Instrument access" value={accessLabels[form.instrumentAccess]} />
          <ReviewLine label="Possible support" value={form.supportAreas.join(", ")} />
        </ReviewGroup>
      </div>
      <div className={styles.reviewOutcome}>
        <strong>After submission</strong>
        <ul><li>Update the current student record.</li><li>Connect guardians.</li><li>Create requested follow-ups.</li></ul>
      </div>
      <CheckboxCard checked={form.accurate} onChange={(event) => update("accurate", event.target.checked)} title="I reviewed this information and it is accurate">
        Guardian contact information is confirmed separately.
      </CheckboxCard>
    </>
  );
}
