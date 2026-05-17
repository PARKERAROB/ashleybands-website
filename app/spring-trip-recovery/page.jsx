export const metadata = {
  title: "Spring Trip Recovery Updates | Bands of AHS",
  description: "Family-facing status updates for the Ashley Bands Spring Trip 2026 cancellation recovery process."
};

const timeline = [
  {
    time: "Friday, May 15 · 2:49 PM",
    title: "Automated \"bus is on the way\" message received",
    body: "CharterUP's automated system sent a \"your vehicle is on the way\" message 11 minutes before the scheduled 3:00 PM pickup. The same message hit the booster officer's phone and is preserved on her Verizon log."
  },
  {
    time: "Friday, May 15 · 3:00 PM",
    title: "Scheduled pickup. Bus did not arrive.",
    body: "Students and chaperones waited outside the band room for approximately 30 to 40 minutes for the bus that had been confirmed and was reportedly already on the way."
  },
  {
    time: "Friday, May 15 · 3:22 PM",
    title: "First call to the assigned driver",
    body: "The booster officer placed the first call to the driver assigned to our reservation. The phone rang and went to a voicemail that was not set up. (Verizon billing record.)"
  },
  {
    time: "Friday, May 15 · 3:31 PM",
    title: "Cancellation call received",
    body: "Inbound call from CharterUP support to the booster officer. The bus broker informed her that the trip was cancelled. This is the documented cancellation moment, anchored to a Verizon billing record and her contemporaneous note on the log."
  },
  {
    time: "Friday, May 15 · 3:34 PM",
    title: "Joint callback to CharterUP",
    body: "Mr. Parker and the booster officer called CharterUP back together for a 9-minute conversation to confirm the cancellation and ask whether a replacement bus could be obtained."
  },
  {
    time: "Friday, May 15 · 4:00 PM",
    title: "Announcement to students inside the band room",
    body: "Once the cancellation was confirmed, students were brought inside and told the bus had cancelled last-minute. Adults continued working the phones in pursuit of a replacement."
  },
  {
    time: "Friday, May 15 · 4:34 to 5:40 PM",
    title: "Replacement-bus search",
    body: "Calls placed to four charter operators (Sunway in Jacksonville, Daniels in Wilmington, Carolina Limo in Myrtle Beach, and a second Jacksonville operator). None could deploy a bus inside our window. (Carrier billing record.)"
  },
  {
    time: "Friday, May 15 · ~5:20 PM",
    title: "Final cancellation communicated",
    body: "Students were told the trip could no longer go forward and were released to families."
  },
  {
    time: "Friday, May 15 · 6:01 PM",
    title: "Initial family update sent",
    body: "Families were notified that the trip was cancelled and that follow-up would continue once the transportation vendor provided written documentation."
  },
  {
    time: "Friday, May 15 · 6:19 PM",
    title: "Substantive call with CharterUP case manager",
    body: "39-minute call with the CharterUP case manager who took over our case. Bus refund of $5,550 verbally committed; an internal exception request opened for non-bus costs. CharterUP holds the recording. (Carrier billing record.)"
  },
  {
    time: "Friday, May 15 · 6:54 PM",
    title: "CharterUP written confirmation received",
    body: "CharterUP confirmed in writing that the bus provider was no longer able to service the trip and that alternate provider options within their marketplace had been exhausted."
  },
  {
    time: "Friday, May 15 · 9:03 PM",
    title: "Hotel refund request sent",
    body: "Refund / exception request sent to the hotel general manager and group sales contact, with CharterUP's written cancellation confirmation forwarded as documentation."
  },
  {
    time: "Friday, May 15 · 9:06 PM",
    title: "Festival refund request sent",
    body: "Refund / exception request sent to the Music in the Parks / Festival's Edge primary contact, with CharterUP's written cancellation confirmation forwarded. Auto-reply received: primary contact is out of office until Monday, May 18 at 8:00 AM."
  },
  {
    time: "Friday, May 15 · 10:43 PM",
    title: "Formal CharterUP follow-up sent",
    body: "A written follow-up was sent to CharterUP requesting documentation and clarification about the transportation failure. CharterUP acknowledged the request at 10:59 PM and assigned an internal ticket."
  },
  {
    time: "Saturday, May 16 · 5:45 AM",
    title: "Chaperone documentation request sent",
    body: "Trip chaperones were asked to share what they observed on May 15, any phone records related to the cancellation, and confirmation of trip-related transactions on the booster account. The goal is one clean record of how the day unfolded."
  },
  {
    time: "Saturday, May 16 · 6:02 AM",
    title: "Family impact form sent",
    body: "Families were invited to share what their student observed and what the family had to give up or change because of trip costs that are now in limbo. Responses are voluntary and are being kept on file alongside the vendor record."
  },
  {
    time: "Sunday, May 17 · 6:57 AM",
    title: "Chaperone witness statement received",
    body: "A written witness statement was received from one of the chaperones who was present in the band room from 2:30 PM on Friday. It corroborates the timeline already on record from on-site observation."
  },
  {
    time: "Sunday, May 17 · 10:46 to 10:52 AM",
    title: "Booster phone log and CharterUP correspondence received",
    body: "A booster officer forwarded her full Verizon Call and Text Log for May 15 and the complete email chain with the bus broker, from initial quote through cancellation. The Verizon log lines up minute-by-minute with the timeline already on record and includes the 3:31 PM incoming call from the broker that informed her the trip was cancelled. That moment is now anchored to a carrier billing record, not a recollection. Additional family responses came in through the weekend. The recovery file is in shape for the vendor conversations that begin Monday, May 18."
  }
];

const statusItems = [
  {
    label: "Bus refund",
    status: "Confirmed in writing",
    detail: "$5,550 submitted by CharterUP. Expected processing window: 7-14 business days."
  },
  {
    label: "Hotel cost",
    status: "Request submitted",
    detail: "A refund / exception request has been sent. Response pending."
  },
  {
    label: "Festival / park package",
    status: "Request submitted",
    detail: "A refund / exception request was sent Friday, May 15 at 9:06 PM. Primary contact returns Monday, May 18 at 8:00 AM."
  },
  {
    label: "Family refunds",
    status: "Pending recovery",
    detail: "Final family refund amounts cannot be determined until recovered funds and the trip account are reconciled."
  },
  {
    label: "Witness and family-impact statements",
    status: "Collection in progress",
    detail: "Chaperones, families, and students have been invited to share what they observed on May 15 and how the cancellation has affected them. This material is being kept on file and will be referenced in vendor correspondence as appropriate."
  }
];

const nextSteps = [
  "Wait for CharterUP's response to the formal documentation request submitted Friday, May 15 at 10:43 PM.",
  "Follow up with Music in the Parks / Festival's Edge when their primary contact returns Monday, May 18.",
  "Watch for the hotel response to the refund / exception request.",
  "Collect and organize chaperone and family responses as they come in.",
  "Confirm the bus refund posts to the booster account within the 7-14 business day window.",
  "Continue documenting each response and preserving the written record.",
  "Reconcile the trip account before issuing final refund information to families."
];

export default function SpringTripRecoveryPage() {
  return (
    <main className="recovery-page">
      <section className="recovery-hero">
        <p className="eyebrow">Spring Trip 2026</p>
        <h1>Recovery Updates</h1>
        <p>
          This page is a family-facing summary of the recovery work after the May 15 spring trip cancellation.
          It will focus on confirmed information, major next steps, and what families should expect.
        </p>
        <div className="recovery-updated">Last updated: Sunday, May 17, 2026</div>
      </section>

      <section className="recovery-section recovery-note">
        <h2>Current Status</h2>
        <p>
          CharterUP has confirmed in writing that the transportation could not be provided and has submitted
          a full refund for the bus cost. Requests have also been sent to the hotel and festival vendors.
          At this point, final family refund amounts cannot be determined until vendor responses are received
          and the trip account is reconciled.
        </p>
        <p>
          Through the weekend, the documentation file has continued to grow: additional family responses,
          a written chaperone account, and an independent third-party phone billing record from a booster
          officer. The day-of timeline is now corroborated from multiple sources. The file is ready for the
          vendor conversations that begin Monday, May 18.
        </p>
      </section>

      <section className="recovery-section recovery-note">
        <h2>What We Are Trying to Recover</h2>
        <p>
          To be honest with families about the financial reality, here is the breakdown of what was paid for
          the trip and where each piece stands right now:
        </p>
        <ul>
          <li><strong>Bus charter (CharterUP):</strong> $5,550 &mdash; <em>refund confirmed in writing, processing through the booster card.</em></li>
          <li><strong>Music in the Parks festival registration (Festival&rsquo;s Edge):</strong> $5,711 &mdash; <em>currently non-refundable; goodwill exception requested.</em></li>
          <li><strong>Hotel (Wyndham Garden Williamsburg):</strong> $2,676.24 net &mdash; <em>currently non-refundable; goodwill exception requested.</em></li>
          <li><strong>Trip t-shirts (Printify):</strong> $720.77 &mdash; <em>physical product, already produced and shipped; not refundable.</em></li>
        </ul>
        <p>
          The total amount paid for the trip is significant. The bus refund covers a meaningful portion of that,
          but the hotel and festival pieces together are the larger ask, and those are the requests that require
          vendors to make exceptions to their own policies. Neither vendor is required to grant those exceptions.
        </p>
        <p>
          For families to see a substantial refund returned to them, several things need to go correctly:
          the bus refund needs to post cleanly, the hotel and festival goodwill exceptions need to be granted
          in some form, and the trip account needs to reconcile against what is recovered. Any one of those
          paths not going as hoped reduces what comes back. I want to be straightforward about that so no one
          is expecting a specific amount before we know what is actually possible.
        </p>
        <p>
          If the goodwill exceptions from the hotel and festival do not result in meaningful recovery, the
          focus of the recovery effort will shift toward CharterUP and the bus provider they hired. They
          are the parties responsible for the failure, and the parties who will ultimately need to account
          for what happened.
        </p>
      </section>

      <section className="recovery-section">
        <div className="recovery-grid">
          {statusItems.map((item) => (
            <article className="recovery-card" key={item.label}>
              <span>{item.label}</span>
              <h2>{item.status}</h2>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="recovery-section">
        <div className="recovery-section-heading">
          <p className="eyebrow">What has happened</p>
          <h2>Timeline</h2>
        </div>
        <div className="recovery-timeline">
          {timeline.map((item) => (
            <article className="recovery-event" key={`${item.time}-${item.title}`}>
              <span>{item.time}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="recovery-section recovery-next">
        <div>
          <p className="eyebrow">Next steps</p>
          <h2>What I am working on now</h2>
        </div>
        <ul>
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <section className="recovery-section recovery-note">
        <h2>A Note on Family Responses</h2>
        <p>
          Thank you to the families who have already written in. Many of you have offered help, asked
          good questions, and shared ideas. The recovery work is further along than it may appear from
          the outside, and several of the suggestions families have raised are already in motion. The
          best thing families can do right now is share their experience through the family impact form
          if they have not already, and otherwise hold the questions until the next update.
        </p>
      </section>

      <section className="recovery-section recovery-note">
        <h2>Transparency Boundary</h2>
        <p>
          This page will not include student information, private contact information, raw phone records,
          or the specific contents of correspondence with vendors. Those records are being preserved
          separately. Keeping the strategic side of the recovery work private is what allows it to land
          cleanly with the vendors involved. The goal here is to give families a clear view of the major
          recovery steps without overwhelming everyone with raw files or compromising the case.
        </p>
      </section>
    </main>
  );
}
