"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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

export default function GiveClient() {
  const params = useSearchParams();
  const businessId = params.get("b") || "";
  const prospectId = params.get("p") || "";

  const [open, setOpen] = useState("loading"); // loading | open | closed
  const [businessName, setBusinessName] = useState("");
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
    const url = businessId
      ? `/api/sponsors/business-public?id=${encodeURIComponent(businessId)}`
      : `/api/sponsors/business-public`;
    fetch(url)
      .then((res) => (res.ok ? res.json().then((j) => ({ ok: true, j })) : { ok: false }))
      .then((out) => {
        if (cancelled) return;
        if (!out.ok) {
          setOpen("closed");
          return;
        }
        setOpen("open");
        if (out.j?.name) setBusinessName(out.j.name);
      })
      .catch(() => !cancelled && setOpen("closed"));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const amountCents = Math.round(Number(amount) * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents >= 500;

  async function submitCheck() {
    setError("");
    if (!businessName.trim()) return setError("Tell us your business name.");
    if (!amountValid) return setError("Enter a gift amount of at least $5.");
    setSavingCheck(true);
    try {
      const res = await fetch("/api/sponsors/give/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId || undefined,
          prospect_id: prospectId || undefined,
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
    } finally {
      setSavingCheck(false);
    }
  }

  if (open === "loading") {
    return <main className="give-shell" />;
  }

  if (open === "closed") {
    return (
      <main className="give-shell">
        <div className="give-card">
          <h1>Sponsor the Bands of Ashley</h1>
          <p>Online giving isn&apos;t open just yet. To sponsor now, contact the director or mail a check to the
            AHS Band Boosters.</p>
          <p>
            <Link href="/sponsors">See sponsorship levels</Link>
          </p>
        </div>
        <Styles />
      </main>
    );
  }

  return (
    <main className="give-shell">
      <div className="give-card">
        <p className="give-eyebrow">AHS Band Boosters · 501(c)(3)</p>
        <h1>Sponsor the Bands of Ashley</h1>
        {businessName ? <p className="give-lede">Thank you for supporting <strong>{businessName}</strong>&apos;s community band.</p> : null}

        {checkResult ? (
          <div className="give-result">
            <h2>Almost there — mail your check</h2>
            <ul>
              <li>Make payable to: <strong>{checkResult.payable_to}</strong></li>
              <li>Mail to: {checkResult.mail_to}</li>
              <li>Memo line: <strong>{checkResult.memo}</strong></li>
            </ul>
            <p className="give-muted">{checkResult.note}</p>
            <p className="give-muted">We&apos;ll send your tax receipt as soon as it arrives. Thank you.</p>
          </div>
        ) : onlineResult ? (
          <div className="give-result">
            <h2>Thank you, {onlineResult.business}!</h2>
            <p>Your {onlineResult.amount} sponsorship of the Bands of Ashley is confirmed.</p>
            <p className="give-muted">A receipt {onlineResult.receiptNumber ? `(${onlineResult.receiptNumber})` : ""} is on its way to your email.</p>
          </div>
        ) : (
          <>
            <label className="give-label">
              Business name
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business" />
            </label>
            <div className="give-grid">
              <label className="give-label">
                Gift amount (USD)
                <input type="number" min="5" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
              </label>
              <label className="give-label">
                Your name
                <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Contact name" />
              </label>
            </div>
            <label className="give-label">
              Email (for your receipt)
              <input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} placeholder="you@business.com" />
            </label>

            <div className="give-methods">
              <button type="button" className={`give-tab ${method === "online" ? "on" : ""}`} onClick={() => setMethod("online")}>
                Give online
              </button>
              <button type="button" className={`give-tab ${method === "check" ? "on" : ""}`} onClick={() => setMethod("check")}>
                Pay by check
              </button>
            </div>

            {error ? <p className="give-error">{error}</p> : null}

            {method === "check" ? (
              <button type="button" className="give-btn give-btn-primary" disabled={savingCheck} onClick={submitCheck}>
                {savingCheck ? "Saving…" : "Get check instructions"}
              </button>
            ) : clientId && amountValid && businessName.trim() ? (
              <PayPalGive
                clientId={clientId}
                businessId={businessId}
                prospectId={prospectId}
                businessName={businessName}
                amountCents={amountCents}
                payerName={payerName}
                payerEmail={payerEmail}
                onError={setError}
                onDone={setOnlineResult}
              />
            ) : (
              <p className="give-muted">Enter your business name and an amount of at least $5 to give online — or choose Pay by check.</p>
            )}
          </>
        )}
      </div>
      <Styles />
    </main>
  );
}

function PayPalGive({ clientId, businessId, prospectId, businessName, amountCents, payerName, payerEmail, onError, onDone }) {
  const ref = useRef(null);
  const dataRef = useRef({ businessId, prospectId, businessName, amountCents, payerName, payerEmail });
  useEffect(() => {
    dataRef.current = { businessId, prospectId, businessName, amountCents, payerName, payerEmail };
  }, [businessId, prospectId, businessName, amountCents, payerName, payerEmail]);

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
            const res = await fetch("/api/sponsors/give/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                business_id: d.businessId || undefined,
                prospect_id: d.prospectId || undefined,
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
      .give-card h1 {
        margin: 0 0 10px;
        font-size: 26px;
      }
      .give-lede {
        color: #3a2f26;
        line-height: 1.5;
      }
      .give-label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin-top: 14px;
      }
      .give-label input {
        width: 100%;
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
