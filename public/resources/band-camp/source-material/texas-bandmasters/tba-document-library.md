# Texas Bandmasters Document Library

Source: [Texas Bandmasters Association Document Library](https://texasbandmasters.org/document-library/)

Local catalog: `data/tba-document-library.csv`

Last catalog pull: 2026-05-24

## What This Is

The TBA document library is a large public collection of band-director handouts and Bandmasters Review articles. The local catalog has 1,396 document rows with title, category, tag/year, document id, and download URL.

Use this as a professional-reference mine, not as copied curriculum. The BDOS pattern is:

1. Pull source PDFs locally when needed.
2. Extract and review text.
3. Save distilled takeaways and Ashley-specific applications in `references/`.
4. Link back to the original document URL.

Raw PDFs are stored locally under `archives/source-pdfs/texas-bandmasters/` and ignored by git.

## Category Counts

- General: 172
- Motivation/Inspiration: 151
- Marching Band: 114
- Pedagogy-Ensemble: 106
- Pedagogy: 91
- Program Management: 81
- Conducting/Literature/Artistry: 67
- Pedagogy-Woodwind: 67
- Jazz: 55
- Pedagogy-Brass: 53
- Health/Wellness: 49
- Technology: 44
- Beginner Band: 41
- Beginner Band-Woodwind: 37
- Beginner Band-Brass: 35
- Recruiting/Retention: 34
- Pedagogy-Percussion: 30
- Small School: 29
- Featured Clinician: 28
- Marching Percussion: 21
- Band History: 17
- Title I: 17
- Boosters: 15
- Student Leadership: 14
- Composer: 14
- Marching Guard: 14
- Mariachi: 11
- Beginner Band-Percussion: 9
- Middle School: 4

## First Mining Queue

Priority for late May / early June 2026:

- Marching Band: season setup, design team, summer band systems, fall pacing.
- Recruiting/Retention: incoming freshman touches, parent trust, monthly communication.
- Student Leadership: selection, training, communication, accountability.
- Program Management: communication systems, staff roles, parent/admin trust.
- Pedagogy-Ensemble: fundamental systems that transfer from marching season to concert season.
- Beginner Band: recruiting and placement patterns that might transfer to Ashley feeder work.

## Completion Goal

Goal set 2026-05-24: finish mining the full TBA document library into BDOS as durable professional-reference pages.

Definition of done:

1. Every major category has either a distilled reference page or a clear note explaining why it was skipped/merged into another page.
2. All available source PDFs for processed categories are pulled into the ignored local archive.
3. Each synthesis page links back to source PDFs and translates the findings into Ashley/BDOS use.
4. `references/index.md` links every synthesis page.
5. This page records processed categories and remaining categories.

Progress:

- [x] Catalog pulled: 1,396 rows in `data/tba-document-library.csv`.
- [x] Local raw-PDF/text archive initialized under ignored `archives/source-pdfs/`.
- [x] Pedagogy-Ensemble: all 106 available PDFs processed -> [tba-ensemble-pedagogy.md](tba-ensemble-pedagogy.md).
- [x] Program Management: 79 of 81 rows with available PDFs processed -> [tba-program-management.md](tba-program-management.md).
- [x] Recruiting/Retention: 33 of 34 rows with available PDFs processed -> [tba-recruiting-retention.md](tba-recruiting-retention.md).
- [x] Student Leadership: 13 of 14 rows with available PDFs processed -> [tba-student-leadership.md](tba-student-leadership.md).
- [x] Marching Band: all 114 available PDFs processed -> [tba-marching-band.md](tba-marching-band.md). Starter season-planning subset remains at [tba-marching-band-season-planning.md](tba-marching-band-season-planning.md).
- [x] Beginner Band: all 41 available PDFs processed -> [tba-beginner-band.md](tba-beginner-band.md).
- [x] Pedagogy: all 91 available PDFs processed -> [tba-pedagogy.md](tba-pedagogy.md).
- [x] Conducting/Literature/Artistry: all 67 available PDFs processed -> [tba-conducting-literature-artistry.md](tba-conducting-literature-artistry.md).
- [x] Pedagogy-Woodwind, Pedagogy-Brass, Pedagogy-Percussion: all 150 available PDFs processed -> [tba-instrument-pedagogy.md](tba-instrument-pedagogy.md).
- [x] Jazz: all 55 available PDFs processed -> [tba-jazz.md](tba-jazz.md).
- [x] Health/Wellness: 48 of 49 rows with available PDFs processed -> [tba-health-wellness.md](tba-health-wellness.md).
- [x] Technology: all 44 available PDFs processed -> [tba-technology.md](tba-technology.md).
- [x] Small School and Title I: all 46 available PDFs processed -> [tba-small-school-title-i.md](tba-small-school-title-i.md).
- [x] Boosters: all 15 available PDFs processed -> [tba-boosters.md](tba-boosters.md).
- [x] Band History, Composer, Featured Clinician: 58 of 59 rows with available PDFs processed -> [tba-history-composers-clinicians.md](tba-history-composers-clinicians.md).
- [x] General: 171 of 172 rows with available PDFs processed -> [tba-professional-practice.md](tba-professional-practice.md).
- [x] Motivation/Inspiration: 149 of 151 rows with available PDFs processed -> [tba-motivation-inspiration.md](tba-motivation-inspiration.md).
- [x] Beginner Band-Brass, Beginner Band-Woodwind, Beginner Band-Percussion, Marching Guard, Marching Percussion, Mariachi, and Middle School: all 131 available PDFs processed -> [tba-specialized-program-lanes.md](tba-specialized-program-lanes.md).

Working order:

1. Beginner Band
2. Marching Band full category
3. Pedagogy + instrument pedagogy categories
4. Conducting/Literature/Artistry
5. Jazz, Health/Wellness, Technology, Small School, Title I, Boosters
6. Band History, Composer, Featured Clinician
7. General and Motivation/Inspiration, merged into focused pages where possible
8. Smaller specialist categories merged into [tba-specialized-program-lanes.md](tba-specialized-program-lanes.md)

## Starter Documents Pulled

- [A "Music First" Fundamental Approach to Marching Band](https://texasbandmasters.org/wp-content/uploads/2026/01/A-Music-First-Fundamental-Approach-to-Marching-Band-Clinicians-Rylon-Guidry-Kyle-Ayoub-Ryan-Dutton.pdf)
- [Communication with Your Design Team Heading into Summer Band](https://texasbandmasters.org/wp-content/uploads/2023/10/2022_6_robb.pdf)
- [Setting Up Your Marching Band for Success: Music Content and Performance Considerations](https://texasbandmasters.org/wp-content/uploads/2024/08/Setting-Up-Your-Marching-Band-for-Success-Music-Content-and-Performance-Considerations.pdf)
- [The Complete Marching Season, Part 1: The Spring Semester](https://texasbandmasters.org/wp-content/uploads/2023/11/The-Complete-Marching-Season-Part-1-The-Spring-Semester-Chreste-Spicer.pdf)
- [The Complete Marching Season, Part 2: Summer Band](https://texasbandmasters.org/wp-content/uploads/2023/11/The-Complete-Marching-Season-Part-2-Summer-Band-Selaiden.pdf)
- [The Complete Marching Season, Part 3: The Fall Semester](https://texasbandmasters.org/wp-content/uploads/2023/11/The-Complete-Marching-Season-Part-3-The-Fall-Semester-Howard.pdf)
- [The Complete Marching Season, Part 4: The Cleaning Process](https://texasbandmasters.org/wp-content/uploads/2023/11/The-Complete-Marching-Season-Part-4-The-Cleaning-Process-Chreste.pdf)
- [The Complete Marching Season, Part 5: Student Leadership](https://texasbandmasters.org/wp-content/uploads/2023/11/The-Complete-Marching-Season-Part-5-Student-Leadership-Spicer.pdf)
- [Training Student Leaders for Lasting Impact](https://texasbandmasters.org/wp-content/uploads/2026/01/2025_4_Spicer.pdf)
- ["Be Our Guest" Creating Recruiting/Retention Events and Activities](https://texasbandmasters.org/wp-content/uploads/2023/10/2023_dixon.pdf)
- [Selling Your Program, the 3 R's: Recruitment, Retention, Rally](https://texasbandmasters.org/wp-content/uploads/2024/08/Selling-Your-Program-the-3-R-s-Recruitment-Retention-Rally.pdf)

## Processed Mining Pages

- [tba-marching-band-season-planning.md](tba-marching-band-season-planning.md) — starter marching-band season planning set.
- [tba-marching-band.md](tba-marching-band.md) — all available Marching Band category PDFs.
- [tba-motivation-inspiration.md](tba-motivation-inspiration.md) — 149 of 151 Motivation/Inspiration rows with available PDFs.
- [tba-beginner-band.md](tba-beginner-band.md) — all available Beginner Band category PDFs.
- [tba-conducting-literature-artistry.md](tba-conducting-literature-artistry.md) — all available Conducting/Literature/Artistry category PDFs.
- [tba-ensemble-pedagogy.md](tba-ensemble-pedagogy.md) — all available Pedagogy-Ensemble category PDFs.
- [tba-health-wellness.md](tba-health-wellness.md) — 48 of 49 Health/Wellness rows with available PDFs.
- [tba-history-composers-clinicians.md](tba-history-composers-clinicians.md) — Band History, Composer, and Featured Clinician categories merged.
- [tba-instrument-pedagogy.md](tba-instrument-pedagogy.md) — all available Pedagogy-Woodwind, Pedagogy-Brass, and Pedagogy-Percussion category PDFs.
- [tba-jazz.md](tba-jazz.md) — all available Jazz category PDFs.
- [tba-pedagogy.md](tba-pedagogy.md) — all available Pedagogy category PDFs.
- [tba-professional-practice.md](tba-professional-practice.md) — 171 of 172 General rows with available PDFs.
- [tba-program-management.md](tba-program-management.md) — all available Program Management category PDFs.
- [tba-recruiting-retention.md](tba-recruiting-retention.md) — all available Recruiting/Retention category PDFs.
- [tba-small-school-title-i.md](tba-small-school-title-i.md) — Small School and Title I categories merged.
- [tba-specialized-program-lanes.md](tba-specialized-program-lanes.md) — Beginner Band-Brass, Beginner Band-Woodwind, Beginner Band-Percussion, Marching Guard, Marching Percussion, Mariachi, and Middle School categories merged.
- [tba-student-leadership.md](tba-student-leadership.md) — all available Student Leadership category PDFs.
- [tba-boosters.md](tba-boosters.md) — all available Boosters category PDFs.
- [tba-technology.md](tba-technology.md) — all available Technology category PDFs.

## Known Gaps

Nine catalog rows did not expose a download URL in the table response during the 2026-05-24 pull. They were all tagged `2026 BMR April`, including:

- Building a Cost-Free Advantage-Creating Systems that Sustain!
- Selecting Student Leaders: Looking Beyond Talent and Toward Trust
- The Summer Advantage: Off-Season Strategies for Band Program Growth

Recheck the website later before assuming these are unavailable.

Additional processed-category gap:

- Health/Wellness: `The Long Game: A Guide for a Joyful & Sustainable Career` did not expose a download URL during processing.
- Featured Clinician: `An Interview with Randall Standridge-TBA Featured Composer` did not expose a download URL during processing.
- General: `Adjudicators x Directors - A Partnership for Progress` did not expose a download URL during processing.
- Motivation/Inspiration: `Sometimes All it Takes is One Word` and `The One Choice We Have: Our Attitude!` did not expose download URLs during processing.
