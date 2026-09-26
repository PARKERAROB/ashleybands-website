import { ROLE_CAPABILITIES } from "./staffCapabilities.js";

// Plain names and one-sentence purposes for each staff role (#131). Keys must match
// ROLE_CAPABILITIES; scripts/staff-home-roles.test.mjs fails if a role is missing here.
const ROLE_TEXT = Object.freeze({
  director: {
    label: "Director",
    description: "You run the program. You can see and change everything here, including who has staff access.",
  },
  program_staff: {
    label: "Program staff",
    description: "You work with students: attendance, groups, forms and instruments. You can't record payments or email families.",
  },
  booster_treasurer: {
    label: "Booster treasurer",
    description: "You handle fees, payments and fundraising totals. You can't open or change student records.",
  },
  sponsor_lead: {
    label: "Sponsor lead",
    description: "You work with business sponsors: who to ask, what they gave and how to thank them. You can't open student records.",
  },
  event_worker: {
    label: "Event helper",
    description: "You take attendance at the events Mr. Parker assigns to you. You can't see fees or family contact details.",
  },
  campaign_researcher: {
    label: "Campaign researcher",
    description: "You research local businesses the campaign could ask for support. You can't see student or family records.",
  },
});

export const STAFF_ROLES = Object.freeze(Object.fromEntries(
  Object.keys(ROLE_CAPABILITIES).map((role) => [role, ROLE_TEXT[role] || null]),
));

export function staffRoleLabel(role) {
  return STAFF_ROLES[String(role || "")]?.label || "Staff";
}

export function staffRoleDescription(role) {
  return STAFF_ROLES[String(role || "")]?.description || "Ask Mr. Parker what this account is for.";
}
