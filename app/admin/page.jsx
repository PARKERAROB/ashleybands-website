"use client";

import { StaffGate } from "@/components/StaffGate";

// Every entry is either a working link (href set) or a PLANNED card
// (planned: true, no href). Planned cards render muted and non-clickable —
// this is a prototype of the proposed admin IA, reacted to before it's built.
const SECTIONS = [
  {
    title: "Daily Operations",
    links: [
      { href: "/admin/attendance", emoji: "✅", label: "Attendance", desc: "Program events and Infinite Campus tracking, kept separate and student-connected" }
    ]
  },
  {
    title: "People & Profiles",
    links: [
      { href: "/admin/students", emoji: "🎓", label: "Current Students", desc: "Search, filter, and open a connected student record" },
      { href: "/admin/ensembles", emoji: "🎶", label: "Ensembles & Memberships", desc: "Build rosters across program groups and school classes" },
      { href: "/admin/contacts", emoji: "📇", label: "Contacts & Guardians", desc: "Every contact value, with where it came from" },
      { href: "/admin/profile-requests", emoji: "🗒️", label: "Profile Activity", desc: "Audit log of portal access + profile edits (not an approval queue)" },
      { href: "/admin/measurements", emoji: "📏", label: "Measurements & Sizes", desc: "Staff-entered Band Shoppe measurements, per student" }
    ]
  },
  {
    title: "Money - always a ledger",
    links: [
      { href: "/admin/billing", emoji: "💵", label: "Student Billing", desc: "Charges, payments, balances, MB fees, CSV export" },
      { planned: true, emoji: "💸", label: "Trip Refunds", desc: "Refund submissions + credits, disposition tracking" },
      { planned: true, emoji: "🔁", label: "PayPal Reconciliation", desc: "Match PayPal activity to the ledger" }
    ]
  },
  {
    title: "Inventory",
    links: [
      { href: "/admin/instrument-inventory", emoji: "🎺", label: "Instruments", desc: "Student-submitted instrument intake review" },
      { href: "/admin/music-library", emoji: "🎼", label: "Music Library", desc: "Music piece intake review" },
      { planned: true, emoji: "🧥", label: "Uniform Garments", desc: "Physical pieces, sizes, who has what" },
      { planned: true, emoji: "🔒", label: "Lockers & Locks", desc: "Assignment + combination tracking" },
      { href: "/instrument-inventory", emoji: "🎙️", label: "Instrument Intake (voice)", desc: "Staff data-entry form for instruments" },
      { href: "/music-library", emoji: "🎙️", label: "Music Intake (voice)", desc: "Staff data-entry form for music pieces" }
    ]
  },
  {
    title: "Forms & Comms",
    links: [
      { href: "/admin/clothing-orders", emoji: "👕", label: "Clothing Orders", desc: "Paid Open House orders and consolidated fulfillment details" },
      { href: "/admin/newsletter", emoji: "📰", label: "AshleyBands Weekly", desc: "Draft, review, publish, and send the Sunday newsletter" },
      { href: "/admin/broadcast", emoji: "📣", label: "Broadcast", desc: "Email families by audience - band's own sender, you compose and send" },
      { planned: true, emoji: "📋", label: "Family Profile Form", desc: "Who's complete, who's missing, follow-up drafts" }
    ]
  },
  {
    title: "Marching Band 2026",
    links: [
      { href: "/admin/marching-band/funding", emoji: "📈", label: "MB Roster & Funding", desc: "Every marching student, placement, goal, and amount raised" },
      { href: "/admin/marching-band", emoji: "🥁", label: "MB Signups & Status", desc: "Signup status, overrides, recapture" }
    ]
  },
  {
    title: "Sponsorship",
    links: [
      { href: "/sponsors/dashboard", emoji: "🤝", label: "Sponsor Tracker", desc: "Prospects, businesses, outreach" }
    ]
  },
  {
    title: "System",
    links: [
      { href: "/admin/data-inventory", emoji: "🗂️", label: "Data Inventory", desc: "Where person-data lives, by table + source, touched vs never-touched" },
      { planned: true, emoji: "📜", label: "Audit Log Viewer", desc: "Browse the full actor + action trail, not per-person" },
      { planned: true, emoji: "🌙", label: "Nightly Backup Status", desc: "Last backup run, size, pass/fail" },
      { planned: true, emoji: "🔑", label: "Staff Accounts", desc: "Who has access, roles, PIN resets" }
    ]
  }
];

export default function AdminHome() {
  return (
    <StaffGate>
      {(session, signOut) => (
        <div style={page}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h1 style={{ margin: 0 }}>Ashley Bands - Staff</h1>
            <span style={{ fontSize: 13, color: "#6f675a" }}>
              {session.display_name} · <button onClick={signOut} style={linkBtn}>sign out</button>
            </span>
          </div>
          <p style={{ color: "#6f675a", fontSize: 14, marginTop: 4 }}>Pick a dashboard.</p>

          {SECTIONS.map((section) => (
            <section key={section.title} style={{ marginTop: 22 }}>
              <h2 style={sectionTitle}>{section.title}</h2>
              <div style={grid}>
                {section.links.map((l) =>
                  l.planned ? (
                    <div key={l.label} style={plannedCard}>
                      <span style={{ fontSize: 24, opacity: 0.5 }}>{l.emoji}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{ fontWeight: 700, color: "#8c8375" }}>{l.label}</span>
                        <span style={plannedTag}>PLANNED</span>
                      </span>
                      <span style={{ fontSize: 12.5, color: "#a39c8f", marginTop: 2 }}>{l.desc}</span>
                    </div>
                  ) : (
                    <a key={l.href} href={l.href} style={card}>
                      <span style={{ fontSize: 24 }}>{l.emoji}</span>
                      <span style={{ fontWeight: 700, marginTop: 6 }}>{l.label}</span>
                      <span style={{ fontSize: 12.5, color: "#6f675a", marginTop: 2 }}>{l.desc}</span>
                    </a>
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </StaffGate>
  );
}

const page = { maxWidth: 980, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#191716" };
const sectionTitle = { fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7b1829", margin: "0 0 8px" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 };
const card = { display: "flex", flexDirection: "column", padding: 16, border: "1px solid #ded4bf", borderRadius: 10, background: "#fffaf0", textDecoration: "none", color: "inherit" };
const plannedCard = { display: "flex", flexDirection: "column", padding: 16, border: "1px dashed #d8d2c4", borderRadius: 10, background: "#f4f1ea" };
const plannedTag = { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", color: "#a39c8f", border: "1px solid #d8d2c4", borderRadius: 999, padding: "1px 6px" };
const linkBtn = { background: "none", border: "none", color: "#7b1829", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 };
