"use client";
import { useCallback, useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import { PageHeader, Notice, Button, DataTable, StatusChip } from "@/components/ui";

// Mr. Parker's Carnegie adults list (#237): who is coming, which option and room, who asked to
// chaperone, and what each family has paid. Only here can someone be made an official chaperone
// or removed.
export default function CarnegieAdults() {
  return <StaffGate>{(session, signOut) => <AdultsList session={session} signOut={signOut} />}</StaffGate>;
}

const usd = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const OPTION = { 1: "Option 1: chaperone", 2: "Option 2: with the band, own travel", 3: "Option 3: fully on own" };

function AdultsList({ session, signOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/carnegie-adults", { headers: staffAuthHeaders(session), cache: "no-store" });
    if (response.status === 401) { await signOut(); return; }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "Could not load."); return; }
    setData(body);
  }, [session, signOut]);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);

  async function act(adult, action) {
    const question = {
      official: `Make ${adult.name} an official chaperone (rides the bus)?`,
      not_official: `Take ${adult.name} off the official chaperone list?`,
      remove: `Remove ${adult.name}? Their price comes off the family's adult total. Payments already made stay with the family's account.`,
    }[action];
    if (!window.confirm(question)) return;
    const response = await fetch("/api/admin/carnegie-adults", {
      method: "PATCH",
      headers: { ...staffAuthHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify({ id: adult.id, action }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "That didn't save."); return; }
    load();
  }

  const adults = data?.adults || [];
  const officials = adults.filter((a) => a.official).length;
  const requests = adults.filter((a) => a.option === 1 && !a.official).length;
  const quads = adults.filter((a) => a.option !== 3 && a.roomType === "quad").length;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <PageHeader title="Carnegie adults" lede={`${adults.length} adults · ${officials} made official here (${Math.max(3 - officials, 0)} of the 3 open places left; the other 7 are already filled) · ${requests} chaperone requests waiting · ${quads} want a quad`} />
      <Button variant="secondary" onClick={load}>Refresh</Button>
      {error ? <Notice tone="error" title="Something went wrong."><p>{error}</p></Notice> : null}
      {!data ? <p role="status">Loading…</p> : (
        <DataTable
          label="Carnegie adults"
          empty="No adults have signed up yet."
          rowKey="id"
          columns={[
            { key: "name", label: "Adult", rowHeader: true },
            { key: "student", label: "Student" },
            { key: "option", label: "Option" },
            { key: "room", label: "Room" },
            { key: "price", label: "Price", align: "end" },
            { key: "family", label: "Family paid / owes", align: "end" },
            { key: "actions", label: "Actions" },
          ]}
          rows={adults.map((adult) => {
            const family = data.families[adult.studentId];
            return {
              id: adult.id,
              name: adult.name,
              student: adult.student,
              option: adult.official
                ? <StatusChip status="done">Official chaperone</StatusChip>
                : adult.option === 1
                  ? <StatusChip status="waiting">Chaperone requested</StatusChip>
                  : OPTION[adult.option],
              room: adult.option === 3 ? "—" : adult.roomType,
              price: adult.option === 3 ? "—" : usd(adult.priceCents),
              family: family ? `${usd(family.paidCents)} / ${usd(family.owedCents)}` : "—",
              actions: (
                <span style={{ display: "inline-flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {adult.option !== 3 ? (adult.official
                    ? <Button variant="quiet" onClick={() => act(adult, "not_official")}>Undo official</Button>
                    : <Button variant="secondary" onClick={() => act(adult, "official")}>Make official</Button>) : null}
                  <Button variant="quiet" onClick={() => act(adult, "remove")}>Remove</Button>
                </span>
              ),
            };
          })}
        />
      )}
    </main>
  );
}
