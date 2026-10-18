// Senior Night 2026 (#216): one self-reported entry per senior, and the announcer script built from them.
export const EVENT_KEY = "senior-night-2026";
export const FIELDS = [
  { id: "announcedName", label: "Your name as it should be announced", hint: "First, middle and last, exactly as the announcer should say it.", max: 120, required: true },
  { id: "pronunciation", label: "How to say it", hint: "Spell it out the way it sounds, for example \"Kay-den SMITH.\" Leave blank if it's easy.", max: 160 },
  { id: "section", label: "Your section", hint: "For example: trumpet, color guard, front ensemble.", max: 80, required: true },
  { id: "escorts", label: "Who walks with you, as it should be read", hint: "For example: \"escorted by her parents, Jane and John Smith.\"", max: 200, required: true },
  { id: "plans", label: "Your plans after graduation", hint: "School, major, military, work, or undecided.", max: 300, required: true },
  { id: "favoriteMoment", label: "Your favorite band moment", hint: "One or two sentences the announcer can read.", max: 400, required: true },
];
const IDS = FIELDS.map((field) => field.id);

export function cleanAnswers(answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  if (Object.keys(answers).some((key) => !IDS.includes(key))) return null;
  const clean = {};
  for (const field of FIELDS) {
    const value = answers[field.id] ?? "";
    if (typeof value !== "string") return null;
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length > field.max || (field.required && !text)) return null;
    clean[field.id] = text;
  }
  return clean;
}

export function eligibleStudent(student) {
  return student?.status?.toLowerCase() === "active" && student.grade_fall26 === "12th Grade";
}

export function resolveSelfStudent(person, links) {
  if (person?.person_type !== "student") return null;
  const eligible = links.filter((link) => link.role === "student" && link.relationship_status === "trusted" && eligibleStudent(link.student));
  return eligible.length === 1 ? eligible[0].student : null;
}

// Every current senior, answered or not; answered seniors first in announced-name order.
export function staffRows(students, responses) {
  const saved = new Map(responses.map((row) => [row.student_id, row]));
  return students.filter(eligibleStudent).map((student) => ({
    studentId: student.id,
    name: student.display_name,
    marching: String(student.marching_2026 || "").toLowerCase() === "yes",
    answers: saved.get(student.id)?.answers || null,
    updatedAt: saved.get(student.id)?.updated_at || null,
  })).sort((a, b) => (!a.answers - !b.answers) || (a.answers?.announcedName || a.name).localeCompare(b.answers?.announcedName || b.name));
}

// One announcer paragraph per answered senior. Pronunciation is a bracketed note for the announcer, not read aloud.
export function scriptEntry(answers) {
  const name = answers.announcedName;
  const say = answers.pronunciation ? ` [say: ${answers.pronunciation}]` : "";
  const end = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
  return [
    `${name}${say}, ${answers.section}.`,
    end(answers.escorts.charAt(0).toUpperCase() + answers.escorts.slice(1)),
    `After graduation: ${end(answers.plans)}`,
    `Favorite band moment: ${end(answers.favoriteMoment)}`,
  ].join(" ");
}
