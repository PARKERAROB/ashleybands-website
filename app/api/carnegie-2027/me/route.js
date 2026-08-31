import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { carnegieSubmissionStatus, latestCarnegieSubmissions, loadPortalCarnegieStudents } from "@/lib/carnegieTrip";

export const runtime = "nodejs";

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const students = await loadPortalCarnegieStudents(session.personId);
    const latest = await latestCarnegieSubmissions(students.map((student) => student.id));
    const rows = [];
    for (const student of students) {
      rows.push({
        id: student.id,
        displayName: student.display_name,
        ensemble: student.ensemble_2026 || "",
        schoolEmail: student.school_email || "",
        status: await carnegieSubmissionStatus(latest[student.id] || null),
      });
    }
    const { data: person } = await supabaseAdmin.from("portal_people")
      .select("display_name").eq("id", session.personId).maybeSingle();
    return NextResponse.json({
      students: rows,
      guardian: { name: person?.display_name || "", email: session.email || "" },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the Carnegie commitment." }, { status: 500 });
  }
}
