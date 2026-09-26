import { STAFF_CAPABILITIES, staffHasCapability, staffUsesAssignedScopes } from "./staffCapabilities.js";

// Staff home content (#131). Tasks are verbs a newcomer understands, in priority order.
// Each one names the capability its destination already requires; this module only
// decides what to show. Route and API authorization stay where they are.
// `metric` names a key from /api/admin/operations-summary when a live count exists.
export const MAX_HOME_TASKS = 8;

export const STAFF_TASKS = Object.freeze([
  { id: "take-attendance", capability: STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE, href: "/attendance", title: "Take attendance", detail: "Open the roster for today's event and mark who is here." },
  { id: "look-up-student", metric: "students", capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/students", title: "Look up a student", detail: "Search by name to see groups, forms, fees and family contacts." },
  { id: "record-payment", capability: STAFF_CAPABILITIES.BILLING_WRITE, href: "/admin/billing", title: "Record a payment", detail: "Find the student, then record a cash or check payment on their fee ledger." },
  { id: "fees-owed", capability: STAFF_CAPABILITIES.BILLING_READ, href: "/admin/financial?filter=open", title: "See who still owes fees", detail: "A list of students with a program fee balance." },
  { id: "missing-forms", metric: "forms", capability: STAFF_CAPABILITIES.FORMS_STATUS_READ, href: "/admin/forms?view=needs", title: "Find missing forms", detail: "See which students still need a form and what happens next." },
  { id: "email-families", metric: "communication", capability: STAFF_CAPABILITIES.COMMUNICATIONS_READ, href: "/admin/broadcast", title: "Email families", detail: "Choose which families to reach and prepare the message." },
  { id: "track-sponsors", capability: STAFF_CAPABILITIES.SPONSORSHIP_READ, href: "/sponsors/dashboard", title: "Track sponsors", detail: "See each business sponsor, what they gave and who follows up." },
  { id: "carnegie-trip", capability: [STAFF_CAPABILITIES.FORMS_STATUS_READ, STAFF_CAPABILITIES.BILLING_READ], href: "/admin/carnegie-2027", title: "Check Carnegie trip answers", detail: "See each family's answer, the $50 deposit and who needs a follow-up." },
  { id: "attendance-catch-up", metric: "attendance", capability: STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ, href: "/admin/attendance?view=ready", title: "Catch up on attendance", detail: "See events that still need attendance marked." },
  { id: "campaign-funding", metric: "financial", capability: STAFF_CAPABILITIES.BILLING_READ, href: "/admin/financial?view=campaign&filter=under100", title: "See who has raised under $100", detail: "Campaign progress for each student, lowest first." },
  { id: "find-instrument", metric: "assets", capability: STAFF_CAPABILITIES.ASSETS_READ, href: "/admin/assets", title: "Find an instrument or uniform", detail: "See what the band owns and who has it right now." },
  { id: "group-roster", metric: "ensembles", capability: STAFF_CAPABILITIES.MEMBERSHIPS_READ, href: "/admin/ensembles", title: "Get a group roster", detail: "Open a band or class and see who is in it." },
  { id: "upcoming-dates", metric: "calendar", capability: STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ, href: "/calendar", title: "Check upcoming dates", detail: "The band calendar with every rehearsal, game and concert." },
  { id: "sponsor-prospects", capability: STAFF_CAPABILITIES.SPONSORSHIP_READ, href: "/sponsors/dashboard/businesses", title: "Choose businesses to contact", detail: "Review local businesses and mark who to ask next." },
  { id: "carnegie-letters", capability: STAFF_CAPABILITIES.CARNEGIE_LETTERS_REVIEW, href: "/admin/carnegie-letters", title: "Confirm Carnegie letters and gifts", detail: "Read student letters and reported gifts, then confirm or send back." },
  { id: "business-research", capability: STAFF_CAPABILITIES.CAMPAIGN_SPONSORSHIP_READ, href: "/sponsors/team", title: "Research local businesses", detail: "Search the business directory before anyone makes an ask." },
]);

export const STAFF_TOOL_GROUPS = Object.freeze([
  {
    title: "Students and families",
    links: [
      { capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/contacts", label: "Family contacts" },
      { capability: STAFF_CAPABILITIES.STUDENTS_WRITE, href: "/admin/students/manage", label: "Add or edit student records" },
      { capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/profile-requests", label: "Family profile changes" },
      { capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/measurements", label: "Uniform measurements" },
      { capability: STAFF_CAPABILITIES.MEMBERSHIPS_READ, href: "/admin/marching-band", label: "Marching band sign-ups" },
      { capability: STAFF_CAPABILITIES.PERCUSSION_PREFERENCES_READ, href: "/admin/percussion-preferences", label: "Percussion choices" },
    ],
  },
  {
    title: "Money and trips",
    links: [
      { capability: STAFF_CAPABILITIES.FUNDING_READ, href: "/admin/marching-band/funding", label: "Marching band funding" },
      { capability: STAFF_CAPABILITIES.BILLING_READ, href: "/admin/clothing-orders", label: "Clothing orders" },
    ],
  },
  {
    title: "Instruments and music",
    links: [
      { capability: STAFF_CAPABILITIES.ASSETS_READ, href: "/admin/instrument-inventory", label: "Instrument requests" },
      { capability: STAFF_CAPABILITIES.ASSETS_READ, href: "/admin/music-library", label: "Music library" },
    ],
  },
  {
    title: "Newsletter",
    links: [
      { capability: STAFF_CAPABILITIES.COMMUNICATIONS_READ, href: "/admin/newsletter", label: "AshleyBands Weekly" },
    ],
  },
  {
    title: "Team workspaces",
    links: [
      { capability: STAFF_CAPABILITIES.OPERATIONS_SUMMARY_READ, href: "/carnegie-2027/team", label: "Carnegie trip team (members only)" },
      { capability: STAFF_CAPABILITIES.SYSTEM_OVERSIGHT_READ, href: "/regiment-os", label: "Regiment OS review (separate code)" },
    ],
  },
  {
    title: "Staff accounts and records",
    links: [
      { capability: STAFF_CAPABILITIES.SYSTEM_OVERSIGHT_READ, href: "/admin/system", label: "Staff access and activity log" },
      { capability: STAFF_CAPABILITIES.SYSTEM_DATA_INVENTORY_READ, href: "/admin/data-inventory", label: "What data we keep" },
      { capability: STAFF_CAPABILITIES.SYSTEM_OVERSIGHT_READ, href: "/admin/practice-loop", label: "Practice Loop test" },
    ],
  },
]);

// Pure: what the staff home shows for a session and its operations summary.
// Limited roles (booster treasurer, event helper) see only what Mr. Parker has
// assigned them, as reported by the summary's authorizedCapabilities.
// status: "ready" | "loading" | "error" | "unassigned".
export function staffHomeView(session, summary, { summaryError = false } = {}) {
  const limited = staffUsesAssignedScopes(session);
  const assignedCapabilities = new Set(summary?.authorizedCapabilities || []);
  const assigned = (capability) => {
    if (!limited) return true;
    if (!summary?.scoped) return false;
    if (assignedCapabilities.has("*")) return true;
    const required = Array.isArray(capability) ? capability : [capability];
    return required.every((item) => assignedCapabilities.has(item));
  };
  const allowed = (item) => staffHasCapability(session, item.capability) && assigned(item.capability);

  const allTasks = STAFF_TASKS.filter(allowed);
  const tasks = allTasks.slice(0, MAX_HOME_TASKS);
  const moreTasks = allTasks.slice(MAX_HOME_TASKS).map((task) => ({ capability: task.capability, href: task.href, label: task.title }));
  const groups = [
    ...(moreTasks.length ? [{ title: "More tasks", links: moreTasks }] : []),
    ...STAFF_TOOL_GROUPS.map((group) => ({ ...group, links: group.links.filter(allowed) })),
  ].filter((group) => group.links.length);

  let status = "ready";
  if (limited && !summary?.scoped) status = summaryError ? "error" : "loading";
  else if (limited && !tasks.length && !groups.length) status = "unassigned";
  return { limited, status, tasks, groups };
}
