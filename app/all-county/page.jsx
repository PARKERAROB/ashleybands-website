import { ButtonLink, Notice, PageHeader } from "@/components/ui";
import styles from "./page.module.css";

const FORM_URL = "https://forms.cloud.microsoft/r/qAWG6DtMK7";

export const metadata = {
  title: "All-County Interest Form | Ashley Bands",
  description: "Students who want to perform in the new New Hanover County Schools All-County can sign up here."
};

export default function AllCountyPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        title="All-County Interest Form"
        lede="Want to perform in the new New Hanover County Schools All-County? Fill out this form to sign up."
        actions={<ButtonLink href={FORM_URL} target="_blank" rel="noopener noreferrer">Open the form in a new tab</ButtonLink>}
      />
      <Notice tone="info" title="Sign in with your school account.">
        <p>Use your @student.nhcs.net email and password. This form is for New Hanover County Schools students.</p>
      </Notice>
      <iframe
        className={styles.frame}
        src={`${FORM_URL}?embed=true`}
        title="All-County interest form"
        loading="lazy"
        allowFullScreen
      />
      <p className={styles.fallback}>
        Form not showing, or asking you to sign in again? <a href={FORM_URL} target="_blank" rel="noopener noreferrer">Open it in a new tab</a>.
      </p>
      <p className={styles.fallback}>Questions? Email Mr. Parker at robert.parker@nhcs.net.</p>
    </main>
  );
}
