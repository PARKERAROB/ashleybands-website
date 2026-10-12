import Link from "next/link";
import { PRACTICE_PIECE_LIST } from "@/lib/practiceLoop.mjs";
import styles from "./bernstein-tribute/practice-loop.module.css";

export const metadata = {
  title: "Practice Maps | Ashley Bands",
  description: "Pick a piece and mark which rehearsal sections are ready.",
  robots: { index: false, follow: false },
};

// Landing page for the Band Room board QR code.
export default function PracticeMapsPage() {
  return <main className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Ashley Bands practice maps</p>
      <h1>Pick your piece</h1>
    </header>
    <nav className={styles.map} aria-label="Practice maps">
      {PRACTICE_PIECE_LIST.map((piece) => <Link className={styles.rangeCard} href={`/practice/${piece.slug}`} key={piece.slug}>
        <strong>{piece.title}</strong>
        <span className={styles.movementCredit}>{piece.shortCredit}</span>
      </Link>)}
    </nav>
  </main>;
}
