# AshleyBands website Jira-grade workflow

This is the canonical work-management procedure for `ashleybands.com`. It provides Jira-grade
discipline using GitHub Issues, repository checks, and the existing checked deployment process. Jira
is not required. — Rob, 2026-09-02, #24

Visual board: [AshleyBands Website Project](https://github.com/users/parkerarob/projects/4). `Backlog`
on the board corresponds to the `status: inbox` issue label. The issue and its labels remain the
durable record when the board and issue temporarily disagree.

Every agent must read this file in full before inspecting, planning, editing, running commands, or
changing external state in this repository.

## The operating promise

Rob may ask for work in ordinary language. The agent, not Rob, translates the request into a
traceable work item. The system must preserve speed without allowing scope, privacy, verification,
or unfinished deployment work to disappear.

One bounded outcome equals one GitHub issue. Do not create a ticket for every thought or
conversation. Read-only explanation and initial diagnosis may occur without an issue, but any
meaningful repository edit or external mutation requires one before implementation begins.

Because this repository is public, issues, titles, branches, commits, test fixtures, screenshots,
and logs must be sanitized. Never place student or family identities, contact details, credentials,
private measurements, payment details, attendance details, or other private program facts in GitHub.
Keep those facts in their canonical private homes and refer to them only by a safe internal case label
when a work item needs traceability.

## Intake: turn a request into a work item

First find an existing issue that owns the outcome. If none exists and Rob has requested a bounded
change, create a sanitized issue using the Website change form. The issue must contain:

1. **Outcome:** what will be observably different when the work is complete.
2. **Reason:** the problem or value, without private facts.
3. **Scope:** what is included and what must remain unchanged.
4. **Canonical source:** the file, database contract, or private Area record that owns the truth.
5. **Risk and privacy:** public-content, private-data, authentication, payment, communication,
   migration, or destructive-action boundaries.
6. **Acceptance checks:** concrete evidence that proves the outcome.
7. **Release instruction:** investigate only, prepare without deploying, or complete and deploy.

If Rob says **change**, **fix**, **build**, **add**, **remove**, or otherwise asks for an actual website
outcome, treat the request as authorization to implement, test, commit, push, and use the checked
production deployment when deployment is necessary to deliver that outcome. A phrase such as
**investigate only**, **draft only**, **local only**, or **do not deploy** narrows that authority.
Existing authority and human-communication boundaries in `CLAUDE.md` still apply.

If the outcome is materially ambiguous, ask one plain-language question. Do not make Rob design the
ticket or choose technical fields.

## Workflow states

Every open change issue has exactly one `status:` label.

| State | Meaning | Exit condition |
|---|---|---|
| `status: inbox` | Captured but not yet safe to start | Readiness fields are complete |
| `status: ready` | Outcome and proof are defined | An agent begins the work |
| `status: in progress` | One agent owns active implementation | Implementation is ready for final proof |
| `status: verify live` | Code may be complete; release evidence is not | Required local, CI, deployment, and live checks pass |
| `status: blocked` | A named external decision or condition prevents progress | The blocker is resolved and recorded |
| Closed issue | Done or deliberately declined | Completion or disposition is recorded |

Use one `type:` label and the highest applicable `risk:` label. Project-board views may mirror these
fields, but the issue remains the durable record.

## Definition of ready

An issue is `status: ready` only when:

- the observable outcome is clear;
- the authoritative source is identified;
- included and excluded scope are understandable;
- privacy and authority boundaries are named;
- acceptance checks are executable;
- release intent is explicit or safely inferable under the intake rule above; and
- there is no unanswered decision that would materially change the implementation.

An agent may complete these fields from repository evidence. Do not interrupt Rob for information
that can be safely retrieved.

## Execution rules

1. Move the issue to `status: in progress` before editing and leave a short start comment naming the
   intended outcome and checks.
2. Inspect the worktree before editing. Preserve unrelated user changes and stage named paths only.
3. Follow `INDEX.md`, `CLAUDE.md`, canonical source rules, privacy boundaries, and migration rules.
4. Keep one active issue per agent. Concurrent agents must own different issues and must not edit the
   same files without explicit coordination.
5. Reference the issue in substantive commit messages with `(#N)`. Narrow Rob-authored deployment
   authorization commits may instead reference the issue in the commit body when needed.
6. Record newly discovered scope as a comment. Open a separate issue when it is a different outcome;
   do not silently expand the active issue.
7. Never report a plan, passing local test, `READY` deployment, or saved draft as an observed final
   outcome.

### Emergency containment

If the live site is exposing private data, accepting unsafe writes, mischarging money, or causing
comparable active harm, contain the harm first when delay would increase it. Open or update the issue
at the first safe pause, state why the emergency lane was used, and complete all normal evidence and
closure steps afterward. This exception does not authorize human communication, spending, destructive
data repair, or concealment of uncertainty.

## Verification by risk

Run the narrowest relevant tests during implementation, then the required repository checks before
release. Add these proofs for higher-risk changes:

| Change type | Required additional proof |
|---|---|
| Public content or dates | Correct canonical source, regenerated projections, direct route readback |
| Authentication or authorization | Negative unauthorized probe plus intended authorized path |
| Person data | Provenance, audit logging, least-data response, privacy test |
| Database migration | Forward-only migration review, production project identity, post-apply readback |
| Payments or billing | Idempotency, ledger state, no accidental live charge, reconciliation readback |
| Broadcast or newsletter | Exact audience preview and Rob-controlled send boundary; never send silently |
| Deployment | `npm run deploy:checked` and direct verification of the final public alias |

Move the issue to `status: verify live` when implementation is complete but any required release or
live proof remains outstanding.

## Definition of done

Close an issue only when all applicable conditions are true:

- the requested outcome exists in the correct canonical source and implementation;
- focused tests and required repository checks passed;
- substantive changes are committed and pushed to real `main`;
- CI passed, or a documented equivalent check explains why CI does not apply;
- production work passed `npm run deploy:checked`;
- the final `ashleybands.com` alias, affected route, privacy headers, generated assets, and relevant
  live behavior were directly verified;
- no private data entered the public repository, issue, logs, or artifacts;
- the issue has a concise completion comment containing changed, evidence, remaining exposure, and
  rollback or recovery information when relevant; and
- follow-up outcomes have their own issues instead of being hidden in the closure note.

If work is intentionally not completed, close it only with a clear declined, duplicate, or superseded
disposition. `status: blocked` issues stay open.

## Routine hygiene

- Review the open issue list weekly. Clarify, close, defer, or deliberately retain every stale item.
- Do not use issue count as a substitute for judgment. Prioritize live safety, time-bound family
  needs, and blockers before convenience improvements.
- Keep operational facts in their owning Area or repository home. Issues hold open work and the
  append-only discussion, not duplicate databases or private records.
- Improve this workflow when observed use exposes a gap. Change the canonical file, its agent
  pointers, templates, and validation together.

## Rob's request guide

`docs/HOW_TO_REQUEST_A_CHANGE.md` explains the shortest correct way to ask for changes, bugs,
investigations, urgent containment, content updates, and private-data work. Agents must honor ordinary
language and must not require Rob to speak in ticket syntax.
