"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { Button, DataTable, Notice, PageHeader } from "@/components/ui";
import { staffAuthHeaders } from "@/lib/staffSession";

const COLUMNS = [
  { key: "prize", label: "Prize or experience", rowHeader: true },
  { key: "value", label: "Est. value", align: "end" },
  { key: "donor", label: "Donor" },
  { key: "business", label: "Business" },
  { key: "contact", label: "Contact" },
  { key: "received", label: "Received" },
];

export default function Dashboard() {
  return <StaffGate>{(session, signOut) => <Offers session={session} signOut={signOut} />}</StaffGate>;
}

function Offers({ session, signOut }) {
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/raffle-prizes", { headers: staffAuthHeaders(session), cache: "no-store" });
      if (response.status === 401) return signOut();
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setOffers(body.offers);
    } catch (e) {
      setError(e.message || "Unable to load.");
    }
  }, [session, signOut]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const rows = (offers || []).map((offer) => ({
    id: offer.id,
    prize: offer.prize_description,
    value: offer.estimated_value,
    donor: offer.donor_name,
    business: offer.business_name || "—",
    contact: offer.contact,
    received: new Date(offer.created_at).toLocaleString(),
  }));

  return (
    <main className="narrow-page">
      <PageHeader title="Raffle prize offers" lede="Offers from the public /raffle form, newest first. Private: never shown on the public page." />
      {error ? <Notice tone="error" title={error} role="alert" /> : null}
      {offers === null && !error ? <p role="status">Loading offers…</p> : null}
      {offers ? <p>{offers.length} {offers.length === 1 ? "offer" : "offers"} so far.</p> : null}
      <p><Button variant="secondary" onClick={load}>Refresh</Button></p>
      {offers ? <DataTable label="Raffle prize offers" columns={COLUMNS} rows={rows} rowKey="id" empty="No offers yet." /> : null}
    </main>
  );
}
