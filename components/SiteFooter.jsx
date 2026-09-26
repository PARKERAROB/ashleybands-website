"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FOOTER_COLUMNS, hidesSiteChrome } from "@/lib/routes";

export default function SiteFooter() {
  const pathname = usePathname();
  if (hidesSiteChrome(pathname)) return null;

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
          <p className="site-footer-addr">
            Robert A. Parker, Director of Bands
            <br />
            <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a>
            <br />
            <a href="tel:+19107902360">(910) 790-2360</a>
          </p>
        </div>
        <nav className="site-footer-cols" aria-label="Footer">
          {FOOTER_COLUMNS.map((col) => (
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
        {/* Operator statement approved by Mr. Parker 2026-09-23 (#99). Wording changes go back through him. */}
        <p className="site-footer-operator">
          This site is owned and managed by Mr. Parker and operated in coordination with the Ashley
          band program and the Ashley High School Band Boosters. Payments are received by the Ashley
          High School Band Boosters, a 501(c)(3) nonprofit. It is not an official New Hanover County
          Schools website.
        </p>
        <span>© {new Date().getFullYear()} Ashley High School Bands · Wilmington, North Carolina</span>
      </div>
    </footer>
  );
}
