import OnboardingClient from "./OnboardingClient";

export const metadata = {
  title: "Student Onboarding | Ashley Bands",
  description: "Review and update a student's connected Ashley Bands information.",
  robots: { index: false, follow: false },
};

export default function StudentOnboardingPage() {
  return <OnboardingClient />;
}
