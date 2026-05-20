"use client";
import { useState } from "react";

const TOPICS = [
  {
    num: 1,
    title: "MTSS Coordinators",
    summary: "Helping students earlier when they are struggling academically, behaviorally, or socially.",
    question: "Do students at our school get help early enough, or do problems usually get addressed after they become bigger?",
    connection: "Some students fall behind quietly. Some behavior issues may really be academic frustration, mental health, or lack of support. A dedicated person coordinating help could make the system less random.",
    details: (
      <>
        <p><strong>What it is.</strong> MTSS is North Carolina's framework for academic, behavioral, social, and emotional support. NCDPI defines NC MTSS as a school-improvement framework that uses data-driven problem-solving to maximize growth for all students across Pre-K through grade 12. In practice, that means universal supports for all students, targeted supports for some, and intensive individualized supports for a smaller group. NHCS is asking for a standalone allotment for MTSS coordinators so schools have dedicated staff capacity to organize and deliver timely interventions.</p>
        <p><strong>NHCS position.</strong> NHCS wants MTSS coordinators especially in Pre-K, elementary grades, and low-performing schools, because the district sees earlier intervention as more effective than waiting until gaps widen.</p>
        <p><strong>How to form your view.</strong> The strongest case: this is a prevention strategy. If schools intervene early and systematically, fewer students fall into deeper academic or behavioral crises later. The strongest caution is role design. If the coordinator role becomes mostly compliance and paperwork, the value is weaker; if it creates real screening, intervention, and progress-monitoring capacity, the case is stronger.</p>
      </>
    ),
  },
  {
    num: 2,
    title: "Pre-K Expansion",
    summary: "Giving more young children access to early learning before kindergarten.",
    question: "Does it make sense to invest earlier so students arrive at school more prepared?",
    connection: "Students do not all start school with the same preparation. Pre-K is one way to reduce that gap before it becomes harder to fix.",
    details: (
      <>
        <p><strong>What it is.</strong> NHCS already operates an Early Childhood Education program through NC Pre-K and local county support, with full-day preschool, free tuition, meals, certified teachers, and low class-size ratios. Expansion means more seats so more four-year-olds&mdash;especially children with economic or developmental risk factors&mdash;can enter kindergarten ready to learn.</p>
        <p><strong>NHCS position.</strong> Superintendent Barnes said he would like to see universal pre-K in the county and, at minimum, restoration of lost classroom capacity. NHCS's pre-K funding picture became more fragile after the loss of Head Start-administered classrooms and the expiration of some pandemic-era support.</p>
        <p><strong>How to form your view.</strong> The evidence runs mostly in favor of expansion when program quality is strong. North Carolina's own statewide evaluation found significant growth during NC Pre-K across language, literacy, math, general knowledge, and social skills. A study led by researchers at Teachers College, Columbia University found that North Carolina's public pre-K investments were associated with improved fifth-grade achievement, with larger gains for children facing more adverse environments. The serious question is not whether early learning matters&mdash;it does. The question is whether expansion would maintain quality and whether state investment is the most reliable way to stabilize capacity.</p>
      </>
    ),
  },
  {
    num: 3,
    title: "Be Pro Be Proud Truck",
    summary: "Exposing students to skilled trades and career pathways through hands-on experiences.",
    question: "Do students know enough about careers that do not require a traditional four-year college path?",
    connection: "Some students are ready for work, trade programs, apprenticeships, or community college pathways, but may not see those options clearly enough in school.",
    details: (
      <>
        <p><strong>What it is.</strong> Be Pro Be Proud NC is a mobile skilled-trades career awareness program with custom exhibition trailers and virtual-reality and hands-on simulations exposing students to construction, manufacturing, transportation, and utilities. This is not a full CTE program; it is a career exploration and pipeline-building tool.</p>
        <p><strong>NHCS position.</strong> District leaders want a truck serving southeastern North Carolina because demand is high and the existing trucks are difficult to book. That fits the district's broader framing of high school outcomes around enlistment, enrollment, or employment.</p>
        <p><strong>How to form your view.</strong> The strongest case: many students need stronger exposure to skilled-trades pathways before making course, credential, or postsecondary decisions, and this tool lowers the barrier to that first exposure. The caution: exposure is not the same as pathway completion. A truck visit has value only if it feeds into real local CTE courses, apprenticeships, community college programs, and employer partnerships.</p>
      </>
    ),
  },
  {
    num: 4,
    title: "Increased Teacher Salaries (15–24 Years Experience)",
    summary: "Keeping experienced teachers from leaving during the middle or later part of their careers.",
    question: "What is lost when strong experienced teachers leave?",
    connection: "Students know the difference between a teacher who is just surviving and a teacher who has the experience, energy, and stability to teach well.",
    details: (
      <>
        <p><strong>What it is.</strong> North Carolina's current state salary schedule is flat for teachers from years 15 through 24, with the next increase not arriving until the 25-plus year mark. NHCS is targeting this band specifically because recent raises have focused more heavily on beginning teachers while leaving veteran teachers in a long stagnation zone.</p>
        <p><strong>NHCS position.</strong> NHCS asks for increased salaries for mid-career educators to retain effective teachers, reduce burnout, and preserve continuity of instruction.</p>
        <p><strong>How to form your view.</strong> This is probably the cleanest retention ask on the list because it identifies a concrete failure point in the state schedule rather than making a general "pay teachers more" appeal. If teachers hit a decade-long plateau during peak expertise years, the system risks losing strong people when they are most valuable. The main caution is distributive politics: prioritizing mid-career teachers may mean fewer dollars for beginners or for across-the-board raises unless the state grows the total compensation pool.</p>
      </>
    ),
  },
  {
    num: 5,
    title: "Non-Instructional Support Staff",
    summary: "More counselors, social workers, nurses, and mental health personnel in schools.",
    question: "Are teachers being asked to handle problems that really require counselors, social workers, or health professionals?",
    connection: "Students bring more than academics into school. Mental health, family situations, attendance, food, safety, and conflict all affect learning.",
    details: (
      <>
        <p><strong>What it is.</strong> NHCS asks to significantly increase allotments for instructional support personnel such as counselors, social workers, and other support personnel. The policy substance: more people around students who are not classroom teachers but directly support learning, wellness, and crisis response.</p>
        <p><strong>NHCS position.</strong> Superintendent Barnes described the state instructional-support formula as thin and outdated, functioning as a catch-all for counselors, social workers, instructional coaches, media coordinators, and mental health therapists, without matching current student need. He also said the state requires an elementary counselor at every school without fully funding that expectation.</p>
        <p><strong>How to form your view.</strong> Schools are being asked to do more attendance work, behavioral support, mental-health triage, crisis response, and family coordination than the classic staffing model was built for. The American School Counselor Association recommends a 250:1 student-to-counselor ratio. The main caution is that support staffing is a recurring cost with recruitment constraints, so a policy win does not automatically become filled positions.</p>
      </>
    ),
  },
  {
    num: 6,
    title: "Lottery Funding for School Renovation and Repair",
    summary: "Using more lottery funding to repair and improve school buildings.",
    question: "Do school buildings affect how students feel, learn, and stay safe?",
    connection: "Facilities are not just cosmetic. HVAC, bathrooms, leaks, safety, classrooms, performance spaces, athletic areas, and accessibility all affect daily school life.",
    details: (
      <>
        <p><strong>What it is.</strong> North Carolina's lottery already funds several education capital streams. NHCS is not asking to create lottery capital funding from scratch; it is asking to expand the renovation-and-repair share so districts can maintain modern, secure, high-quality learning spaces.</p>
        <p><strong>NHCS position.</strong> District leaders connect this ask to the reality that county governments remain primarily responsible for school capital, while district needs continue to outpace local capacity.</p>
        <p><strong>How to form your view.</strong> The strongest case is maintenance realism: renovation is cheaper than deferred maintenance turning into emergency capital failure. The caution: lottery money is already spoken for in multiple categories, so this is ultimately a question of whether the state should shift more lottery revenue into hard capital rather than operations or other budget priorities.</p>
      </>
    ),
  },
  {
    num: 7,
    title: "CEP Meal Program Expansion",
    summary: "Expanding free meal access so more students can eat at school without financial barriers.",
    question: "Should every student be able to eat at school without stigma, debt, or paperwork barriers?",
    connection: "A hungry student is not in the same position to learn. Some students may not qualify neatly, may be embarrassed, or may avoid asking for help.",
    details: (
      <>
        <p><strong>What it is.</strong> The federal Community Eligibility Provision allows qualifying high-poverty schools to serve breakfast and lunch at no cost to all enrolled students without collecting household meal applications. NHCS's ask is for the state to supplement federal CEP funding so all students can be offered free meals regardless of financial status or school assignment.</p>
        <p><strong>NHCS position.</strong> NHCS's agenda language is unusually clear: supplement CEP so all students are offered free, nutritious meals regardless of financial need or school assignment, because that reduces barriers to learning and supports student well-being.</p>
        <p><strong>How to form your view.</strong> The best argument: food access is a learning condition, not a side issue. Federal research found that food insufficiency among school-aged children was lower in states that continued universal free school meals after the pandemic-era federal waiver expired. A systematic review found universal school meals were associated with higher meal participation and some positive attendance and health effects. The main caution is cost: once the state supplements beyond federal reimbursement, this becomes a recurring state commitment.</p>
      </>
    ),
  },
  {
    num: 8,
    title: "EC Funding Formula Rollout",
    summary: "Changing how the state funds services for students with disabilities so funding better matches actual needs.",
    question: "Should funding be based on the actual level of support students need?",
    connection: "EC students do not all need the same level of support. A fair system should recognize that some students require more intensive services.",
    details: (
      <>
        <p><strong>What it is.</strong> "EC" refers to Exceptional Children&mdash;students with disabilities who receive special education services. The current funding model is capped: districts receive state EC funding for the lesser of actual identified students or 13 percent of their allotted ADM. NCDPI recommended moving toward a service-level model that better reflects the frequency, intensity, and duration of services required by students' IEPs.</p>
        <p><strong>NHCS position.</strong> NHCS supports an EC weighted funding model to provide equitable, student-centered funding that improves services and outcomes. District leaders said the district would benefit either from removing the current cap or from shifting to a weighted model, because both approaches would increase resources relative to current practice.</p>
        <p><strong>How to form your view.</strong> This is one of the most technically important priorities on the agenda. The strongest argument for rollout is fairness: students with disabilities do not cost the same to serve, and a flat capped allotment can push extra costs onto local districts. The caution is implementation integrity&mdash;the model should be monitored to avoid over-identification into higher-cost service tiers for funding reasons.</p>
      </>
    ),
  },
  {
    num: 9,
    title: "Calendar Flexibility",
    summary: "Giving districts more control over the school calendar.",
    question: "Should local districts have more flexibility to set calendars around exams, weather, community college schedules, and local needs?",
    connection: "This affects exam timing, semester balance, dual enrollment, hurricanes, family schedules, and how rushed the end of a course feels.",
    details: (
      <>
        <p><strong>What it is.</strong> North Carolina law still tightly constrains traditional public school calendars. Under current statute, the opening date for students can be no earlier than the Monday closest to August 26 and the closing date no later than the Friday closest to June 11, with only limited waiver authority. NHCS is asking for broader local flexibility.</p>
        <p><strong>NHCS position.</strong> Superintendent Barnes has been especially clear about two local reasons: aligning more effectively with Cape Fear Community College so dual-enrollment students can take fuller advantage of that pathway, and building a more rational calendar around hurricane-related weather disruptions without forcing the district into legal gray areas.</p>
        <p><strong>How to form your view.</strong> The strongest case is local fit. Coastal districts, dual-enrollment-heavy districts, and districts with unique family or community needs have real reasons to want more control. The caution: flexible calendars can create complexity for families, employers, and child care&mdash;one reason the state tightened the law in the first place.</p>
      </>
    ),
  },
  {
    num: 10,
    title: "IBEC Building Funding",
    summary: "Funding a permanent or improved building for Isaac Bear Early College.",
    question: "How important is it for strong academic programs to have stable facilities?",
    connection: "Early college programs give students a different path through high school and college credit. A program can be strong but still limited by its building situation.",
    details: (
      <>
        <p><strong>What it is.</strong> Isaac Bear Early College High School has operated for years in modular units on UNCW property. NHCS asks for state building funding to expand early college opportunities and protect a long-standing higher-education partnership.</p>
        <p><strong>NHCS position.</strong> This is both an academic-program and a facilities issue. It is not simply "build a nicer school." It is "protect and expand an early-college pathway that depends on a stable physical home and a continued higher-ed partnership."</p>
        <p><strong>How to form your view.</strong> The strongest case: early colleges are one of the clearest ways districts convert high school into concrete college-credit and postsecondary opportunity, so allowing a successful model to stay in temporary modular space indefinitely is hard to justify. The main caution is opportunity cost: some will ask whether broader district capital needs should come first.</p>
      </>
    ),
  },
  {
    num: 11,
    title: "Statewide Public School Bond",
    summary: "A larger state-level investment in school buildings and facilities.",
    question: "Should school facilities be treated as a statewide responsibility, not just a local county problem?",
    connection: "Students across the state experience very different building conditions. A bond is one way to address large-scale facility needs, though it involves borrowing money.",
    details: (
      <>
        <p><strong>What it is.</strong> A statewide school bond is a large-scale capital financing tool for school construction and major facility work across North Carolina. NHCS's last district facility-needs survey identified more than $406 million in needs even before more recent construction pressures.</p>
        <p><strong>NHCS position.</strong> School capital in North Carolina is still heavily dependent on county capacity, which creates uneven outcomes. A statewide bond would spread some capital burden across the state rather than leaving districts to compete mainly through local tax base and local referendum capacity.</p>
        <p><strong>How to form your view.</strong> This is fundamentally a fairness and scale question. The strongest case: school facilities are part of the state's constitutional education obligation, and major capital backlogs are bigger than many counties can solve alone. The caution: borrowing today creates repayment obligations tomorrow, and statewide bonds can become lightning rods for taxpayer skepticism.</p>
      </>
    ),
  },
  {
    num: 12,
    title: "Funding in Arrears Model",
    summary: "Funding schools based more realistically on enrollment patterns so districts can plan without sudden budget swings.",
    question: "Should school funding be stable enough for districts to hire staff and plan programs responsibly?",
    connection: "Students may not notice this directly, but they feel the results: course availability, staffing, class sizes, support services, and program stability.",
    details: (
      <>
        <p><strong>What it is.</strong> Under this model, effective July 1, 2024, public school units are funded on the prior fiscal year's "Best 1 of 2" ADM. If a district's current-year actual ADM is higher than its allotted ADM, the state can allocate growth funds; if current ADM is lower, the district is held harmless for the current year and the reset happens in the next fiscal year. In plain English: districts get a more stable initial funding base and are not suddenly clawed back midyear when enrollment dips.</p>
        <p><strong>NHCS position.</strong> NHCS supports continuation and normalization of a model already being implemented. District leaders told local media that the model helps them plan because the state is not funding them and then taking money back.</p>
        <p><strong>How to form your view.</strong> This is one of the less ideological items and one of the most operationally sensible. Schools hire people and schedule services months ahead of time, so a whipsaw funding model is genuinely hard to manage. The main caution is that hold-harmless treatment can slightly delay the fiscal reckoning for districts with sustained enrollment decline.</p>
      </>
    ),
  }
];

function TopicCard({ topic }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, marginBottom: 12, background: "var(--paper-strong)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}
      >
        <span style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "var(--garnet)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
          {topic.num}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{topic.title}</div>
          <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 3 }}>{topic.summary}</div>
        </div>
        <span style={{ fontSize: 20, color: "var(--muted)", flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", marginTop: 2 }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={{ padding: "16px 20px 20px 62px", borderTop: "1px solid var(--line)" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--garnet)", marginBottom: 5 }}>
              Student question
            </div>
            <div style={{ fontSize: 15, fontStyle: "italic", color: "var(--ink)" }}>
              &ldquo;{topic.question}&rdquo;
            </div>
          </div>
          <div style={{ marginBottom: topic.details ? 14 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>
              Possible connection
            </div>
            <div style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.6 }}>
              {topic.connection}
            </div>
          </div>
          {topic.details && (
            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                Detailed Background
              </div>
              <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6 }} className="brief-body">
                {topic.details}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RaleighBriefClient() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">
        <a href="/" style={{ color: "inherit", textDecoration: "none" }}>Bands of Ashley High School</a>
        {" · "}
        <a href="https://www.nhcs.net" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>NHCS</a>
      </p>
      <h1>Student Brief</h1>
      <p className="lede">
        NC General Assembly visit &mdash; May 20, 2026. What the issues are, why they matter, and how to think about them as a student.
      </p>

      <div style={{ background: "var(--paper-strong)", border: "1px solid var(--line)", borderRadius: 10, padding: "20px 24px", marginBottom: 36, fontSize: 15, lineHeight: 1.7, color: "var(--ink)" }}>
        <p style={{ margin: "0 0 12px" }}>
          You do not need to be an expert on every issue. The most important thing you bring tomorrow is your own experience as a student.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          Lawmakers hear policy positions all the time. What makes those positions matter is hearing directly from people who live them.
        </p>
        <p style={{ margin: 0 }}>
          You are not there to repeat someone else&rsquo;s opinion. You are there to understand the issues, think about how they connect to your own experience, and begin forming your own views. It is completely fine to say, &ldquo;I&rsquo;m still learning about this,&rdquo; or &ldquo;From my experience as a student, this is what I&rsquo;ve noticed.&rdquo;
        </p>
      </div>

      <div style={{ background: "#f0f4f8", border: "1px solid #ccd6df", borderRadius: 10, padding: "20px 24px", marginBottom: 36, fontSize: 15, lineHeight: 1.7 }}>
        <strong>For at least 3 topics, try to answer:</strong>
        <ul style={{ margin: "10px 0 0", paddingLeft: 20 }}>
          <li>&ldquo;I think this issue matters because ______.&rdquo;</li>
          <li>&ldquo;From my experience as a student, I have seen ______.&rdquo;</li>
          <li>&ldquo;I support / question / want to learn more about this because ______.&rdquo;</li>
          <li>&ldquo;One thing I would want legislators to understand is ______.&rdquo;</li>
        </ul>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "var(--ink)" }}>
        The 12 Issues
      </h2>

      {TOPICS.map((t) => (
        <TopicCard key={t.num} topic={t} />
      ))}

      <div style={{ marginTop: 40, padding: "20px 24px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 15, lineHeight: 1.7, color: "var(--muted)" }}>
        Tomorrow is a chance for you to represent yourselves, Ashley, and NHCS well &mdash; not by sounding rehearsed, but by being thoughtful, honest, and respectful. Looking forward to it.
        <br /><br />
        <strong style={{ color: "var(--ink)" }}>&mdash; Mr. Parker</strong>
      </div>

      {/* Research Brief */}
      <div style={{ marginTop: 60, borderTop: "2px solid var(--line)", paddingTop: 40 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
          Research Brief
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>
          Full background on each priority. Read as much or as little as you want.
        </p>
        <p style={{ fontSize: 14, marginBottom: 32 }}>
          Primary source:{" "}
          <a href="https://www.nhcs.net/board-of-education/legislative-priorities" target="_blank" rel="noopener noreferrer" style={{ color: "var(--garnet)", fontWeight: 600 }}>
            NHCS Legislative Priorities &rarr;
          </a>
        </p>

        <div style={{ fontSize: 15, lineHeight: 1.75, color: "var(--ink)" }} className="brief-body">

          <h3>What NHCS is asking for</h3>
          <p>New Hanover County Schools publicly frames its legislative agenda around academic excellence, workforce sustainability, student well-being, and family and community access. The school board approved its legislative agenda in early May 2026 on a 6&ndash;1 vote.</p>
          <p>One practical note: NHCS's public materials are not perfectly synchronized. The district's main legislative priorities webpage reflects the twelve items in the cards above, but a printable one-page handout from the same page appears to reflect an older version that omits the statewide public school bond and funding-in-arrears items. Use the board webpage as your main reference.</p>
          <p>A useful way to read the agenda: some items are new-money asks for people and services, some request changes to how the state allocates money, and some ask to loosen rules so the district can operate with more local control. A salary ask, a capital bond, a calendar law change, and a funding-formula revision all move through state government differently.</p>

          <h3>Forming your own position</h3>
          <p>A useful way to sort the twelve items:</p>
          <p><strong>High-confidence support if your lens is student access and prevention:</strong> Pre-K expansion, CEP meal expansion, MTSS coordinators, and EC weighted funding. Each tries to solve problems earlier, closer to students, and with fewer barriers before they become much more expensive later.</p>
          <p><strong>Support, but ask hard implementation questions:</strong> support staff, Be Pro Be Proud, calendar flexibility, and funding in arrears. These are generally sensible, but the benefits depend heavily on execution.</p>
          <p><strong>Capital and compensation priorities where values matter as much as evidence:</strong> mid-career teacher pay, lottery repair funding, IBEC building funding, and a statewide school bond. These asks are rational, but they depend more on your beliefs about how North Carolina should divide responsibility between state and local government.</p>
          <p>One concise standard for all twelve: <em>support the items that remove direct barriers to student learning, protect strong educators from avoidable attrition, and fix structural funding problems rather than temporarily patching them. Be more skeptical of items that spend money without changing the underlying system.</em></p>

          <h3>Open questions and limitations</h3>
          <p>NHCS's own public-facing agenda materials are slightly inconsistent. The main webpage and the printable one-page handout do not list exactly the same priorities. Use the board webpage and current board discussion as the main reference, not the older handout alone.</p>
          <p>Some priorities are conceptually clear but not yet fully specified in public NHCS materials&mdash;especially the IBEC building item, the statewide public school bond item, and the exact legislative vehicle for EC rollout. NHCS's public documents signal support but do not fully spell out preferred bill language, dollar amounts, or sequencing.</p>
          <p>The agenda is a statement of priorities, not proof that the General Assembly will act on each item in the form NHCS prefers. In several areas&mdash;calendar law, EC funding, and public school finance mechanics&mdash;the district is operating inside a moving state policy environment rather than asking for change from a blank slate.</p>

        </div>
      </div>
    </main>
  );
}
