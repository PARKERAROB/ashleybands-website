import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import NotesChart from "@/components/NotesChart";
import { logAudit, staffActor } from "@/lib/auditLog";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";
import {
  authorizeLetterReviewer,
  carnegieLettersAccess,
  familyActor,
  letterWithPrinted,
  loadFamilyLetter,
  loadLetterById,
  portalPerson,
  studentForLetter,
  studentLinkCode
} from "@/lib/carnegieLettersServer";
import {
  CAMPAIGN_GIFT_LINE,
  CARNEGIE_CHECK_PAYEE,
  EMPLOYER_MATCH_LINE,
  GIFT_SLIP_LINE,
  PUBLIC_SITE,
  carnegieCheckMemo,
  carnegieStudentPath,
  carnegieStudentReadableUrl,
  composeCarnegieLetter,
  letterIsPrintable
} from "@/lib/carnegieLetters.mjs";
import PacketControls from "./PacketControls";
import styles from "./packet.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Carnegie Letter Packet (Print) | Ashley Bands",
  robots: { index: false, follow: false }
};

// Printable packet for one approved letter (#106): front is the letter, back is the notes chart,
// QR code and how to pay. Visible to that student's family and to reviewing staff only.
async function resolveViewer(requestLike, id) {
  const session = portalPerson(requestLike);
  if (session) {
    const letter = await loadFamilyLetter(session.personId, id);
    if (letter) return { letter, viewer: "family", actor: familyActor(session) };
  }
  const staff = await authorizeLetterReviewer(requestLike).catch(() => ({ ok: false }));
  if (staff.ok) {
    const letter = await loadLetterById(id);
    if (letter) return { letter, viewer: "staff", actor: staffActor(staff.staff) };
  }
  return null;
}

function Logo({ size = 72 }) {
  return (
    <span className={styles.logo} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bandsofahslogo.png" alt="Ashley Bands eagle" width={size - 12} height={size - 12} />
    </span>
  );
}

export default async function CarnegieLetterPacketPage({ params }) {
  const requestLike = { cookies: await cookies() };
  const access = await carnegieLettersAccess(requestLike);
  if (!access.open) notFound();
  const { id } = await params;
  const resolved = await resolveViewer(requestLike, id);
  if (!resolved) notFound();
  const { viewer, actor } = resolved;
  // What prints: the staff-approved correction when there is one; the original is kept as written.
  const letter = await letterWithPrinted(resolved.letter);
  await logAudit({ actor, action: "print_view", table: "carnegie_student_letters", recordId: letter.id, route: "/portal/carnegie-notes/packet/[id]" });

  const backHref = viewer === "staff" ? "/admin/carnegie-letters" : "/portal/carnegie-notes";
  if (!letterIsPrintable(letter)) {
    return (
      <main className={styles.message}>
        <p>This letter is not approved for printing yet. It can be printed once band staff approve it.</p>
        <p><a href={backHref}>Back</a></p>
      </main>
    );
  }
  const [student, code] = await Promise.all([studentForLetter(letter), studentLinkCode(letter.portal_student_id)]);
  if (!student || !code) {
    return <main className={styles.message}><p>This student&apos;s Carnegie link is not active. Ask band staff for help.</p><p><a href={backHref}>Back</a></p></main>;
  }
  const url = `https://${PUBLIC_SITE}${carnegieStudentPath(code)}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#191716", light: "#ffffff" } });
  const text = composeCarnegieLetter({
    recipientType: letter.recipient_type,
    recipientName: letter.recipient_name,
    meaningText: letter.printed_meaning_text,
    helpText: letter.printed_help_text,
    firstName: student.firstName,
    code
  });
  const name = text.signature;

  return (
    <main className={styles.page}>
      {/* Print-only packet fonts, loaded for this one page on purpose. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" />
      <PacketControls letterId={letter.id} version={letter.version} status={letter.status} viewer={viewer} backHref={backHref} previewMode={access.mode === "staff"} />

      <article className={`${styles.sheet} ${styles.front}`} aria-label="Packet front: the letter">
        <header className={styles.frontHead}>
          <div>
            <p className={styles.org}>The Bands of Ashley High School</p>
            <p className={styles.sub}>From Wilmington to Carnegie Hall · March 25, 2027</p>
          </div>
          <Logo size={68} />
        </header>
        <p className={styles.body}>{text.greeting}</p>
        <p className={styles.body}>{text.opening}</p>
        <div className={styles.ownWords}>
          <p className={styles.ownLabel}>{text.ownWordsLabel}</p>
          <p className={styles.ownText}>{text.meaning}</p>
          <p className={styles.ownText}>{text.help}</p>
        </div>
        <p className={styles.body}>Would you help me fill my music notes? My part of the team goal is <strong>$500</strong>, and every $5 or $10 note makes a difference. Every gift goes to the band&apos;s Carnegie campaign and lowers the trip cost for all of us.</p>
        <p className={styles.body}>{text.closing}</p>
        <p className={styles.body}>{text.signoff}<br /><span className={styles.signature}>{name}</span></p>
        <footer className={styles.frontFoot}>
          <span className={styles.qrSmall} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className={styles.footText}>
            <p className={styles.url}>{carnegieStudentReadableUrl(code)}</p>
            <p>{text.payLine}</p>
            <p>{text.campaignLine}</p>
          </div>
        </footer>
      </article>

      <article className={`${styles.sheet} ${styles.back}`} aria-label="Packet back: fill my music notes">
        <header className={styles.backHead}>
          <div>
            <p className={styles.org}>The Bands of Ashley High School</p>
            <div className={styles.banner}>
              <span className={styles.bannerTop}>Help us get to</span>
              <span className={styles.bannerScript}>Carnegie Hall!</span>
            </div>
          </div>
          <div className={styles.backMark}>
            <Logo size={96} />
            <p>March 25, 2027<br />New York City</p>
          </div>
        </header>
        <div className={styles.backMain}>
          <div className={styles.backLeft}>
            <p className={styles.backLede}>Our bands were selected to perform at Carnegie Hall! Support us by joining our <strong>“Fill my Music Notes”</strong> fundraiser.</p>
            <p className={styles.backCampaign}>{CAMPAIGN_GIFT_LINE}</p>
            <p className={styles.sticky}>Every Note Makes a Difference!</p>
            <p className={styles.studentLabel}>Student:<br /><span className={styles.studentName}>{name}</span></p>
          </div>
          <div className={styles.backRight}>
            <p className={styles.goal}>Goal: <span>$500</span></p>
            <NotesChart blank className={styles.chart} />
          </div>
        </div>
        <ol className={styles.stepsRow}>
          <li><span>1</span>Choose the notes you&apos;d like to give and color them in.</li>
          <li><span>2</span>Scan the code to give online, or write a check to the Boosters.</li>
          <li><span>3</span>Once your gift is confirmed, {name}&apos;s notes fill in online.</li>
        </ol>
        <footer className={styles.pay}>
          <span className={styles.qrLarge} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div>
            <p className={styles.payTitle}>How to pay</p>
            <p><strong>Online:</strong> scan the code, or visit {carnegieStudentReadableUrl(code)}</p>
            <p><strong>Check:</strong> payable to {CARNEGIE_CHECK_PAYEE}, memo “{carnegieCheckMemo(name)}.” Give it to {name}, or mail it to {SPONSOR_CONTACT.school}, {SPONSOR_CONTACT.address}, {SPONSOR_CONTACT.cityStateZip}.</p>
            <p className={styles.matchLine}>{EMPLOYER_MATCH_LINE}</p>
          </div>
        </footer>
        <p className={styles.thanks}>Thank you for your support!</p>
        <section className={styles.slip} aria-label="Gift slip for cash or check">
          <div className={styles.slipHead}>
            <p className={styles.slipTitle}>Gift slip · cash or check</p>
            <p className={styles.slipCut}>✂ Cut here. Giving online? You don&apos;t need this slip.</p>
          </div>
          <div className={styles.slipGrid}>
            <p className={styles.slipField}><span>Student:</span><i>{name}</i></p>
            <p className={styles.slipField}><span>Donor name:</span><i /></p>
            <p className={styles.slipField}><span>Amount: $</span><i /></p>
            <p className={styles.slipField}><span>☐ Cash&nbsp;&nbsp;☐ Check #</span><i /></p>
            <p className={styles.slipField}><span>Donor email (optional, for a receipt):</span><i /></p>
          </div>
          <p className={styles.slipNote}>Make checks payable to {CARNEGIE_CHECK_PAYEE}, memo “{carnegieCheckMemo(name)}.” {GIFT_SLIP_LINE}</p>
        </section>
      </article>
    </main>
  );
}
