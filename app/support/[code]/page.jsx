import { notFound, redirect } from "next/navigation";
import { signSponsorStudentGiveToken } from "@/lib/sponsorGiveToken.mjs";
import { resolveSponsorStudentCode } from "@/lib/sponsorStudentLinks";

export const dynamic = "force-dynamic";

export default async function StudentSupportLinkPage({ params }) {
  const { code } = await params;
  const resolved = await resolveSponsorStudentCode(code);
  if (!resolved) notFound();

  const token = signSponsorStudentGiveToken({
    linkId: resolved.link.id,
    studentId: resolved.student.id
  });
  redirect(`/sponsors/give?a=${encodeURIComponent(token)}`);
}
