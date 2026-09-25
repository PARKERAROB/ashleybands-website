// Pure name matching for Infinite Campus register imports (#120). No database or secrets.

function text(value) {
  return String(value || "").trim();
}

export function normalizeName(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function sourceNameKey(value) {
  const [last = "", firstAndMiddle = ""] = text(value).split(",", 2);
  const firstParts = normalizeName(firstAndMiddle).split(" ").filter(Boolean);
  if (firstParts.length > 1 && firstParts.at(-1).length === 1) firstParts.pop();
  return `${firstParts.join(" ")}|${normalizeName(last)}`;
}

export function studentNameKey(student) {
  return `${normalizeName(student.legal_first)}|${normalizeName(student.legal_last)}`;
}

export function preferredNameKey(student) {
  const preferred = normalizeName(student.preferred_first);
  return preferred ? `${preferred}|${normalizeName(student.legal_last)}` : "";
}

// Infinite Campus sometimes prints the name a student goes by. Suggest by exact legal name first,
// then by exact preferred name; a student suggested for two different district numbers gets no
// suggestion, so the conflict surfaces in review instead of failing at accept (#120).
export function buildNameSuggestions(students, sourceStudents) {
  const index = (keyOf) => {
    const map = new Map();
    for (const student of students) {
      const key = keyOf(student);
      if (!key || key === "|") continue;
      map.set(key, [...(map.get(key) || []), student.id]);
    }
    return map;
  };
  const byLegal = index(studentNameKey);
  const byPreferred = index(preferredNameKey);
  const suggestions = new Map();
  for (const source of sourceStudents) {
    const key = sourceNameKey(source.sourceStudentName);
    const legal = byLegal.get(key) || [];
    const preferred = byPreferred.get(key) || [];
    const id = legal.length === 1 ? legal[0] : legal.length === 0 && preferred.length === 1 ? preferred[0] : null;
    if (id) suggestions.set(source.sourceStudentNumber, id);
  }
  const numbersByStudent = new Map();
  for (const [number, id] of suggestions) numbersByStudent.set(id, new Set([...(numbersByStudent.get(id) || []), number]));
  for (const [number, id] of [...suggestions]) if (numbersByStudent.get(id).size > 1) suggestions.delete(number);
  return suggestions;
}

