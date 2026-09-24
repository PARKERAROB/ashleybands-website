import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { carnegieLettersAccess } from "@/lib/carnegieLettersServer";
import LetterBuilderClient from "./LetterBuilderClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Write a Carnegie Letter | Ashley Bands Family Portal",
  robots: { index: false, follow: false }
};

export default async function CarnegieLetterPage() {
  const access = await carnegieLettersAccess({ cookies: await cookies() });
  if (!access.open) notFound();
  return (
    <Suspense fallback={null}>
      <LetterBuilderClient previewMode={access.mode === "staff"} />
    </Suspense>
  );
}
