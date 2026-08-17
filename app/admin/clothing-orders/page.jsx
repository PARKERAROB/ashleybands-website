"use client";
import { useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
const money = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;
export default function Page() { return <StaffGate>{(session) => <Orders session={session} />}</StaffGate>; }
function Orders({ session }) {
  const [orders,setOrders]=useState([]); const [error,setError]=useState("");
  useEffect(()=>{fetch("/api/admin/clothing-orders",{headers:{"x-staff-id":session.id,"x-staff-token":session.token}}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);setOrders(b.orders||[])}).catch(e=>setError(e.message))},[session]);
  const paid=orders.filter(o=>o.payment_status==="paid");
  return <main className="portal-shell"><section className="portal-panel portal-panel-wide"><p className="eyebrow">Staff only</p><h1>Open House Clothing Orders</h1><p>{paid.length} paid orders · {paid.reduce((s,o)=>s+o.portal_clothing_order_items.reduce((a,i)=>a+i.quantity,0),0)} items · {money(paid.reduce((s,o)=>s+o.total_cents,0))} collected</p>{error?<p className="portal-message error">{error}</p>:null}<div className="portal-review-list">{orders.map(o=><article className="portal-review-card" key={o.id}><p className="portal-label">{o.payment_status}</p><h2>{o.portal_students?.display_name}</h2><p>{money(o.subtotal_cents)} + {money(o.tax_cents)} tax = {money(o.total_cents)}</p><ul>{o.portal_clothing_order_items.map((i,n)=><li key={n}>{i.quantity} × {i.product_name} — {i.color}, {i.size}</li>)}</ul></article>)}</div></section></main>;
}

