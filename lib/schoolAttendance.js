import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  attendanceRegisterFileHash,
  parseAttendanceRegisterPdf,
  protectedStudentIdentifier
} from "@/lib/infiniteCampusAttendanceParser.mjs";

function text(value) {
  return String(value || "").trim();
}

function normalizeName(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sourceNameKey(value) {
  const [last = "", firstAndMiddle = ""] = text(value).split(",", 2);
  const firstParts = normalizeName(firstAndMiddle).split(" ").filter(Boolean);
  if (firstParts.length > 1 && firstParts.at(-1).length === 1) firstParts.pop();
  return `${firstParts.join(" ")}|${normalizeName(last)}`;
}

function studentNameKey(student) {
  return `${normalizeName(student.legal_first)}|${normalizeName(student.legal_last)}`;
}

function legalName(student) {
  return [student.legal_first, student.legal_last].filter(Boolean).join(" ").trim()
    || student.display_name;
}

function identifierSecret() {
  const secret = process.env.ATTENDANCE_IDENTIFIER_SECRET;
  if (!secret) throw new Error("Protected attendance identifier storage is not configured.");
  return secret;
}

function rowKey(identifierHash, sectionCode) {
  return `${identifierHash}:${sectionCode}`;
}

async function matchContext() {
  const [studentsResult, identifiersResult] = await Promise.all([
    supabaseAdmin
      .from("portal_students")
      .select("id,display_name,legal_first,legal_last,grade_fall26,status")
      .eq("status", "active")
      .order("legal_last", { ascending: true })
      .order("legal_first", { ascending: true })
      .limit(500),
    supabaseAdmin
      .from("portal_student_external_identifiers")
      .select("student_id,identifier_hash")
      .eq("authority", "NHCS")
      .eq("identifier_type", "student_number")
  ]);
  if (studentsResult.error || identifiersResult.error) {
    throw studentsResult.error || identifiersResult.error;
  }
  const students = studentsResult.data || [];
  const activeById = new Map(students.map((student) => [student.id, student]));
  const byIdentifier = new Map(
    (identifiersResult.data || [])
      .filter((row) => activeById.has(row.student_id))
      .map((row) => [row.identifier_hash, row.student_id])
  );
  const byName = new Map();
  for (const student of students) {
    const key = studentNameKey(student);
    if (!key || key === "|") continue;
    const current = byName.get(key) || [];
    current.push(student.id);
    byName.set(key, current);
  }
  return { students, activeById, byIdentifier, byName };
}

function publicStudent(student) {
  return student ? {
    id: student.id,
    displayName: student.display_name,
    legalName: legalName(student),
    grade: text(student.grade_fall26) || "Not listed"
  } : null;
}

export async function buildSchoolAttendancePreview(bytes) {
  const parsed = await parseAttendanceRegisterPdf(bytes);
  if (parsed.issues.length) {
    const invalid = new Error("The register contains source rows or codes that need review before import.");
    invalid.status = 422;
    invalid.details = parsed.issues;
    throw invalid;
  }
  const fileHash = attendanceRegisterFileHash(bytes);
  const { data: accepted, error: acceptedError } = await supabaseAdmin
    .from("school_attendance_imports")
    .select("id,accepted_at")
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (acceptedError) throw acceptedError;
  if (accepted) {
    return {
      fileHash,
      alreadyAccepted: true,
      importId: accepted.id,
      acceptedAt: accepted.accepted_at,
      metadata: {
        generatedLocal: parsed.generatedLocal,
        generatedAt: parsed.generatedAt,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd
      }
    };
  }

  const context = await matchContext();
  const secret = identifierSecret();
  const sections = new Map(parsed.sections.map((section) => [section.sourceSectionCode, section.name]));
  const rows = parsed.students.map((sourceStudent) => {
    const identifier = protectedStudentIdentifier(sourceStudent.sourceStudentNumber, secret);
    const protectedMatchId = context.byIdentifier.get(identifier.hash);
    const exactNameIds = context.byName.get(sourceNameKey(sourceStudent.sourceStudentName)) || [];
    const suggestedId = exactNameIds.length === 1 ? exactNameIds[0] : null;
    const matchedId = protectedMatchId || suggestedId;
    return {
      rowKey: rowKey(identifier.hash, sourceStudent.sourceSectionCode),
      sourceName: sourceStudent.sourceStudentName,
      sourceStudentLast4: identifier.last4,
      sectionCode: sourceStudent.sourceSectionCode,
      sectionName: sections.get(sourceStudent.sourceSectionCode) || sourceStudent.sourceSectionCode,
      sourcePage: sourceStudent.sourcePage,
      matchStatus: protectedMatchId ? "automatic" : suggestedId ? "suggested" : "unresolved",
      proposedStudent: publicStudent(context.activeById.get(matchedId))
    };
  });
  return {
    fileHash,
    alreadyAccepted: false,
    metadata: {
      generatedLocal: parsed.generatedLocal,
      generatedAt: parsed.generatedAt,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      throughDate: parsed.throughDate,
      latestExplicitMarkDate: parsed.latestExplicitMarkDate,
      term: parsed.term,
      schedule: parsed.schedule,
      schoolYear: parsed.schoolYear,
      pageCount: parsed.pageCount,
      sectionCount: parsed.sections.length,
      rosterRowCount: parsed.students.length,
      markCount: parsed.marks.length
    },
    sections: parsed.sections.map((section) => ({
      code: section.sourceSectionCode,
      name: section.name,
      sequence: section.sequence
    })),
    rows,
    candidates: context.students.map(publicStudent),
    counts: {
      automatic: rows.filter((row) => row.matchStatus === "automatic").length,
      suggested: rows.filter((row) => row.matchStatus === "suggested").length,
      unresolved: rows.filter((row) => row.matchStatus === "unresolved").length
    }
  };
}

export async function acceptSchoolAttendanceImport(bytes, {
  actorStaffId,
  acceptSuggestions = false,
  completeSections = false,
  manualMappings = {}
}) {
  if (!completeSections) {
    const invalid = new Error("Confirm that the PDF includes the full roster for each shown class section.");
    invalid.status = 409;
    throw invalid;
  }
  const parsed = await parseAttendanceRegisterPdf(bytes);
  if (parsed.issues.length) {
    const invalid = new Error("The register contains source rows or codes that need review before import.");
    invalid.status = 422;
    throw invalid;
  }
  const context = await matchContext();
  const secret = identifierSecret();
  const resolvedByRow = new Map();
  const studentByIdentifier = new Map();
  const identifierByStudent = new Map();
  const studentBySection = new Map();
  const roster = [];

  for (const sourceStudent of parsed.students) {
    const identifier = protectedStudentIdentifier(sourceStudent.sourceStudentNumber, secret);
    const key = rowKey(identifier.hash, sourceStudent.sourceSectionCode);
    const protectedMatchId = context.byIdentifier.get(identifier.hash);
    const exactNameIds = context.byName.get(sourceNameKey(sourceStudent.sourceStudentName)) || [];
    const suggestedId = exactNameIds.length === 1 ? exactNameIds[0] : null;
    const manualId = text(manualMappings[key]);
    if (manualId && !context.activeById.has(manualId)) {
      const invalid = new Error(`Choose a current student for ${sourceStudent.sourceStudentName}.`);
      invalid.status = 400;
      throw invalid;
    }
    const portalStudentId = manualId || protectedMatchId || (acceptSuggestions ? suggestedId : null);
    if (!portalStudentId) {
      const invalid = new Error(`Resolve ${sourceStudent.sourceStudentName} before accepting the register.`);
      invalid.status = 409;
      throw invalid;
    }
    const priorStudent = studentByIdentifier.get(identifier.hash);
    if (priorStudent && priorStudent !== portalStudentId) {
      const invalid = new Error(`${sourceStudent.sourceStudentName} is connected inconsistently across class sections.`);
      invalid.status = 409;
      throw invalid;
    }
    studentByIdentifier.set(identifier.hash, portalStudentId);
    const priorIdentifier = identifierByStudent.get(portalStudentId);
    if (priorIdentifier && priorIdentifier !== identifier.hash) {
      const invalid = new Error("Two different district identifiers cannot be connected to the same student.");
      invalid.status = 409;
      throw invalid;
    }
    identifierByStudent.set(portalStudentId, identifier.hash);
    const sectionStudentKey = `${sourceStudent.sourceSectionCode}:${portalStudentId}`;
    if (studentBySection.has(sectionStudentKey)) {
      const invalid = new Error("A student can appear only once in the same class section.");
      invalid.status = 409;
      throw invalid;
    }
    studentBySection.set(sectionStudentKey, true);
    resolvedByRow.set(key, portalStudentId);
    roster.push({
      source_student_hash: identifier.hash,
      source_student_last4: identifier.last4,
      source_student_name: sourceStudent.sourceStudentName,
      source_section_code: sourceStudent.sourceSectionCode,
      portal_student_id: portalStudentId,
      match_method: manualId
        ? "manual"
        : protectedMatchId
          ? "protected_identifier"
          : "confirmed_exact_name",
      source_page: sourceStudent.sourcePage
    });
  }

  const marks = parsed.marks.map((mark) => {
    const identifier = protectedStudentIdentifier(mark.sourceStudentNumber, secret);
    const portalStudentId = resolvedByRow.get(rowKey(identifier.hash, mark.sourceSectionCode));
    if (!portalStudentId) {
      const invalid = new Error("Every marked source row must be connected before accepting the register.");
      invalid.status = 409;
      throw invalid;
    }
    return {
      source_student_hash: identifier.hash,
      source_section_code: mark.sourceSectionCode,
      portal_student_id: portalStudentId,
      attendance_date: mark.attendanceDate,
      code: mark.code,
      meaning: mark.meaning,
      source_page: mark.sourcePage,
      source_column: mark.sourceColumn
    };
  });
  const payload = {
    file_hash: attendanceRegisterFileHash(bytes),
    parser_version: parsed.parserVersion,
    generated_local: parsed.generatedLocal,
    generated_at: parsed.generatedAt,
    period_start: parsed.periodStart,
    period_end: parsed.periodEnd,
    through_date: parsed.throughDate || "",
    latest_explicit_mark_date: parsed.latestExplicitMarkDate || "",
    term: parsed.term,
    schedule: parsed.schedule,
    school_year: parsed.schoolYear,
    page_count: parsed.pageCount,
    sections: parsed.sections.map((section) => ({
      sequence: section.sequence,
      source_section_code: section.sourceSectionCode,
      name: section.name,
      source_complete: completeSections
    })),
    roster,
    dates: parsed.dates.map((date) => ({
      attendance_date: date.attendanceDate,
      source_column: date.sourceColumn
    })),
    marks,
    issues: []
  };
  const { data, error } = await supabaseAdmin.rpc("accept_school_attendance_import", {
    p_payload: payload,
    p_actor_staff_id: actorStaffId
  });
  if (error) throw error;
  return data;
}

export async function loadSchoolAttendanceWorkspace({ studentId = "" } = {}) {
  const [importsResult, currentSectionsResult] = await Promise.all([
    supabaseAdmin
    .from("school_attendance_imports")
    .select("id,status,generated_local,generated_at,period_start,period_end,through_date,latest_explicit_mark_date,term,schedule,school_year,page_count,section_count,roster_row_count,mark_count,issue_count,accepted_at")
    .order("generated_at", { ascending: false })
    .order("accepted_at", { ascending: false })
    .limit(25),
    supabaseAdmin
    .from("school_attendance_import_sections")
    .select("id,import_id,source_section_code,name,sequence,linked_section_id,school_year,source_generated_at,source_through_date,school_attendance_imports!inner(id,status,generated_local,generated_at,period_start,period_end,through_date,latest_explicit_mark_date,term,schedule,school_year,page_count,accepted_at)")
    .eq("status", "current")
    .order("sequence", { ascending: true })
  ]);
  if (importsResult.error || currentSectionsResult.error) {
    throw importsResult.error || currentSectionsResult.error;
  }
  const imports = importsResult.data || [];
  const allCurrentSectionRows = currentSectionsResult.data || [];
  const newestCurrentSection = [...allCurrentSectionRows]
    .sort((a, b) => String(b.source_through_date).localeCompare(String(a.source_through_date))
      || String(b.source_generated_at).localeCompare(String(a.source_generated_at)))[0];
  const activeSchoolYear = newestCurrentSection?.school_year || "";
  const currentSectionRows = activeSchoolYear
    ? allCurrentSectionRows.filter((row) => row.school_year === activeSchoolYear)
    : [];
  const currentImportIds = [...new Set(currentSectionRows.map((row) => row.import_id))];
  const currentPairs = new Set(currentSectionRows.map((row) => `${row.import_id}:${row.source_section_code}`));
  const sourceImport = (row) => Array.isArray(row.school_attendance_imports)
    ? row.school_attendance_imports[0]
    : row.school_attendance_imports;
  const currentImports = [...new Map(currentSectionRows
    .map((row) => sourceImport(row))
    .filter(Boolean)
    .map((item) => [item.id, item])).values()]
    .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)));
  const latest = currentImports[0] || null;

  let markQuery = Promise.resolve({ data: [], error: null });
  if (currentImportIds.length) markQuery = supabaseAdmin
    .from("school_attendance_marks")
    .select("id,import_id,portal_student_id,source_section_code,attendance_date,code,meaning,portal_students!inner(display_name,legal_first,legal_last,grade_fall26)")
    .in("import_id", currentImportIds)
    .order("attendance_date", { ascending: false });
  if (studentId && currentImportIds.length) markQuery = markQuery.eq("portal_student_id", studentId);
  const rosterQuery = currentImportIds.length ? supabaseAdmin
    .from("school_attendance_import_roster")
    .select("import_id,portal_student_id,source_section_code,portal_students!inner(display_name,legal_first,legal_last,grade_fall26)")
    .in("import_id", currentImportIds) : Promise.resolve({ data: [], error: null });
  const studentQuery = studentId ? supabaseAdmin
    .from("portal_students")
    .select("id,display_name,legal_first,legal_last,grade_fall26")
    .eq("id", studentId)
    .maybeSingle() : Promise.resolve({ data: null, error: null });
  const [markResult, rosterResult, studentResult] = await Promise.all([markQuery, rosterQuery, studentQuery]);
  if (markResult.error || rosterResult.error || studentResult.error) {
    throw markResult.error || rosterResult.error || studentResult.error;
  }
  const currentRoster = (rosterResult.data || [])
    .filter((row) => currentPairs.has(`${row.import_id}:${row.source_section_code}`));
  const currentMarks = (markResult.data || [])
    .filter((row) => currentPairs.has(`${row.import_id}:${row.source_section_code}`));
  const rosterCounts = new Map();
  for (const row of currentRoster) {
    rosterCounts.set(row.source_section_code, (rosterCounts.get(row.source_section_code) || 0) + 1);
  }
  const sections = currentSectionRows.map((section) => ({
    code: section.source_section_code,
    name: section.name,
    linkedSectionId: section.linked_section_id,
    rosterCount: rosterCounts.get(section.source_section_code) || 0,
    throughDate: sourceImport(section)?.through_date || section.source_through_date,
    generatedLocal: sourceImport(section)?.generated_local || "",
    generatedAt: sourceImport(section)?.generated_at || section.source_generated_at
  }));
  const coverageDates = sections.map((section) => section.throughDate).filter(Boolean).sort();
  const marks = currentMarks.map((mark) => ({
    id: mark.id,
    studentId: mark.portal_student_id,
    studentName: mark.portal_students?.display_name,
    grade: text(mark.portal_students?.grade_fall26) || "Not listed",
    sectionCode: mark.source_section_code,
    attendanceDate: mark.attendance_date,
    code: mark.code,
    meaning: mark.meaning
  }));
  return {
    imports,
    latest,
    coverage: coverageDates.length ? {
      from: coverageDates[0],
      through: coverageDates.at(-1)
    } : null,
    sections,
    marks,
    student: studentResult.data ? {
      id: studentId,
      displayName: studentResult.data.display_name,
      grade: text(studentResult.data.grade_fall26) || "Not listed"
    } : null
  };
}
