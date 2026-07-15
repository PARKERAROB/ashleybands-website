"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const HIDDEN_FOOTER_ROUTES = ["/raleigh-brief"];

const COLUMNS = [
  {
    heading: "The Program",
    links: [
      { href: "/", label: "Home" },
      { href: "/info/2026-2027-band-information", label: "2026-2027 Band Information" },
      { href: "/info/marching-band-2026", label: "Marching Band 2026" },
      { href: "/calendar", label: "Band Calendar" },
      { href: "/handbook", label: "Handbook" },
      { href: "/repertoire", label: "Performed Repertoire" },
      { href: "/programs", label: "Concert Programs" }
    ]
  },
  {
    heading: "For Families",
    links: [
      { href: "/portal", label: "My Band (Family Portal)" },
      { href: "/portal/request", label: "Request Portal Access" },
      { href: "/info/required-items", label: "Required Items" },
      { href: "/info/the-band-folder", label: "The Band Folder" },
      { href: "https://www.mymusicoffice.com/", label: "My Music Office", external: true },
      { href: "https://ashleybandshirts.printify.me/", label: "Band Shirts Store", external: true }
    ]
  },
  {
    heading: "Support the Band",
    links: [
      { href: "/sponsors", label: "Become a Sponsor" },
      { href: "/info/marching-band-funding", label: "Marching Band Funding" },
      { href: "/info/instaraise-fundraiser", label: "InstaRaise Fundraiser" },
      { href: "/boosters", label: "Band Boosters" }
    ]
  },
  {
    heading: "More",
    links: [
      { href: "/assistant", label: "Ask the Band Assistant" },
      { href: "/sitemap-page", label: "Site Map (every page)" },
      { href: "/privacy", label: "Privacy Notice" },
      { href: "/admin", label: "Staff Sign-In" }
    ]
  }
];

export default function SiteFooter() {
  const pathname = usePathname();
  if (HIDDEN_FOOTER_ROUTES.includes(pathname)) return null;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Image src="/bandsofahslogo.png" alt="" width={54} height={54} />
          <p className="site-footer-name">The Bands of Ashley High School</p>
          <p className="site-footer-addr">
            Eugene Ashley High School
            <br />
            555 Halyburton Memorial Pkwy
            <br />
            Wilmington, NC 28412
          </p>
          <p className="site-footer-addr">Robert A. Parker, Director of Bands</p>
        </div>
        <nav className="site-footer-cols" aria-label="Footer">
          {COLUMNS.map((col) => (
            <div className="site-footer-col" key={col.heading}>
              <p className="site-footer-heading">{col.heading}</p>
              <ul>
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.label}>
                      <a href={l.href} target="_blank" rel="noreferrer">
                        {l.label} ↗
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Ashley High School Bands · Wilmington, North Carolina</span>
      </div>
    </footer>
  );
}
