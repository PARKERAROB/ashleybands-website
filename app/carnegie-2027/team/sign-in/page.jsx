"use client";
import Link from "next/link";
import { StaffLogin } from "@/components/StaffGate";
import styles from "../workspace.module.css";

export default function CarnegieSignInPage() {
  return (
    <main className={styles.main}>
      <StaffLogin
        title="Sign in to the Carnegie workspace"
        description="Use your existing staff email and PIN. After signing in, you will return to the private workspace. Signing in does not grant new access."
        onAuthed={() => window.location.replace("/carnegie-2027/team")}
      />
      <p>
        <Link href="/carnegie-2027/team">Return to workspace</Link>
      </p>
    </main>
  );
}
