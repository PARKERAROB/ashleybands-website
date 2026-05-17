import Link from "next/link";
import Image from "next/image";

export default function SiteNav() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <Image src="/bandsofahslogo.png" alt="" width={42} height={42} />
        <span>Bands of AHS</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/info/2026-2027-band-information">Info</Link>
        <Link href="/info/the-band-folder">Resources</Link>
        <Link href="/info/marching-band-2026">Marching Band</Link>
        <Link href="/repertoire">Repertoire</Link>
        <Link href="/programs">Programs</Link>
        <Link href="/sponsors">Support</Link>
        <Link href="/sitemap-page">All Pages</Link>
        <Link href="/assistant">Assistant</Link>
        <Link href="/members">Members</Link>
      </nav>
    </header>
  );
}
