import { notFound, redirect } from "next/navigation";
import { signSponsorStudentGiveToken } from "@/lib/sponsorGiveToken.mjs";
import { resolveSponsorStudentCode } from "@/lib/sponsorStudentLinks";
import { CARNEGIE_GIVING_PATH } from "@/lib/sponsorCampaigns.mjs";

export const dynamic = "force-dynamic";

// Carnegie student link (#103). Same signed student token as /support/[code], but it lands on the
// Carnegie giving page, so the gift is recorded as carnegie-2027 with the student's credit.
// Record-keeping only: no student balance, and no effect on marching band figures.
export default async function CarnegieStudentSupportLinkPage({ params }) {
  const { code } = await params;
  const resolved = await resolveSponsorStudentCode(code);
  if (!resolved) notFound();

  const token = signSponsorStudentGiveToken({
    linkId: resolved.link.id,
    studentId: resolved.student.id
  });
  redirect(`${CARNEGIE_GIVING_PATH}?a=${encodeURIComponent(token)}#make-a-gift`);
}
