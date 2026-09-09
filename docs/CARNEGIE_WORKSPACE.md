# Private Carnegie coordination workspace

Route: `/carnegie-2027/team`. API: `/api/carnegie-2027/team` and its `files`, `package`,
and `import` routes. All data operations require a validated existing staff session. The page
contains only the sign-in shell until the server authorizes a read. Every response is private/no-store.

Workspace entry checks the server session directly; localStorage is display state, never the entry
authority. Missing/expired sessions receive a Sign in link to `/carnegie-2027/team/sign-in`, which
uses the existing staff Email/PIN form and `/api/sponsors/staff-auth`. Successful sign-in performs a
fixed return to `/carnegie-2027/team`; there is no caller-controlled redirect. An authenticated but
unassigned account receives separate access guidance and can choose another account. Temporary
failures offer read-only retry, without an automatic sign-in loop. Sign-in connection failures stay
on the form with an actionable message.

## Access and initial activation

The existing director role is broader than the initial coordination audience. Access therefore
requires either the singleton's `primary_owner_id` **and** an active director role, or an explicit
`carnegie_workspace_members` row for an active staff account. No campaign role, other director,
family cookie, browser display state or public Supabase key grants access.

The migration seeds an empty workspace and private bucket, with no owner identity or membership.
Deployment may designate the requesting director's existing account as primary owner through a
narrow, audited database configuration step after verifying that identity. This restricts the
existing director authority; it does not create an account, issue a credential, send an invitation,
or grant access to another person. The initial primary owner has program and coordination domains.
Other people's named access and domains require explicit approval before inserting membership rows.
There is intentionally no membership-management UI or public grant endpoint in this version.

Before activating another member, verify the exact existing staff identity, approved document
audience and domain(s): `coordination`, `program`, `finance`. The member can read all workspace
material; domains limit ownership/confirmation, not read visibility. Do not put narrower-audience
financial, student, bank or diligence records here. Revoking membership blocks future API operations;
already downloaded files cannot be recalled. Disabling the underlying staff account also blocks access.

## State and provenance

- Facts, milestones and decisions start unconfirmed. An eligible owner is explicit. Only that owner
  can confirm or accept/reject proposed replacements. Financial confirmation requires a finance owner.
- Proposals record a base record version, source, optional immutable document ID, proposer and review
  actor. A stale proposal is visible but cannot be accepted; review the new record and propose again.
- Any authorized member can request work. Only its recipient can accept/decline or transition it.
  A suggested date is separate from the accepted date. Waiting and completion retain owner,
  acceptance time and acceptance actor. Completion can be reopened only by the owner.
- Every successful write performs one compare-and-swap over the shared revision and appends an
  immutable snapshot/actor/source in the same SQL transaction. Concurrent saves return 409 and
  preserve user inputs for comparison. No silent last-writer overwrite or automatic retries.
- The UI shows the latest 100 history entries; any known revision is downloadable as private JSON.
  Historical snapshots retain their source values and actor IDs, without storage paths or credentials.
  Reads/downloads also call the existing audit logger. Snapshot history is required for write success.

The initial workspace is empty. It is not a projection of the private Area records until a reviewed,
authorized import occurs. The Area remains the source for pre-existing project facts; no OneDrive
migration or synchronization is implied. Uploads alone do not change confirmed values.

## Documents and AI roundtrip

An uploader owns a document series. Each upload creates a random immutable object key, checksum,
source and content preview. Only the owner can label a version current/received/needs correction.
Current working status does not confirm every statement in the file. Latest received stays visibly
separate from the selected working version. Earlier versions remain downloadable.

DOCX/XLSX only, maximum 3 MB compressed; bounded to 300 archive entries, 12 MB expanded, 6 MB per
entry and 120,000 preview characters. Reject unsafe paths, duplicate entries, DTD/entities, macros,
embedded objects, external data/templates and malformed XML. Scan XML text for common credential
labels. All preview content renders as escaped text; formulas are shown with cached values and
never evaluated. Images/layout/comments/tracked changes are not fully represented. No Office
browser editor, paid AI service or automatic semantic reconciliation is included.

The uploader must review the **entire original**, including hidden cells, comments, metadata and
images, and remove credentials/bank instructions/out-of-scope material before upload. The heuristic
scanner cannot establish that arbitrary content is free of secrets. Preserve untouched source
originals in the approved restricted source home. Review a separate clean working copy for import.

The ZIP package contains structured current state and unresolved proposals, people/domain metadata,
the current working and latest received files, a proposal template and AI instructions. It excludes
staff email, login tokens, secrets and object paths. Maximum selected document payload is 30 MB;
older versions can be downloaded individually. Imported JSON creates pending proposals only and
checks each record's base version. It cannot accept commitments or confirm facts. Ordinary Word/Excel
edits require human comparison and explicit proposals; no fake change-detection claim is made.

## Storage, limits and recovery

Three RLS-protected tables and one private bucket use only service-role server access. There are no
public object policies or signed/public storage URLs. Downloads resolve a document ID through the
authorized state, check bucket privacy and verify SHA-256 before returning attachment bytes.
History cannot be updated/deleted by the service role. A failed concurrent upload can leave an
inaccessible orphan object; retain it until an explicitly reviewed maintenance action. Never
silently delete or overwrite files to recover a failed save.

Each collection is bounded to 500 items, with a 3.5-million-character application state limit and
4 MB database limit. Full immutable snapshots intentionally favor recoverability for this small
workspace; reassess storage/retention before broad rollout. Existing services only; no new paid
subscription is required or created. Authenticated upload and export are deliberately bounded.

Application rollback: revert the application commit through the checked release. Leave the additive
tables, private bucket and immutable evidence intact. Removing membership or clearing primary-owner
configuration closes access without deleting evidence. Real imports, grants and destructive cleanup
are separate authorized operations.

## Verification

- `npm run test:carnegie-workspace`: owner, proposal/conflict, commitment and Office safety checks.
- `node --test scripts/carnegie-workspace-http.test.mjs`: actual Next routes against an isolated
  synthetic backend, including unauthorized/wrong-role/other-director, origin, upload/download,
  package, structured import and concurrent-save checks. Port 4319 must be free. Set
  `PLAYWRIGHT_MODULE` to an installed Playwright module for desktop/390px UI screenshots and checks.
- `npm run supabase:production -- db query --linked --file scripts/carnegie-workspace-transaction-test.sql`:
  synthetic rollback-only SQL proof after applying the migration. No real workspace values persist.
- Checked release and direct final-alias privacy/authorized readback remain required.
