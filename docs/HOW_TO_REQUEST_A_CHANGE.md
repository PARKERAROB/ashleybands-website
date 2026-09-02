# How to ask for any AshleyBands website change

You do not need to write a Jira ticket, know the right repository file, or prescribe the solution.
Ask in plain language. The agent is responsible for finding or creating the GitHub issue, identifying
the authoritative source, protecting private information, and returning evidence when the outcome is
complete.

## The universal request

This one sentence is enough:

> Change **[the thing]** so that **[the result I want]**. Keep **[anything that must not change]**.
> **[Investigate only / prepare but do not deploy / complete and deploy.]**

Only the first two parts are essential. If release intent is omitted, action words such as *change*,
*fix*, *build*, *add*, or *remove* mean complete the outcome, including checked deployment when the
live site must change. Say *investigate only*, *draft only*, *local only*, or *do not deploy* when you
want a stopping point before release.

## Common request shapes

### Change or new feature

> Add a way for families to see whether their Carnegie deposit has been received. Do not expose
> payment details. Complete and deploy it.

Helpful, but optional: who needs it, what success looks like, and what must remain unchanged.

### Bug

> Fix the calendar on phones. September 12 is wrapping onto the next event card. I saw it on an
> iPhone. Complete and deploy it.

Helpful, but optional: page or URL, device, what happened, and what you expected.

### Content or date update

> Change the public rehearsal time on September 18 to 5:30 PM. The confirmed source is the band
> calendar. Complete and deploy it.

If the fact is not yet confirmed, say that. The agent must not turn a proposed date into published
truth.

### Investigation without a change

> Investigate why some guardians are missing from the newsletter preview. Do not change data or send
> anything. Tell me the cause and safest options.

This authorizes diagnosis, not implementation.

### Private student or family matter

> A family says their student is missing from the portal. Check the private roster and portal. Do not
> put their name or details in GitHub. Fix and deploy only if the identity match is certain.

Give the identity in the private conversation, never in a public GitHub issue. The agent will use a
sanitized case label in the issue if a code change is necessary.

### Urgent live problem

> Urgent: the live portal appears to expose information to the wrong family. Contain the exposure
> immediately, preserve evidence, and then diagnose it. Do not send messages to families.

Use *urgent* for active harm, not merely a close deadline. Safety containment comes before normal
workflow bookkeeping; verification and the issue record still follow.

### Small visual or wording correction

> Change the Booster Meeting button to say “September Booster Meeting.” Keep the destination and
> design unchanged. Complete and deploy it.

Small changes still receive a work item and live readback, but the issue and checks stay
proportionate.

### A fuzzy idea

> I want the attendance screen to feel faster during rehearsal, but I am not sure what needs to
> change. Help me work it out before building anything.

The agent should clarify the outcome with you. It should not create implementation tickets for every
idea discussed.

## What the agent should give back

A completed change receipt should answer four things in plain language:

1. **Changed:** what is now different.
2. **Evidence:** what tests, deployment checks, and live readbacks passed.
3. **Remaining exposure:** anything uncertain, blocked, or deliberately left open.
4. **Your next move:** only something that genuinely requires your judgment or action.

You should never have to ask whether “done” means planned, coded, pushed, deployed, or verified. The
receipt must say which of those states was actually observed.
