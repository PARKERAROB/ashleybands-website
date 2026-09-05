import Image from "next/image";
import Link from "next/link";
import styles from "./story.module.css";

export const metadata = {
  title: "Our Story: From Struggle to Distinction | Ashley Bands",
  description: "Two decades of Ashley Bands: the 2016 NCMEA performance, rebuilding after COVID, a return to Superior performances, and the journey to Carnegie Hall in 2027.",
  alternates: { canonical: "https://ashleybands.com/our-story" },
  openGraph: {
    title: "From struggle to distinction. The Ashley Bands story.",
    description: "Built by generations of students, families, and educators. From Wilmington to Carnegie Hall.",
    url: "https://ashleybands.com/our-story",
    images: [{ url: "/656637421_1325880026241163_8640066925134763727_n.jpg", alt: "Ashley High School Wind Ensemble on stage" }]
  }
};

const chapters = [
  ["beginnings", "2006", "A first job. A shared beginning."],
  ["ncmea", "2016", "A stage earned together."],
  ["rebuilding", "2020 onward", "When the music was interrupted."],
  ["return", "2026", "The music comes full circle."],
  ["distinction", "2025–2026", "A Program of Distinction."],
  ["carnegie", "2027 and beyond", "The next chapter belongs to the students."]
];

export default function OurStoryPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link href="/" className={styles.back}>← Ashley Bands</Link>
          <p className={styles.kicker}>Our story · Wilmington, North Carolina</p>
          <h1>From struggle<br />to <em>distinction.</em></h1>
          <p className={styles.lede}>A band program grows through people. Through the years when everything comes together, and the years when simply keeping the music going takes everything they have.</p>
          <p>This is the story behind Ashley’s journey to Carnegie Hall.</p>
          <a href="#beginnings" className={styles.read}>Read our story ↓</a>
        </div>
        <figure className={styles.heroPhoto}>
          <Image src="/656637421_1325880026241163_8640066925134763727_n.jpg" alt="Ashley High School Wind Ensemble performing on stage in 2026" fill priority sizes="(max-width: 850px) 100vw, 48vw" style={{ objectFit: "cover", objectPosition: "center 40%" }} />
          <figcaption>Ashley High School Wind Ensemble · 2026</figcaption>
        </figure>
      </header>

      <div className={styles.layout}>
        <nav className={styles.chapters} aria-label="Story chapters">
          <p className={styles.kicker}>Two decades. Still growing.</p>
          {chapters.map(([id, year, title]) => <a key={id} href={`#${id}`}><span>{year}</span>{title}</a>)}
          <a href="#record"><span>The archive</span>Programs &amp; historical notes</a>
        </nav>
        <article className={styles.article}>
          <section id="beginnings">
            <p className={styles.kicker}>01 / 2006</p>
            <h2>A first job.<br />A shared beginning.</h2>
            <p>Mr. Parker came to Ashley High School in 2006, fresh out of college and beginning his first teaching job. Looking back, he describes those early years with honesty: there was a great deal to learn, and plenty of mistakes along the way.</p>
            <p>The program grew through daily rehearsal, student commitment, and the support of families and educators. Concert and marching bands were part of a wider musical home that also made room for percussion, jazz, small ensembles, and students finding their place in music.</p>
            <p>Mr. Parker remembers enrollment reaching roughly 120 students around 2008. The number is a recollection, but the larger story is clear: a community was taking shape. Each class of students helped establish expectations and traditions that the next class could build on.</p>
          </section>

          <section id="ncmea">
            <p className={styles.kicker}>02 / 2016</p>
            <h2>A stage earned together.</h2>
            <p>A decade into that work, the Ashley Wind Ensemble earned the opportunity to perform at the North Carolina Music Educators Association’s professional development conference. It was a meaningful statewide recognition of what students and their community had built.</p>
            <p>The original conference publication lists Ashley’s performance for <strong>Tuesday, November 8, 2016, at 11 a.m.</strong> in Winston-Salem. Its profile describes a program active in concert, marching, chamber, and community music, with a history of Superior ratings.</p>
            <a className={styles.sourceLink} href="https://www.ncmea.net/wp-content/uploads/2020/02/NCMEA-Conference-2016web.pdf#page=26" target="_blank" rel="noreferrer">Open Ashley’s entry in the 2016 NCMEA publication ↗ <span>Printed page 24 · PDF page 26</span></a>
            <p>After the conference came another musical milestone: a performance of <em>Carmina Burana</em> at Music Performance Adjudication, or MPA. Mr. Parker remembers it as an especially ambitious and personally meaningful undertaking. That music would become a point of connection between the program’s first decade and its next chapter.</p>
          </section>

          <section id="rebuilding">
            <p className={styles.kicker}>03 / 2020 onward</p>
            <h2>When the music<br />was interrupted.</h2>
            <p>COVID disrupted the routines that make an ensemble possible. For band and choir, where making music depends on breath and on people listening and performing together, distancing and masking changed the experience of rehearsal itself.</p>
            <p>At Ashley, the effects were profound. Mr. Parker recalls the program falling to about 52 students at one point. He remembers rehearsing outdoors with masks, struggling to retain students, and wondering whether the marching program and the larger musical life of the school could fully return.</p>
            <p>Those students were still making music. But the continuity between classes, the confidence of a full ensemble, and the shared habits built over years had been interrupted. Reopening a room could not immediately restore all of that.</p>
            <div className={styles.callout}><p>Rebuilding would take seven years.</p><span>Mr. Parker’s recollection of a conversation with his Lieutenant Colonel colleague during the disruption.</span></div>
            <p>That was a long view of what recovery would require: successive classes of students learning, staying, and helping the next group find its way. The students who persevered through the difficult years made today’s opportunities possible, even when they would graduate before seeing the result.</p>
            <p>The rebuilding also depended on families, teachers, school administrators, district leadership, and arts educators continuing to believe that the program was worth supporting. The 2026–2027 season approaches the seven-year mark from the shutdown in spring 2020. For Mr. Parker, the return has been a sustained process, not a single successful concert.</p>
          </section>

          <section id="return">
            <p className={styles.kicker}>04 / March 19, 2026</p>
            <h2>The music comes<br />full circle.</h2>
            <p>In 2026, both Ashley concert ensembles earned <strong>Superior ratings at MPA</strong>: the Wind Ensemble performing at Grade VI and the Concert Band at Grade IV. Those grades describe the repertoire level, not the students’ school grades.</p>
            <p>For the Wind Ensemble, the repertoire carried a history of its own. Vincent Persichetti’s <em>Divertimento for Band, Op. 42</em> and Clifton Williams’s <em>Symphonic Dance No. 3, “Fiesta”</em> were the works Mr. Parker recalls preparing for the MPA that was canceled as COVID arrived in 2020. Returning to them in 2026 meant finally bringing that unfinished musical work to the adjudication stage with a new generation of students.</p>
            <div className={styles.repertoire}>
              <div><span>Wind Ensemble · Grade VI · Superior</span><h3>The 2026 program</h3><ul><li><em>Xerxes</em><small>John Mackey</small></li><li><em>Divertimento for Band, Op. 42</em><small>Vincent Persichetti</small></li><li><em>Symphonic Dance No. 3, “Fiesta”</em><small>Clifton Williams</small></li></ul></div>
              <div><span>Concert Band · Grade IV · Superior</span><h3>A shared return</h3><ul><li><em>Bonds of Unity</em><small>Karl King / arr. James Swearingen</small></li><li><em>Southern Hymn</em><small>Samuel Hazo</small></li><li><em>Dimensions of Seven</em><small>James Curnow</small></li></ul></div>
            </div>
            <p>The march was the one change from the intended 2020 Wind Ensemble program. Mr. Parker had planned to pair the Persichetti and Williams works with his favorite march, <em>Nobles of the Mystic Shrine</em>. In 2026, the students were drawn to John Mackey’s <em>Xerxes</em>, and he chose to follow their enthusiasm.</p>
            <p><em>Xerxes</em> already held a place in Ashley’s musical history. Mr. Parker recalls Ashley being among the early ensembles he knew to bring its unconventional character to MPA. Returning to it connected the students’ own musical interests with the program’s past. The choice made the performance theirs.</p>
            <p>The Persichetti masterwork, the exuberance of <em>Fiesta</em>, and the distinctive voice of <em>Xerxes</em> made the program more than a list of demanding pieces. For Mr. Parker, hearing students meet that challenge was evidence of a musical return years in the making.</p>
            <p>The year’s work extended beyond MPA. In May, the Wind Ensemble performed all five movements of Johan de Meij’s <em>Symphony No. 1, “The Lord of the Rings.”</em> The Concert Band, percussion students, and other ensembles contributed their own performances to a season of renewed ambition.</p>
            <div className={styles.links}><a href="/distinction/docs/mpa-program-south-site.pdf">2026 MPA program ↗</a><a href="/distinction/docs/mpa-results-statewide.pdf">2026 MPA results ↗</a><Link href="/programs/spring-concert-2026">Spring concert program →</Link></div>
          </section>

          <section id="distinction">
            <div className={styles.award}><Image src="/images/home/program-of-distinction.png" alt="Official North Carolina Bandmasters Association Program of Distinction badge" width={176} height={176} /><div><p className={styles.kicker}>05 / Inaugural class · 2025–2026</p><h2>A Program<br />of Distinction.</h2></div></div>
            <p>The North Carolina Bandmasters Association named Ashley to its inaugural class of Programs of Distinction. The designation recognizes musical excellence, performance, community outreach, and advocacy.</p>
            <p>The record behind that recognition reaches beyond one ensemble or one concert: Superior performances by both concert bands; students participating in honor bands; jazz and chamber music; marching and other school-spirit ensembles; community performances; and collaboration with younger musicians. Ten Ashley students were selected by audition for the 2026 Eastern District All-District Band.</p>
            <p>The September 1, 2026 Board of Education recognition offered a moment to reflect on the people behind the award. In preparing his remarks, Mr. Parker returned to a simple responsibility: celebrate programs that are succeeding, and keep supporting programs that are struggling.</p>
            <div className={styles.callout}><p>Today’s Program of Distinction was once a program struggling to find its way back.</p><span>Achievement does not erase the difficult years. It shows why support during those years matters.</span></div>
            <p>This recognition belongs to generations of students and to the families, educators, administrators, and community members who stayed with them. No one director, class, or concert built it alone.</p>
          </section>

          <section id="carnegie">
            <p className={styles.kicker}>06 / 2027 and beyond</p>
            <h2>The next chapter<br />belongs to the students.</h2>
            <p>Both the Ashley Concert Band and Wind Ensemble have been selected for the National Band &amp; Orchestra Festival at Carnegie Hall on <strong>March 25, 2027</strong>. The planned New York trip runs March 23–26.</p>
            <p>Mr. Parker’s musical plan includes returning to <em>Carmina Burana</em> for MPA and Carnegie Hall. A work that helped mark the first decade of his time at Ashley could now become part of another generation’s story. The performance program remains a plan as preparation continues.</p>
            <p>The educational aim reaches beyond entering a famous building: prepare demanding music, learn from clinicians, perform with purpose, and bring those experiences back to the classroom. The invitation is a milestone in that work, and an opportunity to imagine what the next ten years could hold.</p>
            <p>As the 2026–2027 year begins, Mr. Parker describes enrollment as the second highest of his time at Ashley. Today’s students have different demands on their attention and more ways to spend their time than the students he first taught in 2006. They are still choosing band. Families are still finding value in the community it creates.</p>
            <p>The next chapter is about continuing to earn that trust: expanding what students can experience, deepening what they learn each day, and helping them carry music into their lives beyond graduation. In his board-meeting preparation, Mr. Parker recalled alumni traveling back from as far away as Portland, Oregon, and New York to perform with the program again. That kind of return speaks to a connection that lasts long after a student’s final school concert.</p>
            <p>Music education gives students repeated opportunities to listen, contribute, persist through difficulty, and make something meaningful with other people. Carnegie Hall can be one extraordinary part of that education. The lasting story is what students take with them, and what they make possible for those who follow.</p>
            <div className={styles.next}><p className={styles.kicker}>From Wilmington to Carnegie Hall</p><h3>Be part of the next chapter.</h3><p>A community sponsorship campaign is being prepared to help make this opportunity possible. Campaign details are coming soon.</p><Link href="/info/carnegie-2027">Explore current Carnegie Hall information →</Link><p className={styles.fine}>Final participation, price, approvals, funding, and travel arrangements remain subject to confirmation.</p></div>
          </section>

          <section id="record" className={styles.record}>
            <p className={styles.kicker}>Programs &amp; historical notes</p>
            <h2>Keeping the story connected to its record.</h2>
            <p>This account brings together public performance records and Mr. Parker’s recollections, including his September 2026 board-recognition preparation. Approximate enrollment figures and the seven-year conversation are identified as recollections. They are not an audited enrollment history.</p>
            <ul>
              <li><a href="https://www.ncmea.net/wp-content/uploads/2020/02/NCMEA-Conference-2016web.pdf#page=26" target="_blank" rel="noreferrer">2016 NCMEA conference publication</a>: Ashley’s profile and scheduled performance appear on printed page 24 (PDF page 26). This is the conference entry, not the ensemble’s complete concert program.</li>
              <li><a href="https://www.ncbaeastern.com/past-programs.html" target="_blank" rel="noreferrer">NCBA Eastern District program archive</a>: the source for earlier MPA programs. The exact year and program for Ashley’s first <em>Carmina Burana</em> performance are still being located.</li>
              <li><Link href="/repertoire">Ashley’s repertoire archive</Link> and the linked 2026 programs document the more recent musical record.</li>
            </ul>
            <p className={styles.fine}>The 2016 NCMEA profile also describes a program serving 120 students. Differences between remembered peaks and published program totals are not resolved here; the story makes no precise historical enrollment comparison.</p>
            <Link href="/">← Return to Ashley Bands</Link>
          </section>
        </article>
      </div>
    </main>
  );
}
