// Staff home by role (#131): every role has a plain name and purpose, and each role
// sees only the tasks its capabilities (and assignments, for limited roles) allow.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROLE_CAPABILITIES, staffHasCapability, staffUsesAssignedScopes } from "../lib/staffCapabilities.js";
import { STAFF_ROLES, staffRoleDescription, staffRoleLabel } from "../lib/staffRoles.js";
import { MAX_HOME_TASKS, STAFF_TASKS, STAFF_TOOL_GROUPS, staffHomeView } from "../lib/staffHome.js";

const session = (role) => ({ id: "test", role, display_name: "Test" });
const scoped = (authorizedCapabilities) => ({ scoped: true, metrics: {}, authorizedCapabilities });
const taskIds = (view) => view.tasks.map((task) => task.id);

test("every role in ROLE_CAPABILITIES has a plain label and a one-sentence description", () => {
  for (const role of Object.keys(ROLE_CAPABILITIES)) {
    const entry = STAFF_ROLES[role];
    assert.ok(entry, `${role} needs an entry in lib/staffRoles.js`);
    assert.match(entry.label, /^[A-Z][a-z]+( [a-z]+)*$/, `${role} label is plain words`);
    assert.ok(entry.description.length > 20, `${role} needs a description`);
    assert.doesNotMatch(entry.description, /—/, `${role} description has no em dash`);
    assert.equal(staffRoleLabel(role), entry.label);
    assert.equal(staffRoleDescription(role), entry.description);
  }
  assert.equal(staffRoleLabel("unknown_role"), "Staff");
});

test("each role sees exactly the task cards it can use", () => {
  const expected = {
    director: ["take-attendance", "look-up-student", "record-payment", "fees-owed", "missing-forms", "email-families", "track-sponsors", "carnegie-trip"],
    program_staff: ["take-attendance", "look-up-student", "missing-forms", "attendance-catch-up", "find-instrument", "group-roster", "upcoming-dates", "carnegie-letters"],
    booster_treasurer: ["record-payment", "fees-owed", "campaign-funding", "carnegie-letters"],
    sponsor_lead: ["track-sponsors", "sponsor-prospects", "carnegie-letters"],
    event_worker: ["take-attendance", "attendance-catch-up", "upcoming-dates", "carnegie-letters"],
    campaign_researcher: ["business-research"],
  };
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(ROLE_CAPABILITIES).sort());
  for (const [role, ids] of Object.entries(expected)) {
    // Limited roles here have a global assignment covering everything their role allows.
    const view = staffHomeView(session(role), scoped(["*"]));
    assert.equal(view.status, "ready", role);
    assert.deepEqual(taskIds(view), ids, role);
    assert.ok(view.tasks.length <= MAX_HOME_TASKS);
  }
});

test("no task or tool is ever shown without its capability", () => {
  for (const role of Object.keys(ROLE_CAPABILITIES)) {
    const view = staffHomeView(session(role), scoped(["*"]));
    for (const task of view.tasks) assert.ok(staffHasCapability(session(role), task.capability), `${role}: ${task.id}`);
    for (const group of view.groups) for (const link of group.links) assert.ok(staffHasCapability(session(role), link.capability), `${role}: ${link.href}`);
  }
  assert.deepEqual(staffHomeView(session("not_a_role"), null).tasks, []);
  assert.deepEqual(staffHomeView(null, null).groups, []);
});

test("the director's extra tasks move to Other tools instead of disappearing", () => {
  const view = staffHomeView(session("director"), null);
  const more = view.groups.find((group) => group.title === "More tasks");
  assert.ok(more);
  const shown = new Set([...view.tasks.map((task) => task.href), ...more.links.map((link) => link.href)]);
  for (const task of STAFF_TASKS) assert.ok(shown.has(task.href), task.id);
  for (const group of STAFF_TOOL_GROUPS) for (const link of group.links) {
    assert.ok(view.groups.some((g) => g.links.some((l) => l.href === link.href)), link.href);
  }
});

test("limited roles follow their assignments and get a clear empty state", () => {
  for (const role of Object.keys(ROLE_CAPABILITIES).filter((name) => staffUsesAssignedScopes({ role: name }))) {
    assert.equal(staffHomeView(session(role), null).status, "loading", role);
    assert.equal(staffHomeView(session(role), null, { summaryError: true }).status, "error", role);
    const empty = staffHomeView(session(role), scoped([]));
    assert.equal(empty.status, "unassigned", role);
    assert.deepEqual(empty.tasks, []);
    assert.deepEqual(empty.groups, []);
  }
  const eventOnly = staffHomeView(session("event_worker"), scoped(["attendance.events.read", "attendance.events.write"]));
  assert.deepEqual(taskIds(eventOnly), ["take-attendance", "attendance-catch-up", "upcoming-dates"]);
  const readOnlyTreasurer = staffHomeView(session("booster_treasurer"), scoped(["billing.read"]));
  assert.deepEqual(taskIds(readOnlyTreasurer), ["fees-owed", "campaign-funding"]);
  // An assignment cannot add a capability the role lacks.
  const overreach = staffHomeView(session("event_worker"), scoped(["students.read", "billing.write"]));
  assert.equal(overreach.status, "unassigned");
  // Unlimited roles never wait on the summary.
  assert.equal(staffHomeView(session("program_staff"), null).status, "ready");
});

test("home and header use plain words and keep the help contact", () => {
  const page = readFileSync("app/admin/page.jsx", "utf8");
  const header = readFileSync("components/StaffWorkspaceHeader.jsx", "utf8");
  const layout = readFileSync("app/admin/layout.jsx", "utf8");
  const home = readFileSync("lib/staffHome.js", "utf8");
  for (const source of [page, header, home]) {
    assert.doesNotMatch(source, /command center|Operational areas|Supporting tools/i);
    assert.doesNotMatch(source, /—/);
  }
  assert.match(page, /Mr\. Parker hasn&apos;t assigned you to an event or area yet\. Ask him to add you\./);
  assert.match(page, /Need help\? Email Mr\. Parker/);
  assert.match(page, /This is your workspace\. Everything here is private to staff\./);
  assert.doesNotMatch(page, /styles\.appBar/, "the workspace header replaces the old home bar");
  assert.match(layout, /<StaffWorkspaceHeader \/>/);
  assert.doesNotMatch(layout, /style=/);
  assert.match(header, /Ashley Bands Workspace/);
  assert.match(header, /revokeStaffSession/);
});
