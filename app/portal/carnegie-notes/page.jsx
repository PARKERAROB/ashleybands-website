import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { carnegieLettersAccess } from "@/lib/carnegieLettersServer";
import CarnegieNotesClient from "./CarnegieNotesClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "My Carnegie Notes | Ashley Bands Family Portal",
  robots: { index: false, follow: false }
};

// Private family page (#106). Not linked anywhere; 404 unless the gate allows this request.
export default async function CarnegieNotesPage() {
  const access = await carnegieLettersAccess({ cookies: await cookies() });
  if (!access.open) notFound();
  return <CarnegieNotesClient previewMode={access.mode === "staff"} />;
}
