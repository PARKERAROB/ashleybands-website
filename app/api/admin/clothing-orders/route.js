import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.BILLING_READ, { scope: { type: "global" } });
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;
  try {
    const { data, error } = await supabaseAdmin.from("portal_clothing_orders")
      .select("id,subtotal_cents,tax_cents,total_cents,payment_status,submitted_at,portal_students(display_name),portal_clothing_order_items(product_name,color,size,quantity,unit_price_cents)")
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    await logAuditRequired({
      actor: staffActor(staff), action: "view_fulfillment_orders",
      table: "portal_clothing_orders", route: "/api/admin/clothing-orders",
      changes: { order_count: (data || []).length }
    });
    return privateJson({ orders: data || [] });
  } catch (error) {
    return privateServerError("clothing-orders", error, "Clothing orders could not be loaded or durably attributed.");
  }
}
