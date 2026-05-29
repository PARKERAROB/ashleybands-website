# Student Instrument Dashboard Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Extend the existing instrument inventory page so students can browse all safe-to-show school instruments and submit repair/location updates for a selected instrument.

**Architecture:** Keep BDOS CSVs as canonical. Generate a sanitized public JSON snapshot from `~/Desktop/BandDirectorOS/data/instrument-inventory-merged.csv` into the website. The public API serves the snapshot and accepts student observations into Supabase `instrument_inventory`; observations remain a review queue and do not mutate canonical inventory.

**Tech Stack:** Next.js App Router, React client page, Supabase service client, Node CSV snapshot script, existing staff auth.

---

## Safety decisions

- Students may see all instruments, but not assignment, lock numbers, combinations, internal notes, valuation, PO, or purchase data.
- Student submissions are observations/reports only. They go into Supabase review queue and do not update BDOS CSVs directly.
- Public snapshot fields: `asset_id`, `instrument_type`, `brand`, `model`, `model_markings`, `serial_number`, `finish`, `key_pitch`, `level`, `condition`, `play_status`, `location`, `locker`, `visible_issues`, `repair_needed`, `repair_priority`, `last_verified_date`.

## Task 1: Add sanitized snapshot generator

**Objective:** Generate website-local `content/instruments-public.json` from BDOS merged inventory without exposing private columns.

**Files:**
- Create: `scripts/build-instruments-public.mjs`
- Modify: `package.json`
- Create output: `content/instruments-public.json`

**Steps:**
1. Implement a small CSV parser or reuse a robust local parser in Node stdlib style.
2. Read `/Users/parkerarob/Desktop/BandDirectorOS/data/instrument-inventory-merged.csv`.
3. Map only safe public fields.
4. Sort by `instrument_type`, then `brand`, then `asset_id`.
5. Write JSON with `{ generatedAt, source, count, instruments }`.
6. Add npm script `instruments:build`.
7. Run `npm run instruments:build`.

## Task 2: Extend Supabase schema for linked student reports

**Objective:** Let student submissions reference a canonical instrument and include location/repair update fields.

**Files:**
- Create: `supabase/migrations/0010_instrument_inventory_student_updates.sql`
- Modify: `app/api/instrument-inventory/route.js`
- Modify: `app/api/instrument-inventory/admin/route.js` only if needed for display ordering.

**Schema additions:**
- `asset_id text not null default ''`
- `locker text not null default ''`
- `location text not null default ''`
- `repair_needed text not null default ''`
- `repair_priority text not null default ''`

## Task 3: Add public inventory GET API

**Objective:** `GET /api/instrument-inventory` returns sanitized instruments and maybe selected reviewed reports later.

**Files:**
- Modify: `app/api/instrument-inventory/route.js`

**Behavior:**
- GET reads `content/instruments-public.json` from process cwd.
- Returns `{ instruments, generatedAt, count }`.
- If file missing, returns empty list with status 200 and warning.

## Task 4: Rebuild student page into dashboard + report form

**Objective:** Students can search/filter all instruments, select one, and submit a report for repair/location/locker updates.

**Files:**
- Modify: `app/instrument-inventory/page.jsx`

**UI:**
- Top: purpose note: “Browse school instruments and send Mr. Parker a repair/location update.”
- Search input.
- Filter by instrument type and repair status.
- List/table cards showing asset ID, type, brand/model, serial, location/locker, play status, repair status.
- Clicking an instrument pre-fills selected instrument in the report form.
- Report form includes: selected asset ID, submitted_by, locker, location, repair_needed, condition_notes, visible_damage, missing_parts, plays, case_present, mouthpiece_present, optional voice transcript.

## Task 5: Improve admin review display

**Objective:** Staff review queue clearly shows which canonical instrument a student report is about.

**Files:**
- Modify: `app/admin/instrument-inventory/page.jsx`

**Display additions:**
- asset_id in card heading.
- locker/location rows.
- repair_needed and repair_priority rows.

## Task 6: Verify

**Commands:**
- `npm run instruments:build`
- `npm run lint`
- `npm run build`

**Expected:**
- Snapshot created.
- Lint passes or only pre-existing warnings.
- Build passes.

## Task 7: Cost ledger

Track model routing by task:
- Main architecture/planning: gpt-5.5 via openai-codex.
- Implementation subagent: openrouter/pareto-code.
- Review subagent: openrouter/pareto-code unless done in main.
- Auxiliary summaries/titles: OWL Alpha or Gemini Flash if used.

Report actual token/cost if surfaced by Hermes; otherwise estimate using OpenRouter pricing metadata and clearly label pareto-code as variable-priced router.
