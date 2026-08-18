import { NextResponse } from "next/server";
import { isTrustedGuardian } from "@/lib/billing";
import { clothingTotals, CLOTHING_DEADLINE, CLOTHING_TAX_RATE, OPEN_HOUSE_CLOTHING } from "@/lib/openHouseClothing";
import { createOrder, isPaypalConfigured } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const [{ data: links, error: linkError }, { data: orders, error: orderError }] = await Promise.all([
    supabaseAdmin
      .from("portal_student_people")
      .select("student_id, portal_students(id, display_name)")
      .eq("person_id", session.personId)
      .eq("relationship_status", "trusted"),
    supabaseAdmin
      .from("portal_clothing_orders")
      .select("id, student_id, subtotal_cents, tax_cents, total_cents, payment_status, submitted_at, portal_clothing_order_items(product_name,color,size,quantity,unit_price_cents)")
      .eq("submitted_by_person_id", session.personId)
      .order("submitted_at", { ascending: false })
  ]);
  if (linkError || orderError) return NextResponse.json({ error: "Could not load the clothing order." }, { status: 500 });
  const students = (links || []).map((link) => {
    const student = Array.isArray(link.portal_students) ? link.portal_students[0] : link.portal_students;
    return student ? { id: student.id, displayName: student.display_name } : null;
  }).filter(Boolean);
  return NextResponse.json({ students, products: OPEN_HOUSE_CLOTHING, deadline: CLOTHING_DEADLINE, taxRate: CLOTHING_TAX_RATE, paymentsEnabled: isPaypalConfigured(), orders: orders || [] });
}

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (Date.now() > new Date(CLOTHING_DEADLINE).getTime()) return NextResponse.json({ error: "The bulk-order deadline has passed." }, { status: 410 });
  if (!isPaypalConfigured()) return NextResponse.json({ error: "Portal payment is not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "");
  if (!(await isTrustedGuardian(session.personId, studentId))) return NextResponse.json({ error: "Student access not found." }, { status: 403 });

  const catalog = new Map(OPEN_HOUSE_CLOTHING.map((product) => [product.id, product]));
  const lines = [];
  for (const raw of Array.isArray(body.items) ? body.items : []) {
    const product = catalog.get(String(raw.productId || ""));
    const color = String(raw.color || "");
    const size = String(raw.size || "");
    const quantity = Math.round(Number(raw.quantity) || 0);
    if (!product || !product.colors.includes(color) || !product.sizes.includes(size) || quantity < 1 || quantity > 20) continue;
    lines.push({ productId: product.id, productName: product.name, color, size, quantity, priceCents: product.priceCents });
  }
  if (!lines.length) return NextResponse.json({ error: "Add at least one clothing item." }, { status: 400 });
  const totals = clothingTotals(lines);
  const { data: order, error } = await supabaseAdmin.from("portal_clothing_orders").insert({
    student_id: studentId, submitted_by_person_id: session.personId,
    subtotal_cents: totals.subtotalCents, tax_rate: CLOTHING_TAX_RATE,
    tax_cents: totals.taxCents, total_cents: totals.totalCents
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Could not create the clothing order." }, { status: 500 });
  await supabaseAdmin.from("portal_clothing_order_items").insert(lines.map((line) => ({
    order_id: order.id, product_key: line.productId, product_name: line.productName,
    color: line.color, size: line.size, quantity: line.quantity, unit_price_cents: line.priceCents
  })));
  try {
    const paypal = await createOrder({ amountCents: totals.totalCents, studentId, invoiceId: `CLOTH-${order.id}`, description: "Ashley Bands Open House clothing order" });
    await supabaseAdmin.from("portal_clothing_orders").update({ paypal_order_id: paypal.id }).eq("id", order.id);
    return NextResponse.json({ orderId: paypal.id, clothingOrderId: order.id });
  } catch {
    await supabaseAdmin.from("portal_clothing_orders").update({ payment_status: "failed" }).eq("id", order.id);
    return NextResponse.json({ error: "Could not start portal payment." }, { status: 502 });
  }
}
