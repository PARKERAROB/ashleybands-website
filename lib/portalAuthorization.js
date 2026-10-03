import { readPortalSession } from "@/lib/portalTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { personWithinActorStudents } from "@/lib/portalPersonScope.mjs";

export async function authorizePortalStudentRequest(request, studentId, { strong = false } = {}) {
  const session = readPortalSession(request);
  if (!session?.personId) return { ok: false, status: 401, error: "Not signed in." };
  if (!studentId) return { ok: false, status: 400, error: "Choose a student." };

  const { data: relationship, error } = await supabaseAdmin
    .from("portal_student_people")
    .select("id,student_id,person_id,role,relationship_status,assurance_level,trust_source")
    .eq("person_id", session.personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: "Family access could not be verified." };
  if (!relationship) return { ok: false, status: 403, error: "Not authorized for this student." };
  if (strong && !["medium", "high"].includes(relationship.assurance_level)) {
    return {
      ok: false,
      status: 403,
      code: "STRONG_RELATIONSHIP_REQUIRED",
      error: "This family connection must be verified before onboarding can be opened."
    };
  }

  const [{ data: person }, { data: student }] = await Promise.all([
    supabaseAdmin.from("portal_people").select("id,person_type,display_name").eq("id", session.personId).maybeSingle(),
    supabaseAdmin
      .from("portal_students")
      .select("id,source_student_id,legal_first,legal_last,preferred_first,display_name,grade_fall26,school_email,cell_phone,status,source,updated_at")
      .eq("id", studentId)
      .maybeSingle()
  ]);

  if (!person || !student || String(student.status || "").toLowerCase() !== "active") {
    return { ok: false, status: 404, error: "Current student record not found." };
  }

  return { ok: true, session, relationship, person, student };
}

// True when the actor may change this person's shared name and contact methods: every open
// student link of the person is to a student the actor holds a trusted medium or high link to.
export async function personWithinActorFamily(actorPersonId, targetPersonId) {
  if (actorPersonId && actorPersonId === targetPersonId) return true;
  const [{ data: targetLinks, error: targetError }, { data: actorLinks, error: actorError }] = await Promise.all([
    supabaseAdmin.from("portal_student_people").select("student_id,relationship_status").eq("person_id", targetPersonId),
    supabaseAdmin.from("portal_student_people").select("student_id,relationship_status,assurance_level").eq("person_id", actorPersonId)
  ]);
  if (targetError || actorError) return false;
  return personWithinActorStudents(targetLinks || [], actorLinks || []);
}

const CLOSED_CONTACT_FILTER = "(hard_bounce,replaced,superseded)";

// The onboarding family step links each guardian entry to an existing person (by personId
// on this student, else by email) and then writes that entry's name and contacts onto the
// person. For a person shared with students outside the actor's family, keep their stored
// name and refuse new contact methods. Mirrors portal_save_onboarding_step step 3.
export async function scopeOnboardingGuardians(actorPersonId, studentId, payload) {
  const guardians = Array.isArray(payload?.guardians) ? payload.guardians : null;
  if (!guardians) return { payload };
  const scoped = [];
  for (const entry of guardians) {
    const email = String(entry?.email || "").trim().slice(0, 320).toLowerCase();
    let personId = null;
    if (String(entry?.personId || "").trim()) {
      const { data } = await supabaseAdmin
        .from("portal_student_people")
        .select("person_id,portal_people!inner(person_type)")
        .eq("student_id", studentId)
        .eq("person_id", String(entry.personId).trim())
        .neq("portal_people.person_type", "student")
        .not("relationship_status", "in", "(rejected,superseded)")
        .limit(1)
        .maybeSingle();
      personId = data?.person_id || null;
    }
    if (!personId && email) {
      const { data } = await supabaseAdmin
        .from("portal_contact_methods")
        .select("person_id,portal_people!inner(person_type)")
        .eq("contact_type", "email")
        .eq("value_normalized", email)
        .not("verification_status", "in", CLOSED_CONTACT_FILTER)
        .neq("portal_people.person_type", "student")
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      personId = data?.person_id || null;
    }
    if (!personId || await personWithinActorFamily(actorPersonId, personId)) {
      scoped.push(entry);
      continue;
    }

    // Email is a sign-in route, so a shared person never gains one from another family's form.
    const [{ data: person }, { data: emails }] = await Promise.all([
      supabaseAdmin.from("portal_people").select("display_name").eq("id", personId).maybeSingle(),
      supabaseAdmin.from("portal_contact_methods").select("value_normalized").eq("person_id", personId).eq("contact_type", "email")
    ]);
    if (email && !(emails || []).some((row) => row.value_normalized === email)) {
      return {
        error: "One guardian is also connected to another student, so their email can only be kept as it is here. Email Mr. Parker to change it."
      };
    }
    scoped.push({ ...entry, name: person?.display_name || entry.name });
  }
  return { payload: { ...payload, guardians: scoped } };
}
