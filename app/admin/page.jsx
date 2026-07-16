"use client";

import { StaffGate } from "@/components/StaffGate";

const SECTIONS = [
  {
    title: "Communication",
    links: [
      { href: "/admin/broadcast", emoji: "📣", label: "Broadcast", desc: "Email families by audience — band's own sender, you compose and send" }
    ]
  },
  {
    title: "Money",
    links: [
      { href: "/admin/billing", emoji: "💵", label: "Student Billing", desc: "Charges, payments, balances, MB fees, CSV export" }
    ]
  },
  {
    title: "Students & Profiles",
    links: [
      { href: "/admin/profile-requests", emoji: "👤", label: "Profile Requests", desc: "Review portal access + profile edits" },
      { href: "/admin/students", emoji: "➕", label: "Add / Edit Student", desc: "Create or update a student and guardians" },
      { href: "/admin/data-inventory", emoji: "🗂️", label: "Data Inventory", desc: "Where person-data lives, by table + source, touched vs never-touched" },
      { href: "/admin/measurements", emoji: "📏", label: "Uniform Measurements", desc: "Staff-entered Band Shoppe measurements, per student" }
    ]
  },
  {
    title: "Marching Band 2026",
    links: [
      { href: "/admin/marching-band", emoji: "🥁", label: "MB Signups & Status", desc: "Signup status, overrides, recapture" }
    ]
  },
  {
    title: "Inventory",
    links: [
      { href: "/admin/instrument-inventory", emoji: "🎺", label: "Instrument Inventory", desc: "Student-submitted instrument intake review" },
      { href: "/admin/music-library", emoji: "🎼", label: "Music Library", desc: "Music piece intake review" },
      { href: "/instrument-inventory", emoji: "🎙️", label: "Instrument Intake (voice)", desc: "Staff data-entry form for instruments" },
      { href: "/music-library", emoji: "🎙️", label: "Music Intake (voice)", desc: "Staff data-entry form for music pieces" }
    ]
  },
  {
    title: "Sponsorship",
    links: [
      { href: "/sponsors/dashboard", emoji: "🤝", label: "Sponsor Tracker", desc: "Prospects, businesses, outreach" }
    ]
  },
  {
    title: "Analysis",
    links: [
      { href: "/admin/mpa-analysis", emoji: "📊", label: "MPA Analysis", desc: "2026 MPA adjudication notes" }
    ]
  }
];

export default function AdminHome() {
  return (
    <StaffGate>
      {(session, signOut) => (
        <div style={page}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h1 style={{ margin: 0 }}>Ashley Bands — Staff</h1>
            <span style={{ fontSize: 13, color: "#6f675a" }}>
              {session.display_name} · <button onClick={signOut} style={linkBtn}>sign out</button>
            </span>
          </div>
          <p style={{ color: "#6f675a", fontSize: 14, marginTop: 4 }}>Pick a dashboard.</p>

          {SECTIONS.map((section) => (
            <section key={section.title} style={{ marginTop: 22 }}>
              <h2 style={sectionTitle}>{section.title}</h2>
              <div style={grid}>
                {section.links.map((l) => (
                  <a key={l.href} href={l.href} style={card}>
                    <span style={{ fontSize: 24 }}>{l.emoji}</span>
                    <span style={{ fontWeight: 700, marginTop: 6 }}>{l.label}</span>
                    <span style={{ fontSize: 12.5, color: "#6f675a", marginTop: 2 }}>{l.desc}</span>
                  </a>
                ))}
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
const linkBtn = { background: "none", border: "none", color: "#7b1829", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 };
