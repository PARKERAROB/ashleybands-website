"use client";

import { useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";

export default function DataInventoryPage() {
  return <StaffGate>{(session) => <DataInventory session={session} />}</StaffGate>;
}

function DataInventory({ session }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/data-inventory", { headers: staffAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(String(e)));
  }, [session]);

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Data Inventory</h1>
        <a href="/admin" style={link}>← Staff home</a>
      </div>
      <p style={{ color: "#6f675a", fontSize: 14 }}>
        Where person-data lives in this app and who has touched it. Read-only, live counts —
        the provenance statement for this system.
      </p>

      {error && <p style={{ color: "#7b1829" }}>{error}</p>}
      {!data && !error && <p>Loading…</p>}

      {data && (
        <>
          <p style={{ fontSize: 12, color: "#6f675a" }}>
            Generated {new Date(data.generatedAt).toLocaleString()} for {data.staff.displayName}.
          </p>

          <Section title="Touched by family (portal_students / portal_people)">
            <Row label="Students touched" stat={data.touchedByFamily.studentsTouched} tone="good" />
            <Row label="Students never touched" stat={data.touchedByFamily.studentsUntouched} tone="warn" />
            <Row label="Guardians touched" stat={data.touchedByFamily.peopleTouched} tone="good" />
            <Row label="Guardians never touched" stat={data.touchedByFamily.peopleUntouched} tone="warn" />
            <p style={{ fontSize: 12, color: "#6f675a", marginTop: 6 }}>
              "Touched" = at least one consumed portal login, a submitted update request, or a
              contact method the family (not the CSV sync) supplied. See migration 0028 for the
              exact rule.
            </p>
          </Section>

          <Section title="Portal (System B) table counts">
            <Row label="Students" stat={data.portal.students} />
            <Row label="People (guardians/staff/etc.)" stat={data.portal.people} />
            <Row label="Student ↔ person links" stat={data.portal.studentPeopleLinks} />
            <Row label="Households" stat={data.portal.households} />
            <Row label="Access requests (outside-in)" stat={data.portal.accessRequests} />
            <Row label="Update requests (parent-submitted edits)" stat={data.portal.updateRequests} />
            <Row label="Magic links issued" stat={data.portal.magicLinksIssued} />
            <Row label="Magic links consumed (actual logins)" stat={data.portal.magicLinksConsumed} />
            <Row label="Review queue — open items" stat={data.portal.reviewQueueOpen} />
          </Section>

          <Section title="Contact methods by source">
            {data.portal.contactMethodsBySource.available ? (
              <>
                <Row label="Total contact methods" stat={{ available: true, count: data.portal.contactMethodsBySource.total }} />
                {Object.entries(data.portal.contactMethodsBySource.byValue)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <Row key={source} label={source} stat={{ available: true, count }} />
                  ))}
              </>
            ) : (
              <Unavailable error={data.portal.contactMethodsBySource.error} />
            )}
          </Section>

          <Section title="Legacy System A (schema-drift, no migration file — retirement pending)">
            <Row label="students" stat={data.legacySystemA.students} />
            <Row label="guardians" stat={data.legacySystemA.guardians} />
            <Row label="families (PIN login)" stat={data.legacySystemA.families} />
          </Section>

          <Section title="Health-class data">
            <Row label="Marching band signups (medical notes + emergency contacts)" stat={data.marchingBandSignups2026} />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={panel}>
      <strong style={{ display: "block", marginBottom: 8 }}>{title}</strong>
      {children}
    </div>
  );
}

function Row({ label, stat, tone }) {
  if (!stat) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13.5 }}>
      <span>{label}</span>
      {stat.available ? (
        <strong style={{ color: tone === "warn" ? "#b3541e" : tone === "good" ? "#215732" : "#191716" }}>
          {stat.count}
        </strong>
      ) : (
        <Unavailable error={stat.error} />
      )}
    </div>
  );
}

function Unavailable({ error }) {
  return (
    <span style={{ color: "#999", fontSize: 12 }} title={error || "unavailable"}>
      unavailable
    </span>
  );
}

const page = { maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", color: "#191716" };
const panel = { border: "1px solid #ded4bf", borderRadius: 10, background: "#fffaf0", padding: 14, margin: "12px 0" };
const link = { color: "#7b1829", fontSize: 13, textDecoration: "underline" };
