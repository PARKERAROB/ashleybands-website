"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BOOSTER_NONPROFIT_COPY, CARNEGIE_CAMPAIGN, CARNEGIE_TERMS_VERSION, CARNEGIE_CHANGE_TERMS, CARNEGIE_SUGGESTED_AMOUNTS, carnegieGiftPrefill, carnegieStudentGiftLine } from "@/lib/sponsorCampaigns.mjs";
import { sponsorThankYouLine } from "@/lib/sponsorGiftPolicy.mjs";
import { SPONSOR_CONTACT, TIERS } from "@/lib/sponsorshipContent";

const GENERAL_PURPOSE = "Supports the Ashley band program: instructional staff, transportation, scholarships and instruments.";
const PAY_FALLBACK_MESSAGE = "Payment could not be processed. Please try again or pay by check.";
const LOGO_TIERS = new Set(["Patron", "Premier", "Legacy"]);
// Short plain-language highlight for each level, drawn from the TIERS benefits.
const TIER_HIGHLIGHTS = {
  Friend: "concert program and website listing",
  Partner: "bold concert program listing and a social media thank-you",
  Patron: "logo in the concert program",
  Premier: "logo on the equipment trailer and a PA read at home football games",
  Legacy: "banner at home games and a Spotlight Sponsor social post"
};

// Same thresholds as tierForAmount in lib/sponsorRecognition.js: the highest level the amount reaches.
function sponsorLevelForCents(cents) {
  const whole = (Number(cents) || 0) / 100;
  return [...TIERS].sort((a, b) => b.amount - a.amount).find((tier) => whole >= tier.amount) || null;
}

function formatDollars(cents) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

let paypalSdkPromise = null;
function loadPaypalSdk(clientId) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => {
      paypalSdkPromise = null;
      reject(new Error("Could not load PayPal."));
    };
    document.body.appendChild(script);
  });
  return paypalSdkPromise;
}

// attributionToken (#106): the gated Carnegie student landing passes its signed token directly.
// Every existing caller omits it and keeps reading ?a= from the URL.
export default function GiveClient({ campaignCode = "general", embedded = false, attributionToken: tokenProp = "" }) {
  const carnegie = campaignCode === CARNEGIE_CAMPAIGN;
  const Shell = embedded ? "div" : "main";
  const Heading = embedded ? "h2" : "h1";
  const params = useSearchParams();
  const prefill = carnegie ? carnegieGiftPrefill(params.get("kind"), params.get("amount")) : { giftKind: null, amount: carnegieGiftPrefill(null, params.get("amount")).amount };
  const [giftKind, setGiftKind] = useState(prefill.giftKind || (carnegie ? "donation" : "sponsorship"));
  const attributionToken = tokenProp || params.get("a") || "";
  const checkRequestKey = useRef("");

  const [onlineAvailable, setOnlineAvailable] = useState(true);
  const [open, setOpen] = useState("loading"); // loading | open | closed
  const [closedReason, setClosedReason] = useState("outage"); // outage | expired
  const [copyStatus, setCopyStatus] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [amount, setAmount] = useState(prefill.amount);
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [method, setMethod] = useState("online");
  const [error, setError] = useState("");
  const [checkResult, setCheckResult] = useState(null);
  const [onlineResult, setOnlineResult] = useState(null);
  const [savingCheck, setSavingCheck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = attributionToken
      ? `/api/sponsors/business-public?token=${encodeURIComponent(attributionToken)}`
      : `/api/sponsors/business-public`;
    const lookupUrl = carnegie ? `${url}${url.includes("?") ? "&" : "?"}campaign=${CARNEGIE_CAMPAIGN}` : url;
    fetch(lookupUrl)
      .then((res) => (res.ok
        ? res.json().then((j) => ({ ok: true, j }))
        : res.json().catch(() => ({})).then((j) => ({ ok: false, expired: Boolean(attributionToken) && j?.error === "invalid_link" }))))
      .then((out) => {
        if (cancelled) return;
        if (!out.ok) {
          setClosedReason(out.expired ? "expired" : "outage");
          setOpen("closed");
          return;
        }
        setOpen("open");
        if (carnegie && out.j?.online_available === false) { setOnlineAvailable(false); setMethod("check"); }
        if (out.j?.name) setBusinessName(out.j.name);
        if (out.j?.student_name) setStudentName(out.j.student_name);
      })
      .catch(() => !cancelled && setOpen("closed"));
    return () => {
      cancelled = true;
    };
  }, [attributionToken, carnegie]);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const amountCents = Math.round(Number(amount) * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents >= 500;
  const level = !carnegie && amountValid ? sponsorLevelForCents(amountCents) : null;
  const giftNoun = carnegie
    ? "gift for Ashley’s Carnegie trip"
    : level ? "sponsorship of the Bands of Ashley" : "gift to the Bands of Ashley";

  async function copyCheckInstructions() {
    if (!checkResult) return;
    const text = [
      `Make payable to: ${checkResult.payable_to}`,
      `Mail to: ${checkResult.mail_to}`,
      `Memo line: ${checkResult.memo}`
    ].join("\n");
    const ok = await copyText(text);
    setCopyStatus(ok ? "Copied." : "Copy didn't work. Please write these down or take a screenshot.");
  }

  async function submitCheck() {
    setError("");
    if (!businessName.trim()) return setError("Tell us your name or business name.");
    if (!amountValid) return setError("Enter a gift amount of at least $5.");
    if (carnegie && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail.trim())) return setError("Enter your email for the receipt and any trip updates.");
    setSavingCheck(true);
    try {
      if (!checkRequestKey.current) checkRequestKey.current = window.crypto.randomUUID();
      const res = await fetch("/api/sponsors/give/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_key: checkRequestKey.current,
          campaign_code: campaignCode,
          gift_kind: giftKind,
          gift_terms_version: carnegie ? CARNEGIE_TERMS_VERSION : undefined,
          attribution_token: attributionToken || undefined,
          business_name: businessName,
          amount_cents: amountCents,
          payer_name: payerName,
          payer_email: payerEmail
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not record that. Please try again.");
        return;
      }
      setCheckResult(json.instructions);
    } catch {
      setError("Could not record your check request. Please try again.");
    } finally {
      setSavingCheck(false);
    }
  }

  if (open === "loading") {
    return <Shell className="give-shell"><p role="status">Loading giving options…</p></Shell>;
  }

  if (open === "closed") {
    return (
      <Shell className="give-shell">
        <div className="give-card">
          <Heading>{carnegie ? "Support Ashley’s Carnegie trip" : "Sponsor the Bands of Ashley"}</Heading>
          {closedReason === "expired" ? <>
            <p>This giving link has expired. You can still give here.</p>
            <p>
              <Link href="/sponsors/give">Give to the band</Link>
              {" · "}
              <Link href="/support-carnegie">Give to the Carnegie trip</Link>
            </p>
          </> : (
            <p>Online giving is temporarily unavailable. Mail a check payable to {SPONSOR_CONTACT.boosterOrg},
              {" "}{SPONSOR_CONTACT.address}, {SPONSOR_CONTACT.cityStateZip}, or email
              {" "}<a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.</p>
          )}
        </div>
        <Styles />
      </Shell>
    );
  }

  return (
    <Shell className="give-shell">
      <div className="give-card">
        <p className="give-eyebrow">Ashley High School Band Boosters · 501(c)(3)</p>
        <Heading>{carnegie ? "Make a gift for Ashley’s trip" : studentName ? `Support ${studentName}'s Ashley Bands sponsorship effort` : "Sponsor the Bands of Ashley"}</Heading>
        {carnegie ? <>
          <p className="give-lede">Choose an amount and give online or by check. Your gift is designated for Ashley Bands’ 2027 Carnegie trip.</p>
          {studentName ? <p className="give-lede give-student-credit">{carnegieStudentGiftLine(studentName)}</p> : null}
        </> : studentName ? (
          <p className="give-lede">
            Your gift supports the whole Bands of Ashley program and will be credited to {studentName}&apos;s sponsorship total.
          </p>
        ) : businessName ? <p className="give-lede">{sponsorThankYouLine(businessName)}</p> : null}
        {!carnegie ? <p className="give-lede">{GENERAL_PURPOSE}</p> : null}

        {checkResult ? (
          <div className="give-result" role="status" aria-live="polite">
            <h2>Almost there. Mail your check</h2>
            <ul>
              <li>Make payable to: <strong>{checkResult.payable_to}</strong></li>
              <li>Mail to: {checkResult.mail_to}</li>
              <li>Memo line: <strong>{checkResult.memo}</strong></li>
            </ul>
            <p className="give-muted">{checkResult.note}</p>
            <p className="give-muted">We&apos;ll send your tax receipt as soon as it arrives. Thank you.</p>
            <button type="button" className="give-btn" onClick={copyCheckInstructions}>Copy instructions</button>
            {copyStatus ? <p className="give-muted" role="status">{copyStatus}</p> : null}
            <p className="give-muted">Questions? <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a></p>
          </div>
        ) : onlineResult ? (
          <div className="give-result" role="status" aria-live="polite">
            <h2>Thank you, {onlineResult.business}!</h2>
            <p>
              {onlineResult.pending
                ? `PayPal has your ${onlineResult.amount} ${giftNoun}. We'll email your receipt once it's recorded. Please don't pay again.`
                : `Your ${onlineResult.amount} ${giftNoun} is confirmed.`}
            </p>
            {onlineResult.pending ? null : (
              <p className="give-muted">
                {onlineResult.recognition === "sent"
                  ? `A receipt ${onlineResult.receiptNumber ? `(${onlineResult.receiptNumber})` : ""} was sent to the email on the PayPal account.`
                  : "Your payment is recorded. Ashley Bands will follow up if a receipt could not be delivered."}
              </p>
            )}
            {!carnegie && level && LOGO_TIERS.has(level.name) ? (
              <p>Next: email your logo (PNG or PDF) to <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a> so we can list you.</p>
            ) : null}
            <p className="give-muted">Questions? <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a></p>
          </div>
        ) : (
          <>
            {carnegie ? <fieldset className="give-kind">
              <legend>How would you like to help?</legend>
              <label><input type="radio" name="gift-kind" value="donation" checked={giftKind === "donation"} onChange={() => setGiftKind("donation")} /> Personal donation</label>
              <label><input type="radio" name="gift-kind" value="sponsorship" checked={giftKind === "sponsorship"} onChange={() => setGiftKind("sponsorship")} /> Business sponsorship</label>
            </fieldset> : null}
            {carnegie ? (
              <div className="give-amounts" role="group" aria-label="Suggested gift amounts">
                {CARNEGIE_SUGGESTED_AMOUNTS[giftKind].map((dollars) => (
                  <button key={dollars} type="button" aria-pressed={amount === String(dollars)} onClick={() => setAmount(String(dollars))}>
                    ${dollars.toLocaleString("en-US")}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="give-grid">
              <label className="give-label">
                {carnegie ? "Or enter another amount (USD)" : "Gift amount (USD)"}
                <input type="number" min="5" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Any amount, $5 or more" />
              </label>
              {method === "check" ? (
                <label className="give-label">
                  Your name
                  <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Contact name" />
                </label>
              ) : null}
            </div>
            {!carnegie && amountValid ? (
              <p className="give-muted" aria-live="polite">
                {level
                  ? <>{formatDollars(amountCents)} matches the {level.name} level{TIER_HIGHLIGHTS[level.name] ? `: ${TIER_HIGHLIGHTS[level.name]}` : ""}. <Link href="/sponsors#tiers">See all levels</Link></>
                  : "Thank you. Gifts under $250 are donations and aren't a sponsorship level."}
              </p>
            ) : null}
            <label className="give-label">
              Your name or business name
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Individual, family, or business"
                readOnly={Boolean(attributionToken) && !studentName}
              />
            </label>
            {method === "check" ? (
              <label className="give-label">
                Email (for your receipt)
                <input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} placeholder="you@example.com" />
              </label>
            ) : (
              <p className="give-muted">Your online receipt goes to the verified email on the PayPal account.</p>
            )}

            <div className="give-methods">
              <button
                type="button"
                className={`give-tab ${method === "online" ? "on" : ""}`}
                disabled={!onlineAvailable}
                aria-pressed={method === "online"}
                onClick={() => setMethod("online")}
              >
                Give online
              </button>
              <button
                type="button"
                className={`give-tab ${method === "check" ? "on" : ""}`}
                aria-pressed={method === "check"}
                onClick={() => setMethod("check")}
              >
                Pay by check
              </button>
            </div>

            {!onlineAvailable ? <p className="give-muted">Online trip giving is temporarily unavailable. You can give by check or contact Mr. Parker.</p> : null}
            {carnegie ? <p className="give-muted">{CARNEGIE_CHANGE_TERMS} <a href="#about-your-gift">What your gift supports</a>.</p> : null}
            {carnegie ? <p className="give-muted">{BOOSTER_NONPROFIT_COPY}</p> : null}
            {error ? <p className="give-error" role="alert">{error}</p> : null}

            {method === "check" ? (
              <button type="button" className="give-btn give-btn-primary" disabled={savingCheck} onClick={submitCheck}>
                {savingCheck ? "Saving…" : "Get check instructions"}
              </button>
            ) : clientId && amountValid && businessName.trim() ? (
              <PayPalGive
                clientId={clientId}
                key={`${campaignCode}:${giftKind}`}
                campaignCode={campaignCode}
                giftKind={giftKind}
                attributionToken={attributionToken}
                businessName={businessName}
                amountCents={amountCents}
                payerName={payerName}
                payerEmail={payerEmail}
                onError={setError}
                onDone={setOnlineResult}
              />
            ) : (
              <p className="give-muted">Enter your name and an amount of at least $5 to give online, or choose Pay by check.</p>
            )}
          </>
        )}
      </div>
      <Styles />
    </Shell>
  );
}

function PayPalGive({ clientId, campaignCode, giftKind, attributionToken, businessName, amountCents, payerName, payerEmail, onError, onDone }) {
  const ref = useRef(null);
  const requestKey = useRef("");
  const serverMessage = useRef("");
  const dataRef = useRef({ campaignCode, giftKind, attributionToken, businessName, amountCents, payerName, payerEmail });
  useEffect(() => {
    dataRef.current = { campaignCode, giftKind, attributionToken, businessName, amountCents, payerName, payerEmail };
  }, [campaignCode, giftKind, attributionToken, businessName, amountCents, payerName, payerEmail]);

  useEffect(() => {
    let cancelled = false;
    let buttons;
    loadPaypalSdk(clientId)
      .then((paypal) => {
        if (cancelled || !ref.current) return;
        buttons = paypal.Buttons({
          createOrder: async () => {
            onError("");
            serverMessage.current = "";
            const d = dataRef.current;
            if (!requestKey.current) requestKey.current = window.crypto.randomUUID();
            const res = await fetch("/api/sponsors/give/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                request_key: requestKey.current,
                campaign_code: d.campaignCode,
                gift_kind: d.giftKind,
                gift_terms_version: d.campaignCode === CARNEGIE_CAMPAIGN ? CARNEGIE_TERMS_VERSION : undefined,
                attribution_token: d.attributionToken || undefined,
                business_name: d.businessName,
                amount_cents: d.amountCents,
                payer_name: d.payerName,
                payer_email: d.payerEmail
              })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              // Deliberate plain server messages (over the limit, too many attempts) reach the donor.
              serverMessage.current = json.error || "";
              throw new Error(json.error || "Could not start the gift.");
            }
            return json.orderId;
          },
          onApprove: async (data) => {
            const res = await fetch("/api/sponsors/give/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              onError(json.error || "There was a problem completing your gift.");
              return;
            }
            onDone(json);
          },
          onError: () => onError(serverMessage.current || PAY_FALLBACK_MESSAGE)
        });
        buttons.render(ref.current);
      })
      .catch(() => onError("Could not load PayPal. Please pay by check."));
    return () => {
      cancelled = true;
      if (buttons && buttons.close) buttons.close();
    };
  }, [clientId, onError, onDone]);

  return <div ref={ref} className="give-paypal" />;
}

function Styles() {
  return (
    <style jsx global>{`
      .give-shell {
        max-width: 560px;
        margin: 0 auto;
        padding: 36px 18px 80px;
        color: #20160f;
      }
      .give-card {
        background: #fff;
        border: 1px solid #ece3d6;
        border-radius: 14px;
        padding: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .give-eyebrow {
        text-transform: uppercase;
        letter-spacing: 2px;
        font-size: 12px;
        color: var(--garnet);
        font-weight: 700;
        margin: 0 0 4px;
      }
      .give-card h1, .give-card h2 {
        margin: 0 0 10px;
        font-size: 26px;
      }
      .give-lede {
        color: #3a2f26;
        line-height: 1.5;
      }
      .give-kind { border: 0; padding: 0; margin: 18px 0; }
      .give-kind legend { font-weight: 700; margin-bottom: 8px; }
      .give-kind label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
      .give-label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin-top: 14px;
      }
      .give-label input {
        width: 100%;
        min-height: 44px;
        box-sizing: border-box;
        margin-top: 5px;
        padding: 10px 12px;
        border: 1px solid #cabfad;
        border-radius: 8px;
        font-size: 15px;
      }
      .give-amounts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .give-amounts button {
        min-height: 48px;
        border: 1.5px solid #cabfad;
        background: #fffaf0;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 700;
        color: #20160f;
        cursor: pointer;
      }
      .give-amounts button[aria-pressed="true"] {
        border-color: var(--garnet);
        background: #f7e4e7;
        color: var(--garnet);
      }
      .give-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 480px) {
        .give-grid {
          grid-template-columns: 1fr;
        }
      }
      .give-methods {
        display: flex;
        gap: 8px;
        margin: 18px 0 14px;
      }
      .give-tab {
        flex: 1;
        min-height: 44px;
        border: 1px solid #c9bba6;
        background: #fff;
        border-radius: 8px;
        padding: 10px;
        font-weight: 600;
        cursor: pointer;
        color: #3a2f26;
      }
      .give-tab.on {
        background: var(--garnet);
        border-color: var(--garnet);
        color: #fff;
      }
      .give-btn {
        border: 1px solid var(--garnet);
        background: #fff;
        color: var(--garnet);
        border-radius: 8px;
        padding: 11px 18px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
      }
      .give-btn-primary {
        background: var(--garnet);
        color: #fff;
      }
      .give-paypal {
        margin-top: 6px;
      }
      .give-result h2 {
        margin-top: 0;
      }
      .give-result ul {
        line-height: 1.7;
      }
      .give-muted {
        color: #6f675a;
        font-size: 14px;
      }
      .give-error {
        color: var(--garnet);
        font-weight: 600;
      }
      .give-shell a {
        color: var(--garnet);
      }
    `}</style>
  );
}
