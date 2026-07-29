"use client";
import { useState } from "react";

/* ------------------------------------------------------------------ atoms */

const STATUS_STYLE = {
  FROZEN: { bg: "#7b1829", fg: "#fff" },
  stated: { bg: "#e8ddc4", fg: "#4a4231" },
  floated: { bg: "#e4e9ef", fg: "#41505f" },
  open: { bg: "#fbe7d2", fg: "#7a4a18" },
  installed: { bg: "#dcead9", fg: "#2f4c2a" },
};

function Chip({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.stated;
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}

function Collapse({ title, status, sub, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        marginBottom: 10,
        background: "var(--paper-strong)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: "14px 18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {title}
            {status ? <Chip status={status} /> : null}
          </div>
          {sub ? (
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 3 }}>{sub}</div>
          ) : null}
        </div>
        <span
          style={{
            fontSize: 18,
            color: "var(--muted)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          {"▾"}
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "4px 18px 18px",
            borderTop: "1px solid var(--line)",
            fontSize: 14.5,
            lineHeight: 1.65,
            color: "var(--ink)",
          }}
          className="brief-body"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function H2({ children, note }) {
  return (
    <div style={{ marginTop: 48, marginBottom: 14 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{children}</h2>
      {note ? (
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "6px 0 0" }}>{note}</p>
      ) : null}
    </div>
  );
}

function Rows({ head, rows }) {
  return (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14, minWidth: 420 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "7px 10px",
                  borderBottom: "2px solid var(--line)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  style={{
                    padding: "7px 10px",
                    borderBottom: "1px solid var(--line)",
                    verticalAlign: "top",
                    color: j === 0 ? "var(--ink)" : "var(--ink)",
                    fontWeight: j === 0 ? 600 : 400,
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Term({ name, status, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <code
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--garnet-dark)",
            background: "none",
            padding: 0,
          }}
        >
          {name}
        </code>
        {status ? <Chip status={status} /> : null}
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function WordList({ label, words }) {
  return (
    <p style={{ margin: "0 0 10px" }}>
      <strong>{label}</strong>{" "}
      <span style={{ color: "var(--ink)" }}>
        {words.map((w, i) => (
          <span key={w}>
            <code style={{ background: "none", padding: 0, fontSize: 14 }}>{w}</code>
            {i < words.length - 1 ? " · " : ""}
          </span>
        ))}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------- page */

export default function LeadershipBriefClient() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">
        <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
          Bands of Ashley High School
        </a>
        {" · "}
        Screaming Eagle Regiment
        {" · "}
        Leadership
      </p>
      <h1>Regiment OS: where we are</h1>
      <p className="lede">
        Every decision made so far, the two hierarchies, the rehearsal day block by block, and the
        full library of terms. Current as of July 29, 2026. Camp opens August 3.
      </p>

      <div
        style={{
          background: "var(--paper-strong)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "18px 22px",
          marginBottom: 14,
          fontSize: 15,
          lineHeight: 1.7,
        }}
      >
        <p style={{ margin: "0 0 10px" }}>
          <strong>Regiment OS is the system. Band camp is the install.</strong> The question this
          answers is what the marching band needs, operating-system-wise, in order to work. Camp is
          only the window where it gets put in place.
        </p>
        <p style={{ margin: 0 }}>
          This is the working state, not a finished handbook. Read it to review, argue, and find what
          is wrong. Most of it is not locked yet, and the tags below tell you exactly how much weight
          each line carries.
        </p>
      </div>

      {/* ---------------------------------------------------- how to read */}

      <div
        style={{
          background: "#f0f4f8",
          border: "1px solid #ccd6df",
          borderRadius: 10,
          padding: "18px 22px",
          marginBottom: 8,
          fontSize: 14.5,
          lineHeight: 1.7,
        }}
      >
        <strong>How to read the tags.</strong>
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <div>
            <Chip status="FROZEN" />{" "}
            Locked. Only Mr. Parker freezes something, and only by saying so in words. Frozen items
            are the only things that get taught to students as settled.
          </div>
          <div>
            <Chip status="stated" />{" "}
            He said it, on the record. Still not frozen. However much it reads like doctrine.
          </div>
          <div>
            <Chip status="floated" /> Came up, not resolved.
          </div>
          <div>
            <Chip status="open" /> The slot exists and nothing is in it yet.
          </div>
          <div>
            <Chip status="installed" /> Taught, with evidence students own it.
          </div>
        </div>
        <p style={{ margin: "12px 0 0" }}>
          <strong>Absence of a tag never means settled.</strong> Exactly one item in the whole system
          is frozen right now: <code>low</code>.
        </p>
      </div>

      {/* --------------------------------------------------------- charter */}

      <H2 note="The argument the rest of this rests on.">Why any of this exists</H2>

      <Collapse
        title="One hundred percent is a constant; scope is the variable"
        status="stated"
        sub="The load-bearing piece. Why leadership exists at all."
        defaultOpen
      >
        <p>
          Students can count on always getting one hundred percent of Mr. Parker. In his words, it is
          just a default state: when he is working, he is working as hard as he can.
        </p>
        <p>
          <strong>So delegation never means he gives less.</strong> It means his hundred percent
          scopes to a smaller target, and that is where the leverage is. Fifty students in the band
          room with him rehearsing the full band makes everything better, and a lot of it better
          well. But what makes an individual student better is his whole attention pointed at that
          student.
        </p>
        <p>
          <strong>Leadership&rsquo;s job is to help ensure Mr. Parker is doing only what only Mr.
          Parker can do.</strong> That list is short: make the parent phone call, escalate to the
          principal, set the vision and the standard, and write the rehearsal plan for the next two
          weeks so everyone is on board.
        </p>
        <p>
          <strong>The failure state is not laziness. It is dilution.</strong> If he is also the brass
          tech, the woodwind tech, the front ensemble tech, the guard tech, the drum major tech, the
          music person and the visual person, the hundred percent is still there. It is just poured
          into many buckets instead of the one it serves best.
        </p>
        <p>
          <strong>The test for any proposed delegation:</strong> does this move his hundred percent
          toward something only he can do, or does it just move a task? A leader who takes work off
          him is not reducing the attention on the band. They are increasing its resolution.
        </p>
      </Collapse>

      <Collapse title="Install time versus runtime" status="stated" sub="Why camp is expensive on purpose.">
        <blockquote style={{ margin: "0 0 10px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          If you have to explain front sideline in October, that is frustration. If you explain front
          sideline the second day of band camp, that is onboarding. Installation.
        </blockquote>
        <p>Three things follow:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>
            <strong>Sequencing.</strong> Anything needed at runtime gets installed at install time,
            or it is paid for at ten times the cost during the season.
          </li>
          <li>
            <strong>Diagnosis.</strong> An in-season frustration is a missed install, not a
            discipline problem.
          </li>
          <li>
            <strong>Budget.</strong> Camp costs what it costs because installation is front-loaded by
            design.
          </li>
        </ul>
      </Collapse>

      <Collapse title="Frustration is where learning happens" status="stated">
        <p>
          Frustration is the distance between what you know and what you do not, and Mr. Parker will
          not promise its absence. The useful question is whether the workload is frustrating because
          it is too much, or because you lack the tools you need. Often both.
        </p>
        <p>
          <strong>The frustration that is misdirected</strong> is watching people unwilling to enter
          that zone at all. That is the kind this system can actually remove.
        </p>
      </Collapse>

      <Collapse title="The system must not think for the student" status="stated">
        <p>
          It removes what has already been decided so attention is available for what actually needs
          thinking about. The purpose of education is students who think for themselves, especially
          when the system in question could very well think for you.
        </p>
        <p>
          This is also the limit on the whole project. Pinning down what was assumed is the
          instrument working. Deciding something that should have been left to a person in the moment
          is over-specification. Both feel the same at first.
        </p>
      </Collapse>

      <Collapse title="The handoff is the actual product" status="stated">
        <blockquote style={{ margin: "0 0 10px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          Could what we achieve be handed off to an entirely different band, and if they follow it,
          they will have success?
        </blockquote>
        <p>
          Three years out, a freshman who is now a junior still knows what <code>sip and dip</code>{" "}
          means. The glossary exists so an argument on the bus gets settled by looking it up. Stated
          horizon: not this year. Three years from now.
        </p>
        <p>
          Sixteen seniors this year against eight last year. That institutional knowledge is the
          reason this work is possible now, and the reason to spend camp on it.
        </p>
      </Collapse>

      <Collapse title="Camp outcome and the release criterion" status="stated">
        <p>
          <strong>The outcome:</strong> the operating system is fully installed and operational. Note
          what that is not. It is not an amount of drill learned, and he said so explicitly when
          asked whether the camp outcome was movement one.
        </p>
        <p>
          <strong>His prediction if it is installed:</strong> the entire first movement, marching and
          playing, no metronome, no soundtrack, ready to perform.
        </p>
        <p>
          <strong>The observable version:</strong> a rehearsal segment runs start to finish without
          staff narrating any transition. Everything required for that is v1. Everything else is
          later.
        </p>
      </Collapse>

      <Collapse title="Trade-offs are not errors" status="stated">
        <p>
          Wanting something the program is not currently pointed at is a choice about allocation, not
          a wrong opinion. Jazz nationals, a symphonic orchestra: nothing wrong with them. They are a
          feature set not funded this release, and the cost of adding one is what goes on the back
          burner.
        </p>
        <p>
          Mr. Parker&rsquo;s own stated position is <strong>benevolent dictator</strong>. He owns the
          direction. The benevolence is that he says where he is going and invites people to come.
        </p>
      </Collapse>

      <Collapse title="What the students said they want from the season" status="stated">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>Less choreography for its own sake, more rehearsal time on music.</li>
          <li>
            Drumline central and purposeful, memorized early, not an afterthought in choreography.
          </li>
          <li>A captivating show.</li>
          <li>
            To be underestimated on sight and then not. His refinement: no juxtaposition at all. The
            audience hears the first phrase, knows it will be good, and is then proven right.
          </li>
          <li>DCI-style meaning. A story you can feel.</li>
          <li>Choreography tied to accents, theme, and position in the story.</li>
          <li>
            Better general effect. His definition: pre-planned arrival moments, performed
            appropriately.
          </li>
          <li>People enjoying it enough to come back next year.</li>
        </ul>
      </Collapse>

      {/* ------------------------------------------------------ the test */}

      <H2 note="The standard every block gets judged against.">The acceptance test</H2>

      <div
        style={{
          border: "2px solid var(--garnet)",
          borderRadius: 10,
          padding: "18px 22px",
          marginBottom: 10,
          fontSize: 15.5,
          lineHeight: 1.7,
          background: "var(--paper-strong)",
        }}
      >
        <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 17 }}>
          Mr. Parker is in the hospital for one day. Camp follows this schedule and nobody has to ask
          why.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          This is the strongest standard stated for any part of the system, because it cannot be
          passed by him knowing things. A substitute holding this page can run the block, and no
          student has to ask a question the page does not answer.
        </p>
        <p style={{ margin: 0 }}>
          <strong>What it exposes:</strong> the schedule is the container. The day&rsquo;s outcomes
          are the payload. A defined block with no stated outcome for that particular day gets a
          substitute to the field and no further. Passing the test requires a{" "}
          <strong>daily plan written and visible before the day starts</strong>, and that artifact
          does not exist yet. It is the highest-leverage missing thing in the system.
        </p>
      </div>

      {/* ------------------------------------------------------- authority */}

      <H2 note="Two hierarchies. Confusing them is how this gets tangled.">Authority</H2>

      <Rows
        head={["", "what it governs", "shape"]}
        rows={[
          [
            "Instruction hierarchy",
            "Who may correct, and whose outcome wins, inside a rep. About perspective, big picture to individual.",
            "box → section → self",
          ],
          [
            "Command hierarchy",
            "Who is in charge of a block, and who acts when the person above is absent. About continuity.",
            "the ladder below",
          ],
        ]}
      />

      <Collapse title="Command hierarchy" status="stated" sub="Who runs the block. Six levels." defaultOpen>
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          In any potential rehearsal block, the highest ranking member is the one who does that stuff.
        </blockquote>
        <ol style={{ paddingLeft: 20 }}>
          <li>
            <strong>Mr. Parker.</strong>
          </li>
          <li>
            <strong>Jessica Meade.</strong> Effectively co-director, building supervisor, school staff
            member. Owns guard entirely.
          </li>
          <li>
            <strong>Staff.</strong> Whichever staff member is in charge of that block or situation.
            They act by following the outlined plan and schedule that has been communicated, or by
            following the defaults.
          </li>
          <li>
            <strong>Band parents.</strong> Adults, and an adult ranks above a student on principle. In
            practice they are good at reading when to step in and when to defer, and they most often
            defer to student leadership. The ranking is about authority available, not authority
            exercised.
          </li>
          <li>
            <strong>Student leadership.</strong>
          </li>
          <li>
            <strong>Grade level</strong>, senior down to eighth grader.
          </li>
        </ol>
        <p>
          <strong>The dependency this exposes.</strong> Level 3 and below act by following the plan
          and the defaults. So the ladder only works to the degree the plan is written and the
          defaults exist. <strong>An unwritten plan collapses the hierarchy to level 1</strong>, which
          is the same finding as the missing daily plan, arriving from a different direction.
        </p>
        <p>
          Leadership designed this on 7/28 and Mr. Parker corrected it in the room. The first attempt
          was director, staff, DM, leadership, self. He replaced it on the principle{" "}
          <strong>perspective first, big to individual</strong>.
        </p>
        <p>
          <strong>A student&rsquo;s own parent is not on this ladder at all</strong>, and for their own
          child they sit above him. See leave approval below.
        </p>
      </Collapse>

      <Collapse title="Instruction hierarchy: box, section, self" status="stated" sub="Three levels, and he said that is all that is needed.">
        <p>
          <strong>Why hierarchy at all.</strong> Undefined, whoever is talking wins. Two people talk
          at once and you get a hierarchy fight and frustration. It has to be defined and sequential,
          and it does not have to start with him.
        </p>
        <p>
          <strong>Box.</strong> Sees what the audience sees. Addresses the full ensemble, never an
          individual. Assesses the outcome, then establishes the next one. The analogy he used is the
          preacher: talking to everyone, and if it applies to you, listen. If he is on the field,
          instruction does not come from him first, because from there he only sees the one player
          whose feet are out of time and the ensemble does not need to hear about that player.
        </p>
        <p>
          <strong>Section.</strong> Assesses against the box&rsquo;s outcome. If the section is aligned
          or has not yet achieved it, keep the box&rsquo;s outcome and do nothing else. If already
          achieved, the section may set a new outcome inside the parameters. His example: the box is
          working shoulders, clarinets already have shoulders, so they drill crossing counts so count
          7 hits the yard line.
        </p>
        <p>
          <strong>Self.</strong> Listen, then ask whether your own outcome aligns with the
          box&rsquo;s. If the box is working what you need, work that and nothing else. If you are
          past it, you may drill down, but only ever to <strong>one thing</strong>.
        </p>
        <p>
          <strong>Expected distribution.</strong> Freshmen mostly need the box. Seniors are mostly
          moving the section. <strong>Every individual must know their own outcome before Set is
          called.</strong>
        </p>
        <p>
          <strong>Who runs which.</strong> Staff run the box and most of the section. Leadership runs
          the section and the self.
        </p>
      </Collapse>

      <Collapse title="Box occupancy, and how it degrades" status="stated" sub="Whoever is in the box is the box. It is a seat, not a person.">
        <ul style={{ paddingLeft: 20 }}>
          <li>
            <strong>No one in the box:</strong> the drum major becomes the box, running it from the
            podium.
          </li>
          <li>
            <strong>Mr. Parker absent:</strong> a staff member takes the box. Visual staff, a
            consultant, the colorguard instructor. The identity does not matter, the assignment does.
            Someone is watching the entire program and giving feedback on the entire program.
          </li>
          <li>
            <strong>Zero staff:</strong> the drum major runs everything from the podium, doing both
            the DM job and the box job. Harder, and the reason it is avoided, but a defined fallback
            rather than a failure.
          </li>
        </ul>
        <p>
          This closes the single-point-of-failure hole. The box degrades gracefully, and the seat is
          never empty in a way that stops the loop.
        </p>
      </Collapse>

      <Collapse title="Instructor absent means sectionals" status="stated" sub="The general fallback, not a per-block patch.">
        <p>
          Not &ldquo;box absent.&rdquo; <strong>The instructor</strong>, meaning the thinker, the one
          setting outcomes. Whenever the instructor is absent from any block:
        </p>
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--ink)", fontWeight: 600 }}>
          Sectional time. One outcome at a time, run by the first-tier players, facilitated by
          leadership.
        </blockquote>
        <p>
          <strong>Why it holds up.</strong> It only requires that someone is thinking, or that the
          group can reach consensus on what needs work. Worst case it produces repetition and the
          chance to find what is actually going wrong. Best case, sectional time used well makes
          individual and small-group progress far faster than large-group progress.
        </p>
        <p>
          <strong>Who runs it.</strong> Typically the first-tier players, who may hold no formal
          title. Leadership still carries the responsibility to facilitate. Handing authority to
          whoever is better suited in the moment is normal and expected.
        </p>
        <p>
          <strong>Requires, and none of it is written yet:</strong> a location, an expectation of
          behavior, and a general understanding of who holds the hierarchy in that group.
        </p>
      </Collapse>

      <Collapse title="What student leadership is responsible for" status="stated" sub="Scoped deliberately, because the failure mode is leadership inventing consequences.">
        <Rows
          head={["", "responsible for"]}
          rows={[
            ["A student", "themselves"],
            [
              "Leadership",
              "the general student body, meaning the standard, not an individual's conduct record",
            ],
          ]}
        />
        <p>
          <strong>Leadership does:</strong> set a standard and expectation, help maintain it in the
          social setting, and escalate to staff when need be.
        </p>
        <p>
          <strong>Leadership does not:</strong> give discipline. Does not assign consequences.
          Unintended or inappropriate consequence-giving is explicitly outside the role. It is not a
          thing leadership got wrong, it is a thing leadership was never granted.
        </p>
        <p>
          <strong>Why the boundary is drawn here.</strong> Escalation is the pressure-release valve. A
          leader with no authority to punish and no path to escalate will invent punishment, because
          something has to happen. The escalation path is what makes the deny survivable.
        </p>
      </Collapse>

      <Collapse title="Escalation is a judgment, not an access list" status="stated" sub="The most portable design principle in the system.">
        <p>
          The lunch rule reads <em>only the drum major interacts with staff</em>. That is a
          description of the routine channel, not a door policy, and he rejected reading it as one:
        </p>
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          If I see one of my seniors in the leadership open the door and look directly at me, I am not
          going to question him and say why are you here, only the drum major can come in. That is not
          the intent of the role. I am going to look at him and go, what is up?
        </blockquote>
        <p>
          <strong>The mechanism is that the leader already understands why staff are in the
          room.</strong> A leader who comes through the door anyway has, by coming, communicated that
          there is a fight, or a problem that cannot be solved right now, and we need you. That is an
          appropriate escalation.
        </p>
        <p>
          <strong>The design principle, and it generalizes well past lunch.</strong> Where a rule
          names a person, check whether it means <em>that person only</em> or{" "}
          <em>that person by default</em>.{" "}
          <strong>
            A rule enforced past its intent produces the failure it was written to prevent.
          </strong>{" "}
          Here, a rule meant to protect staff attention was used to keep a senior out of the room
          during a fight. Where the two readings diverge, the intent wins and the named person is the
          default rather than the gate.
        </p>
        <p>
          <strong>The freshman is taught the rule. Leadership is taught the intent.</strong> That gap
          is the whole ownership progression.
        </p>
      </Collapse>

      <Collapse title="Leave approval, and the one authority above Mr. Parker" status="stated" sub="A standing rule for the whole day, not a lunch rule.">
        <p>
          <strong>Scope:</strong> from the moment rehearsal begins to the moment students are
          dismissed.
        </p>
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--garnet)", color: "var(--ink)", fontWeight: 600 }}>
          Any student needing to leave must be approved by the director, or the director&rsquo;s
          designee. No one else.
        </blockquote>
        <p>
          Not other staff. Not student leadership. Not a band parent on site. Those people should be{" "}
          <strong>informed</strong>, which is good practice and often necessary, but informing is not
          approving, and that is the distinction that fails in practice.
        </p>
        <p>
          <strong>The exception, and it is above him rather than below him.</strong> A student&rsquo;s
          own parent may take their own child, and outranks him in doing so. He is informed. He does
          not approve, because it is not his to approve.
        </p>
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          I am never going to gate a parent having access to their child inappropriately.
        </blockquote>
        <p>
          This is not a loophole in the rule. It is a limit on his authority and it is written as one.
          An earlier draft listed &ldquo;parents&rdquo; among those who must be informed rather than
          approve. That was wrong, and the error came from the word:{" "}
          <strong>
            bare &ldquo;parent&rdquo; collapsed the band parent and the student&rsquo;s own parent into
            one category
          </strong>
          . They are opposite ends of this rule. The vocabulary fix and this correction are the same
          fix.
        </p>
        <p>
          <strong>The designee.</strong> Mr. Parker absent means Jessica Meade, and from there it
          follows the command ladder.
        </p>
        <p>
          <strong>
            If neither he nor a designee is present who is genuinely running rehearsal, rehearsal is
            cancelled.
          </strong>{" "}
          Not &ldquo;runs with no leave authority.&rdquo; A designee in name who is not actually
          running rehearsal does not satisfy this.
        </p>
        <p>
          <strong>Why this one does not degrade like everything else.</strong> Every other authority
          passes down gracefully. The box seat goes staff to drum major. This one stops at the
          designee and then cancels the block instead. That is deliberate: leaving campus is the one
          action with no undo.
        </p>
        <p>
          <strong>The known failure mode:</strong> students with cars treat the car as the permission.
        </p>
      </Collapse>

      <Collapse title="Schedule authority" status="stated">
        <p>
          <strong>The schedule ends a block, not a person.</strong> Only the head director, or the
          head person in charge on the field at the time, may modify it, and only when conditions
          warrant. His example: 72 degrees with cloud cover, stay outside until noon, because combined
          outdoor field time becomes extremely scarce once camp ends while music time is plentiful
          after school starts.
        </p>
        <p>
          <Chip status="open" />{" "}
          <strong>Is &ldquo;head person in charge on the field&rdquo; the box, or a separate
          role?</strong> With Mr. Parker absent, a staff member in the box and another as
          head-on-field, nothing yet says which one ends the block. These two answers were given
          minutes apart and do not resolve each other.
        </p>
      </Collapse>

      <Collapse title="Guard is Meade's, completely" status="stated" sub="And the largest undegraded dependency in the system.">
        <p>
          <strong>Any guard block is hers.</strong> She is responsible for whatever it will be. Mr.
          Parker does not author it and does not need to.
        </p>
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          I do not know. And that is not a failure point for me, that is just a scoping in reality. I
          pay somebody to take that off my plate.
        </blockquote>
        <p>
          <strong>Her weight in the program, in his words:</strong> the most important person he has.
          The two of them alone could run this band, him running everything band and her running
          everything guard. Others genuinely lessen the load. She is the one the arrangement rests on.
        </p>
        <p>
          <strong>Without her:</strong> he can still make it work, but guard stops being an asset and
          becomes a thing he has to function with, and then everything loses a little of his
          attention, not just guard. That is the dilution failure named against a specific person.
        </p>
        <p>
          <Chip status="open" /> This is a single point of failure with no stated fallback. The box
          seat degrades, the designee degrades to cancelling rehearsal, guard has no ladder at all.
        </p>
      </Collapse>

      <Collapse title="The attendance chain" status="stated">
        <p>
          Section, then drum major, then Mr. Parker. Each section takes its own. The drum major
          consolidates and reports, and owns it, accountable for it happening even when Mr. Parker is
          the one doing the data entry into <code>Geo</code>. In his words, the drum major has to be
          the one who keeps pushing his buttons until it gets done.
        </p>
      </Collapse>

      <Collapse title="Still open in authority" status="open">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>
            <strong>Who authors the outcome.</strong> The box establishes it. He then said the outcome
            is set by the DM. Establishing versus stating is unresolved.
          </li>
          <li>
            <strong>The DM&rsquo;s veto.</strong> Granted explicitly, and he invited enforcement
            against himself. Scope undefined. Refusing to start is one thing; how often, and what
            happens next, is another.
          </li>
          <li>
            <strong>Ceiling on self-assigned outcomes.</strong> &ldquo;Inside the parameters&rdquo; is
            the only limit stated. Nothing distinguishes a legitimate drill-down from quiet
            disengagement.
          </li>
          <li>
            <strong>The 12:30 to 1:50 block has no box.</strong> Section and self only. Who authors
            the outcome there.
          </li>
          <li>
            <strong>Named people.</strong> Staff, DMs, section leaders are not recorded yet.
          </li>
        </ul>
      </Collapse>

      {/* ------------------------------------------------------------- day */}

      <H2 note="Week 1 is 8/3 to 8/7. Week 2 is 8/10 to 8/14. 7:00 AM to 3:00 PM, and the 3:00 end is firm.">
        The rehearsal day
      </H2>

      <Rows
        head={["Time", "Block", "Operational meaning"]}
        rows={[
          ["7:00–10:00", "Outdoor visual rehearsal", "Students are ready to begin outdoor work at 7:00"],
          [
            "10:00–10:15",
            "Transition indoors",
            "Movement, equipment, hydration, readiness. Visible scheduled work",
          ],
          ["10:15–11:45", "Music rehearsal", "Indoor musical capability and application"],
          [
            "11:45–12:30",
            "Lunch, including transition",
            "Lunch and all movement in and out fits inside the block",
          ],
          ["12:30–1:50", "Discipline-specific work", "Groupings and outcomes undefined"],
          ["1:50–2:00", "Transition to full band", "All groups move and become ready"],
          ["2:00–2:50", "Combined band", "Full-ensemble capability and application"],
          [
            "2:50–3:00",
            "Cleanup, announcements, dismissal",
            "Reset people, equipment, spaces, information",
          ],
          ["3:00", "Camp ends", "The end time is firm"],
        ]}
      />

      <div
        style={{
          background: "#f0f4f8",
          border: "1px solid #ccd6df",
          borderRadius: 10,
          padding: "16px 20px",
          margin: "14px 0 20px",
          fontSize: 14.5,
          lineHeight: 1.7,
        }}
      >
        <p style={{ margin: "0 0 10px" }}>
          <strong>This is the default schedule, not a fixture.</strong> A default exists so nobody has
          to decide in the moment. It is the state that is true most of the time, not the state that is
          true always.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          <strong>An adjustment is legal when it is accepted, stated, understood and known</strong>, in
          advance, not discovered. If the front ensemble needs twenty minutes rather than fifteen, that
          is a fine adjustment and a bad surprise. The rule is not never change the schedule. It is
          never change it silently.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Schedule rules:</strong> block start times are firm; students know the readiness
          condition required at each start; transition time is explicit and may not be silently
          borrowed by the preceding block; the final ten minutes are an instructional and operational
          block, not leftover time; students are released and camp ends at 3:00.
        </p>
      </div>

      <Collapse title="Before 7:00 — arrival, call time, attendance" status="stated" sub="There is no official call time for a rehearsal day. Rehearsal starts at 7:00.">
        <Rows
          head={["who", "default call"]}
          rows={[
            ["staff and leadership", "30 minutes before rehearsal start"],
            ["all membership", "15 minutes before rehearsal start"],
          ]}
        />
        <p>
          Expected to shift as prop committee, front ensemble committee and any other role with
          responsibility beyond personal equipment comes online. Anyone who has to work with someone
          else or set something up may need an earlier call.
        </p>
        <p>
          <strong>Arrival location is deliberately undefined, and that is the decision, not a
          gap.</strong> Members may do whatever they need in order to prepare. Typically the band room
          first, but only because that is where the things they need are. The requirement is readiness
          at 7:00, not a route. <code>pretty</code> happens on the way, off the field.
        </p>
        <p>
          <strong>Field setup must be complete before 7:00.</strong> The field is already set when
          rehearsal starts. Setup is not part of the block. Dependencies: leadership crew, paint crew,
          prop crew, front ensemble crew, plus every individual&rsquo;s own equipment.{" "}
          <Chip status="open" /> the actual task list per crew, and who is on each committee. Mr.
          Parker assigns once tasks are enumerated.
        </p>
        <p>
          <strong>Attendance is taken at 7:00 exactly</strong>, complete by 7:01, or at minimum a
          snapshot as of 7:01. Anyone not present at that point is late, and everything after is
          exception handling. Each section takes its own and reports to the drum major, who reports to
          Mr. Parker. Sections looking around and naming who is missing is the whole point. Him
          scanning for absent individuals while doing something else is the named failure mode and the
          reason attendance has always bogged down.
        </p>
        <p>
          <strong>System of record is <code>Geo</code>.</strong> If attendance is not in the app,
          attendance did not get done. A paper record elsewhere does not count until it is entered.
          Students may self-check-in through a check-in window; the drum major is responsible for the
          actual input, or at minimum for recording who is missing.
        </p>
        <p>
          <strong>Late.</strong> A late member checks in with the drum major, something close to{" "}
          <em>good morning, checking in, I am late as of [time]</em>, and immediately joins. It should
          cost no meaningful time. <strong>There is no penalty for being late.</strong> Being late is a
          broken contract, and checking in fulfills it. The record exists for visibility, not
          punishment. If a pattern shows up, the response is to find the cause and help change it, not
          to apply penalties to force a change that may not be the student&rsquo;s responsibility. In
          his words: sometimes mom is late. It is not the kid. By punishing the kid you do not actually
          solve the problem.
        </p>
        <p>
          <strong>Building access, and the first defined cancel condition.</strong> Mr. Parker and
          Jessica Meade open the building. Staff with keys, and the only two. Redundancy is the point.
          If both are out and rehearsal is to proceed anyway, a director must determine who grants
          building access and who communicates it. If that cannot happen, rehearsal is cancelled by
          default, because the conditions cannot be met. This is the system&rsquo;s first stated
          fail-closed default.
        </p>
        <p>
          <Chip status="open" /> the cancellation communication path itself: who tells sixty-plus
          families, through what channel, and how early. A cancel decision made at 6:00 AM has no
          defined route to the field.
        </p>
      </Collapse>

      <Collapse title="7:00–10:00 — Outdoor visual rehearsal" status="stated" sub="Visual and drill capability, applied. Owner: the box.">
        <p>
          <strong>Warm-up.</strong> Two things in order: physical warm-up so bodies are ready, then
          fundamentals warm-up on the fundamentals of the visual design. Normal day, both inside no
          more than 30 minutes. Once fully operational and only being run rather than taught, 15
          minutes as a predetermined full block.
        </p>
        <p>
          <strong>The rest of the block is the rep loop</strong>, repeated. Outcome, Set, perform,
          Place, Check, Adjust, hold place, Low, Instruction, Reset, Low, Outcome. If no one is in the
          box, the drum major is the box.
        </p>
        <p>
          <strong>Observable signal:</strong> the loop turns without staff narrating transitions.
        </p>
        <p>
          <strong>Water.</strong> Target cadence is <code>sip and dip</code> every 15 minutes and{" "}
          <code>gush and go</code> every 30, condition dependent. The system needs to know water is
          important, and that a water break is only what it is, not a long break. District heat policy
          sets a floor above this. See the heat section.
        </p>
        <p>
          <strong>10:00 exit.</strong> The schedule ends the block, not a person. The noon extension he
          described is unavailable during the district 10-day window, when outdoor practice must be
          finished by 10:30 AM and not resume until 6:00 PM. That rule is calendar-based, not
          condition-based, so a pleasant morning creates no exception.
        </p>
        <p>
          <Chip status="open" /> Where the drum major writes the manual attendance fallback if{" "}
          <code>Geo</code> access does not land. Whether water breaks are clock-anchored or called by
          the box. Physical warm-up content and its qualified-adult and safety requirements.
          Fundamentals warm-up content. Drill-learning procedure. Field setup task list per crew.
          Whether &ldquo;head person in charge on the field&rdquo; is the box or a separate role.
        </p>
      </Collapse>

      <Collapse title="10:00–10:15 — Transition indoors" status="stated" sub="This is the day's planned bathroom and hydration window.">
        <p>
          <strong>Transition made visible and paid for honestly.</strong> Not a movement block that
          bathroom happens to interrupt. Owner is the highest-ranking person present.
        </p>
        <p>
          <strong>Destinations.</strong> Winds and percussion to the band room. Guard to the Murray
          band room, called the guard room during band camp.
        </p>
        <p>
          <strong>Exit condition at 10:15.</strong> Everyone in the room, seated, instruments and music
          out and ready to rehearse, and fully watered both ways. Bathroom and hydration are complete
          at 10:15, not beginning.
        </p>
        <p>
          <strong>How fifteen minutes is possible: the one push transition.</strong> Everyone moves in
          a single trip, which requires roles defined and one job per person. Shuttling is what turns
          fifteen minutes into twenty-five. The mechanism is the role assignment. The single trip is
          the result.
        </p>
        <p>
          <strong>Music readiness is a standing rule, not just this block.</strong> At any music
          rehearsal, students must have all of their music, not only what they expect to be called,
          even when it is likely to be show music. Satisfied by the program the band uses, which puts
          all music on the phone. Paper is not the requirement. Having it is.
        </p>
        <p>
          <strong>Front ensemble.</strong> The default is that front ensemble is with the band, and he
          is keeping it there even though that is not always the actual state, especially early in
          camp. They need to rehearse technique, and that does not have to happen while the ensemble
          works visual.
        </p>
        <p>
          <strong>Equipment.</strong> Everything has a <code>home</code> and the default is to put it
          there. The one blocker is naming. See the library.
        </p>
        <p>
          <strong>It is a timed break with a predefined callback.</strong> An exact number of minutes
          with a callback stated before it begins. The same ruling covers the 1:50 transition. What
          this buys is that 10:15 becomes self-executing: the exit condition is carried by every
          student because they were told the number and the callback up front, rather than depending on
          someone noticing the time and herding.
        </p>
        <p>
          <Chip status="open" /> What the callback actually is. Who verifies everyone is in and seated
          at 10:15. Whether <code>pretty</code> re-applies indoors. A dead phone as a music-readiness
          failure state.
        </p>
      </Collapse>

      <Collapse title="10:15–11:45 — Music rehearsal" status="stated" sub="A classroom day, not the outdoor system. Owner: Mr. Parker, unusually tightly.">
        <p>
          <strong>Proximity is the variable.</strong> Indoors students are seated, close together,
          close to him, and the chairs point their eyes at him, so he has classroom-capacity control.
          Outdoors he is on a building or in a press box, far away, amplified or shouting, and there is
          a lot more room for things to wiggle.
        </p>
        <p>
          <strong>The principle that falls out, and it is the most portable thing in this
          block:</strong> the amount of formal protocol a block needs scales with distance from the
          instructor. Strict procedure outdoors is what makes visual rehearsal fast. Indoors, proximity
          does that work and the protocol can be lighter. This is why the outdoor system should not
          simply be copied inside.
        </p>
        <p>
          <strong>Structure.</strong> Warm-up and fundamentals. Then lesson time, whatever is in the
          plan to address: articulations, dynamics, or understanding a section conceptually and what it
          requires. Then repetitions with outcome and small instruction.
        </p>
        <p>
          That third step is the rep loop, but coupled tightly to him rather than run by the system.
          Same machine, different coupling. Outdoors it is system-mediated because it has to be.
          Indoors it is teacher-mediated because it can be.
        </p>
        <p>
          <strong>Mr. Parker absent: do not recreate the system.</strong> Default to sectionals.
          Leadership takes the reins and does a similar job with a much smaller group and much less
          defined outcomes, one or two, really just one until it is achieved, then the next.
          Communicated, not assumed: if he is missing, there is a message stating what is being asked.
        </p>
        <p>
          <strong>Sectionals need a definition regardless of length.</strong> Fifteen minutes or two
          hours, a sectional needs a location, an expectation of behavior, and a general understanding
          of who holds the hierarchy in that group. <Chip status="open" /> none of the three is written
          yet.
        </p>
        <p>
          <strong>The discretion boundary.</strong> Sectionals are where the system stops specifying
          and starts relying on someone thinking in the moment. The name for that is{" "}
          <strong>commander&rsquo;s intent</strong>. His own statement of it: if he is sick and has
          left a plan, and leadership has a better plan whose rationale fits what he would agree to, he
          expects them to change his plan.
        </p>
      </Collapse>

      <Collapse title="11:45–12:30 — Lunch" status="stated" sub="The only deny-list block in the day, and the only real test of whether self-management installed.">
        <p>
          <strong>Exit condition: at 12:30, at the next specific area.</strong> Not moving toward it.
          All movement into and out of lunch fits inside the block. Owner is the student. This is the
          one block where the individual owns the time.
        </p>
        <p>
          <strong>It is deny-list, not allow-list.</strong> Every other block specifies what happens.
          Lunch specifies only what may not happen, and the student manages the rest. That inversion is
          the design.
        </p>
        <p>
          <strong>Forty-five minutes, one hard exit condition, no prescribed sequence.</strong>
          Leadership will likely give reminders and the system does not require them. A reminder is a
          courtesy, not a control. If 12:30 depends on someone herding, the block has failed at what it
          is for.
        </p>
        <p>
          <strong>Where students eat: the hallway</strong> around the band room, in the Minnie Evans
          Arts Center. Named, because a deny with no named alternative is not teachable.
        </p>
        <p>
          <strong>Deny 1. No student eats in the band room.</strong> The band room is staff-only during
          lunch, for two reasons that both matter. Space, because staff need a block where they are not
          on. And findability, because a fixed, known staff location means a student with something
          wrong knows where to go.
        </p>
        <p>
          <strong>Only the drum major interacts with staff during lunch</strong>, for routine matters,
          and this is a default, not a gate. See escalation above.
        </p>
        <Rows
          head={["", "who may reach staff", "example"]}
          rows={[
            [
              "Something is wrong",
              "anybody. Find a staff member, escalate",
              "a student falls, cuts an elbow, a lot of blood",
            ],
            [
              "Routine",
              "up the chain of command. Do not use staff",
              "I do not have my music",
            ],
          ]}
        />
        <p>
          Routine is not unimportant. The missing music still has to be dealt with. It is that the
          chain of command is the correct path for it, and staff are not on that path during this
          block.
        </p>
        <p>
          <strong>The second known regression, and it is social rather than disciplinary.</strong>
          Students who want to talk to adults about what they are thinking and doing. All of that is
          wonderful and lovely, and lunch is not when it happens, because sometimes the adults need to
          be around adults without maintaining the instructor facade.{" "}
          <strong>This failure looks like a good student doing a good thing</strong>, which is exactly
          why nobody stops it. It is not misbehavior and must not be taught as misbehavior. It is a
          boundary about when staff are on duty.
        </p>
        <p>
          <strong>Band family, a directive rather than a rule.</strong> Two standing expectations.
          Students sit with each other and talk, because band is a social and emotional learning
          experience. And older students and leadership pull younger students in. We do not retreat into
          cliques; we invite people into our spaces. Deliberately unenforceable. In his words, it is
          not a hard rule by any means. It is nearer an evaluation criterion for leadership than a rule
          a student can break.
        </p>
        <p>
          <strong>Deny 2. No student leaves campus, for any reason.</strong> Not on their own, not for
          any reason. This has failed before: students with cars assume the privilege follows the car.
          It does not. Taught explicitly rather than assumed.
        </p>
        <p>
          <Chip status="open" /> Heat and shade during the hottest block of the day. Whether the DM
          eats with staff or with the band. What happens when a student is not at the next area at
          12:30. Whether the hallway is supervised at all, and by whom, given staff are deliberately
          off duty. The exact extent of the hallway.
        </p>
      </Collapse>

      <Collapse title="12:30–1:50 — Discipline-specific block" status="stated" sub="Separate work by discipline, at a resolution the full ensemble cannot reach.">
        <p>
          <strong>Entry condition</strong> is being at the assigned location at 12:30, which is the
          lunch block&rsquo;s exit condition. The instruction hierarchy runs with the box absent, so
          section and self only. Owner is the instructor of that group.
        </p>
        <Rows
          head={["group", "location"]}
          rows={[
            ["Winds only", "the upper gym"],
            ["Front ensemble", "separate, unnamed"],
            ["Battery", "separate, unnamed"],
            ["Guard", "unnamed"],
          ]}
        />
        <p>
          Described as what typically happens, not as a fixed roster of groups. Percussion breaks into
          front ensemble and battery in separate locations, and there is usually a percussion block and
          a guard-specific block as well.
        </p>
        <p>
          <strong>Same shape, one goal.</strong> The block runs the same shape as any other. It is the
          rep loop, not a different machine. What distinguishes it is that there is usually one defined
          goal: memorizing music, building technique, or working something specific. That single-goal
          property is the same one stated for instructor-absent sectionals. This block is the planned
          version of that rather than the fallback version.
        </p>
        <p>
          <strong>Why this block exists at all.</strong> It is the schedule&rsquo;s expression of one
          hundred percent is a constant, scope is the variable. The full ensemble improves generally. A
          discipline group improves specifically. The block buys resolution, and it only works if each
          group has someone whose whole attention is on it.
        </p>
        <p>
          <Chip status="open" /> The groupings are still not ruled. Asked about a drumline-specific
          format, he answered that he does not want to define that yet, that we need to figure out what
          is needed and what is wanted. With no box, who authors each group&rsquo;s outcome. What
          happens to a group whose instructor is absent, since the general fallback is sectionals and
          this block already is sectionals, so the fallback has no lower gear. Locations are unnamed
          except the upper gym.
        </p>
      </Collapse>

      <Collapse title="1:50–2:00 — Transition to combined band" status="stated" sub="Ten minutes, because the distances are real.">
        <p>
          <strong>Renamed.</strong> It was called <em>reset and return</em>. He did not recognize the
          name and it was wrong twice over: it is not <code>reset</code>, and nothing returns. It is
          ten minutes of transition. <code>reset</code> keeps one meaning.
        </p>
        <p>
          Groups end the previous block spread across campus, the upstairs gym and wherever front
          ensemble and percussion are, and have to reach the Minnie Evans Arts Center or the band room.
          That movement takes about ten minutes, so ten minutes is budgeted for it. Here{" "}
          <code>band</code> means everyone, guard included.
        </p>
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          It ensures that we have an end time to the block before it and a begin time to the new block.
        </blockquote>
        <p>
          <strong>The transition gets its own container so neither neighbor has to absorb it.</strong>{" "}
          Without it, either the discipline block bleeds past 1:50 or combined band starts late, and in
          both cases the schedule stops being true. The ten minutes are spent either way. This makes
          them budgeted rather than stolen.
        </p>
        <p>
          Stated twice now from two directions, which makes it a general rule of the day rather than a
          property of one block: <strong>every move between two named locations gets its own block.</strong>
        </p>
        <p>
          Also a timed break with a predefined callback, same ruling as 10:00 to 10:15, so 2:00 is
          self-executing rather than herded.
        </p>
      </Collapse>

      <Collapse title="2:00–2:50 — Combined band" status="open" sub="Still being written. This is where the day's install gets stress-tested.">
        <p>
          Purpose is full-ensemble capability and application. The full loop and the full hierarchy are
          true throughout.
        </p>
        <p>
          Everything else in this block is open, and this is where the day&rsquo;s install gets
          stress-tested whether or not that is declared. It is the next thing being written.
        </p>
      </Collapse>

      <Collapse title="2:50–3:00 — Closing, announcements, cleanup" status="open" sub="An instructional block, not leftover time.">
        <p>
          Purpose is to reset people, equipment, spaces, and information. Runs on <code>pretty</code>{" "}
          and on communication. Students released at 3:00.
        </p>
        <p>
          <Chip status="open" /> What gets announced and by whom. Who confirms equipment is accounted
          for. What the next-day call is and how it is acknowledged. His ask that students bring back
          terms they thought of during the day lives here.
        </p>
      </Collapse>

      {/* --------------------------------------------------------- library */}

      <H2 note="Every term defined exactly once. Roughly 150 terms came from the students' free-list on 7/28 and are being sorted. A term appearing in two categories needs disambiguation before it is taught.">
        The library
      </H2>

      <Collapse title="Register — every term is one or the other" status="stated" defaultOpen>
        <p>
          <strong>Vocal command:</strong> said aloud, in the moment, across distance.{" "}
          <strong>Concept:</strong> used in planning, teaching and talking about the work. Never
          shouted.
        </p>
        <Rows
          head={["vocal", "concept"]}
          rows={[
            [
              "set · place · low · check · go · reset · adjust",
              "minus one · plus one · dot · outcome · prerequisite · install",
            ],
          ]}
        />
        <p>
          His own catch: <code>set</code> and <code>place</code> are vocals.{" "}
          <code>minus one</code> is not. It is hard to say in the moment and it is three syllables.
        </p>
        <p>
          <strong>Design rule for a vocal command.</strong> It has to survive being shouted or
          amplified across a field. One syllable preferred, two at most. Distinct enough from the other
          commands that it cannot be misheard as one of them. And per <code>low</code>, not reachable
          by accident.
        </p>
        <p>
          A term with no register assigned has not been finished. When a concept needs to be called in
          the moment, it needs a vocal counterpart. That is exactly the{" "}
          <code>minus one</code> and <code>place</code> relationship.
        </p>
      </Collapse>

      <Collapse title="Ensemble states and commands" sub="set · place · minus one / plus one / dot · low · outcome · check · adjust · reset · instruction · the rep loop" defaultOpen>
        <Term name="set" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            Two things. <strong>The noun:</strong> the picture on the field, all members on defined
            dots. <strong>The command:</strong> every part of your body in whatever is predefined as
            the last moment of the previous set. Called only at the beginning of a rep.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>How you get there:</strong> from nothing. Set is assumed from a static start, not
            arrived at in motion.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Is not:</strong> ever called at the end of a rep. That is <code>place</code>. The
            apparent double-Set in the loop was a missing word, not an overloaded one. Also not
            primarily about instrument carriage; it is the whole body in a defined configuration, feet
            included. Called by box or DM.
          </p>
        </Term>

        <Term name="place" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            The last moment of moving through the drill. The same physical location as{" "}
            <code>set</code>, arrived at while in motion. Defined by what the foot is doing in that
            moment, because it is the first portion of the transition between two sets.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Is not</strong> <code>set</code>. Same location, different arrival, and a different
            function. Place is where the picture is frozen, audited, adjusted, and imprinted at the end
            of a rep. Naming this is what resolved the <code>set</code> ambiguity.
          </p>
        </Term>

        <Term name="minus one / plus one / dot" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            <strong>dot</strong> is an individual place on the field. All dots together are a{" "}
            <code>set</code>. The concept: the dot exists without the human in it. On paper you only
            see a dot.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>minus one</strong> is the beat before the dot. Standing at minus one from the dot{" "}
            <em>is</em> the <code>place</code> moment. <strong>plus one</strong> is the beat after, the
            next individual point.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>The load-bearing idea:</strong> the dot never has a defined moment in time. The
            moments in time are the beat before and the beat after. The dot is a position, not an
            event. A performer can occupy minus one or plus one. Nobody is ever on the dot in time.
          </p>
          <Rows
            head={["", "how you get there", "when"]}
            rows={[
              ["set", "from nothing, static", "start of a rep"],
              ["place", "in motion, last moment of the drill", "end of a rep"],
              ["minus one", "the notational concept, the beat before the dot", "describes both"],
            ]}
          />
        </Term>

        <Term name="low" status="FROZEN">
          <p style={{ margin: "0 0 6px" }}>
            <strong>The one frozen item in the system.</strong> Vocal command, one syllable.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Is:</strong> the default attention position plus hands crossed in front, or as
            otherwise defined when needed. Five points of alignment as defined in the visual system,
            head on the drum major or the box, listening. Hands crossed in front of the body. With an
            instrument, it is held in front with the opposite hand resting on top of the hand holding
            it.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>The definition is equipment-optional, and that is deliberate.</strong> Hands
            crossed in front works with nothing in them, which matters because visual rehearsal is
            often run without equipment, especially when learning drill for the first time. The base
            form is the no-instrument form. Holding an instrument is a case of it, not a requirement of
            it.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Means:</strong> I am in listening mode. I do not need to be performance-engaged, my
            body can be relaxed. Attentive without standing at attention. Etymology: low is where the
            horn is. Horn down.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Observable test:</strong> crossed-hands-in-front is not a position anybody assumes
            randomly. That is the design criterion. It cannot be reached by accident, so seeing it is
            proof of intent.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Is not</strong> <code>trail</code>. Not <code>set</code>. Not a fallout; you are
            not released. Military analogue is parade rest.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>What this settles about set.</strong> Low and Set share the body and differ in the
            instrument. Both are five points of alignment with the head on the box. Low is horn down,
            hands crossed. Set is the same body with the instrument in playing-ready carriage. The
            distinction is carriage, not posture, which is exactly what makes the pair legible from a
            distance.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Variants to define under the clause, and they are not blockers:</strong> tubas and
            contras cannot be held in front with hands crossed. Battery already has the drum in front,
            harness-mounted, so hands on the rim or on the drum. Front ensemble stands behind keyboards
            with nothing to hold, so the base no-equipment form may simply apply. Guard has flag, rifle
            and sabre, three objects with three natural rest positions.
          </p>
        </Term>

        <Term name="outcome" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            The declared intent of a rep. Not a goal. A goal is <em>I kind of want to go over there</em>
            ; an outcome says <em>I will do this</em>.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Why:</strong> a rep begun without one is a wasted rep, period. It is also what
            makes a miss diagnostic instead of a fault.{" "}
            <strong>Observable test:</strong> it was said aloud before Set.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Enforcement:</strong> the DM&rsquo;s hands do not drop on beat one without one. He
            invited leadership to call him on it when he breaks his own rule.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Is not</strong> a promise of success. Missing it is a thing, not a bad thing. It may
            mean going back to define prerequisites. <em>Run it once and see what happens</em> is a
            legitimate outcome, and it forbids being angry afterward about anything it did not ask for.
          </p>
        </Term>

        <Term name="check" status="stated">
          Assess. <strong>Do not move.</strong> Self-assessment before correction, and it makes the
          picture auditable. Is not <code>adjust</code>. Not permission to move or talk.
        </Term>

        <Term name="adjust" status="stated">
          Correct the ending position. Corrected <strong>for the group</strong>, because the point of
          being in the right place is visual: do you see the people where you expect to see them. Is not
          an individual fix for your own benefit. Also spans categories, since adjust is used musically
          too, so it needs disambiguation.
        </Term>

        <Term name="reset" status="stated">
          Straight to your dot. Common order, no speech, with purpose. Observable test: an outside
          observer can see the intention in you. Is not the fastest way possible, which is how someone
          face-plants and costs ninety seconds. Not goofing. Not a talking window.{" "}
          <Chip status="open" /> destination when a rep starts mid-phrase or the start point moves.
        </Term>

        <Term name="instruction" status="stated">
          The legitimate channel for talk during a rep cycle, delivered live or pre-planned. Why:
          member-to-member on-field talk is the bug. A senior talking in the wrong place opens the back
          door and freshmen follow. Called by box, then section, then self, in that order.{" "}
          <Chip status="open" /> the performer&rsquo;s question mark. After the DM states the outcome,
          &ldquo;maybe, if we need to.&rdquo; This is currently the only path a member has to signal{" "}
          <em>I do not have what I need</em>, and it is not a decision.
        </Term>

        <Term name="the rep loop" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            Outcome, <strong>Set</strong>, perform (press play), <strong>Place</strong>, Check, Adjust,{" "}
            <em>hold place</em>, Low, Instruction, Reset, Low, Outcome, and around again.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Set is called once, at the start.</strong> The end of the rep is{" "}
            <code>place</code>. There was never a second Set; the loop was missing a word.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Holding place after Adjust is deliberate.</strong> He argued it against going to
            Low: everybody freezes, the picture is auditable at a glance, and the member gets the real,
            true recapture of their mind&rsquo;s eye of exactly the way it is supposed to feel, so the
            next rep recreates it correctly the first time. Dropping to Low there loses the imprint and
            opens a talking window.
          </p>
        </Term>

        <Term name="clapping" status="floated">
          Attention. Stated as the last line of the 7/28 session and not placed.{" "}
          <Chip status="open" /> clap into <code>set</code> or into <code>low</code>, and whether it is
          the same signal as the timed-break callback.
        </Term>

        <WordList
          label="Open and unsorted in this category:"
          words={[
            "continue",
            "done",
            "don't play",
            "hold",
            "freeze",
            "eyes",
            "horns up",
            "breathe",
            "sing",
            "watch the dot",
            "count off",
            "go",
            "section holds",
          ]}
        />
      </Collapse>

      <Collapse title="Defaults" sub="call time · water cadence · weather · black · field setup · attendance · warm-up · pretty · home · one push transition · music readiness · guard room · late · warm-up block · across the floor · water breaks · timed break · arrival kit · on-field carry · band · band parent · the hallway · band family">
        <Term name="call time" status="stated">
          The time by which the eyeballs of someone superior to you must be able to see you:
          leadership, staff, director. On campus, or in the band room, as specified.{" "}
          <strong>Is not rehearsal start time. They are separate.</strong> Events get both, for example
          call 8:00 in the band room, start 8:30 at the stadium. This was a live disagreement in the
          room on 7/28 and his definition settled it. Defaults when none is stated: staff and
          leadership 30 minutes before, all membership 15 minutes before.
        </Term>

        <Term name="water cadence" status="stated">
          The target rhythm of hydration inside a rehearsal block. <code>sip and dip</code> every 15
          minutes, <code>gush and go</code> every 30, condition-dependent. Is not a break, and not
          discretionary in heat. Governed by district heat policy, whose floor is breaks every 15 to 30
          minutes long enough to drink 8 to 10 oz and cool down.{" "}
          <Chip status="open" /> <code>sip and dip</code> likely does not meet the 8 to 10 oz floor, so
          it cannot serve as the compliant every-15-minute break. Either{" "}
          <code>gush and go</code> takes that slot with sip and dip supplemental, or sip and dip is
          redefined upward and loses its distinction. His call.
        </Term>

        <Term name="weather" status="floated">
          The category above heat. Heat, rain and lightning are separate cases with separate responses.{" "}
          <strong>Lightning in the area is an immediate off the field</strong>, whether or not it is
          raining. Instrument is the Zelus WBGT app, geolocked to the rehearsal field; he or any staff
          member reading it in the moment can make the call, so the authority follows the reading rather
          than the person. Fallback is always an indoor option: other parts of the school, or switch to
          music. Failure states are inconvenient, not blocking. Rain and everything else parked for a
          later scoped pass.
        </Term>

        <Term name="black" status="stated">
          Black condition. <strong>Not allowed outside.</strong> If rehearsal is black, the ensemble
          does not go out. The program&rsquo;s shorthand for the district heat call. It arrives; it is
          not decided locally. The AHS athletic trainer texts the athletics thread when practices must
          move indoors or come off pads, and Mr. Parker is on that thread by agreement with
          administration. <strong>Is not his judgment call.</strong> He has a separate and stricter
          discretion to go inside whenever he judges the heat is costing focus. Black is the floor, not
          the ceiling. <Chip status="open" /> the channel terminates at him. A substitute is not on the
          athletics thread. It needs a second person on it or a defined relay.
        </Term>

        <Term name="field setup" status="stated">
          The field is fully set before rehearsal start. Setup is not part of the block. Owned by
          leadership crew, paint crew, prop crew, front ensemble crew, plus individual equipment.{" "}
          <Chip status="open" /> the task list per crew, and who is on each committee.
        </Term>

        <Term name="attendance" status="stated">
          A snapshot of who is present, taken at rehearsal start and complete one minute later.
          Observable test: it is in <code>Geo</code>. If it is not in the app, it did not happen. Each
          section takes its own, reports to the drum major, who reports to Mr. Parker. Is not him
          scanning for missing individuals while running rehearsal, which is the named failure mode.
        </Term>

        <Term name="physical warm-up / fundamentals warm-up" status="stated">
          Two things in order: physical warm-up so bodies are ready, then fundamentals warm-up on the
          fundamentals of the visual design. Budget is no more than 30 minutes on a normal day, and 15
          once it is only being run rather than taught, as a predetermined full block.{" "}
          <Chip status="open" /> content and ownership for both.
        </Term>

        <Term name="pretty" status="stated">
          <strong>A state of the equipment</strong>, an organized state defining the gear itself rather
          than a place. Applies to instrument, water bottle, and any bag. Happens off the field. Why:
          the instrument is safe, you know where it is, no decision is made in the moment, and rehearsal
          moves faster. The model is Carolina Crown&rsquo;s rehearsal, where every bag, bottle and
          instrument is lined up and nobody is telling them to. Reference form: against the wall, in
          line, by section, in consistent order, clarinet 1 then 2 then 3.{" "}
          <strong>Observable test:</strong> a stranger can see the order.{" "}
          <strong>Is not a location.</strong> Gear is pretty wherever it is set down.
        </Term>

        <Term name="home" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            Every piece of equipment has a home, a defined location it returns to. The default action
            for anything being put away is put it in its home. It removes the decision the same way{" "}
            <code>pretty</code> does for personal gear. <code>home</code> is <code>pretty</code> for
            program equipment. <strong>Observable test:</strong> a person who has never done it can find
            the home from its name.
          </p>
          <Rows
            head={["thing", "home"]}
            rows={[
              ["front ensemble equipment", "band room"],
              ["sound equipment", "with the front ensemble, band room"],
              ["paint equipment / TurfTank", "instrument storage room"],
              ["podium", "directly outside the band room"],
              ["props", "band room · directly outside the band room · equipment trailer"],
            ]}
          />
          <p style={{ margin: "0 0 6px" }}>
            <strong>The storage taxonomy behind those:</strong> inside the band room; directly outside
            the band room, which is outdoor equipment and equipment storage and can include props; and
            the instrument storage room, which is its own equipment storage, subdivided as needed.
          </p>
          <p style={{ margin: 0 }}>
            <strong>The actual gap, and it is cheap.</strong> The locations exist and he knows them, but
            they are not named. In his words, I know which locker it is but I do not know what the
            number is. An unnamed location cannot be written down, taught, or followed by a substitute,
            which makes this a direct hospital-day failure. The fix is a one-time labeling pass, not a
            design decision.
          </p>
        </Term>

        <Term name="one push transition" status="stated">
          Everyone moves in a single trip. Nobody shuttles. Requires roles well defined and one job per
          person; that is the whole mechanism, and the single trip is the result rather than the
          instruction. Observable test: count the trips. More than one per person means the roles were
          not assigned. <strong>Is not moving fast. It is moving once.</strong>
        </Term>

        <Term name="music readiness" status="stated">
          At any music rehearsal, a student has <strong>all</strong> of their music, not only what they
          expect to be called, even when the block&rsquo;s likely content has been announced. Observable
          test: they can produce any chart asked for. Satisfied by the program the band uses, which holds
          all music on the phone. Paper is not required; having it is.{" "}
          <strong>Failure state: a dead phone.</strong> Single point of failure, no stated remedy.
          Charging belongs to the arrival kit.
        </Term>

        <Term name="guard room" status="stated">
          The Murray band room, used by colorguard during band camp. The program&rsquo;s name for it in
          that context.
        </Term>

        <Term name="late / check-in" status="stated">
          A member-initiated declaration to the drum major on arriving after the attendance snapshot,
          recorded, and then the member immediately joins. The record makes lateness visible so patterns
          can be found and their causes fixed. <strong>Is not punishable.</strong> Late is a broken
          contract; checking in fulfills it. A pattern triggers investigation of the root cause, not
          escalation, because the cause is often not the student&rsquo;s to control. Note: this is the
          first member-initiated state signal in the system, and the precedent for the still-missing{" "}
          <em>I do not have what I need</em> channel.
        </Term>

        <Term name="warm-up block" status="stated">
          A fixed field location, the same every time. It doubles as the attendance read, since anyone
          can see at a glance whether everyone is there. <Chip status="open" /> whether instruments come
          to it.
        </Term>

        <Term name="across the floor" status="stated">
          Assigned lines, a default standing spot. Changeable, but defaulted. In his words, it costs time
          every single time it is not defined.
        </Term>

        <Term name="water breaks" status="stated">
          <strong>gush and go</strong> is the normal one, about 1.5 to 2 minutes. Get water in, ask a
          staff member a question if needed, back on the field. Purposeful movement, same standard as{" "}
          <code>reset</code>. <strong>sip and dip</strong> is very quick. Water in, straight back, no
          talking. His read is that what the room previously called gush and go was actually sipping.
          There is no gush and slow.
        </Term>

        <Term name="timed break" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            A block of an <strong>exact, stated number of minutes</strong>, ending on a{" "}
            <strong>predefined callback</strong> given before the break begins. Promoted out of water
            breaks, because it stopped being a kind of water break and became the mechanism two
            scheduled transitions run on.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Why:</strong> it makes an end time self-executing. Every member carries the exit
            condition because they were told the number and the callback up front. The alternative is
            someone watching a clock and herding, which fails exactly when that person is busy, and they
            are always busy.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Observable test:</strong> the break ends on time with no one telling anyone to come
            back. If a staff member or the drum major has to call people in, it was not a timed break. It
            was slack with a hopeful end time.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Is not</strong> <code>gush and go</code>, <code>sip and dip</code>, slack, or
            &ldquo;about ten minutes.&rdquo; <strong>A duration with no callback is not a timed
            break.</strong> Used at the 10:00 transition, the 1:50 transition, and any water break he
            declares as one.
          </p>
          <div
            style={{
              border: "1px solid #ccd6df",
              background: "#f0f4f8",
              borderRadius: 8,
              padding: "12px 14px",
              marginTop: 8,
            }}
          >
            <Chip status="open" />{" "}
            <strong>What the callback actually is. This is the one slot the term names and does not
            fill, and it is Mr. Parker&rsquo;s to answer.</strong> The constraints the system already
            puts on it: one form used everywhere, because a callback that varies by block or by who is
            running it cannot be carried by a student, and carrying it is the entire point. Audible
            across an upstairs gym, a hallway, and a field, which are three very different acoustic
            spaces. Not dependent on a specific person being present, or it reintroduces the failure it
            removes. And if it is a vocal it must survive being shouted; if it is not a vocal, it is a
            sound or a signal and needs naming anyway.
          </div>
        </Term>

        <Term name="arrival kit" status="floated">
          Water, instrument, sunscreen, bug spray, deodorant, athletic clothes, lunch, music on phone,
          coordinate chart on phone. <Chip status="open" /> a checklist already exists and he flagged it
          for revisiting. Who verifies, and what the consequence is.
        </Term>

        <Term name="on-field carry" status="stated">
          Always on the field with you: water, instrument, music, phone, since music and coordinates live
          there.
        </Term>

        <Term name="band / the band / marching band" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            <strong>The whole thing, guard included.</strong> Any holistic use, meaning the band, the
            marching band, full band, combined band, the entire band, includes colorguard, always.
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Is not</strong> winds and percussion. Guard is excluded only when winds and
            percussion are being named separately and explicitly, as in the discipline-specific
            breakout.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Why:</strong> the exclusion is easy to make by accident, because guard is the one
            group he delegates entirely. He named this himself as a terminology issue rather than
            waiting to be asked. <strong>Observable test:</strong> if a sentence says <em>the band</em>{" "}
            and a guard member reading it would not know whether they are included, the sentence is
            defective.
          </p>
        </Term>

        <Term name="band parent" status="stated">
          <p style={{ margin: "0 0 6px" }}>
            An adult present with the band in a program capacity. <code>band parent</code> is the
            preferred term. <code>booster</code> and <code>booster parent</code> are correct and
            consistent. <strong>Never just &ldquo;parent.&rdquo;</strong>
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Why:</strong> the word has to carry that this adult is with the band right now, not
            acting individually as the parent of their own child. Those are two different people with
            two different authorities, and the bare word collapses them, which is exactly the collision
            that produced the leave-approval error.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Is not</strong> <code>chaperone</code>, which is a role on a trip rather than the
            standing term. And <strong>not a student&rsquo;s own parent</strong>, who is a separate
            category entirely and who outranks Mr. Parker for their own child.
          </p>
        </Term>

        <Term name="the hallway" status="stated">
          The hallway around the band room, in the Minnie Evans Arts Center.{" "}
          <strong>Where students eat lunch.</strong> Named because the band room is staff-only at lunch
          and the deny only works if the permitted location is named. Is not the band room, and is not
          off campus, for anyone, for any reason. <Chip status="open" /> exact extent of the hallway.
        </Term>

        <Term name="band family" status="stated">
          The standing expectation at lunch that students sit with each other and talk, and that older
          students and leadership deliberately pull younger students in. Band is a social and emotional
          learning experience, not only a performing one. Cliques are the default outcome of unstructured
          time; inclusion is the thing that has to be actively done.{" "}
          <strong>Is not enforceable.</strong> It is a leadership trait, closer to an evaluation
          criterion for leadership than a rule students can break. The first deliberately unenforceable
          entry in the library. Do not harden it into compliance language; that would destroy the thing
          it asks for.
        </Term>
      </Collapse>

      <Collapse title="The rest of the vocabulary, by category" sub="Sorted from the students' free-list. Most are not yet defined; the category is the current state.">
        <WordList
          label="Field geography:"
          words={[
            "dot",
            "set",
            "hash",
            "deck",
            "sideline (front, back)",
            "front field / back field",
            "A side / B side",
            "Ashley / Murray sidelines",
            "50 and yard lines",
            "grid",
            "box",
            "box number",
            "podium",
            "front",
          ]}
        />
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13.5 }}>
          <code>front</code> as in front ensemble collides with front sideline and needs
          disambiguation.
        </p>

        <WordList
          label="Time and counts:"
          words={[
            "count",
            "counts",
            "count off",
            "minus one / plus one",
            "measure",
            "crossing counts",
            "pulse",
            "double time",
            "ID speed",
          ]}
        />

        <WordList
          label="Movement technique:"
          words={[
            "march",
            "forwards / backwards",
            "slide",
            "spiral",
            "step size",
            "step off",
            "mark time",
            "ball toe",
            "trail",
            "carry",
            "horns up",
            "upper body / lower body",
            "posture",
            "alignment",
            "stretch",
            "tendu",
            "choreo",
            "body movement",
          ]}
        />
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13.5 }}>
          <code>tendu</code> and the ballet vocabulary are their own category, French and dance.
        </p>

        <WordList
          label="Musical concepts:"
          words={[
            "music",
            "intonation",
            "balance",
            "blend",
            "dynamics",
            "articulation",
            "listening zone",
            "warm-up circle / music block",
            "sing",
            "top",
          ]}
        />
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13.5 }}>
          <code>music</code> spans categories.
        </p>

        <WordList
          label="Structural units:"
          words={[
            "rep",
            "set",
            "chunk",
            "block",
            "movement",
            "show",
            "drill",
            "formation",
            "grouping",
            "impact",
            "solo",
            "feature",
            "full ensemble",
          ]}
        />

        <WordList
          label="Roles and authority:"
          words={["staff", "director", "drum major", "section leader", "box", "self", "section"]}
        />

        <WordList
          label="Equipment and care:"
          words={[
            "instrument",
            "flags",
            "rifle",
            "colorguard equipment",
            "prop",
            "uniform",
            "costume",
            "microphone",
            "cables",
            "front ensemble gear",
            "pretty",
          ]}
        />

        <WordList
          label="Event types:"
          words={[
            "rehearsal",
            "practice",
            "marching band",
            "game",
            "halftime",
            "competition",
            "performance",
            "outdoor",
            "ensemble",
            "stands",
          ]}
        />
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13.5 }}>
          Is there a difference between <code>rehearsal</code> and <code>practice</code>? Needs a
          ruling.
        </p>

        <WordList
          label="Effect language:"
          words={["effect", "general effect", "impact", "energy", "air", "intention"]}
        />
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13.5 }}>
          <code>general effect</code> is defined: pre-planned arrival moments, performed appropriately.
          That makes it as much a knowing-when-and-what problem as a performance problem.
        </p>

        <WordList
          label="Logistics, safety, care:"
          words={[
            "water",
            "sunscreen",
            "bug spray",
            "deodorant",
            "lunch",
            "bathroom",
            "heat",
            "hydration",
          ]}
        />
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5 }}>
          <Chip status="open" /> own component, or a non-negotiable embedded everywhere. Asked 7/24,
          still unanswered.
        </p>
      </Collapse>

      <Collapse title="Systems of record" status="stated" sub="All three are Arc products, all subscribed, all in production use.">
        <ul style={{ paddingLeft: 20 }}>
          <li>
            <strong>UDB, Ultimate Drill Book.</strong> Drill and coordinates. His working position is{" "}
            <strong>dot over form, with both required</strong>. Procedure source is AC/DC: Animation,
            Cross Count, Direction Change.
          </li>
          <li>
            <strong>Beam.</strong> <Chip status="open" /> role in the system not yet stated. Likely the
            music app, unconfirmed.
          </li>
          <li>
            <strong>Geo.</strong> Geofence. The system of record for attendance. Students may
            self-check-in inside a window; the drum major is responsible for input.{" "}
            <Chip status="open" /> whether the drum major can be granted access, and whether the feature
            set supports it.
          </li>
        </ul>
        <p>
          <strong>The rule that follows:</strong> a fact that lives only outside its system of record
          does not exist. Stated for attendance, and it likely generalizes.
        </p>
      </Collapse>

      <Collapse title="The scoping rule, and the diagnostic behind it" status="stated">
        <p>
          The diagnostic he ran: pick one word that frustrates a freshman, a parent and a senior
          differently. The room chose <strong>performance</strong>. The senior is frustrated the
          ensemble cannot yet do what they can. The freshman has never performed at all. The parent is
          managing a schedule, or seeing their child, or waiting through a football game.
        </p>
        <p>
          <strong>The scoping rule that follows:</strong> define a term only in the context this system
          uses it, never exhaustively. In his words, we do not have to define <em>front</em> in all the
          ways front needs defining. We need to define it in the context of how it fits within our
          system.
        </p>
      </Collapse>

      {/* ------------------------------------------------------------ heat */}

      <H2 note="Governed by district policy, which sets a floor the program cannot design around.">
        Heat
      </H2>

      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "18px 22px",
          marginBottom: 10,
          fontSize: 14.5,
          lineHeight: 1.7,
          background: "var(--paper-strong)",
        }}
      >
        <p style={{ margin: "0 0 10px" }}>
          <strong>Cool first, transport second.</strong> That order is counterintuitive and it is the
          order.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          <strong>Heat symptoms are an immediate escalation to staff, from anyone, at any time.</strong>{" "}
          This is not a chain-of-command matter. It is the &ldquo;something is wrong&rdquo; path.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Lightning in the area is an immediate off the field</strong>, whether or not it is
          raining.
        </p>
      </div>

      <Collapse title="What the policy requires, and where it collides with the day" status="open">
        <ul style={{ paddingLeft: 20 }}>
          <li>
            <strong>Break length.</strong> Breaks must be long enough to drink 8 to 10 oz and cool
            down. <code>sip and dip</code> probably does not qualify, so it cannot be the compliant
            every-15-minute break.
          </li>
          <li>
            <strong>WBGT 87 restricts outdoor activity to two hours.</strong> The morning block is
            three. <strong>A defined two-hour version of the block is required</strong>: what gets cut,
            and who decides. The reading of when the two hours start is unconfirmed and is an
            administration answer, and the current schedule rests on it.
          </li>
          <li>
            <strong>WBGT 90 ceases outdoor activity entirely.</strong> Nothing in the system measures
            WBGT continuously, and nobody yet owns the meter or the authority to call it. The
            instrument named is the Zelus app, geolocked to the field, with the authority following the
            reading rather than the person.
          </li>
          <li>
            <strong>The 10-day window.</strong> Outdoor practice must be finished by 10:30 AM and not
            resume until 6:00 PM. Calendar-based, not condition-based, so a pleasant morning creates no
            exception. Whether that athletics rule binds band, and what date starts it, is unconfirmed.
          </li>
          <li>
            <strong>The emergency plan assumes an athletic trainer on duty.</strong> Whether one is on
            campus and reachable during 7:00 to 10:00 band mornings is not yet confirmed, and the cold
            tank location, access and ice supply are not yet established. This is being resolved with
            the school&rsquo;s athletic training staff before August 3.
          </li>
          <li>
            <strong>The <code>black</code> channel terminates at Mr. Parker.</strong> A substitute is
            not on the athletics thread. It needs a second person on it or a defined relay.
          </li>
        </ul>
        <p>
          <strong>His own standard is stricter than the policy.</strong> He can take the ensemble inside
          whenever he judges the heat is costing focus. <code>black</code> is the floor, not the
          ceiling.
        </p>
      </Collapse>

      {/* -------------------------------------------------------- install */}

      <H2 note="Camp is a dependency problem, not a calendar problem. Install states before transitions, transitions before content. Never teach a term that will not be used the same day.">
        The install order
      </H2>

      <Collapse title="Layers 0 through 6" status="floated" sub="This ordering is derived, not Mr. Parker's. Most likely wrong in detail and right in structure.">
        <Rows
          head={["layer", "when", "what"]}
          rows={[
            [
              "0",
              "day 1 morning",
              "attention signal · low · set · pretty · call time · warm-up block. Nothing else can install before these.",
            ],
            ["1", "day 1 afternoon", "check · adjust · reset. All three require set and low first."],
            [
              "2",
              "day 2",
              "the outcome protocol. No rep without a declared outcome, the DM's veto, and what a miss means.",
            ],
            ["3", "days 2–3", "assemble and run the full rep loop."],
            [
              "4",
              "day 3",
              "the instruction hierarchy. After the loop, because you need something to instruct inside of.",
            ],
            [
              "5",
              "day 4+",
              "gush and go · sip and dip · timed break · across the floor · field entry and exit · equipment movement.",
            ],
            [
              "6",
              "day 5+",
              "stress test. Staff go silent and watch whether the loop still turns. The only way to distinguish installed from covered.",
            ],
          ]}
        />
        <p>
          <strong>Two blocking items sit on day 1 morning: <code>low</code> and <code>set</code>.</strong>{" "}
          Everything in layers 1 through 6 queues behind them.
        </p>
        <p>
          <strong>The standard for layer 6.</strong> &ldquo;Students were told&rdquo; and &ldquo;we
          covered it&rdquo; are not evidence of ownership. Evidence must describe something students can
          do reliably under fatigue, heat, complexity and repetition.
        </p>
        <p>
          <strong>Not yet placed:</strong> indoor rehearsal, since the loop was designed on the field
          and indoors <code>set</code>, <code>dot</code>, <code>reset</code> and <code>box</code> have
          no referent. Discipline-specific groupings. Physical warm-up. The visual curriculum, an
          eleven-step source progression that is not yet the camp sequence. Drill learning. Safety, heat
          and hydration. The website glossary.
        </p>
        <p>
          Leadership has 7/29 and 7/30 to finish designing, and any field grid has to be painted by
          Friday 7/31.
        </p>
      </Collapse>

      {/* ----------------------------------------------------------- frame */}

      <H2 note="Why this whole document is written in software language. It is a directive, not a flourish.">
        The engineering frame
      </H2>

      <Collapse title="Why the vocabulary is deliberate" status="stated">
        <p>
          Mr. Parker is unconsciously competent at running a band, and the whole risk of this project is
          that he skips what he already does without thinking. Software vocabulary drags those moves
          into conscious competence, where they can be inspected, named, taught, and handed off.
        </p>
        <p>
          <strong>The rule:</strong> design in engineering words, teach in band words. Students never
          need to hear &ldquo;state machine.&rdquo; They need to hear Low, Set, Check, Adjust.
        </p>
        <p>
          <strong>The highest-value move in the frame:</strong> a gap is a spec defect, not a character
          defect. Runtime errors read as someone&rsquo;s fault. Missing dependencies do not.
        </p>
        <p>
          <strong>And:</strong> nothing is real until it has an acceptance test. A definition without an
          observable test is a wish.
        </p>
      </Collapse>

      <Collapse title="Commander's intent — the term for where the system hands off to a person" status="stated">
        <p>
          He described it exactly and asked for the technical term: the system carries a mass of people
          through the work correctly, and then reaches a point where it depends on someone thinking in
          the moment and making a good decision.
        </p>
        <p>
          <strong>Commander&rsquo;s intent</strong> comes from military mission command. The commander
          states the purpose and the desired end state rather than the steps, precisely so subordinates
          can adapt when the plan meets reality. Deviation from the plan is authorized in advance as
          long as it serves the intent.
        </p>
        <p>
          <strong>He already built this and did not name it.</strong> His message to leadership on 7/28:
          he defines the WHY, they design the WHAT and the HOW. And his sick-day statement, that if
          their rationale fits something he would agree to he would <em>expect</em> the change rather
          than merely permit it, is the doctrine&rsquo;s core clause.
        </p>
        <p>
          <strong>So the test for a legal deviation is not did you follow the plan.</strong> It is does
          your reasoning serve the stated intent. Which means the intent has to be stated, every time,
          or the boundary cannot be used.
        </p>
        <p>
          <strong>And it gives the ownership progression its missing test.</strong> Choose, Commit,
          Learn, Try, Do, <strong>Own</strong>. Own has never had an acceptance test. It does now: a
          student or leader who changes the plan, and whose stated rationale serves the intent, has
          demonstrated Own. <strong>Compliance follows the plan. Ownership serves the intent.</strong>
        </p>
        <p>
          Two related terms. <strong>Work-as-imagined versus work-as-done</strong> is the diagnostic
          term: procedures are what is imagined, what happens on the field is what is done, and
          operators constantly adapt to close the gap. That gap is normal and necessary rather than a
          failure. <strong>Escape hatch</strong> is the design term: the deliberate opening where a
          system stops enforcing and hands control to a human. Good systems have them on purpose and in
          named places. Sectionals are an escape hatch. <code>low</code> is not, and should be fully
          specified.
        </p>
      </Collapse>

      <Collapse title="The friction is the instrument working" status="stated" sub="Recorded because it will come up again.">
        <blockquote style={{ margin: "0 0 12px", paddingLeft: 14, borderLeft: "3px solid var(--line)", color: "var(--muted)" }}>
          I find the software manual very grating and have the friction there. I like it because it is
          defining things that I do not typically think of, and I am also just going to state out loud
          that it is friction that I feel in it. Doesn&rsquo;t mean I want anything to change.
        </blockquote>
        <p>
          The friction is the sensation of a thing being specified that he has never had to specify,
          because he does not need it specified. Twenty years of directing made it automatic.{" "}
          <strong>A freshman has none of that.</strong> So the friction is not a symptom of the document
          being over-built. It is the measurement showing the definition has gone past the point where
          his intuition already covered it, which is exactly the point where it starts being useful to
          anyone else.
        </p>
      </Collapse>

      {/* ------------------------------------------------------------ open */}

      <H2 note="Grouped by who can close them.">What is still open</H2>

      <Collapse title="Mr. Parker's to answer" status="open" defaultOpen>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>
            <strong>The callback for a timed break.</strong> One form, audible in a gym, a hallway and
            on a field, not dependent on any one person. Both scheduled transitions stay theoretical
            until this exists.
          </li>
          <li>
            <strong>The discipline-block groupings</strong>, deliberately not yet ruled.
          </li>
          <li>
            <strong>Whether <code>sip and dip</code> is redefined upward</strong> or{" "}
            <code>gush and go</code> takes the compliant 15-minute slot.
          </li>
          <li>
            <strong>How a student&rsquo;s own parent informs him of a leave</strong>, and whether before
            or after.
          </li>
          <li>
            <strong>Whether &ldquo;head person in charge on the field&rdquo; is the box</strong> or a
            separate role.
          </li>
          <li>
            <strong>Whether the DM eats with staff or with the band.</strong>
          </li>
          <li>
            <strong>Whether <code>learn</code> and <code>rep</code> are different things</strong>, which
            changes what a miss means. Parked for now.
          </li>
        </ul>
      </Collapse>

      <Collapse title="A naming pass, not a design decision" status="open">
        <p>Four instances of the same blocker. One labeling pass fixes all of it.</p>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>Equipment homes, by locker and room number.</li>
          <li>The exact extent of the lunch hallway.</li>
          <li>Every discipline-block location except the upper gym.</li>
          <li>Front ensemble and battery rooms.</li>
        </ul>
      </Collapse>

      <Collapse title="Still being built" status="open">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>
            <strong>The daily plan.</strong> The schedule is the container, the day&rsquo;s outcomes are
            the payload. The highest-leverage missing piece, and without it the hospital-day test fails
            and the command ladder collapses to level 1.
          </li>
          <li>
            <strong>The 2:00 to 2:50 combined band block</strong>, and the 2:50 to 3:00 close.
          </li>
          <li>
            <strong>A member signal channel.</strong> Three needs and one empty slot: the
            performer&rsquo;s question mark, leadership&rsquo;s ground reports, and heat symptoms.
            Because heat is in it, the signal must be legal from any state.
          </li>
          <li>
            <strong>Sectionals</strong> need a location, a behavior expectation, and a stated hierarchy.
          </li>
          <li>
            <strong>Who verifies everyone is in and seated at 10:15.</strong>
          </li>
          <li>
            <strong>Where the drum major records attendance by hand</strong> if <code>Geo</code> access
            does not land.
          </li>
          <li>
            <strong>The cancellation communication path.</strong> Who tells sixty-plus families, through
            what channel, and how early.
          </li>
          <li>
            <strong>Props, podium and sound destinations at the end of the day.</strong>
          </li>
          <li>
            <strong>The four <code>low</code> variants</strong> under the exception clause.
          </li>
          <li>
            <strong>Guard has no fallback ladder.</strong> The largest undegraded dependency in the
            system.
          </li>
        </ul>
      </Collapse>

      <Collapse title="Corrections already made — do not reintroduce" status="stated">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>
            The rep loop does <strong>not</strong> pass through Set twice. The end of a rep is{" "}
            <code>place</code>.
          </li>
          <li>
            <code>set</code> is <strong>not</strong> distinguished from <code>low</code> by instrument
            carriage alone; they share the body and differ in the instrument.
          </li>
          <li>Ashley does have an athletic trainer. The question is availability, not existence.</li>
          <li>The 7/28 schedule variant is not the schedule. The 7/24 frame is.</li>
          <li>
            Parents are not merely informed of a leave. A student&rsquo;s own parent decides.
          </li>
          <li>
            The 1:50 block is not called <em>reset and return</em> and does not run on{" "}
            <code>reset</code>.
          </li>
          <li>
            <code>timed break</code> is not a subtype of water break. It is the general mechanism.
          </li>
          <li>Guard is inside &ldquo;the band.&rdquo;</li>
          <li>Leadership was never granted the authority to give consequences.</li>
        </ul>
      </Collapse>

      {/* ----------------------------------------------------------- close */}

      <div
        style={{
          marginTop: 44,
          padding: "20px 24px",
          border: "1px solid var(--line)",
          borderRadius: 10,
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--ink)",
          background: "var(--paper-strong)",
        }}
      >
        <p style={{ margin: "0 0 12px" }}>
          This is the real state of the work, not a cleaned-up version of it. You are seeing the open
          questions at the same time I am holding them, and one item in the whole system is actually
          frozen.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          Read it looking for what is wrong. If a definition would not survive a freshman reading it
          cold, that is a defect in the definition, not in the freshman. If you can close one of the
          open items from where you stand, bring it.
        </p>
        <p style={{ margin: 0 }}>
          <strong>&mdash; Mr. Parker</strong>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 13, color: "var(--muted)" }}>
        Working source: <code>regiment-os</code>, sessions of 7/24, 7/27, 7/28 and 7/29. Replaces
        nothing in the Band Camp OS document, which sits one altitude above this at thirteen
        program-level components.
      </p>
    </main>
  );
}
