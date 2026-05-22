"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const HIDDEN_NAV_ROUTES = ["/raleigh-brief"];
const NAV_LINKS = [
  { href: "/info/2026-2027-band-information", label: "Info" },
  { href: "/info/marching-band-2026", label: "Marching Band" },
  { href: "/portal", label: "Profile" },
  { href: "/sponsors", label: "Support" },
  { href: "/info/the-band-folder", label: "Resources" },
  { href: "/assistant", label: "Ask" },
  { href: "/sitemap-page", label: "All Pages" }
];

export default function SiteNav() {
  const pathname = usePathname();
  if (HIDDEN_NAV_ROUTES.includes(pathname)) return null;

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <Image src="/bandsofahslogo.png" alt="" width={42} height={42} />
        <span>Bands of AHS</span>
      </Link>
      <nav aria-label="Main navigation">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
          return (
            <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
