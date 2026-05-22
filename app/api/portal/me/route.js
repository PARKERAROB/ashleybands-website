import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [{ data: person, error: personError }, { data: links, error: linksError }] = await Promise.all([
    supabaseAdmin
      .from("portal_people")
      .select("id, display_name, person_type")
      .eq("id", session.personId)
      .maybeSingle(),
    supabaseAdmin
      .from("portal_student_people")
      .select("relationship_status, role, primary_contact, portal_students(id, display_name, preferred_first, grade_fall26, status, cell_phone)")
      .eq("person_id", session.personId)
      .eq("relationship_status", "trusted")
  ]);

  if (personError || linksError) {
    return NextResponse.json({ error: "Could not load portal profile." }, { status: 500 });
  }

  const students = (links || [])
    .map((link) => ({
      id: link.portal_students?.id,
      displayName: link.portal_students?.display_name,
      preferredFirst: link.portal_students?.preferred_first,
      grade: link.portal_students?.grade_fall26,
      status: link.portal_students?.status,
      cellPhone: link.portal_students?.cell_phone,
      relationshipStatus: link.relationship_status,
      role: link.role,
      primaryContact: link.primary_contact
    }))
    .filter((student) => student.id);

  return NextResponse.json({
    person,
    email: session.email,
    students
  });
}
