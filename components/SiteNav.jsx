"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readStaffSession } from "@/lib/staffSession";

const HIDDEN_NAV_ROUTES = ["/raleigh-brief", "/attendance", "/day-1-agenda", "/regiment-os"];
const NAV_LINKS = [
  { href: "/info/2026-2027-band-information", label: "Info" },
  { href: "/info/marching-band-2026", label: "Marching Band" },
  { href: "/calendar", label: "Calendar" },
  { href: "/newsletter", label: "Weekly" },
  { href: "/portal", label: "Family Portal", profile: true },
  { href: "/sponsors", label: "Support" },
  { href: "/info/the-band-folder", label: "Resources" },
  { href: "/assistant", label: "Ask" }
];

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState({ signedIn: false, firstName: "" });
  // Staff identity is a SEPARATE login from the family/portal session above.
  // When a staff session exists, surface a Manage door to the /admin hub.
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Staff access is independent of the family session. Surface the Manage
    // door immediately even if the family-session check is slow or unavailable.
    queueMicrotask(() => {
      if (!cancelled) setIsStaff(Boolean(readStaffSession()));
    });
    fetch("/api/portal/session")
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data) => {
        if (cancelled) return;
        setSession(data || { signedIn: false });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function signOut() {
    await fetch("/api/portal/signout", { method: "POST" }).catch(() => {});
    setSession({ signedIn: false, firstName: "" });
    router.push("/portal");
  }

  if (HIDDEN_NAV_ROUTES.includes(pathname)) return null;

  // When signed in, the Profile link goes straight to the dashboard.
  const profileHref = session.signedIn ? "/portal/review" : "/portal";

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <Image src="/bandsofahslogo.png" alt="" width={42} height={42} />
        <span>Bands of AHS</span>
      </Link>
      <nav aria-label="Main navigation">
        {NAV_LINKS.map((link) => {
          const href = link.profile ? profileHref : link.href;
          const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
          return (
            <Link key={link.label} href={href} aria-current={active ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
        {isStaff && (
          <Link
            href="/admin"
            className="nav-manage"
            aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            style={{ fontWeight: 700, color: "#7b1829" }}
          >
            Manage
          </Link>
        )}
        {session.signedIn ? (
          <span className="nav-account">
            <span className="nav-account-name">Signed in{session.firstName ? ` as ${session.firstName}` : ""}</span>
            <button type="button" className="nav-signout" onClick={signOut}>
              Sign out
            </button>
          </span>
        ) : (
          <Link className="nav-signin" href="/portal">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
