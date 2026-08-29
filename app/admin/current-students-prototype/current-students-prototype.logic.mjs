function lastName(student) {
  return student.legalName.trim().split(/\s+/).at(-1) || "";
}

function ensembleKey(student) {
  return [...student.ensembles].sort((a, b) => a.localeCompare(b)).join(" · ");
}

export function compareStudents(a, b, sortBy) {
  const direction = sortBy.endsWith("-desc") ? -1 : 1;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  let comparison = 0;

  if (sortBy.startsWith("last")) comparison = collator.compare(lastName(a), lastName(b));
  else if (sortBy.startsWith("first")) comparison = collator.compare(a.displayName, b.displayName);
  else if (sortBy.startsWith("grade")) {
    const gradeValue = (student) => student.grade === "Beyond 12" ? 13 : Number(student.grade);
    comparison = gradeValue(a) - gradeValue(b);
  } else if (sortBy.startsWith("ensemble")) comparison = collator.compare(ensembleKey(a), ensembleKey(b));
  else if (sortBy.startsWith("instrument")) comparison = collator.compare(a.programInstrument, b.programInstrument);
  else if (sortBy === "needs-desc") comparison = a.needs.length - b.needs.length;

  return comparison * direction || collator.compare(lastName(a), lastName(b)) || collator.compare(a.displayName, b.displayName);
}

export function emailValuesForStudents(students, axis) {
  return [...new Set(students.flatMap((student) => {
    if (axis === "student") return [student.schoolEmail];
    if (axis === "guardian") return [student.guardian.email];
    return [student.schoolEmail, student.guardian.email];
  }).filter(Boolean))];
}

export function needDescription(student, need) {
  const [formsComplete, formsTotal] = student.forms;
  const descriptions = {
    Contact: "Contact information missing",
    Equipment: "Equipment assignment needed",
    Form: `${formsTotal - formsComplete} ${formsTotal - formsComplete === 1 ? "form" : "forms"} missing`,
    Instrument: "School instrument follow-up needed",
    Schedule: "Schedule review needed",
    Transportation: "Transportation follow-up needed"
  };
  return descriptions[need] || "Follow-up needed";
}
