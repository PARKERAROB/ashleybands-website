"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CARNEGIE_CAMPAIGN } from "@/lib/sponsorCampaigns.mjs";
import { sponsorThankYouLine } from "@/lib/sponsorGiftPolicy.mjs";

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

export default function GiveClient({ campaignCode = "general", embedded = false }) {
  const carnegie = campaignCode === CARNEGIE_CAMPAIGN;
  const Shell = embedded ? "div" : "main";
  const Heading = embedded ? "h2" : "h1";
  const [giftKind, setGiftKind] = useState(carnegie ? "donation" : "sponsorship");
  const params = useSearchParams();
  const attributionToken = params.get("a") || "";
  const checkRequestKey = useRef("");

  const [onlineAvailable, setOnlineAvailable] = useState(true);
  const [open, setOpen] = useState("loading"); // loading | open | closed
  const [businessName, setBusinessName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [amount, setAmount] = useState("");
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
      .then((res) => (res.ok ? res.json().then((j) => ({ ok: true, j })) : { ok: false }))
      .then((out) => {
        if (cancelled) return;
        if (!out.ok) {
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
          <p>Online giving isn&apos;t open just yet. To sponsor now, contact the director or mail a check to the
            AHS Band Boosters.</p>
          <p>
            <Link href="/sponsors">See sponsorship levels</Link>
          </p>
        </div>
        <Styles />
      </Shell>
    );
  }

  return (
    <Shell className="give-shell">
      <div className="give-card">
        <p className="give-eyebrow">AHS Band Boosters · 501(c)(3)</p>
        <Heading>{carnegie ? "Make a gift for Ashley’s trip" : studentName ? `Support ${studentName}'s Ashley Bands sponsorship effort` : "Sponsor the Bands of Ashley"}</Heading>
        {carnegie ? <p className="give-lede">Choose an amount and give online or by check. Your gift is designated for Ashley Bands’ 2027 Carnegie trip.</p> : studentName ? (
          <p className="give-lede">
            Your gift supports the whole Bands of Ashley program and will be credited to {studentName}&apos;s sponsorship total.
          </p>
        ) : businessName ? <p className="give-lede">{sponsorThankYouLine(businessName)}</p> : null}

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
          </div>
        ) : onlineResult ? (
          <div className="give-result" role="status" aria-live="polite">
            <h2>Thank you, {onlineResult.business}!</h2>
            <p>
              {onlineResult.pending
                ? `PayPal received your ${onlineResult.amount} sponsorship. Ashley Bands is reconciling the receipt now.`
                : `Your ${onlineResult.amount} ${carnegie ? "gift for Ashley’s Carnegie trip" : "sponsorship of the Bands of Ashley"} is confirmed.`}
            </p>
            <p className="give-muted">
              {onlineResult.recognition === "sent"
                ? `A receipt ${onlineResult.receiptNumber ? `(${onlineResult.receiptNumber})` : ""} was sent to the email on the PayPal account.`
                : "Your payment is recorded. Ashley Bands will follow up if a receipt could not be delivered."}
            </p>
          </div>
        ) : (
          <>
            {carnegie ? <fieldset className="give-kind">
              <legend>How would you like to help?</legend>
              <label><input type="radio" name="gift-kind" value="donation" checked={giftKind === "donation"} onChange={() => setGiftKind("donation")} /> Personal donation</label>
              <label><input type="radio" name="gift-kind" value="sponsorship" checked={giftKind === "sponsorship"} onChange={() => setGiftKind("sponsorship")} /> Business sponsorship</label>
            </fieldset> : null}
            <label className="give-label">
              Your name or business name
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Individual, family, or business"
                readOnly={Boolean(attributionToken) && !studentName}
              />
            </label>
            <div className="give-grid">
              <label className="give-label">
                Gift amount (USD)
                <input type="number" min="5" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
              </label>
              {method === "check" ? (
                <label className="give-label">
                  Your name
                  <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Contact name" />
                </label>
              ) : null}
            </div>
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
            {carnegie ? <p className="give-muted">Your gift supports Ashley’s group trip. Please read <a href="#about-your-gift">what your gift supports and how funds are handled if plans change</a>.</p> : null}
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
            const d = dataRef.current;
            if (!requestKey.current) requestKey.current = window.crypto.randomUUID();
            const res = await fetch("/api/sponsors/give/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                request_key: requestKey.current,
                campaign_code: d.campaignCode,
                gift_kind: d.giftKind,
                attribution_token: d.attributionToken || undefined,
                business_name: d.businessName,
                amount_cents: d.amountCents,
                payer_name: d.payerName,
                payer_email: d.payerEmail
              })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Could not start the gift.");
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
          onError: () => onError("Payment could not be processed. Please try again or pay by check.")
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
        color: #7b1829;
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
        background: #7b1829;
        border-color: #7b1829;
        color: #fff;
      }
      .give-btn {
        border: 1px solid #7b1829;
        background: #fff;
        color: #7b1829;
        border-radius: 8px;
        padding: 11px 18px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
      }
      .give-btn-primary {
        background: #7b1829;
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
        color: #7b1829;
        font-weight: 600;
      }
      .give-shell a {
        color: #7b1829;
      }
    `}</style>
  );
}
