"use client";

import {
  MATTRESS_SALE_BANNER_ENDS_MS,
  MATTRESS_SALE_EVENT_URL,
  isMattressSaleBannerActive
} from "@/lib/mattressSaleBanner.mjs";

const BANNER_ID = "home-mattress-sale";

// The homepage is prerendered at build time, so the date is checked in three places:
// - here at module load: at build time on the server, and at page load in the browser
//   (covers rebuilds after the date and client-side navigation back to /);
// - the inline script below, which hides a stale prerendered banner before first paint.
// suppressHydrationWarning lets the DOM keep the script's `hidden` attribute.
const HIDDEN_AT_LOAD = !isMattressSaleBannerActive(Date.now());
const HIDE_AFTER_END = `(function(){var n=document.getElementById(${JSON.stringify(BANNER_ID)});if(n&&!(Date.now()<${MATTRESS_SALE_BANNER_ENDS_MS}))n.hidden=true})()`;

export default function MattressSaleBanner() {
  return (
    <>
      <aside id={BANNER_ID} className="home-promo" aria-label="Mattress sale" hidden={HIDDEN_AT_LOAD} suppressHydrationWarning>
        <p className="home-promo-text">
          <strong>Mattress Sale this Saturday, September 26</strong>
          <span>10 AM to 4 PM in the Ashley gym. Open to the public. Every purchase supports the band.</span>
        </p>
        <a className="home-promo-link" href={MATTRESS_SALE_EVENT_URL} target="_blank" rel="noopener noreferrer">
          Facebook event <span aria-hidden="true">↗</span>
        </a>
      </aside>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: HIDE_AFTER_END }}
      />
    </>
  );
}
