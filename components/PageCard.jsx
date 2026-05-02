import Link from "next/link";

export default function PageCard({ page }) {
  return (
    <Link className="page-card" href={`/info/${page.slug}`}>
      <span>{page.audience}</span>
      <h3>{page.title}</h3>
      <p>{page.summary}</p>
    </Link>
  );
}
