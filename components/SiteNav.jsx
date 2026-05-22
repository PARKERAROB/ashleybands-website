"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const HIDDEN_NAV_ROUTES = ["/raleigh-brief"];
const NAV_LINKS = [
  { href: "/info/2026-2027-band-information", label: "Info" },
  { href: "/info/marching-band-2026", label: "Marching Band" },
  { href: "/portal", label: "Profile", profile: true },
  { href: "/sponsors", label: "Support" },
  { href: "/info/the-band-folder", label: "Resources" },
  { href: "/assistant", label: "Ask" },
  { href: "/sitemap-page", label: "All Pages" }
];

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState({ signedIn: false, firstName: "" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/session")
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data) => {
        if (!cancelled) setSession(data || { signedIn: false });
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
