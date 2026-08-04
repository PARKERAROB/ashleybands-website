import { redirect } from "next/navigation";

export const metadata = {
  title: "Family Sponsorship | Bands of Ashley"
};

export default function LegacySponsorTrackerPage() {
  redirect("/portal/sponsorship");
}
