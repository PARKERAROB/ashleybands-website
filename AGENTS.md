# Ashley Bands website — Codex entry point

## Required first read for every agent

Before inspecting, planning, editing, running commands, or changing external state in this repository,
read [`PROJECT_WORKFLOW.md`](PROJECT_WORKFLOW.md) in full. It is the canonical Jira-grade workflow
for all website work. A repository change must have a sanitized GitHub issue and satisfy that
workflow's readiness and completion rules. This requirement applies to every coding agent and every
entry path into the repository.

The canonical thinking and coordination surface for Rob Parker's work is
`/Users/parkerarob/workdesk`. Before acting, read its `AGENTS.md` and `CLAUDE.md`.

This repository is a legitimate Codex root for a bounded website build. If the request is still
cross-Area thinking, assurance, or prioritization, use the workdesk task. Do not reconstruct an
operating layer from historical assistant repositories or memory.

Read `CLAUDE.md` for project mechanics, privacy boundaries, and verification commands; the desk
remains the operating context. When instructions conflict, the stricter privacy, authority, or
verification boundary wins.

Codex Area hooks in `.codex/hooks.json` reuse `.claude/settings.json` through the shared workdesk
adapter. New definitions must be reviewed in Codex `/hooks`; installed configuration alone does not
prove runtime enforcement. The checks supplement the repository instructions and checked commands.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
