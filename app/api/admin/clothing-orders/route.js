import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";

export async function GET(request) {
  const staff = await validateStaffRequest(request);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("portal_clothing_orders")
    .select("id,subtotal_cents,tax_cents,total_cents,payment_status,submitted_at,portal_students(display_name),portal_clothing_order_items(product_name,color,size,quantity,unit_price_cents)")
    .order("submitted_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    actor: staffActor(staff), action: "view_fulfillment_orders",
    table: "portal_clothing_orders", route: "/api/admin/clothing-orders",
    changes: { order_count: (data || []).length }
  });
  return NextResponse.json({ orders: data || [] });
}
