export const metadata = {
  title: "Spring Trip Recovery Updates | Bands of AHS",
  description: "Family-facing status updates for the Ashley Bands Spring Trip 2026 cancellation recovery process."
};

const timeline = [
  {
    time: "Friday, May 15 · approximately 3:30 PM",
    title: "Trip cancelled",
    body: "The charter bus did not arrive as scheduled. After working through the situation and attempting to identify replacement transportation, the trip had to be cancelled and students were sent home."
  },
  {
    time: "Friday, May 15 · 6:01 PM",
    title: "Initial family update sent",
    body: "Families were notified that the trip was cancelled and that follow-up would continue once the transportation vendor provided written documentation."
  },
  {
    time: "Friday, May 15 · 6:54 PM",
    title: "CharterUP written confirmation received",
    body: "CharterUP confirmed in writing that the bus provider was no longer able to service the trip and that alternate provider options within their marketplace had been exhausted."
  },
  {
    time: "Friday, May 15 · evening",
    title: "Vendor recovery requests sent",
    body: "Refund and exception requests were sent to the hotel and to Music in the Parks / Festival's Edge. CharterUP's written cancellation confirmation was forwarded as documentation."
  },
  {
    time: "Friday, May 15 · 10:43 PM",
    title: "Formal CharterUP follow-up sent",
    body: "A written follow-up was sent to CharterUP requesting documentation and clarification about the transportation failure. CharterUP acknowledged the request and assigned an internal ticket."
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
    detail: "A refund / exception request has been sent. Primary contact returns Monday, May 18."
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
  "Wait for CharterUP's response to the formal documentation request submitted Friday night.",
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
        <div className="recovery-updated">Last updated: Saturday, May 16, 2026 · 12:00 PM</div>
      </section>

      <section className="recovery-section recovery-note">
        <h2>Current Status</h2>
        <p>
          CharterUP has confirmed in writing that the transportation could not be provided and has submitted
          a full refund for the bus cost. Requests have also been sent to the hotel and festival vendors.
          At this point, final family refund amounts cannot be determined until vendor responses are received
          and the trip account is reconciled.
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
