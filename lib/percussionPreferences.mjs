export const SURVEY_KEY = "fall-2026";
export const WORKS = [
  {id:"freedom",title:"Let Freedom Ring!",parts:[
    ["percussion1","Percussion 1: snare drum, bass drum","1–2"], ["timpani","Timpani","3–4"], ["percussion2","Percussion 2: crash cymbals, suspended cymbal, triangle","5"]]},
  {id:"legends",title:"Legends and Heroes",parts:[
    ["percussion1","Percussion I: snare drum, bass drum, crash cymbals","6–11"], ["percussion2","Percussion II: cymbals, metal plates/anvil, sticks/spoons, wood block, ratchet, tambourine, triangle, field/tenor drums, slapstick, sleigh bells","12–15"], ["keyboard","Keyboard Percussion: bells, chimes, xylophone, marimba","16–19"], ["timpani","Timpani","20–23"]]},
  {id:"salute",title:"Salute to the Armed Services",parts:[
    ["mallets","Mallet Percussion: bells","24–26"], ["percussion1","Percussion 1: snare drum, bass drum","27–31"], ["percussion2","Percussion 2: crash cymbals","32–34"]]},
  {id:"cenotaph",title:"Cenotaph",parts:[
    ["percussion1","Percussion I: tam-tam, bass drum, cymbals, triangle, sleigh bells, anvil","35"], ["percussion2","Percussion II: chimes","36"], ["percussion3","Percussion III: vibes","37"], ["percussion4","Percussion IV: bells","38"], ["timpani","Timpani","39"]]},
  {id:"bernstein",title:"A Bernstein Tribute",parts:[
    ["timpani","Timpani","40–42"], ["mallets","Bells, Xylophone & Vibraphone","43–45"], ["percussion","Percussion: snare, tenor, bass and pitched drums; cymbals, triangle, bongos, wood block, cowbells, gourd","46–49"]]},
  {id:"entertainer",title:"The Entertainer",parts:[
    ["drums","Drums: triangle, snare drum, bass drum, choke cymbal, closed hi-hat","50"], ["xylophone","Xylophone","51"]]},
];
export function validChoices(choices) {
  return !!choices && typeof choices === "object" && !Array.isArray(choices)
    && Object.keys(choices).length === WORKS.length
    && WORKS.every(work => Object.hasOwn(choices,work.id) && work.parts.some(([id]) => id === choices[work.id]));
}
export function eligibleStudent(student) {
  return student?.status?.toLowerCase() === "active" && student.ensemble_2026 === "Percussion Ensemble" && student.band_class_2026?.toLowerCase() === "yes";
}
export function resolveSelfStudent(person, links) {
  if(person?.person_type !== "student") return null;
  const eligible = links.filter(link => link.role === "student" && link.relationship_status === "trusted" && eligibleStudent(link.student));
  return eligible.length === 1 ? eligible[0].student : null;
}
export function choiceLabel(work,id) { return work.parts.find(part => part[0] === id)?.[1] || ""; }
export function directorRows(students,responses) {
  const saved = new Map(responses.map(row => [row.student_id,row]));
  return students.filter(eligibleStudent).map(student => ({studentId:student.id,name:student.display_name,choices:saved.get(student.id)?.choices || null,updatedAt:saved.get(student.id)?.updated_at || null})).sort((a,b)=>a.name.localeCompare(b.name));
}
export function preferencesCsv(rows) {
  const cell = value => { let text=String(value ?? ""); if (/^[\s]*[=+@-]/.test(text)) text="'"+text; return '"'+text.replaceAll('"','""')+'"'; };
  return "\uFEFF" + [["Student","Status",...WORKS.map(work=>work.title),"Last saved"],...rows.map(row=>[row.name,row.choices?"Saved":"No response",...WORKS.map(work=>choiceLabel(work,row.choices?.[work.id])),row.updatedAt || ""])].map(row=>row.map(cell).join(",")).join("\r\n");
}
