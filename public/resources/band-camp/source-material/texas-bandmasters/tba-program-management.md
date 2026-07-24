# TBA Mining Notes: Program Management

Sources:

- [TBA Document Library catalog](tba-document-library.md)
- Program Management category: 81 catalog rows, 79 direct PDF downloads available on 2026-05-24.
- Local catalog filter: `data/tba-document-library.csv` where `categories` includes `Program Management`.

## Core Takeaway

The Program Management documents point to one practical thesis: a band program stays healthy when the director builds systems before the urgent moment.

The recurring systems are:

- communication chain
- admin relationship
- parent relationship
- staff role clarity
- calendar and long-range planning
- money/resources procedures
- grade and eligibility monitoring
- sectional/rehearsal planning
- fire-prevention routines

For BDOS, this is a direct fit. Most of Rob’s fuzzy points are not music problems. They are unmanaged context, unclear ownership, late communication, or repeated manual coordination.

## High-Value Source Set

- [Organizational Communication: Getting the Message Out](https://texasbandmasters.org/wp-content/uploads/2023/11/2014-06-vandewalker.pdf)
- [Communicating With Your Administrators: How To Talk So Principals Will Listen](https://texasbandmasters.org/wp-content/uploads/2023/10/2022_ghinelli.pdf)
- [Empowering Effective Communication with Administrators](https://texasbandmasters.org/wp-content/uploads/2026/01/2025_9_Alstrin_Bailey.pdf)
- [How to Successfully Communicate with Your Administrator](https://texasbandmasters.org/wp-content/uploads/2026/01/How-to-Successfully-Communicate-with-Your-Administrator-Clinicians-John-Alstrin-Dr.-Christopher-Bailey.pdf)
- [From Lawn Mower to Seed Sower: Cultivating Positive Parent Relationships](https://texasbandmasters.org/wp-content/uploads/2026/01/From-Lawn-Mower-to-Seed-Sower-Cultivating-Positive-Parent-Relationships-Clinician-Loren-Taylor.pdf)
- [Blending Well With Others: Cultivating a Cohesive Band Staff](https://texasbandmasters.org/wp-content/uploads/2023/10/2022_davis.pdf)
- [Great Middle School Band Teams: How Successful Staffs Work Together on Campuses and Across Campuses](https://texasbandmasters.org/wp-content/uploads/2023/11/Great-Middle-School-Band-Teams-Hanegan-Pascasio-Porter-Brandon.pdf)
- [See a Need, Fill a Need: Roles of Assistant Directors on a Team](https://texasbandmasters.org/wp-content/uploads/2024/08/See-a-Need-Fill-a-Need-Roles-of-Assistant-Directors-on-a-Team.pdf)
- [The Power of Planning](https://texasbandmasters.org/wp-content/uploads/2023/10/2023_barrera.pdf)
- [How to Get the Resources Needed for Your Program: Developing, Implementing, and Sustaining a 5 Year Plan](https://texasbandmasters.org/wp-content/uploads/2023/11/How-to-Get-the-Resources-needed-for-Your-Program-5-Year-Plan-Johnson-Lemish.pdf)
- [There is ALWAYS a Fire!](https://texasbandmasters.org/wp-content/uploads/2024/08/There-is-ALWAYS-a-Fire.pdf)
- [How to Plan and Structure Your Sectionals](https://texasbandmasters.org/wp-content/uploads/2023/11/How-to-Plan-and-Structure-Your-Sectionals-Greg-Dick.pdf)
- [Is Grade Check at The Bottom of Your List? Wrong!!](https://texasbandmasters.org/wp-content/uploads/2023/11/2005-12-ruiz1.pdf)
- [Avoiding Trouble at Work](https://texasbandmasters.org/wp-content/uploads/2023/11/Avoiding-Trouble-at-Work-King-Myers-Warshaw.pdf)
- [Managing the Three Ring Circus: Marching, Concert, & Jazz Bands](https://texasbandmasters.org/wp-content/uploads/2023/11/2010-alvarado.pdf)
- [The Total Band Program](https://texasbandmasters.org/wp-content/uploads/2023/11/2021_Drinkwater.pdf)

## BDOS Translation

### 1. Communication Needs A Chain

The communication sources repeatedly stress specificity, consistency, and repetition. The practical issue is not “send more email.” It is deciding:

- who needs to know
- what they need to know
- by when
- through which channel
- who owns the update
- where the official version lives

BDOS application:

- Every event arc should include a communication map.
- Parent/student/admin versions should draw from the same source facts.
- `now.md` should hold the open loop, not the entire explanation.
- Reusable language belongs in `references/templates/`.

### 2. Admin Trust Is Built Before The Ask

The administrator-communication materials focus on becoming legible to principals and admin teams.

Useful habits:

- communicate early, especially around schedule, money, facilities, transportation, and parent-facing decisions
- bring options and implications, not just problems
- make the band program visible as a school asset
- avoid surprises
- document decisions and follow-through

Ashley application:

- Before major events, prepare one admin-facing brief: purpose, dates/times, student impact, facility needs, transportation, money, risks, asks.
- For recovery or conflict-prone issues, separate facts from recommendations.
- Add admin-facing templates only after they are used more than once.

### 3. Parent Relationships Start Before Problems

The parent-relationship sources match the recruiting/retention notes: parents trust programs that make the path clear before anxiety rises.

Useful habits:

- front-load calendars, cost, expectations, and contact path
- make hardship/payment paths normal and private
- invite parent help into defined lanes
- keep parent communication predictable
- avoid letting parent volunteers become informal policy-makers

Ashley application:

- For marching band, parent trust runs through the signup form, fee path, Signing Day, summer-band reminders, and first-week communication.
- For trips/events, parent trust runs through clear timelines, money transparency, and fast post-decision documentation.

### 4. Staff Roles Need Visible Ownership

The staff/team documents emphasize role clarity and shared language.

Useful staff map fields:

- primary class/ensemble responsibility
- event responsibility
- communication responsibility
- inventory/equipment responsibility
- student support responsibility
- admin/parent interface limits
- what this person should escalate

Ashley application:

- For SER, create a small staff responsibility table before summer band.
- For any assistant/tech role, name both the job and the boundary.
- For major events, list the single owner for each operational lane.

### 5. Planning Needs Multiple Horizons

The planning documents separate daily, weekly, monthly, yearly, and multi-year thinking.

BDOS already supports this if used cleanly:

- `now.md`: this week and open loops
- `projects/`: active project details
- `data/calendar-2026.csv`: hard dates only
- `references/event-arcs/`: recurring annual systems
- `decisions/log.md`: decisions and rationale

Ashley application:

- When a recurring event is done, convert the process into an event arc instead of rebuilding it next year.
- When a problem happens three times, it is a system candidate for `/level-up`.
- Long-range needs like uniforms, instruments, trailers, and major trips need separate project pages or structured CSVs, not scattered notes.

### 6. Fire Prevention Beats Fire Response

The “There is ALWAYS a Fire!” material is especially BDOS-aligned. The issue is not that fires happen; it is whether every fire consumes the director.

Common preventable fire categories:

- calendar conflicts
- transportation details
- parent confusion
- staff unclear on duties
- missing supplies/equipment
- late publicity
- grade/eligibility issues
- money/accounts confusion
- facility surprises

Ashley application:

- Add pre-event checklists to event arcs.
- Use `data/calendar-2026.csv` for confirmed space-time only.
- Keep deliverables as tasks, not calendar events.
- Add “risk/known load” notes to project files, as already done for the Oct. 24 marching-band load.

### 7. Eligibility And Student Support Are Management Systems

Grade-check and eligibility notes frame academics as part of program care, not a last-minute compliance task.

Ashley application:

- Before heavy marching weeks, identify students who need academic support early.
- For competition season, create a repeatable grade/eligibility check rhythm if the school process allows it.
- Treat academic support as parent/admin trust-building, not just avoiding lost performers.

### 8. Sectionals Need A Purpose

The sectional-planning material argues against “having sectionals to have sectionals.”

Useful questions:

- What is the goal?
- Who needs to be there?
- What music/skill is impossible to fix efficiently in full rehearsal?
- How will progress be tracked?
- What should students prepare before the next sectional?

Ashley application:

- For concert season, create sectional plans from repertoire demands.
- For marching season, use sectionals only where they solve a specific musical or technical problem.
- Track the sectional goal in the project/event file, not only on a whiteboard.

## Reusable BDOS Checklist

Before a major band event or season phase:

- Is there one canonical source file?
- Are hard dates in `data/calendar-2026.csv`?
- Are deliverables in `now.md` or the project file?
- Is parent communication drafted from source facts?
- Is admin communication clear about asks and risks?
- Are staff/volunteer roles named?
- Is money/accountability handled through the right source?
- Is there a known-risk list?
- Is there a post-event path to convert lessons into an event arc?

## Next BDOS Moves

- Build an admin-facing brief template if Rob has another admin ask this month.
- Add a staff-role table to `projects/marching-band/` before July preseason.
- Turn “communication chain” into a small SOP or template after it is used on one real event.
- Mine `Pedagogy-Ensemble` next for fundamental/rehearsal systems.

