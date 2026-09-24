import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { carnegieLettersAccess } from "@/lib/carnegieLettersServer";
import LettersReviewClient from "./LettersReviewClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carnegie student letters | Staff", robots: { index: false, follow: false } };

// Staff review queue (#106). Not linked from the staff home while the feature is gated.
export default async function CarnegieLettersAdminPage() {
  const access = await carnegieLettersAccess({ cookies: await cookies() });
  if (!access.open) notFound();
  return <LettersReviewClient previewMode={access.mode === "staff"} />;
}
