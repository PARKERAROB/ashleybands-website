import Image from "next/image";
import Link from "next/link";
import styles from "./story.module.css";

export const metadata = {
  title: "Our Story | Ashley Bands",
  description: "Ashley Bands from 2006 to the 2027 Carnegie Hall invitation: the 2016 NCMEA performance, the drop to about 52 students after COVID, Superior ratings in 2026, and what is planned next.",
  alternates: { canonical: "https://ashleybands.com/our-story" },
  openGraph: {
    title: "The Ashley Bands story, 2006 to 2027.",
    description: "How a Wilmington high school band program got an invitation to Carnegie Hall.",
    url: "https://ashleybands.com/our-story",
    images: [{ url: "/656637421_1325880026241163_8640066925134763727_n.jpg", alt: "Ashley High School Wind Ensemble on stage" }]
  }
};

const chapters = [
  ["beginnings", "2006", "Mr. Parker's first job"],
  ["ncmea", "2016", "The NCMEA conference"],
  ["rebuilding", "2020 onward", "COVID and the rebuild"],
  ["return", "2026", "The 2020 program, finally played"],
  ["distinction", "2025–2026", "Program of Distinction"],
  ["carnegie", "2027 and beyond", "Carnegie Hall, March 25, 2027"]
];

export default function OurStoryPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <Link href="/" className={styles.back}>← Ashley Bands</Link>
          <p className={styles.kicker}>Our story · Wilmington, North Carolina</p>
          <h1>How we<br />got <em>here.</em></h1>
          <p className={styles.lede}>Ashley Bands has been invited to play Carnegie Hall in March 2027. Six years ago the program was down to about 52 students and rehearsing outside in masks.</p>
          <p>This page is how one turned into the other.</p>
          <a href="#beginnings" className={styles.read}>Start at 2006 ↓</a>
        </div>
        <figure className={styles.heroPhoto}>
          <Image src="/656637421_1325880026241163_8640066925134763727_n.jpg" alt="Ashley High School Wind Ensemble performing on stage in 2026" fill priority sizes="(max-width: 850px) 100vw, 48vw" style={{ objectFit: "cover", objectPosition: "center 40%" }} />
          <figcaption>Ashley High School Wind Ensemble · 2026</figcaption>
        </figure>
      </header>

      <div className={styles.layout}>
        <nav className={styles.chapters} aria-label="Story chapters">
          <p className={styles.kicker}>2006 to now</p>
          {chapters.map(([id, year, title]) => <a key={id} href={`#${id}`}><span>{year}</span>{title}</a>)}
          <a href="#record"><span>The archive</span>Programs &amp; historical notes</a>
        </nav>

        <article className={styles.article}>
          <section id="beginnings">
            <p className={styles.kicker}>01 / 2006</p>
            <h2>Mr. Parker’s<br />first job.</h2>
            <p>Mr. Parker came to Ashley in 2006, straight out of college. It was his first teaching job, and by his own account he made plenty of mistakes in those first years.</p>
            <p>The program grew anyway. Concert band and marching band were the core, with percussion, jazz, and small ensembles around them.</p>
            <p>By about 2008 enrollment was somewhere around 120 students. That number is from memory, not a roster, but it was a full band room.</p>
          </section>

          <section id="ncmea">
            <p className={styles.kicker}>02 / 2016</p>
            <h2>The NCMEA conference.</h2>
            <p>Ten years in, the Wind Ensemble was selected to perform at the North Carolina Music Educators Association conference in Winston-Salem.</p>
            <p>The conference program lists the performance for <strong>Tuesday, November 8, 2016, at 11 a.m.</strong> The entry describes a program active in concert, marching, chamber, and community music, with a history of Superior ratings. The page is linked below.</p>
            <a className={styles.sourceLink} href="https://www.ncmea.net/wp-content/uploads/2020/02/NCMEA-Conference-2016web.pdf#page=26" target="_blank" rel="noreferrer">Open Ashley’s entry in the 2016 NCMEA publication ↗ <span>Printed page 24 · PDF page 26</span></a>
            <p>After the conference, the band took <em>Carmina Burana</em> to Music Performance Adjudication, or MPA. It is an ambitious piece for a high school band. Keep it in mind. It comes back at the end.</p>
          </section>

          <section id="rebuilding">
            <p className={styles.kicker}>03 / 2020 onward</p>
            <h2>COVID.</h2>
            <p>Band depends on breath and on people in a room together. COVID took both away.</p>
            <p>The program dropped to about 52 students at the low point. Rehearsals moved outside, in masks. Students left and did not come back. Mr. Parker was not sure the marching band would come back.</p>
            <p>The students who stayed kept playing. What was gone was everything a band passes down from seniors to freshmen, and reopening the room did not bring it back.</p>
            <div className={styles.callout}><p>Rebuilding would take seven years.</p><span>A colleague, a Lieutenant Colonel, said this to Mr. Parker during the shutdown.</span></div>
            <p>He was right. It took class after class of students learning the program, staying in it, and teaching the next group. Most of the students who did that work graduated before the Carnegie Hall invitation came.</p>
            <p>The 2026–2027 season is the seventh since the shutdown in spring 2020.</p>
          </section>

          <section id="return">
            <p className={styles.kicker}>04 / March 19, 2026</p>
            <h2>The 2020 program,<br />finally played.</h2>
            <p>On March 19, 2026, both concert ensembles earned <strong>Superior ratings at MPA</strong>. The Wind Ensemble played at Grade VI and the Concert Band at Grade IV. The grade is the difficulty of the music, not a school grade.</p>
            <p>Two of the Wind Ensemble pieces had been waiting six years. Vincent Persichetti’s <em>Divertimento for Band, Op. 42</em> and Clifton Williams’s <em>Symphonic Dance No. 3, “Fiesta”</em> were on the program for the 2020 MPA that COVID canceled. None of the 2026 students had been in the band then.</p>
            <div className={styles.repertoire}>
              <div><span>Wind Ensemble · Grade VI · Superior</span><h3>The 2026 program</h3><ul><li><em>Xerxes</em><small>John Mackey</small></li><li><em>Divertimento for Band, Op. 42</em><small>Vincent Persichetti</small></li><li><em>Symphonic Dance No. 3, “Fiesta”</em><small>Clifton Williams</small></li></ul></div>
              <div><span>Concert Band · Grade IV · Superior</span><h3>The 2026 program</h3><ul><li><em>Bonds of Unity</em><small>Karl King / arr. James Swearingen</small></li><li><em>Southern Hymn</em><small>Samuel Hazo</small></li><li><em>Dimensions of Seven</em><small>James Curnow</small></li></ul></div>
            </div>
            <p>The march was the one change. The 2020 plan was <em>Nobles of the Mystic Shrine</em>, Mr. Parker’s favorite. The 2026 students wanted John Mackey’s <em>Xerxes</em>, so that is what they played.</p>
            <p>Ashley had taken <em>Xerxes</em> to MPA years before, early enough that Mr. Parker remembers it being an unusual choice at the time.</p>
            <p>In May the Wind Ensemble played all five movements of Johan de Meij’s <em>Symphony No. 1, “The Lord of the Rings.”</em> The spring concert program is linked below.</p>
            <div className={styles.links}><a href="/distinction/docs/mpa-program-south-site.pdf">2026 MPA program ↗</a><a href="/distinction/docs/mpa-results-statewide.pdf">2026 MPA results ↗</a><Link href="/programs/spring-concert-2026">Spring concert program →</Link></div>
          </section>

          <section id="distinction">
            <div className={styles.award}><Image src="/images/home/program-of-distinction.png" alt="Official North Carolina Bandmasters Association Program of Distinction badge" width={176} height={176} /><div><p className={styles.kicker}>05 / Inaugural class · 2025–2026</p><h2>A Program<br />of Distinction.</h2></div></div>
            <p>The North Carolina Bandmasters Association named Ashley to its first class of Programs of Distinction. NCBA’s criteria are musical excellence, performance, community outreach, and advocacy.</p>
            <p>The record includes Superior ratings from both concert bands, students in honor bands, jazz and chamber groups, the marching band and pep band, community performances, and work with younger musicians. Ten students made the 2026 Eastern District All-District Band by audition.</p>
            <p>The Board of Education recognized the program on September 1, 2026. Mr. Parker’s remarks that night made one point: celebrate the programs that are doing well, and keep supporting the ones that are struggling.</p>
            <div className={styles.callout}><p>Today’s Program of Distinction was a 52-student program six years ago.</p><span>The point of the September 1 remarks.</span></div>
          </section>

          <section id="carnegie">
            <p className={styles.kicker}>06 / 2027 and beyond</p>
            <h2>Carnegie Hall,<br />March 25, 2027.</h2>
            <h3 className={styles.fullCircleTitle}>Mr. Parker has played there.</h3>
            <p>As a freshman at Mount Tabor High School, Mr. Parker played Carnegie Hall with his own band. The photo below is from that trip.</p>
            <figure className={styles.historicalPhoto}>
              <a href="/images/story/mount-tabor-carnegie-original.jpeg" target="_blank" rel="noreferrer" aria-label="Open the original Mount Tabor Carnegie Hall photograph at full size">
                <Image src="/images/story/mount-tabor-carnegie-original.jpeg" alt="Mount Tabor High School band on the Carnegie Hall stage during Mr. Parker's freshman-year visit" width={1290} height={1034} sizes="(max-width: 850px) 100vw, 800px" unoptimized />
              </a>
              <figcaption>Mount Tabor High School at Carnegie Hall, during Mr. Parker’s freshman year. Original photograph from his personal collection. <a href="/images/story/mount-tabor-carnegie-original.jpeg" target="_blank" rel="noreferrer">View full-size photo ↗</a></figcaption>
            </figure>
            <p>In March 2027 he goes back with his own students.</p>
            <p>Both the Ashley Concert Band and Wind Ensemble have been selected for the National Band &amp; Orchestra Festival at Carnegie Hall on <strong>March 25, 2027</strong>. The New York trip is planned for March 23–26.</p>
            <p>The plan is to bring <em>Carmina Burana</em> back, for MPA and then for Carnegie Hall. It is the same piece the band took to MPA after the 2016 conference. The performance program is not final yet.</p>
            <p>Enrollment this fall is the second highest in Mr. Parker’s twenty years at Ashley. Students in 2026 have more competing for their time than the students of 2006 did. They are still choosing band.</p>
            <p>Alumni have come back from as far as Portland, Oregon, and New York to play with the band again.</p>
            <div className={styles.next}><p className={styles.kicker}>From Wilmington to Carnegie Hall</p><h3>Help get the band there.</h3><p>Fundraisers are open now, and a sponsorship campaign for the trip is being put together.</p><Link href="/info/carnegie-2027">Current Carnegie Hall information →</Link><p className={styles.fine}>Final participation, price, approvals, funding, and travel arrangements remain subject to confirmation.</p></div>
          </section>

          <section id="record" className={styles.record}>
            <p className={styles.kicker}>Programs &amp; historical notes</p>
            <h2>Sources.</h2>
            <p>This page combines public performance records with Mr. Parker’s recollections, including his notes for the September 2026 board recognition. The enrollment numbers and the seven-year conversation are from memory, not an audited history.</p>
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
