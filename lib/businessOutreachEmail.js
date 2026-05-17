// Cold "willingness" email template for the 2026-2027 business prospect campaign.
// Used by the (future) outreach send route AND surfaced in the curation dashboard
// preview so Mr. Parker can see exactly what each business would receive before
// any send happens.

import { SPONSOR_CONTACT } from "./sponsorshipContent.js";

export const CAMPAIGN_ID = "2026-2027-cold-willingness";

export const COLD_EMAIL_SUBJECT =
  "Ashley HS Band sponsorship — would your business be open to a conversation later this year?";

// HTML body. Replaces {business_name} and {contact_first} at render time.
// Click links use {yes_url} and {no_url} (built per-business with the
// business_outreach.id signed token).
export function renderColdEmailHTML({ businessName, contactFirst, yesUrl, noUrl }) {
  const greeting = contactFirst ? `Hi ${contactFirst},` : `Hi there,`;
  return `
<div style="font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.55; color: #222;">
<p>${greeting}</p>

<p>I'm Robert Parker, Director of Bands at Ashley High School here in Wilmington. The Ashley Band Boosters (a 501(c)(3)) is preparing the 2026-2027 sponsorship campaign, and I'm writing to ask one thing, not to pitch.</p>

<p>Would <strong>${businessName || "your business"}</strong> be open to hearing from an Ashley band family in the coming weeks about supporting the program? Click below if yes.</p>

<p style="margin: 20px 0;">
<a href="${yesUrl}" style="display: inline-block; background: #2f7a2f; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none; font-weight: 600; margin-right: 8px;">Yes, I'd be open to hearing more</a>
<a href="${noUrl}" style="display: inline-block; background: #f0f0f0; color: #555; padding: 10px 18px; border-radius: 4px; text-decoration: none; font-weight: 600;">No thanks</a>
</p>

<p>If yes, an Ashley band family will reach out personally with the details.</p>

<p>Thanks,<br>
Mr. Parker</p>

<hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0 12px;">
<p style="font-size: 11px; color: #777; line-height: 1.4;">
${SPONSOR_CONTACT.boosterOrg} is a registered 501(c)(3) educational nonprofit. EIN ${SPONSOR_CONTACT.ein}.<br>
Mailing: ${SPONSOR_CONTACT.school} · ${SPONSOR_CONTACT.address} · ${SPONSOR_CONTACT.cityStateZip}<br>
You received this because your business is part of the Wilmington / Carolina Beach community served by Ashley HS. To remove your business from our outreach list, click <a href="${noUrl}" style="color: #777;">No thanks</a> above.
</p>
</div>`.trim();
}

// Plain-text fallback for clients that don't render HTML
export function renderColdEmailText({ businessName, contactFirst, yesUrl, noUrl }) {
  const greeting = contactFirst ? `Hi ${contactFirst},` : `Hi there,`;
  return `${greeting}

I'm Robert Parker, Director of Bands at Ashley High School here in Wilmington. The Ashley Band Boosters (a 501(c)(3)) is preparing the 2026-2027 sponsorship campaign, and I'm writing to ask one thing, not to pitch.

Would ${businessName || "your business"} be open to hearing from an Ashley band family in the coming weeks about supporting the program? Reply yes via one of the links below.

YES, I'd be open to hearing more:
${yesUrl}

NO thanks:
${noUrl}

If yes, an Ashley band family will reach out personally with the details.

Thanks,
Mr. Parker

--
${SPONSOR_CONTACT.boosterOrg} (501(c)(3)) -- EIN ${SPONSOR_CONTACT.ein}
${SPONSOR_CONTACT.school} -- ${SPONSOR_CONTACT.address}, ${SPONSOR_CONTACT.cityStateZip}
To remove your business from our outreach list, use the "No thanks" link above.`;
}
