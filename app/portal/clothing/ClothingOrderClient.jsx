"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./clothing-order.module.css";

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
  const [catalog, setCatalog] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [lines, setLines] = useState([]);
  const [selections, setSelections] = useState({});
  const [lastAddedProduct, setLastAddedProduct] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const paypalRef = useRef(null);
  const orderRef = useRef(null);

  useEffect(() => {
    fetch("/api/portal/clothing-order")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load the order form.");
        const requestedStudentId = new URLSearchParams(window.location.search).get("studentId") || "";
        const selectedStudentId = body.students?.some((student) => student.id === requestedStudentId) ? requestedStudentId : body.students?.[0]?.id || "";
        setCatalog(body); setStudentId(selectedStudentId);
      }).catch((error) => setMessage(error.message));
  }, []);

  function selectedFor(product) {
    return selections[product.id] || { color: product.colors[0], size: "", quantity: 1 };
  }

  function choose(product, field, value) {
    setSelections((current) => ({
      ...current,
      [product.id]: { ...selectedFor(product), ...current[product.id], [field]: field === "quantity" ? Number(value) : value }
    }));
    setLastAddedProduct("");
  }

  function add(product) {
    const selected = selectedFor(product);
    if (!selected.size) {
      setAnnouncement(`Choose a size for ${product.name}.`);
      return;
    }
    const line = { key: crypto.randomUUID(), productId: product.id, name: product.name, priceCents: product.priceCents, color: selected.color, size: selected.size, quantity: selected.quantity };
    setLines((current) => [...current, line]);
    setLastAddedProduct(product.id);
    setAnnouncement(`${selected.quantity} ${product.name}, ${selected.color}, size ${selected.size}, added to your order.`);
  }
  function update(key, field, value) { setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: field === "quantity" ? Number(value) : value } : line)); }
  function remove(key) {
    setLines((current) => current.filter((line) => line.key !== key));
    setLastAddedProduct("");
  }
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0), [lines]);
  const tax = Math.round(subtotal * (catalog?.taxRate || 0));
  const total = subtotal + tax;
  const itemCount = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

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

  if (!catalog) return <main className="portal-shell"><section className="portal-panel"><h1>Open House Clothing</h1><p>{message || "Loading…"}</p></section></main>;
  if (!catalog.students?.length) return <main className="portal-shell"><section className="portal-panel"><h1>Open House Clothing</h1><p>No student is connected to this Family Portal account.</p><Link href="/portal/request">Request student access</Link></section></main>;
  return (
    <main className={`portal-shell ${lines.length ? styles.shellWithMobileBar : ""}`}>
      <section className={`portal-panel ${styles.panel}`}>
        <Link className={styles.backLink} href={`/portal/band-ready/clothing?studentId=${encodeURIComponent(studentId)}&refresh=1`}>← Back to Band Ready</Link>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Family Portal</p>
            <h1>Open House Clothing Order</h1>
            <p className="portal-copy">Choose the color, size, and quantity before adding each item. Your order stays visible while you shop.</p>
          </div>
          <div className={styles.deadline}><span>Order by</span><strong>Friday, August 28</strong><small>No individual shipping charge</small></div>
        </header>

        <label className={styles.studentPicker}>Ordering for<select value={studentId} onChange={(event) => setStudentId(event.target.value)}>{catalog.students.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}</select></label>

        <div className={styles.layout}>
          <section aria-labelledby="clothing-choices-heading">
            <div className={styles.sectionHeading}><div><p className={styles.stepLabel}>1 · Choose items</p><h2 id="clothing-choices-heading">What would you like?</h2></div><span>{catalog.products.length} options</span></div>
            <div className={styles.catalogGrid}>
              {catalog.products.map((product) => {
                const selected = selectedFor(product);
                return (
                  <article className={styles.productCard} key={product.id}>
                    <div className={styles.productHeading}><h3>{product.name}</h3><strong>{money(product.priceCents)}</strong></div>
                    <p className={styles.taxNote}>Price before {Math.round(catalog.taxRate * 100)}% tax</p>
                    <div className={styles.productFields}>
                      <label><span>Color</span><select value={selected.color} onChange={(event) => choose(product, "color", event.target.value)}>{product.colors.map((color) => <option key={color}>{color}</option>)}</select></label>
                      <label><span>Size</span><select value={selected.size} onChange={(event) => choose(product, "size", event.target.value)}><option value="">Choose size</option>{product.sizes.map((size) => <option key={size}>{size}</option>)}</select></label>
                      <label><span>Quantity</span><select value={selected.quantity} onChange={(event) => choose(product, "quantity", event.target.value)}>{[1,2,3,4,5,6].map((quantity) => <option key={quantity}>{quantity}</option>)}</select></label>
                    </div>
                    <button className={`${styles.addButton} ${lastAddedProduct === product.id ? styles.addedButton : ""}`} type="button" disabled={!selected.size} onClick={() => add(product)}>{!selected.size ? "Choose a size to add" : lastAddedProduct === product.id ? "Added ✓ · Add another" : "Add to my order"}</button>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className={styles.orderPanel} id="clothing-order-summary" ref={orderRef} aria-labelledby="clothing-order-heading">
            <div className={styles.orderHeading}><div><p className={styles.stepLabel}>2 · Review</p><h2 id="clothing-order-heading">Your order</h2></div><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span></div>
            {!lines.length ? <div className={styles.emptyOrder}><strong>Nothing added yet</strong><p>Choose a size on any item, then select “Add to my order.” It will appear here.</p></div> : (
              <div className={styles.orderLines}>
                {lines.map((line) => {
                  const product = catalog.products.find((item) => item.id === line.productId);
                  return (
                    <article className={styles.orderLine} key={line.key}>
                      <div className={styles.orderLineHeading}><strong>{line.name}</strong><button type="button" onClick={() => remove(line.key)} aria-label={`Remove ${line.name}`}>Remove</button></div>
                      <div className={styles.orderLineFields}>
                        <label><span>Color</span><select value={line.color} onChange={(event) => update(line.key, "color", event.target.value)}>{product.colors.map((color) => <option key={color}>{color}</option>)}</select></label>
                        <label><span>Size</span><select value={line.size} onChange={(event) => update(line.key, "size", event.target.value)}>{product.sizes.map((size) => <option key={size}>{size}</option>)}</select></label>
                        <label><span>Qty</span><select value={line.quantity} onChange={(event) => update(line.key, "quantity", event.target.value)}>{[1,2,3,4,5,6,7,8,9,10].map((quantity) => <option key={quantity}>{quantity}</option>)}</select></label>
                      </div>
                      <p>{line.quantity} × {money(line.priceCents)} <strong>{money(line.quantity * line.priceCents)}</strong></p>
                    </article>
                  );
                })}
                <dl className={styles.totals}><div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div><div><dt>Tax</dt><dd>{money(tax)}</dd></div><div className={styles.total}><dt>Total</dt><dd>{money(total)}</dd></div></dl>
                <button className={styles.paymentButton} disabled={busy} onClick={beginPayment}>{busy ? "Preparing payment…" : `Continue to payment · ${money(total)}`}</button>
              </div>
            )}
            <div ref={paypalRef} className={styles.paypal} />
            {message ? <p className="portal-message">{message}</p> : null}
          </aside>
        </div>

        <p className={styles.assistance}>If required clothing creates a financial hardship, contact Mr. Parker. No student will be excluded.</p>
        <p className={styles.returnLink}><Link href={`/portal/band-ready/clothing?studentId=${encodeURIComponent(studentId)}&refresh=1`}>Return to Band Ready</Link></p>
        <p className={styles.srOnly} aria-live="polite">{announcement}</p>
      </section>
      {lines.length ? <button className={styles.mobileOrderBar} type="button" onClick={() => orderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><span><strong>{itemCount} {itemCount === 1 ? "item" : "items"}</strong><small>{money(total)} total</small></span><b>Review order ↑</b></button> : null}
    </main>
  );
}
