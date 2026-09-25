# AshleyBands website

Before repository work, read PROJECT_WORKFLOW.md in full. Every meaningful change requires a sanitized issue. Read Workdesk context; use INDEX.md for source and implementation ownership.

Public Next.js/Vercel/Supabase application for private ~/Atlas/BandsofAHS records. Only sanitized projections, website-owned content, and application code belong here.

## Sources

- Edit content/sources/ markdown, then npm run content:build; never hand-edit generated content/*.json.
- Program dates belong in ~/Atlas/BandsofAHS/data/calendar-events.jsonl. Regenerate with python3 ~/Atlas/BandsofAHS/scripts/render_calendar.py --write; never hand-edit public/calendar.ics, public/calendar-data.json, or BandsofAHS data/calendar-2026.csv. Run npm run integration:doctor and /check-site-dates before shipping dates.
- Public voice: short sentences, no em dashes, “Mr. Parker,” and “Ashley.” Read ~/Atlas/BandsofAHS/references/voice.md and Workdesk's draft-time voice sources.

## Portal and data

- Family-owned profile/contact changes and roster-matched access auto-apply. A verified email with a roster match gets a trusted link. /admin/profile-requests is an audit log; no-match requests need follow-up, not approval. Never add an approval gate for these changes. Decision: docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md.
- Participation/placement corrections change roster-owned facts and remain staff-reviewed: supabase/migrations/0040_participation_change_requests.sql and app/api/portal/participation-request/route.js.
- No grades, coursework, GPA, or required-for-class features.
- Rob's roster notes are private staff notes and never reach families. portal_students.notes is the family-visible "Family notes" field: family-entered text only, never roster notes or staff stamps. sync-portal-csv.mjs --check fails if staff notes appear there. — Rob, 2026-09-25, #117
- Guardian contacts, personal student emails, and phones are family-owned. sync-portal-csv.mjs may mirror canonical @student.nhcs.net addresses from BandsofAHS students.csv as unverified; successful code entry sets verified_email_code.
- New person-data tables/columns require source provenance, via a source/source_* column or -- provenance: comment in the migration. Run npm run lint:provenance; retain its existing baseline exemptions.
- Every admin route reading or writing person data calls logAudit from lib/auditLog.js with actor and action. Logging failure must not block the request.
- Standing database access is read-only; writes require task authorization. Use established ignored .env.local credentials (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY) with PostgREST; never expose them.
- students is the CSV roster projection; portal_students is portal identity. portal_student_measurements.student_id references portal_students.id, not students.id. Verify joins before interpreting an empty result. Measurement source records provenance; portal_self_edit means family entry. Report a minor's submission presence, time, and provenance, not body measurements. Requery current counts.
- Resend broadcasts and send queues are draft/stage only; Rob sends.

## Release

- Local visual checks: npm run preview:shots -- /route. npm run dev is write-guarded; ALLOW_LOCAL_WRITES=1 needs task authorization. docs/LOCAL_PREVIEW.md.
- docs/RELEASING.md owns setup, validation, publication, final-alias proof, and recovery. Use npm run release:checked; deploy:checked is its compatibility alias. Never bypass the wrapper or deploy:preflight.
- Production Supabase CLI commands use npm run supabase:production -- <command>; it validates the project and clears stale token overrides.
