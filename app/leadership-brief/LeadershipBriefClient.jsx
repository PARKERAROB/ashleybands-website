"use client";
import { useState } from "react";

const SETTLED = [
  {
    title: "“Band” always includes guard",
    body: "Any whole-group use of the word is everyone. The band, marching band, full band, combined band. Guard is excluded only when winds and percussion are named separately and on purpose.",
  },
  {
    title: "“Band parent” is the term",
    body: "Never a bare “parent.” Booster and booster parent are also correct. A student’s own parent is a separate category entirely, and that distinction changes who decides what.",
  },
  {
    title: "A student’s own parent decides for their own student",
    body: "On anything involving their student, the parent has the call. Mr. Parker is informed, not asked. Leadership never stands between a family and their own student.",
  },
  {
    title: "The ladder when Mr. Parker is out",
    body: "Meade first, then down the command ladder. If there is no director and no designee genuinely running rehearsal, rehearsal is cancelled. That is the answer, not a worst case to improvise around.",
  },
  {
    title: "Leadership does not give discipline or consequences",
    body: "This was never granted, so it is not something anyone got wrong. Leadership sets the standard, maintains it socially, and escalates. Consequences belong to staff.",
  },
  {
    title: "Escalation is a judgment, not an access list",
    body: "Severity decides, not rank or relationship. Blood means anybody finds staff immediately. “I do not have my music” goes up the chain. Routine is not unimportant. It is that staff are not on its path.",
  },
  {
    title: "Both scheduled transitions are timed breaks",
    body: "10:00 to 10:15 and 1:50 to 2:00. Each has a fixed length and a predefined callback. Transition time is budgeted, not stolen from the blocks on either side.",
  },
  {
    title: "Every move between two named places is its own block",
    body: "If a move is not budgeted, one neighboring block absorbs it and the schedule stops being true. This is why the day has more blocks than it looks like it needs.",
  },
];

const LESSONS = [
  {
    title: "A rule enforced past its intent produces the failure it was written to prevent",
    body: "Where a rule names a person, ask whether it means that person only, or that person by default. A freshman is taught the rule. Leadership is taught the intent. That gap is the whole ownership progression.",
  },
  {
    title: "A deny with no named alternative is not teachable",
    body: "Telling someone where they may not be, without telling them where they may be, is not a standard. It is a trap. Lunch was rewritten to name the hallway for exactly this reason.",
  },
  {
    title: "Lunch is the only block that says what may not happen",
    body: "Every other block in the day specifies what does happen. That makes lunch the day’s one real test of whether self-management actually installed.",
  },
  {
    title: "Some failures look like good behavior",
    body: "A student who wants to tell an adult what they are thinking is not misbehaving. But there are moments when staff are deliberately not on duty. That is a boundary about timing, and it must never be taught as misbehavior.",
  },
];

const OPEN = [
  {
    label: "Mr. Parker’s to answer",
    items: [
      "The callback for a timed break. One form, audible in a gym, a hallway, and on a field, and not dependent on any one person’s voice. Both transitions stay theoretical until this exists.",
      "The discipline-block groupings, deliberately not yet ruled.",
      "How a student’s own parent informs him of a leave, and whether before or after.",
    ],
  },
  {
    label: "A naming pass, not a design decision",
    items: [
      "Equipment homes.",
      "The exact extent of the lunch hallway.",
      "Every discipline-block location except the upper gym.",
      "Front ensemble and battery rooms.",
    ],
  },
  {
    label: "Still being built",
    items: [
      "The daily plan. The schedule is the container. The day’s outcomes are the payload. This is the highest-leverage missing piece.",
      "The 2:00 to 2:50 combined band block, and the 2:50 to 3:00 close.",
      "A member signal channel that covers three needs: a performer’s question, leadership’s ground reports, and heat symptoms.",
      "Sectionals need a location, a behavior expectation, and a stated hierarchy.",
      "Who verifies that everyone is in and seated at 10:15.",
      "Where the drum major records attendance by hand if digital access does not land.",
    ],
  },
];

function Item({ entry, num }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        marginBottom: 12,
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
          padding: "16px 20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <span
          style={{
            minWidth: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--garnet)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {num}
        </span>
        <div style={{ flex: 1, fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
          {entry.title}
        </div>
        <span
          style={{
            fontSize: 20,
            color: "var(--muted)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            marginTop: 2,
          }}
        >
          {"▾"}
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "16px 20px 20px 62px",
            borderTop: "1px solid var(--line)",
            fontSize: 15,
            lineHeight: 1.65,
            color: "var(--ink)",
          }}
        >
          {entry.body}
        </div>
      )}
    </div>
  );
}

export default function LeadershipBriefClient() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">
        <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
          Bands of Ashley High School
        </a>
        {" · "}
        Leadership
      </p>
      <h1>Leadership Brief</h1>
      <p className="lede">
        Where the rehearsal day stands as of July 29, 2026. What is settled, what we learned building
        it, and what is still open five days out.
      </p>

      <div
        style={{
          background: "var(--paper-strong)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 36,
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--ink)",
        }}
      >
        <p style={{ margin: "0 0 12px", fontWeight: 600 }}>
          One hundred percent is a constant. Scope is the variable.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          Mr. Parker gives one hundred percent every day. Delegation does not change how much there
          is. It changes where it points. So the failure state of this program is not laziness. It is
          dilution.
        </p>
        <p style={{ margin: 0 }}>
          That is the entire argument for leadership existing. A leader who takes work off Mr. Parker
          does not reduce his attention. That leader increases its resolution. Leadership’s job is
          to make sure he does only what only he can do.
        </p>
      </div>

      <div
        style={{
          background: "#f0f4f8",
          border: "1px solid #ccd6df",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 40,
          fontSize: 15,
          lineHeight: 1.7,
        }}
      >
        <strong>Where the build stopped.</strong>
        <p style={{ margin: "10px 0 0" }}>
          The rehearsal day is written from arrival through 2:00, block by block. The 2:00 to 2:50
          combined band block and the 2:50 to 3:00 close are still being written. Combined band is
          where the day’s work gets stress tested, whether or not anyone declares it that way.
        </p>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
        What is settled
      </h2>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
        These are decided. Read all of them. Tap any one for the reasoning.
      </p>
      {SETTLED.map((e, i) => (
        <Item key={e.title} entry={e} num={i + 1} />
      ))}

      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginTop: 44,
          marginBottom: 6,
          color: "var(--ink)",
        }}
      >
        What we learned building it
      </h2>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
        Four things worth not having to learn twice.
      </p>
      {LESSONS.map((e, i) => (
        <Item key={e.title} entry={e} num={i + 1} />
      ))}

      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginTop: 44,
          marginBottom: 6,
          color: "var(--ink)",
        }}
      >
        What is still open
      </h2>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20 }}>
        Nothing here is hidden from you. If you can answer one of these from where you stand, say so.
      </p>
      {OPEN.map((group) => (
        <div key={group.label} style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--garnet)",
              marginBottom: 8,
            }}
          >
            {group.label}
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--ink)",
            }}
          >
            {group.items.map((it) => (
              <li key={it} style={{ marginBottom: 6 }}>
                {it}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div
        style={{
          marginTop: 20,
          padding: "20px 24px",
          border: "1px solid var(--line)",
          borderRadius: 10,
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--ink)",
        }}
      >
        <strong>Heat.</strong>
        <p style={{ margin: "10px 0 0" }}>
          The heat protocol for camp mornings is being finalized with the school’s athletic
          training staff before August 3. The order does not change: cool first, transport second.
          Heat symptoms are always an immediate escalation to staff, from anyone, at any time.
        </p>
      </div>

      <div
        style={{
          marginTop: 40,
          padding: "20px 24px",
          border: "1px solid var(--line)",
          borderRadius: 10,
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--muted)",
        }}
      >
        This is the real state of the work, not a cleaned-up version of it. You are seeing the open
        questions at the same time I am holding them. Bring me the ones you can answer.
        <br />
        <br />
        <strong style={{ color: "var(--ink)" }}>{"— Mr. Parker"}</strong>
      </div>
    </main>
  );
}
