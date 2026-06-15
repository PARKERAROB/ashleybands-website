// Concert program intro slides — UNCW Summer Concert Band, 2026-06-15.
// These WRAP the Band of Heroes interactive finale: one parchment title card per
// piece + an intermission card, shown on the projected display between works. The
// driver advances them like any narrative slide; the last card flows into the Band
// of Heroes cover (slide 1), which is itself the title for the closing piece.
//
// Unlike slides.js (auto-generated from Svanoe's deck — do NOT hand-edit), THIS file
// is hand-maintained. Edit titles/years/dates freely.
//
//   kind: "program"       title card — title, composer + life dates, composition year
//   kind: "intermission"  the intermission card
//   program: true         flags non-adventure slides so the display hides the vote QR
//   ids start at 1001 so they never collide with the 1..102 adventure deck.
//
// Dates verified against sources 2026-06-15 (Barnes Alvamar = 1981 not 1882; Hisaishi
// b. 1950 and living; Anderson 1908-1975, Typewriter composed 1950). Rob's call on titles.

export const PROGRAM_START = 1000;

export const programSlides = [
  { id: 1000, kind: "image", program: true, scene: "Welcome",
    image: "/band-of-heroes/summer-band-flyer.png", alt: "UNCW Summer Concert Band 2026 — Kenan Auditorium, Monday June 15, 7:30 PM", next: 1001 },
  { id: 1001, kind: "program", program: true, scene: "Program",
    title: "Alvamar Overture", composer: "James Barnes", life: "b. 1949", year: "1981", next: 1002 },
  { id: 1002, kind: "program", program: true, scene: "Program",
    title: "Children’s March", composer: "Percy Grainger", life: "1882–1961", year: "1916", next: 1003 },
  { id: 1003, kind: "program", program: true, scene: "Program",
    title: "Foundry", composer: "John Mackey", life: "b. 1973", year: "2010", next: 1004 },
  { id: 1004, kind: "intermission", program: true, scene: "Intermission",
    title: "Intermission", next: 1005 },
  { id: 1005, kind: "program", program: true, scene: "Program",
    title: "The Legend of Ashitaka", composer: "Joe Hisaishi", life: "b. 1950", year: "1997", next: 1006 },
  { id: 1006, kind: "program", program: true, scene: "Program",
    title: "The Typewriter", composer: "Leroy Anderson", life: "1908–1975", year: "1950", next: 1 },
];
