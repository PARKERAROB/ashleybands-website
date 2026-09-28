"use client";
import { useEffect, useState } from "react";
import { CalendarDays, CalendarRange, ClipboardCheck, Music, BookOpen, ListOrdered, Megaphone, Music4, NotebookPen } from "lucide-react";
import { CLASS_BLOCKS, TIME_ZONE, nextOnOrAfter, schoolClock, selectBlock, shortDate } from "@/lib/classroomBoard.mjs";
import styles from "./page.module.css";

const REFRESH_MS = 5 * 60 * 1000;

function to12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`;
}

function List({ items, empty, className = styles.list }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={className}>
      {list.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function RoomBoard({ slug, initialData }) {
  const [data, setData] = useState(initialData);
  const [now, setNow] = useState(null);
  const [manual, setManual] = useState(null);

  // Clock ticks every 15 seconds. Rendered after mount so server and client agree.
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 15 * 1000);
    return () => clearInterval(id);
  }, []);

  // Fresh data every 5 minutes without reloading the page.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/${slug}`, { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        // Keep showing the last good data.
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [slug]);

  // A manual pick lasts until the next block change.
  const autoId = now ? selectBlock(now) : CLASS_BLOCKS[0].id;
  const activeId = manual && manual.forAuto === autoId ? manual.id : autoId;
  const active = CLASS_BLOCKS.find((block) => block.id === activeId);
  const cls = data.classes?.[activeId] || {};

  const clock = now ? schoolClock(now) : null;
  const today = clock?.isoDate || data.weekOf;
  const todayName = clock?.weekday || "Mon";
  const isSchoolDay = (data.week || []).some((day) => day.date === today);
  const nextTest = nextOnOrAfter(data.tests, today);
  const bigDate = nextOnOrAfter(data.bigDates, today);
  const daysAway = bigDate ? Math.round((Date.parse(`${bigDate.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000) : null;
  const plan = isSchoolDay ? cls.plans?.[todayName] : null;

  return (
    <main className={styles.board}>
      <header className={styles.top}>
        <div className={styles.title}>
          <p className={styles.block}>
            {active.block} · {to12(active.start)} to {to12(active.end)}
          </p>
          <h1>{active.name}</h1>
        </div>
        <nav className={styles.switcher} aria-label="Choose a class">
          {CLASS_BLOCKS.map((block) => (
            <button
              key={block.id}
              type="button"
              className={block.id === activeId ? styles.switchOn : styles.switchBtn}
              aria-pressed={block.id === activeId}
              onClick={() => setManual(block.id === autoId ? null : { id: block.id, forAuto: autoId })}
            >
              <span>{block.block}</span>
              {block.name}
            </button>
          ))}
        </nav>
        <div className={styles.clock} aria-live="off">
          <p className={styles.time}>
            {now ? new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(now) : " "}
          </p>
          <p className={styles.date}>
            {now ? new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric" }).format(now) : " "}
          </p>
        </div>
      </header>

      <section className={styles.strip} aria-label="Coming up">
        <div className={styles.stripItem}>
          <ClipboardCheck size="1.2em" aria-hidden="true" />
          <div>
            <h2>Next test</h2>
            <p>{nextTest ? `${nextTest.label}, ${shortDate(nextTest.date)}` : "Add next test"}</p>
          </div>
        </div>
        <div className={styles.stripItem}>
          <NotebookPen size="1.2em" aria-hidden="true" />
          <div>
            <h2>Due</h2>
            <p>
              {cls.keyDue?.text || "Add due items"}
              {cls.keyDue?.date ? `, ${shortDate(cls.keyDue.date)}` : ""}
            </p>
          </div>
        </div>
        {bigDate ? (
          <div className={styles.stripBig}>
            <Music size="1.2em" aria-hidden="true" />
            <div>
              <h2>{bigDate.label}</h2>
              <p>
                {shortDate(bigDate.date)}, {bigDate.time}
                <strong>{daysAway === 0 ? " · Today" : ` · ${daysAway} ${daysAway === 1 ? "day" : "days"}`}</strong>
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <div className={styles.main}>
        <section className={styles.plan}>
          <h2>
            <ListOrdered size="1em" aria-hidden="true" /> Today in class
          </h2>
          {plan ? (
            <div className={styles.planParts}>
              <div>
                <h3 className={styles.partTitle}>
                  <BookOpen size="1em" aria-hidden="true" /> Fundamentals and Lesson
                </h3>
                <List items={plan.fundamentals} empty="Add fundamentals" className={styles.planList} />
              </div>
              <div>
                <h3 className={styles.partTitle}>
                  <Music4 size="1em" aria-hidden="true" /> Rehearsal
                </h3>
                <List items={plan.rehearsal} empty="Add concert music" className={styles.planList} />
              </div>
            </div>
          ) : (
            <p className={styles.empty}>{isSchoolDay ? "Add plan" : "No class today."}</p>
          )}
        </section>

        <div className={styles.side}>
          <section className={styles.panel}>
            <h2>
              <Megaphone size="1em" aria-hidden="true" /> Announcements
            </h2>
            <List items={data.announcements} empty="No announcements." />
          </section>
          <section className={styles.panel}>
            <h2>
              <CalendarRange size="1em" aria-hidden="true" /> Next week
            </h2>
            <List items={[...(data.nextWeek?.program || []), ...(cls.nextWeek || [])]} empty="Add next week." />
          </section>
        </div>
      </div>

      <section className={styles.week} aria-label="This week">
        {(data.week || []).map((day) => {
          const due = cls.due?.[day.day] || [];
          return (
            <div key={day.date} className={day.date === today ? styles.dayToday : styles.day}>
              <h2>
                <CalendarDays size="0.9em" aria-hidden="true" /> {shortDate(day.date)}
              </h2>
              <List items={day.program} empty="" />
              {due.length ? (
                <div className={styles.due}>
                  <h3>Due</h3>
                  <List items={due} empty="" />
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
    </main>
  );
}
