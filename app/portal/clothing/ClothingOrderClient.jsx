"use client";

import { useEffect, useMemo, useRef, useState } from "react";

let paypalPromise;
function paypalSdk(clientId) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalPromise) return paypalPromise;
  paypalPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
    script.onload = () => resolve(window.paypal);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return paypalPromise;
}

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function ClothingOrderClient() {
  const [profile, setProfile] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [lines, setLines] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const paypalRef = useRef(null);

  useEffect(() => {
    Promise.all([fetch("/api/portal/me"), fetch("/api/portal/clothing-order")])
      .then(async ([a, b]) => {
        const [p, c] = await Promise.all([a.json(), b.json()]);
        if (!a.ok || !b.ok) throw new Error(p.error || c.error || "Could not load the order form.");
        setProfile(p); setCatalog(c); setStudentId(p.students?.[0]?.id || "");
      }).catch((error) => setMessage(error.message));
  }, []);

  function add(product) {
    setLines((current) => [...current, { key: crypto.randomUUID(), productId: product.id, name: product.name, priceCents: product.priceCents, color: product.colors[0], size: product.sizes[0], quantity: 1 }]);
  }
  function update(key, field, value) { setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: field === "quantity" ? Number(value) : value } : line)); }
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0), [lines]);
  const tax = Math.round(subtotal * (catalog?.taxRate || 0));
  const total = subtotal + tax;

  async function beginPayment() {
    setBusy(true); setMessage("");
    const res = await fetch("/api/portal/clothing-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, items: lines }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(body.error || "Could not start payment."); return; }
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    try {
      const paypal = await paypalSdk(clientId);
      paypalRef.current.innerHTML = "";
      await paypal.Buttons({
        createOrder: () => body.orderId,
        onApprove: async (data) => {
          const capture = await fetch("/api/portal/clothing-order/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.orderID }) });
          const result = await capture.json().catch(() => ({}));
          if (!capture.ok) { setMessage(result.error || "Payment could not be confirmed."); return; }
          setLines([]); setMessage("Paid and ordered. Your items will be distributed through the band after the bulk order arrives.");
        },
        onCancel: () => setMessage("Payment was cancelled; the order was not completed."),
        onError: () => setMessage("PayPal could not complete the payment.")
      }).render(paypalRef.current);
    } catch { setMessage("Could not open PayPal."); }
  }

  if (!profile || !catalog) return <main className="portal-shell"><section className="portal-panel"><h1>Open House Clothing</h1><p>{message || "Loading…"}</p></section></main>;
  return (
    <main className="portal-shell"><section className="portal-panel portal-panel-wide">
      <p className="eyebrow">Family Portal</p><h1>Open House Clothing Order</h1>
      <p className="portal-copy">Order by Friday, August 28. Prices include no individual shipping; items will be distributed through the band.</p>
      <label>Student<select value={studentId} onChange={(e) => setStudentId(e.target.value)}>{profile.students.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label>
      <div className="portal-review-list">
        {catalog.products.map((product) => <article className="portal-review-card" key={product.id}><h2>{product.name}</h2><p>{money(product.priceCents)} before tax</p><button className="portal-action-link" type="button" onClick={() => add(product)}>Add item</button></article>)}
      </div>
      {lines.map((line) => { const product = catalog.products.find((p) => p.id === line.productId); return <div className="portal-row" key={line.key}>
        <strong>{line.name}</strong>
        <select aria-label={`${line.name} color`} value={line.color} onChange={(e) => update(line.key,"color",e.target.value)}>{product.colors.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label={`${line.name} size`} value={line.size} onChange={(e) => update(line.key,"size",e.target.value)}>{product.sizes.map((x) => <option key={x}>{x}</option>)}</select>
        <input aria-label={`${line.name} quantity`} type="number" min="1" max="20" value={line.quantity} onChange={(e) => update(line.key,"quantity",e.target.value)} />
        <button type="button" onClick={() => setLines((xs) => xs.filter((x) => x.key !== line.key))}>Remove</button>
      </div>; })}
      {lines.length ? <div className="portal-finance-summary"><strong>Subtotal {money(subtotal)} · Tax {money(tax)} · Total {money(total)}</strong><button className="sponsors-btn sponsors-btn-primary" disabled={busy} onClick={beginPayment}>{busy ? "Preparing…" : "Continue to portal payment"}</button></div> : null}
      <div ref={paypalRef} />
      {message ? <p className="portal-message">{message}</p> : null}
      <p className="portal-footnote">If required clothing creates a financial hardship, contact Mr. Parker. No student will be excluded.</p>
    </section></main>
  );
}

