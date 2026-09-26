"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readStaffSession, revokeStaffSession, STAFF_SESSION_EVENT, STAFF_STORAGE_KEY } from "@/lib/staffSession";
import { staffRoleLabel } from "@/lib/staffRoles";
import styles from "./StaffWorkspaceHeader.module.css";

// Shared header for every /admin page (#131). Reads the display-only staff session
// from the browser; authorization still happens on each API route.
export default function StaffWorkspaceHeader() {
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => setSession(readStaffSession());
    const timer = window.setTimeout(refresh, 0);
    const onStorage = (event) => { if (event.key === STAFF_STORAGE_KEY) refresh(); };
    window.addEventListener(STAFF_SESSION_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(STAFF_SESSION_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  const signOut = async () => {
    setBusy(true);
    setSignOutFailed(false);
    if (await revokeStaffSession()) {
      // Reload so the page's own staff gate shows the sign-in form.
      window.location.reload();
      return;
    }
    setBusy(false);
    setSignOutFailed(true);
  };

  return <header className={styles.bar}>
    <div className={styles.brand}>
      <Link href="/admin" className={styles.home} aria-current={pathname === "/admin" ? "page" : undefined}>
        <span className={styles.title}>Ashley Bands Workspace</span>
        <span className={styles.homeLabel}>Home</span>
      </Link>
    </div>
    {session ? <div className={styles.person}>
      <span className={styles.who}>
        <strong>{session.display_name || "Staff member"}</strong>
        <span>{staffRoleLabel(session.role)}</span>
      </span>
      <button type="button" className={styles.signOut} onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
      {signOutFailed ? <span className={styles.error} role="alert">Sign out did not finish. Try again.</span> : null}
    </div> : null}
  </header>;
}
