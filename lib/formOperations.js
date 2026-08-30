import { supabaseAdmin } from "@/lib/supabaseAdmin";

function one(row, key) {
  return Array.isArray(row?.[key]) ? row[key][0] || null : row?.[key] || null;
}

function group(rows, key) {
  return (rows || []).reduce((result, row) => {
    (result[row[key]] ||= []).push(row);
    return result;
  }, {});
}

function dateActive(requirement, today) {
  if (!requirement.active) return false;
  if (requirement.starts_on && requirement.starts_on > today) return false;
  if (requirement.ends_on && requirement.ends_on < today) return false;
  return true;
}

function stateLabel(state) {
  return {
    not_started: "Not started",
    submitted: "Submitted",
    needs_review: "Needs review",
    needs_correction: "Needs correction",
    complete: "Complete",
    waived: "Waived",
    not_required: "Not required",
    reopened: "Reopened",
  }[state] || state;
}

export async function loadFormOperations() {
  const today = new Date().toISOString().slice(0, 10);
  const [studentsResult, requirementsResult] = await Promise.all([
    supabaseAdmin.from("portal_students")
      .select("id,display_name,legal_first,legal_last,preferred_first,grade_fall26,status,updated_at")
      .eq("status", "active")
      .order("legal_last", { ascending: true })
      .order("legal_first", { ascending: true })
      .limit(500),
    supabaseAdmin.from("form_requirements")
      .select("id,school_year,scope_type,scope_ref,starts_on,due_on,ends_on,active,source_label,updated_at,form_definitions(id,code,title,description,owner_label,active),form_versions(id,version,delivery_type,action_href,source_label,is_sensitive)")
      .eq("active", true),
  ]);
  if (studentsResult.error || requirementsResult.error) throw new Error("Could not load form requirements.");

  const students = studentsResult.data || [];
  const requirements = (requirementsResult.data || []).filter((row) => dateActive(row, today));
  const studentIds = students.map((student) => student.id);
  const requirementIds = requirements.map((requirement) => requirement.id);
  const groupIds = requirements.filter((row) => row.scope_type === "group").map((row) => row.scope_ref).filter(Boolean);

  const [statusResult, onboardingResult, requestResult, membershipResult, musicProfileResult] = await Promise.all([
    requirementIds.length && studentIds.length
      ? supabaseAdmin.from("student_form_requirements")
        .select("id,requirement_id,student_id,state,completion_mode,source_ref,next_action,submitted_at,reviewed_at,completed_at,waived_at,note_summary,updated_at")
        .in("requirement_id", requirementIds)
        .in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabaseAdmin.from("portal_onboarding_completions")
        .select("student_id,form_version,first_submitted_at,last_confirmed_at,revision")
        .in("student_id", studentIds)
        .order("last_confirmed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabaseAdmin.from("portal_instrument_requests")
        .select("id,student_id,status,school_year,responsibility_accepted,agreement_version,submitted_at,updated_at")
        .in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabaseAdmin.from("program_memberships")
        .select("student_id,group_id")
        .in("group_id", groupIds)
        .is("ends_on", null)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabaseAdmin.from("portal_student_music_profiles")
        .select("student_id,instrument_access")
        .in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [statusResult, onboardingResult, requestResult, membershipResult, musicProfileResult]) {
    if (result.error) throw new Error("Could not load form requirements.");
  }

  const studentRequirementIds = (statusResult.data || []).map((row) => row.id);
  const referenceResult = studentRequirementIds.length
    ? await supabaseAdmin.from("form_submission_references")
      .select("id,student_requirement_id,reference_type,source_table,source_record_id,received_at,received_by_staff_id,created_at")
      .in("student_requirement_id", studentRequirementIds)
      .order("received_at", { ascending: false })
    : { data: [], error: null };
  if (referenceResult.error) throw new Error("Could not load form evidence.");
  const referencesByRequirement = group(referenceResult.data, "student_requirement_id");

  const explicitByPair = new Map((statusResult.data || []).map((row) => [`${row.requirement_id}:${row.student_id}`, row]));
  const onboardingByStudent = new Map();
  for (const row of onboardingResult.data || []) if (!onboardingByStudent.has(row.student_id)) onboardingByStudent.set(row.student_id, row);
  const requestsByStudent = group(requestResult.data, "student_id");
  const musicProfileByStudent = new Map((musicProfileResult.data || []).map((row) => [row.student_id, row]));
  const membersByGroup = group(membershipResult.data, "group_id");
  const studentById = new Map(students.map((student) => [student.id, student]));
  const rows = [];

  for (const requirement of requirements) {
    const definition = one(requirement, "form_definitions");
    const version = one(requirement, "form_versions");
    if (!definition?.active || !version) continue;
    let applicable = [];
    if (requirement.scope_type === "all_active") applicable = students;
    if (requirement.scope_type === "student") applicable = [studentById.get(requirement.scope_ref)].filter(Boolean);
    if (requirement.scope_type === "group") applicable = (membersByGroup[requirement.scope_ref] || []).map((row) => studentById.get(row.student_id)).filter(Boolean);
    if (requirement.scope_type === "instrument_request") {
      applicable = students.filter((student) => (requestsByStudent[student.id] || [])
        .some((request) => !requirement.school_year || request.school_year === requirement.school_year)
        || musicProfileByStudent.get(student.id)?.instrument_access === "school");
    }

    for (const student of applicable) {
      const explicit = explicitByPair.get(`${requirement.id}:${student.id}`) || null;
      let derived = null;
      if (definition.code === "career-onboarding") {
        const completion = onboardingByStudent.get(student.id);
        if (completion) derived = {
          state: "complete", sourceRef: `portal_onboarding_completions:${student.id}`,
          completedAt: completion.last_confirmed_at, updatedAt: completion.last_confirmed_at,
          nextAction: "", systemOwned: true,
        };
      }
      if (definition.code === "county-instrument-agreement") {
        const request = (requestsByStudent[student.id] || [])
          .filter((item) => !requirement.school_year || item.school_year === requirement.school_year)
          .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))[0];
        if (request) derived = {
          state: request.responsibility_accepted ? "complete" : "submitted",
          sourceRef: `portal_instrument_requests:${request.id}`,
          submittedAt: request.submitted_at,
          completedAt: request.responsibility_accepted ? request.submitted_at : null,
          updatedAt: request.updated_at || request.submitted_at,
          nextAction: request.status === "submitted" ? "Open instrument fulfillment" : "",
          actionHref: request.status === "submitted" ? "/admin/instrument-inventory" : "",
          fulfillmentLabel: {
            submitted: "Awaiting instrument assignment",
            assigned: "Instrument assigned",
            returned: "Instrument returned",
            cancelled: "Request cancelled",
          }[request.status] || "Fulfillment status not listed",
          systemOwned: true,
        };
      }
      const current = derived || explicit || {
        state: "not_started", completion_mode: version.delivery_type,
        next_action: version.delivery_type === "portal" ? "Waiting on the family workflow" : "Record status",
      };
      const state = current.state || "not_started";
      rows.push({
        id: explicit?.id || `virtual:${requirement.id}:${student.id}`,
        requirementId: requirement.id,
        student: {
          id: student.id,
          displayName: student.display_name,
          legalFirst: student.legal_first || "",
          legalLast: student.legal_last || "",
          preferredFirst: student.preferred_first || "",
          grade: student.grade_fall26 || "",
        },
        definition: {
          id: definition.id,
          code: definition.code,
          title: definition.code === "county-instrument-agreement" ? "School instrument acknowledgement" : definition.title,
          description: definition.code === "county-instrument-agreement"
            ? "AshleyBands care acknowledgement for a requested school instrument. Assignment is tracked separately."
            : definition.description,
          owner: definition.owner_label,
        },
        version: version.version,
        deliveryType: version.delivery_type,
        actionHref: derived?.actionHref || (version.delivery_type === "portal" ? "" : version.action_href),
        sensitive: Boolean(version.is_sensitive),
        schoolYear: requirement.school_year,
        dueOn: requirement.due_on,
        scopeType: requirement.scope_type,
        source: requirement.source_label || version.source_label,
        state,
        stateLabel: stateLabel(state),
        sourceRef: derived?.sourceRef || explicit?.source_ref || "",
        nextAction: derived?.nextAction ?? explicit?.next_action ?? current.next_action ?? "",
        fulfillmentLabel: derived?.fulfillmentLabel || "",
        submittedAt: derived?.submittedAt || explicit?.submitted_at || null,
        reviewedAt: explicit?.reviewed_at || null,
        completedAt: derived?.completedAt || explicit?.completed_at || null,
        updatedAt: derived?.updatedAt || explicit?.updated_at || requirement.updated_at,
        noteSummary: explicit?.note_summary || "",
        references: explicit ? referencesByRequirement[explicit.id] || [] : [],
        systemOwned: version.delivery_type === "portal" || Boolean(derived?.systemOwned),
      });
    }
  }

  const definitions = requirements.map((requirement) => {
    const definition = one(requirement, "form_definitions");
    const version = one(requirement, "form_versions");
    return definition && version ? {
      requirementId: requirement.id,
      code: definition.code,
      title: definition.title,
      deliveryType: version.delivery_type,
      schoolYear: requirement.school_year,
      source: requirement.source_label,
    } : null;
  }).filter(Boolean);

  return {
    rows,
    definitions,
    students: students.map((student) => ({
      id: student.id, displayName: student.display_name, grade: student.grade_fall26 || "",
    })),
    summary: rows.reduce((result, row) => {
      result.total += 1;
      if (["complete", "waived", "not_required"].includes(row.state)) result.complete += 1;
      else if (["submitted", "needs_review"].includes(row.state)) result.review += 1;
      else result.action += 1;
      return result;
    }, { total: 0, action: 0, review: 0, complete: 0 }),
    updatedAt: rows.map((row) => row.updatedAt).filter(Boolean).sort().at(-1) || null,
  };
}
