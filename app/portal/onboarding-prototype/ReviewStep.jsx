import { CheckboxCard, ReviewGroup, ReviewLine, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

const contactLabels = { school_email: "School email", personal_email: "Personal email", mobile: "Student mobile" };
const accessLabels = { personal: "Student has an instrument", school: "School instrument requested", not_sure: "Needs help deciding" };

export default function ReviewStep({ form, update, jumpTo }) {
  return (
    <>
      <StepIntro eyebrow="Step 6 of 6" title="Review the student picture.">
        This is how the onboarding record would be organized before it becomes part of current operations.
      </StepIntro>
      <div className={styles.reviewStack}>
        <ReviewGroup title="Student" onEdit={() => jumpTo(0)}>
          <ReviewLine label="Official record" value="Jordan Ellis · Murray Middle · 8th Grade" />
          <ReviewLine label="Goes by" value={form.preferredFirst} />
          <ReviewLine label="Pronunciation" value={form.pronunciation} />
          <ReviewLine label="Pronouns" value={form.pronouns} />
        </ReviewGroup>
        <ReviewGroup title="Contact" onEdit={() => jumpTo(1)}>
          <ReviewLine label="Preferred channel" value={contactLabels[form.preferredContact]} />
          <ReviewLine label="Personal email" value={form.personalEmail} />
          <ReviewLine label="Student mobile" value={form.mobile} />
          <ReviewLine label="Text permission" value={form.textOkay ? "Yes" : "No"} />
        </ReviewGroup>
        <ReviewGroup title="Family" onEdit={() => jumpTo(2)}>
          <ReviewLine label="Guardian 1" value={[form.guardian1Name, form.guardian1Relationship].filter(Boolean).join(" · ")} />
          <ReviewLine label="Guardian 1 contact" value={[form.guardian1Email, form.guardian1Phone].filter(Boolean).join(" · ")} />
          <ReviewLine label="Guardian 2" value={[form.guardian2Name, form.guardian2Relationship].filter(Boolean).join(" · ")} />
          <ReviewLine label="Emergency contact" value={form.emergencySame ? "Guardian selection during family verification" : [form.emergencyName, form.emergencyPhone].filter(Boolean).join(" · ")} />
        </ReviewGroup>
        <ReviewGroup title="Music and participation" onEdit={() => jumpTo(3)}>
          <ReviewLine label="Primary instrument or role" value={form.primaryInstrument} />
          <ReviewLine label="Experience" value={form.yearsPlaying} />
          <ReviewLine label="Other instruments" value={form.otherInstruments} />
          <ReviewLine label="Interests" value={form.interests.join(", ")} />
        </ReviewGroup>
        <ReviewGroup title="Support" onEdit={() => jumpTo(4)}>
          <ReviewLine label="Shirt size" value={form.shirtSize} />
          <ReviewLine label="Instrument access" value={accessLabels[form.instrumentAccess]} />
          <ReviewLine label="Possible support" value={form.supportAreas.join(", ")} />
          <ReviewLine label="Private family follow-up" value={form.privateFollowup === "yes" ? "Requested" : "Not requested"} />
        </ReviewGroup>
      </div>
      <div className={styles.reviewOutcome}>
        <strong>What the real submission would do</strong>
        <ul><li>Update the current student record.</li><li>Create or connect guardian records.</li><li>Send guardian-owned contact details for verification.</li><li>Create only the specific staff follow-ups requested above.</li></ul>
      </div>
      <CheckboxCard checked={form.accurate} onChange={(event) => update("accurate", event.target.checked)} title="I reviewed this information and it is accurate">
        This confirms the student portion only. Guardians would verify their own information separately.
      </CheckboxCard>
    </>
  );
}
