"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PrintControls({ autoPrint = true, backHref = "/sponsors" }) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [autoPrint]);

  return (
    <div className="print-controls no-print">
      <button type="button" onClick={() => window.print()} className="sponsors-btn sponsors-btn-primary">
        Print this page
      </button>
      <Link href={backHref} className="sponsors-btn">
        Back to Sponsors
      </Link>
    </div>
  );
}
